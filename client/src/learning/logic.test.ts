/// <reference types="node" />
// Run: npm test -w client (Node's built-in runner; Node 23+ runs TypeScript directly).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEvents, DAY_MS, type LearningEvent, type Mastery, replay, type Stage, type TokenPlan } from '@heirloom/learner';
import type { Message, MessageAnalysis } from '../api/types.ts';
import {
  annotatableIds,
  BACKFILL_COUNT,
  computeView,
  guessOptions,
  isStageUp,
  mergeAnalyses,
  newlyMastered,
  showTranslationEvents,
  WEEK_MS,
  weekBuckets,
  tapEventType,
  viewEvents,
  voiceSource,
} from './logic.ts';

const NOW = Date.UTC(2026, 8, 26, 18);
const analysis = (messageId: string, lemma = 'x'): MessageAnalysis => ({
  messageId,
  viewerLang: 'en',
  translation: 't',
  tokens: [{ i: 0, surface: lemma, pre: '', lemma, gloss: 'g' }],
  phrases: [],
  needsNativeCheck: true,
});
const message = (id: string, extra: Partial<Message> = {}): Message => ({
  id,
  threadId: 't',
  senderId: 'them',
  kind: 'text',
  originalText: 'hola',
  originalLanguage: 'es',
  audioUrl: null,
  wordTimestamps: null,
  status: 'ready',
  createdAt: new Date(NOW - DAY_MS).toISOString(),
  translations: [],
  ...extra,
});

test('mergeAnalyses keeps entries that arrived over the socket before the fetch returned (review #4)', () => {
  const fromSocket = { m2: analysis('m2') };
  const merged = mergeAnalyses(fromSocket, [analysis('m1')]);
  assert.deepEqual(Object.keys(merged).sort(), ['m1', 'm2']);
  assert.equal(mergeAnalyses(undefined, [analysis('m1')]).m1.messageId, 'm1');
});

test('hysteresis is per language: Spanish at Reader does not hold Urdu at Reader (review #5)', () => {
  // 27% readable: Listener from scratch, but a Reader would hold (≥ 30% − 5%).
  const mastered: LearningEvent[] = [];
  for (const lemma of ['a', 'b', 'c']) {
    mastered.push({ lemma, lang: 'ur', type: 'read_unaided', at: NOW - 6 * DAY_MS });
    for (const d of [5, 3, 0]) mastered.push({ lemma, lang: 'ur', type: 'guess_correct', at: NOW - d * DAY_MS, options: 4 });
  }
  const m = applyEvents({}, mastered).mastery;
  const lemmas = ['a', 'b', 'c', ...Array.from({ length: 8 }, (_, k) => `x${k}`)]; // 3/11 ≈ 27%
  const prev = new Map<string, Stage>([['p:es', 'reader']]);
  assert.equal(computeView(m, lemmas, NOW, 'p:ur', prev).stage, 'listener');
  assert.equal(computeView(m, lemmas, NOW, 'p:ur', new Map([['p:ur', 'reader']])).stage, 'reader');
});

test('two views sharing the stage map agree inside the hysteresis band (chip vs settings sheet)', () => {
  const events: LearningEvent[] = [];
  for (const lemma of ['a', 'b', 'c']) {
    events.push({ lemma, lang: 'es', type: 'read_unaided', at: NOW - 6 * DAY_MS });
    for (const d of [5, 3, 0]) events.push({ lemma, lang: 'es', type: 'guess_correct', at: NOW - d * DAY_MS, options: 4 });
  }
  const m = applyEvents({}, events).mastery;
  const shared = new Map<string, Stage>([['p:es', 'reader']]); // was Reader, now 27% readable
  const lemmas = ['a', 'b', 'c', ...Array.from({ length: 8 }, (_, k) => `x${k}`)];
  const chip = computeView(m, lemmas, NOW, 'p:es', shared);
  shared.set('p:es', chip.stage);
  const sheet = computeView(m, lemmas, NOW, 'p:es', shared);
  assert.equal(chip.stage, 'reader');
  assert.equal(sheet.stage, chip.stage);
  // With separate (fresh) maps they would have disagreed:
  assert.equal(computeView(m, lemmas, NOW, 'p:es', new Map()).stage, 'listener');
});

test('voiceSource: stage default until the listener picks one (review #2)', () => {
  assert.equal(voiceSource(null, 'listener'), 'translated');
  assert.equal(voiceSource(null, 'reader'), 'original');
  assert.equal(voiceSource('translated', 'fluent'), 'translated');
});

test('annotatableIds: backfill window, fresh messages, never empty or own messages (review #3)', () => {
  const old = Array.from({ length: BACKFILL_COUNT + 5 }, (_, k) =>
    message(`m${k}`, { createdAt: new Date(NOW - (100 - k) * DAY_MS).toISOString() }),
  );
  const msgs = [
    ...old,
    message('empty', { originalText: '  ' }),
    message('mine', { senderId: 'me' }),
    message('fr', { originalLanguage: 'fr' }),
    message('fresh', { createdAt: new Date(NOW - 60_000).toISOString() }),
  ];
  const ids = annotatableIds(msgs, 'me', 'es', NOW);
  assert.ok(!ids.has('m0'), 'older than the backfill window');
  assert.ok(ids.has(`m${BACKFILL_COUNT + 4}`));
  assert.ok(ids.has('fresh'));
  for (const x of ['empty', 'mine', 'fr']) assert.ok(!ids.has(x), x);
});

// ---- Phase 5 ----

const tok = (i: number, lemma: string, extra: Partial<MessageAnalysis['tokens'][number]> = {}) => ({
  i,
  surface: lemma,
  pre: i ? ' ' : '',
  lemma,
  gloss: `g-${lemma}`,
  ...extra,
});
const planOf = (flags: Partial<TokenPlan>[]): TokenPlan[] =>
  flags.map((f, i) => ({ i, status: 'learning', hint: false, partialHint: false, romanization: false, challenge: false, recall: 0.5, ...f }));
const CTX = { messageId: 'm1', threadId: 't1', lang: 'es' as const, at: NOW };

test('viewEvents: hinted → exposure, unhinted → read_unaided, challenges and tapped words skipped, one per lemma', () => {
  const tokens = [tok(0, 'hola'), tok(1, 'mijo'), tok(2, 'frío'), tok(3, 'hola'), tok(4, '!', { isPunct: true }), tok(5, 'sopa')];
  const plan = planOf([{ hint: true }, {}, { challenge: true }, { hint: true }, {}, {}]);
  const ev = viewEvents(tokens, plan, new Set(['sopa']), CTX);
  assert.deepEqual(
    ev.map((e) => `${e.lemma}:${e.type}`),
    ['hola:exposure_hinted', 'mijo:read_unaided'],
  );
  assert.ok(ev.every((e) => e.messageId === 'm1' && e.threadId === 't1' && e.at === NOW));
});

test('viewEvents: romanizationShown only for words that have romanization', () => {
  const ev = viewEvents([tok(0, 'آج', { romanization: 'aaj' }), tok(1, 'x')], planOf([{ romanization: false }, {}]), new Set(), {
    ...CTX,
    lang: 'ur',
  });
  assert.equal(ev[0].romanizationShown, false);
  assert.equal('romanizationShown' in ev[1], false);
});

test('tapEventType: curiosity on a mastered word is free', () => {
  assert.equal(tapEventType('mastered'), 'tap_explore');
  for (const s of ['new', 'learning', 'fading'] as const) assert.equal(tapEventType(s), 'tap_reveal');
});

test('showTranslationEvents: only the words that were shown without help', () => {
  const tokens = [tok(0, 'a'), tok(1, 'b'), tok(2, 'c'), tok(3, 'a')];
  const ev = showTranslationEvents(tokens, planOf([{}, { hint: true }, { challenge: true }, {}]), CTX);
  assert.deepEqual(
    ev.map((e) => `${e.lemma}:${e.type}`),
    ['a:show_translation'],
  );
});

test('guessOptions: 4 distinct options including the answer, stable per seed', () => {
  const o = guessOptions('cold', ['hot', 'cold', 'Cold', 'rain', 'sun', 'snow', ''], 'frío');
  assert.equal(o.length, 4);
  assert.ok(o.includes('cold'));
  assert.equal(new Set(o.map((x) => x.toLowerCase())).size, 4);
  assert.deepEqual(o, guessOptions('cold', ['hot', 'cold', 'Cold', 'rain', 'sun', 'snow', ''], 'frío'));
});

test('newlyMastered + isStageUp', () => {
  const ev: LearningEvent[] = [{ lemma: 'a', lang: 'es', type: 'read_unaided', at: NOW - 6 * DAY_MS }];
  for (const d of [5, 3, 0]) ev.push({ lemma: 'a', lang: 'es', type: 'guess_correct', at: NOW - d * DAY_MS, options: 4 });
  const before = applyEvents({}, ev.slice(0, 3)).mastery;
  const after = applyEvents({}, ev).mastery;
  assert.deepEqual(newlyMastered(before, after, ['a', 'a', 'b'], NOW), ['a']);
  assert.deepEqual(newlyMastered(after, after, ['a'], NOW), []);
  assert.equal(isStageUp('listener', 'reader'), true);
  assert.equal(isStageUp('reader', 'reader'), false);
  assert.equal(isStageUp(undefined, 'reader'), false);
});

// ---- Phase 7: time travel ----

const evAt = (at: number, lemma = 'a', lang: 'es' | 'ur' = 'es'): LearningEvent => ({ lemma, lang, type: 'read_unaided', at });

test('weekBuckets: one cut-off per week, last one covers the final event', () => {
  const start = NOW - 8 * WEEK_MS;
  // 9 events one week apart span exactly 8 weeks end to end.
  const events = Array.from({ length: 9 }, (_, i) => evAt(start + i * WEEK_MS));
  const weeks = weekBuckets(events);
  assert.equal(weeks.length, 8);
  assert.ok(weeks.every((w, i) => i === 0 || w > weeks[i - 1]), 'strictly increasing');
  assert.equal(weeks.at(-1), Math.max(...events.map((e) => e.at)), 'last week includes every event');
});

test('weekBuckets: empty log, single event, and a log longer than the cap', () => {
  assert.deepEqual(weekBuckets([]), []);
  assert.deepEqual(weekBuckets([evAt(NOW)]), [NOW]);
  const long = Array.from({ length: 30 }, (_, i) => evAt(NOW - (29 - i) * WEEK_MS));
  assert.equal(weekBuckets(long).length, 8, 'never more steps than the cap');
});

test('weekBuckets: a log shorter than a week, and a cluster at one timestamp, collapse to one step', () => {
  const short = [evAt(NOW - 2 * DAY_MS), evAt(NOW - DAY_MS), evAt(NOW)];
  assert.deepEqual(weekBuckets(short), [NOW], 'under a week is a single step ending at the last event');
  const cluster = [evAt(NOW), evAt(NOW, 'b'), evAt(NOW, 'c')];
  assert.deepEqual(weekBuckets(cluster), [NOW], 'zero span is still one usable step');
});

test('weekBuckets: cut-offs stay strictly increasing even when the log is capped', () => {
  const long = Array.from({ length: 30 }, (_, i) => evAt(NOW - (29 - i) * WEEK_MS));
  const weeks = weekBuckets(long);
  assert.equal(weeks.length, 8);
  assert.ok(weeks.every((w, i) => i === 0 || w > weeks[i - 1]), `no two steps collide: ${weeks}`);
  assert.equal(weeks.at(-1), NOW, 'the last step still covers the final event');
});

test('replay at each week cut-off never loses ground: mastery only grows across the arc', () => {
  const start = NOW - 8 * WEEK_MS;
  const events: LearningEvent[] = [];
  // One word introduced per week, each reinforced on two later days so it can actually reach mastery.
  for (let w = 0; w < 8; w++) {
    const lemma = `w${w}`;
    events.push(evAt(start + w * WEEK_MS, lemma));
    events.push({ lemma, lang: 'es', type: 'guess_correct', at: start + w * WEEK_MS + 2 * DAY_MS, options: 4 });
    events.push({ lemma, lang: 'es', type: 'guess_correct', at: start + w * WEEK_MS + 5 * DAY_MS, options: 4 });
  }
  const weeks = weekBuckets(events);
  const seen = weeks.map((until) => Object.keys(replay(events, until, 'es')).length);
  assert.ok(seen.every((n, i) => i === 0 || n >= seen[i - 1]), `tracked words never shrink: ${seen}`);
  assert.ok(seen.at(-1)! > seen[0], 'the arc actually moves');
});

test('replay is scoped by language: Urdu events never enter the Spanish snapshot', () => {
  const events = [evAt(NOW - WEEK_MS, 'hola', 'es'), evAt(NOW - WEEK_MS, 'salaam', 'ur')];
  assert.deepEqual(Object.keys(replay(events, NOW, 'es')), ['hola']);
  assert.deepEqual(Object.keys(replay(events, NOW, 'ur')), ['salaam']);
});

test('replay ignores everything after the cut-off', () => {
  const events = [evAt(NOW - 2 * WEEK_MS, 'early'), evAt(NOW - 1, 'late')];
  assert.deepEqual(Object.keys(replay(events, NOW - WEEK_MS, 'es')), ['early']);
  assert.equal(Object.keys(replay(events, NOW, 'es')).length, 2);
});

test("scrubbing must clear the replay stage memory, or a rewound week inherits the later week's stage", () => {
  // Two snapshots either side of the Reader threshold (0.30), inside the 0.05 hysteresis band:
  // week 7 at 0.28 (Listener on its own), week 8 at 0.33 (Reader).
  const lemmas = Array.from({ length: 100 }, (_, i) => `w${i}`);
  const masteryOf = (n: number): Mastery =>
    Object.fromEntries(
      lemmas.slice(0, n).map((l) => [
        l,
        applyEvents({}, [
          { lemma: l, lang: 'es', type: 'read_unaided', at: NOW - 6 * DAY_MS },
          { lemma: l, lang: 'es', type: 'guess_correct', at: NOW - 3 * DAY_MS, options: 4 },
          { lemma: l, lang: 'es', type: 'guess_correct', at: NOW - DAY_MS, options: 4 },
        ]).mastery[l],
      ]),
    );
  const week7 = masteryOf(28);
  const week8 = masteryOf(33);
  const key = 'p:es';
  const pick = (m: Mastery, stages: Map<string, Stage>) => {
    const v = computeView(m, lemmas, NOW, key, stages);
    stages.set(key, v.stage); // what useLanguageView does on every render
    return v.stage;
  };

  assert.equal(pick(week7, new Map()), 'listener', 'week 7 on its own is below Reader');
  assert.equal(pick(week8, new Map()), 'reader', 'week 8 is Reader');

  // The hazard: keeping one map across picks makes the answer depend on click order.
  const carried = new Map<string, Stage>();
  pick(week8, carried);
  assert.equal(pick(week7, carried), 'reader', 'carried hysteresis wrongly holds week 7 at Reader');

  // What store/demo.ts does instead: clear on every setWeek, so each week stands alone.
  const cleared = new Map<string, Stage>();
  pick(week8, cleared);
  cleared.clear();
  assert.equal(pick(week7, cleared), 'listener', 'clearing restores the honest stage for week 7');
});
