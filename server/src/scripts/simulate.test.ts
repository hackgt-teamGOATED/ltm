// Seed simulator tests (no database, no OpenAI). Tokens come from a naive split here; the real seed uses
// the model's analysis, so exact shares differ, but the arc and the invariants must hold.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY_MS, type Lang } from '@heirloom/learner';
import { type ScriptLine, SPANISH, URDU } from './demoContent.js';
import { DEMO_MAX, DEMO_MIN, DEMO_PREFIX, scriptIds } from './demoIds.js';
import { type SimMessage, scheduleTimes, simulateLearner, windowStart } from './simulate.js';

const END = Date.UTC(2026, 8, 27, 3);
const START = windowStart(END);

function naive(lines: ScriptLine[], lang: Lang): SimMessage[] {
  const times = scheduleTimes(
    lines.map((l) => l.week),
    END,
  );
  return lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.from === 'them')
    .map(({ l, i }) => ({
      id: `m${i}`,
      threadId: 't',
      at: times[i],
      lang,
      kind: l.voice ? 'voice' : 'text',
      text: l.text,
      tokens: l.text.split(/\s+/).map((w, k) => {
        const lemma = w.replace(/[¿?¡!.,،۔؟]/g, '').toLowerCase();
        return { i: k, lemma: lemma || w, surface: w, gloss: `g-${lemma}`, isPunct: !lemma };
      }),
    }));
}

test('script: ~40+ lines per chat, ~30% voice, 3 hero messages each', () => {
  for (const lines of [SPANISH, URDU]) {
    assert.ok(lines.length >= 36, `${lines.length} lines`);
    const voice = lines.filter((l) => l.voice).length / lines.length;
    assert.ok(voice >= 0.25 && voice <= 0.35, `voice share ${voice}`);
    assert.equal(lines.filter((l) => l.heroId).length, 3);
    assert.ok(lines.every((l) => l.week >= 1 && l.week <= 8));
  }
});

test('scheduleTimes: strictly increasing, inside the 8-week window, ends before now', () => {
  const t = scheduleTimes(
    SPANISH.map((l) => l.week),
    END,
  );
  assert.equal(t.length, SPANISH.length);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] > t[i - 1], `line ${i} out of order`);
  assert.ok(t[0] >= START - DAY_MS && t[t.length - 1] <= END - 3600_000);
});

test('simulation is deterministic for a seed', () => {
  const msgs = naive(SPANISH, 'es');
  assert.deepEqual(simulateLearner(msgs, 42, START, END), simulateLearner(msgs, 42, START, END));
});

test('simulated events are well-formed and never in the future', () => {
  const { events } = simulateLearner(naive(URDU, 'ur'), 42, START, END);
  assert.ok(events.length > 100);
  for (const e of events) {
    assert.equal(e.lang, 'ur');
    assert.ok(e.at <= END + 5 * 60_000, 'event after the end of the window');
    assert.ok(e.messageId, 'every seeded event is tied to a seeded message (so reseeding can replace it)');
  }
});

test('realistic arc (D-024): Spanish starts at Listener and reaches Reader by week 8', () => {
  const { weekly } = simulateLearner(naive(SPANISH, 'es'), 42, START, END);
  assert.equal(weekly.length, 8);
  assert.equal(weekly[0].stage, 'listener');
  assert.equal(weekly[7].stage, 'reader', weekly.map((w) => `${w.stage} ${w.readableShare.toFixed(2)}`).join(', '));
  assert.ok(weekly.every((w) => w.stage !== 'fluent'));
});

// ---- PR #4 review ----

test('events are strictly increasing in time (server replay order = simulation order)', () => {
  for (const [lines, lang] of [
    [SPANISH, 'es'],
    [URDU, 'ur'],
  ] as const) {
    const { events } = simulateLearner(naive(lines, lang), 42, START, END);
    for (let i = 1; i < events.length; i++) assert.ok(events[i].at > events[i - 1].at, `event ${i} not after ${i - 1}`);
  }
});

test('a word repeated within one message is only logged once per view', () => {
  const { events } = simulateLearner(naive(SPANISH, 'es'), 42, START, END);
  const reading = events.filter((e) => e.type !== 'audio_play' && e.type !== 'tap_reveal' && e.type !== 'guess_correct' && e.type !== 'guess_wrong');
  const keys = reading.map((e) => `${e.messageId}|${e.lemma}|${e.type}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('every scripted line lands in its script week, whatever the time of day the seed runs', () => {
  for (const end of [Date.UTC(2026, 8, 27, 3), Date.UTC(2026, 8, 27, 20), Date.UTC(2026, 8, 27, 0, 30)]) {
    const start = windowStart(end);
    const t = scheduleTimes(
      SPANISH.map((l) => l.week),
      end,
    );
    SPANISH.forEach((l, i) => {
      const lo = start + (l.week - 1) * 7 * DAY_MS;
      const hi = start + l.week * 7 * DAY_MS;
      assert.ok(t[i] >= lo && t[i] < hi, `line ${i} (week ${l.week}) outside its week for end=${new Date(end).toISOString()}`);
    });
    assert.ok(t[t.length - 1] <= end - 2 * 3600_000);
  }
});

test('demo ids: prefixed, unique, stable under reordering, new when a line changes', () => {
  const T = '00000000-0000-0000-0000-0000000000a2';
  const ids = scriptIds(T, SPANISH);
  assert.equal(new Set(ids).size, ids.length, 'repeated lines still get distinct ids');
  assert.ok(ids.every((x) => x.startsWith(`${DEMO_PREFIX}-`) && /^[0-9a-f-]{36}$/.test(x) && x >= DEMO_MIN && x <= DEMO_MAX));
  const moved = [SPANISH[5], ...SPANISH.slice(0, 5), ...SPANISH.slice(6)];
  assert.deepEqual(new Set(scriptIds(T, moved)), new Set(ids));
  const edited = SPANISH.map((l, i) => (i === 3 ? { ...l, text: `${l.text}!` } : l));
  assert.notEqual(scriptIds(T, edited)[3], ids[3]);
  assert.deepEqual(scriptIds(T, edited).slice(4), ids.slice(4));
});
