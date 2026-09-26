import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyEvent,
  applyEvents,
  DAY_MS,
  type LearningEvent,
  languageStage,
  type Mastery,
  practiceItems,
  renderPlan,
  replay,
  status,
  wordLists,
} from '../src/index.js';

const T0 = Date.UTC(2026, 8, 1, 12); // noon UTC, so +hours stays on the same day
const ev = (type: LearningEvent['type'], at: number, extra: Partial<LearningEvent> = {}): LearningEvent => ({
  lemma: 'casa',
  lang: 'es',
  type,
  at,
  threadId: 't1',
  ...extra,
});
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);

// ---- Formulas (PLAN.md §8.4) ----

test('first contact: stability = 0.3 + 2(1 − d); halved for exposure; ×0.4 for failure', () => {
  close(applyEvent(undefined, ev('read_unaided', T0))?.skills.recognize?.stability ?? 0, 1.3);
  close(applyEvent(undefined, ev('exposure_hinted', T0))?.skills.recognize?.stability ?? 0, 0.65);
  close(applyEvent(undefined, ev('tap_reveal', T0))?.skills.recognize?.stability ?? 0, 0.52);
});

test('success multiplies stability by 1 + w·2.5·(1 − d)·spacing', () => {
  const a = applyEvent(undefined, ev('read_unaided', T0));
  const d = a?.difficulty ?? 0;
  const later = T0 + DAY_MS;
  const r = 2 ** (-1 / 1.3);
  const spacing = Math.min(3, (1 - r) / 0.1);
  const b = applyEvent(a, ev('read_unaided', later));
  close(b?.skills.recognize?.stability ?? 0, 1.3 * (1 + 0.4 * 2.5 * (1 - d) * spacing));
});

test('failure keeps stability above the relearn floor', () => {
  let s = applyEvent(undefined, ev('read_unaided', T0));
  for (let k = 1; k <= 6; k++) s = applyEvent(s, ev('tap_reveal', T0 + k * 1000));
  close(s?.skills.recognize?.stability ?? 0, 0.8 * 1.3);
});

test('difficulty moves by 0.05·w·(R_before − outcome), clamped', () => {
  const a = applyEvent(undefined, ev('tap_reveal', T0)); // R_before = 0, outcome 0 → no change
  close(a?.difficulty ?? 0, 0.5);
  const b = applyEvent(a, ev('tap_reveal', T0)); // R_before = 1 → +0.05
  close(b?.difficulty ?? 0, 0.55);
});

test('guess_correct weight is 1 − 1/options', () => {
  const a = applyEvent(undefined, ev('guess_correct', T0, { options: 4 }));
  assert.equal(a?.skills.recognize?.history[0].w, 0.75);
});

test('read_unaided without romanization also earns script evidence', () => {
  const a = applyEvent(undefined, ev('read_unaided', T0, { lang: 'ur', romanizationShown: false }));
  assert.ok(a?.skills.script);
  const b = applyEvent(undefined, ev('read_unaided', T0, { lang: 'ur', romanizationShown: true }));
  assert.equal(b?.skills.script, undefined);
});

// ---- Plain-language scenarios (PLAN.md §8.6) ----

test('5 taps then 1 unaided read stays unmastered', () => {
  const events = [0, 1, 2, 3, 4].map((k) => ev('tap_reveal', T0 + k * 3600_000));
  events.push(ev('read_unaided', T0 + 6 * 3600_000));
  const m = applyEvents({}, events).mastery;
  assert.notEqual(status(m.casa, T0 + 6 * 3600_000), 'mastered');
});

test('curiosity taps change nothing', () => {
  const before = applyEvent(undefined, ev('read_unaided', T0));
  const after = applyEvent(before, ev('tap_explore', T0 + 1000));
  assert.equal(after, before);
  assert.equal(applyEvent(undefined, ev('tap_explore', T0)), undefined);
});

test('mastery needs successes on 2 different days', () => {
  // Many strong successes on one day: stability grows, but still one success day.
  let s = applyEvent(undefined, ev('guess_correct', T0));
  for (let k = 1; k <= 8; k++) s = applyEvent(s, ev('guess_correct', T0 + k * 1800_000));
  assert.equal(s?.skills.recognize?.successDays.length, 1);
  assert.notEqual(status(s, T0 + 5 * 3600_000), 'mastered');

  // Spaced successes across days do get there.
  let t = applyEvent(undefined, ev('read_unaided', T0));
  for (const day of [1, 3, 6]) t = applyEvent(t, ev('guess_correct', T0 + day * DAY_MS));
  assert.equal(status(t, T0 + 6 * DAY_MS), 'mastered');
});

test('a long gap turns mastered into fading', () => {
  let t = applyEvent(undefined, ev('read_unaided', T0));
  for (const day of [1, 3, 6]) t = applyEvent(t, ev('guess_correct', T0 + day * DAY_MS));
  assert.equal(status(t, T0 + 6 * DAY_MS), 'mastered');
  assert.equal(status(t, T0 + 120 * DAY_MS), 'fading');
});

test('an unseen inflected form transfers at 0.85', () => {
  let s = applyEvent(undefined, ev('read_unaided', T0, { form: 'casa' }));
  s = applyEvent(s, ev('read_unaided', T0 + DAY_MS, { form: 'casas' }));
  close(s?.skills.recognize?.history[1].w ?? 0, 0.4 * 0.85);
});

// ---- Stage, render, practice, replay ----

const masteredMap = (lemmas: string[]): Mastery => {
  const events: LearningEvent[] = [];
  for (const lemma of lemmas) {
    events.push(ev('read_unaided', T0, { lemma }));
    for (const day of [1, 3, 6]) events.push(ev('guess_correct', T0 + day * DAY_MS, { lemma }));
  }
  return applyEvents({}, events).mastery;
};
const NOW = T0 + 6 * DAY_MS;

test('languageStage follows the readable share with a 5-point buffer on the way down', () => {
  const m = masteredMap(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  const recent = (known: number, total: number) => [
    ...'abcdefg'.slice(0, known).split(''),
    ...Array.from({ length: total - known }, (_, k) => `x${k}`),
  ];
  assert.equal(languageStage(m, recent(1, 10), NOW).stage, 'listener');
  assert.equal(languageStage(m, recent(3, 10), NOW).stage, 'reader');
  assert.equal(languageStage(m, recent(7, 10), NOW).stage, 'conversant');
  // 27% would be listener, but from reader it holds until below 25%.
  assert.equal(languageStage(m, recent(3, 11), NOW, 'reader').stage, 'reader');
  assert.equal(languageStage(m, recent(1, 10), NOW, 'reader').stage, 'listener');
});

test('renderPlan hides hints for mastered words from Reader on, keeps punctuation plain', () => {
  const m = masteredMap(['hola']);
  const tokens = [
    { i: 0, lemma: 'hola' },
    { i: 1, lemma: ',', isPunct: true },
    { i: 2, lemma: 'mijo' },
  ];
  const listener = renderPlan(tokens, m, NOW, 'listener');
  assert.deepEqual(
    listener.tokens.map((t) => t.hint),
    [true, false, true],
  );
  const reader = renderPlan(tokens, m, NOW, 'reader');
  assert.deepEqual(
    reader.tokens.map((t) => t.hint),
    [false, false, true],
  );
  assert.equal(reader.fadePct, 50);
});

test('renderPlan shows romanization until the script skill is recalled', () => {
  const plan = renderPlan([{ i: 0, lemma: 'پانی', romanization: 'paani' }], {}, NOW);
  assert.equal(plan.tokens[0].romanization, true);
});

test('practiceItems picks weak words with 4 options and a valid answer', () => {
  const events = ['uno', 'dos', 'tres', 'cuatro', 'cinco'].map((lemma) => ev('tap_reveal', T0, { lemma }));
  const m = applyEvents({}, events).mastery;
  const sentences = [
    {
      messageId: 'm1',
      text: 'uno dos tres cuatro cinco',
      tokens: ['uno', 'dos', 'tres', 'cuatro', 'cinco'].map((lemma, i) => ({
        i,
        lemma,
        surface: lemma,
        gloss: ['one', 'two', 'three', 'four', 'five'][i],
      })),
    },
  ];
  const items = practiceItems(m, sentences, T0 + DAY_MS);
  assert.equal(items.length, 5);
  for (const it of items) {
    assert.equal(it.options.length, 4);
    assert.equal(new Set(it.options).size, 4);
    assert.ok(it.answerIndex >= 0);
  }
  assert.deepEqual(items, practiceItems(m, sentences, T0 + DAY_MS), 'deterministic');
});

test('replay only uses events up to the cutoff and the requested language', () => {
  const events = [
    ev('read_unaided', T0),
    ev('read_unaided', T0 + 2 * DAY_MS, { lemma: 'perro' }),
    ev('read_unaided', T0, { lemma: 'ghar', lang: 'ur' }),
  ];
  assert.deepEqual(Object.keys(replay(events, T0 + DAY_MS, 'es')), ['casa']);
  assert.deepEqual(wordLists(replay(events, T0 + 3 * DAY_MS, 'es'), T0 + 3 * DAY_MS).learning, ['casa', 'perro']);
});
