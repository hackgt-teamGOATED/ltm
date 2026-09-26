// Unit tests for the database-free parts of the learning layer. Run: npm test -w server
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { RawAnalysis } from '../ai.js';
import { HttpError } from '../http.js';
import { AnalysisInvalid, alignAnalysis, attachTimings } from './align.js';
import { MAX_EVENT_AGE_MS, parseEvent } from './events.js';
import { pendingKeys, runExclusive } from './queue.js';

type RawToken = RawAnalysis['tokens'][number];
const tok = (surface: string, lemma: string, gloss: string, tw: string[], extra: Partial<RawToken> = {}): RawToken => ({
  surface,
  lemma,
  romanization: null,
  gloss,
  pos: null,
  grammar: null,
  isPunct: false,
  translationWords: tw,
  ...extra,
});
const raw = (tokens: RawToken[], phrases: RawAnalysis['phrases'] = []): RawAnalysis => ({
  translation: '',
  tokens,
  phrases,
});

// ---- parseEvent (review #4) ----

const NOW = Date.UTC(2026, 8, 26);
const good = { lemma: 'casa', lang: 'es', type: 'read_unaided' };

test('parseEvent accepts a valid event and defaults `at` to now', () => {
  assert.equal(parseEvent(good, NOW).at, NOW);
  assert.equal(parseEvent({ ...good, at: NOW - 1000 }, NOW).at, NOW - 1000);
});

test('parseEvent clamps future timestamps to now', () => {
  assert.equal(parseEvent({ ...good, at: NOW + 1e9 }, NOW).at, NOW);
});

test('parseEvent rejects absurd or malformed timestamps with a 400', () => {
  for (const at of [-1e20, NOW - MAX_EVENT_AGE_MS - 1, Number.NaN, Number.POSITIVE_INFINITY, '123']) {
    assert.throws(
      () => parseEvent({ ...good, at }, NOW),
      (e: unknown) => e instanceof HttpError && e.status === 400,
      `at=${String(at)}`,
    );
  }
});

test('parseEvent rejects bad lemma, lang and type with a 400', () => {
  for (const bad of [{ ...good, lemma: '' }, { ...good, lang: 'fr' }, { ...good, type: 'hack' }, null]) {
    assert.throws(
      () => parseEvent(bad, NOW),
      (e: unknown) => e instanceof HttpError && e.status === 400,
    );
  }
});

test('parseEvent drops ids that are not UUIDs', () => {
  const e = parseEvent({ ...good, threadId: 'x; drop table', messageId: '00000000-0000-0000-0000-0000000000a2' }, NOW);
  assert.equal(e.threadId, null);
  assert.equal(e.messageId, '00000000-0000-0000-0000-0000000000a2');
});

// ---- runExclusive (review #1) ----

test('runExclusive: a failing job rejects only its own caller, never unhandled, and the next job still runs', async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  try {
    const order: string[] = [];
    const a = runExclusive('p1', async () => {
      order.push('a');
      throw new Error('boom');
    });
    const b = runExclusive('p1', async () => {
      order.push('b');
      return 2;
    });
    await assert.rejects(a, /boom/);
    assert.equal(await b, 2);
    assert.deepEqual(order, ['a', 'b']);
    await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(unhandled, []);
    assert.equal(pendingKeys(), 0);
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('runExclusive runs one key strictly in order', async () => {
  const seen: number[] = [];
  const slow = (n: number, ms: number) => runExclusive('p2', () => new Promise<void>((r) => setTimeout(() => r(void seen.push(n)), ms)));
  await Promise.all([slow(1, 30), slow(2, 1), slow(3, 10)]);
  assert.deepEqual(seen, [1, 2, 3]);
});

// ---- alignAnalysis (review #5 + model-output edge cases) ----

test('align: Spanish idiom, missing comma token, spans into the translation', () => {
  const es = '¡Hola mijo, me muero de hambre!';
  const tr = 'Hi sweetie, I am starving!';
  const a = alignAnalysis(
    es,
    raw(
      [
        tok('¡', '¡', '', [], { isPunct: true }),
        tok('Hola', 'hola', 'hi', ['Hi']),
        tok('mijo', 'mijo', 'sweetie', ['sweetie']),
        tok('me', 'me', 'myself', []),
        tok('muero', 'morir', 'die', []),
        tok('de', 'de', 'of', []),
        tok('hambre', 'hambre', 'hunger', []),
        tok('!', '!', '', [], { isPunct: true }),
      ],
      [{ tokenIndices: [3, 4, 5, 6], meaning: 'I am starving', isIdiom: true, culture: null, translationWords: ['I am starving'] }],
    ),
    tr,
    false,
  );
  assert.equal(a.tokens.map((t) => t.pre + t.surface).join(''), es);
  assert.deepEqual(
    a.tokens.map((t) => t.surface),
    ['¡', 'Hola', 'mijo', ',', 'me', 'muero', 'de', 'hambre', '!'],
  );
  assert.equal(a.tokens[3].isPunct, true);
  assert.deepEqual(a.tokens[2].tSpans, [[3, 10]]);
  const span = a.phrases[0].tSpans?.[0] as [number, number];
  assert.equal(tr.slice(...span), 'I am starving');
  assert.deepEqual(a.phrases[0].tokenIndices, [4, 5, 6, 7]);
});

test('align: case-insensitive fallback works when the translation is already lowercase (review #5)', () => {
  const a = alignAnalysis('Hola', raw([tok('Hola', 'hola', 'hi', ['Hi'])]), 'hi there', false);
  assert.deepEqual(a.tokens[0].tSpans, [[0, 2]]);
});

test('align: Urdu keeps right-to-left text intact and requires romanization', () => {
  const ur = 'آج بہت گرمی ہے۔';
  const tr = 'It is very hot today.';
  const b = alignAnalysis(
    ur,
    raw([
      tok('آج', 'آج', 'today', ['today'], { romanization: 'aaj' }),
      tok('بہت', 'بہت', 'very', ['very'], { romanization: 'bohat' }),
      tok('گرمی', 'گرمی', 'heat', ['hot'], { romanization: 'garmi' }),
      tok('ہے', 'ہونا', 'is', ['is'], { romanization: 'hai' }),
      tok('۔', '۔', '', [], { isPunct: true }),
    ]),
    tr,
    true,
  );
  assert.equal(b.tokens.map((t) => t.pre + t.surface).join(''), ur);
  assert.equal(tr.slice(...((b.tokens[0].tSpans ?? [])[0] as [number, number])), 'today');
  assert.throws(() => alignAnalysis('آج', raw([tok('آج', 'آج', 'today', [])]), 'today', true), AnalysisInvalid);
});

test('align: skipped words are invalid; hallucinated translation words just get no span', () => {
  assert.throws(() => alignAnalysis('hola mijo', raw([tok('hola', 'hola', 'hi', [])]), 'hi', false), AnalysisInvalid);
  const c = alignAnalysis('hola', raw([tok('hola', 'hola', 'hi', ['hello'])]), 'hi', false);
  assert.equal(c.tokens[0].tSpans, undefined);
});

test('align: a repeated word claims a different span each time', () => {
  const d = alignAnalysis('sí sí', raw([tok('sí', 'sí', 'yes', ['yes']), tok('sí', 'sí', 'yes', ['yes'])]), 'yes yes', false);
  assert.deepEqual(
    d.tokens.map((t) => t.tSpans),
    [[[0, 3]], [[4, 7]]],
  );
});

test('attachTimings matches Whisper words in order on normalized surface', () => {
  const a = alignAnalysis(
    'Hola mijo, me',
    raw([tok('Hola', 'hola', 'hi', []), tok('mijo', 'mijo', 'sweetie', []), tok('me', 'me', 'me', [])]),
    'x',
    false,
  );
  attachTimings(a.tokens, [
    { word: 'Hola', start: 0, end: 0.4 },
    { word: 'mijo,', start: 0.4, end: 0.8 },
    { word: 'me', start: 0.9, end: 1 },
  ]);
  assert.equal(a.tokens[1].end, 0.8);
  assert.equal(a.tokens[3].start, 0.9);
});

// ---- no message text in errors or logs (PR #2 review, AGENTS.md hard rule) ----

test('AnalysisInvalid carries a code and offset, never message text', () => {
  const MARKER = 'ZQXJ-private-marker';
  const cases: [string, RawAnalysis][] = [
    [`hola ${MARKER}`, raw([tok('hola', 'hola', 'hi', [])])], // unanalyzed tail
    [`${MARKER} hola`, raw([tok('hola', 'hola', 'hi', [])])], // skipped text
    ['hola', raw([tok(MARKER, MARKER, 'x', [])])], // surface not found
  ];
  for (const [original, r] of cases) {
    try {
      alignAnalysis(original, r, 'hi', false);
      assert.fail('expected AnalysisInvalid');
    } catch (e) {
      assert.ok(e instanceof AnalysisInvalid);
      assert.ok(!e.message.includes(MARKER), e.message);
      assert.ok(!String(e.stack).includes(MARKER));
    }
  }
  try {
    alignAnalysis(MARKER, raw([tok(MARKER, MARKER, 'x', [])]), 'x', true);
  } catch (e) {
    assert.ok(e instanceof AnalysisInvalid && e.code === 'missing_romanization' && !e.message.includes(MARKER));
  }
});

test('safeErr logs name/code/status only', async () => {
  const { safeErr } = await import('../logSafe.js');
  const err = Object.assign(new Error('user said: ZQXJ-private-marker'), { code: 'rate_limit', status: 429 });
  assert.equal(safeErr(err), 'Error code=rate_limit status=429');
  assert.equal(safeErr('boom'), 'string');
});
