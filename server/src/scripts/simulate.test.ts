// Seed simulator tests (no database, no OpenAI). Tokens come from a naive split here; the real seed uses
// the model's analysis, so exact shares differ, but the arc and the invariants must hold.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DAY_MS, type Lang } from '@heirloom/learner';
import { type ScriptLine, SPANISH, URDU } from './demoContent.js';
import { type SimMessage, scheduleTimes, simulateLearner } from './simulate.js';

const END = Date.UTC(2026, 8, 27, 3);
const START = END - 56 * DAY_MS;

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
