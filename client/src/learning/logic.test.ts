/// <reference types="node" />
// Run: npm test -w client (Node's built-in runner; Node 23+ runs TypeScript directly).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEvents, DAY_MS, type LearningEvent, type Stage } from '@heirloom/learner';
import type { Message, MessageAnalysis } from '../api/types.ts';
import { annotatableIds, BACKFILL_COUNT, computeView, mergeAnalyses, voiceSource } from './logic.ts';

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
