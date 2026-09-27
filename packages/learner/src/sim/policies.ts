// The three decision rules compared in the evaluation (PLAN.md §10).
//
// A policy answers one question: "does this learner know this word well enough that we can stop
// helping?" That decision is what drives the fade, so it is the thing worth measuring. Every policy
// sees exactly the same interaction history and the same simulated learner; only the rule differs.
// If a baseline were given less information the comparison would be worthless.
import { CHALLENGE_BAND } from '../constants.js';
import { applyEvents, skillRecall, status } from '../model.js';
import type { LearningEvent, Mastery } from '../types.js';

export type PolicyName = 'heirloom' | 'no-fade' | 'count-3';

export interface Policy {
  name: PolicyName;
  label: string;
  /** Fold one more event into the policy's internal state. */
  observe(events: LearningEvent[]): void;
  /** Does the policy consider this word known (so no hint is shown)? */
  knows(lemma: string, now: number): boolean;
  /** Predicted probability of recall, or null when the policy makes no prediction. */
  predict(lemma: string, now: number): number | null;
  /**
   * Which of these words the policy would turn into a guess (active recall), given a budget.
   *
   * Every policy gets the same budget. Testing is how a learner escapes the deadlock where a word is
   * always glossed and so never retrieved, and giving only our model that ability would make the
   * baselines strawmen. What differs is which words each policy thinks are worth testing.
   */
  challenge(candidates: string[], now: number, budget: number): string[];
}

/** Our model: a word is known once it is mastered (R ≥ 0.90, stability ≥ 7d, successes on 2+ days). */
export function heirloomPolicy(): Policy {
  let mastery: Mastery = {};
  return {
    name: 'heirloom',
    label: 'Heirloom (this model)',
    observe(events) {
      mastery = applyEvents(mastery, events).mastery;
    },
    knows: (lemma, now) => status(mastery[lemma], now) === 'mastered',
    predict: (lemma, now) => {
      const l = mastery[lemma];
      if (!l) return 0;
      return skillRecall(l.skills.recognize, now);
    },
    // Test the words it is genuinely unsure about: recall inside CHALLENGE_BAND, the least
    // certain first. That is what renderPlan does in the app.
    challenge(candidates, now, budget) {
      const [lo, hi] = CHALLENGE_BAND;
      return candidates
        .map((lemma) => ({ lemma, r: skillRecall(mastery[lemma]?.skills.recognize, now) }))
        .filter(({ r }) => r >= lo && r <= hi)
        .sort((a, b) => a.r - b.r)
        .slice(0, budget)
        .map(({ lemma }) => lemma);
    },
  };
}

/**
 * The status quo: translation never fades, so the learner is always helped and never has to recall.
 * It "knows" nothing, which is the point — this is what today's translated messengers do.
 */
export function noFadePolicy(): Policy {
  return {
    name: 'no-fade',
    label: 'No fading (always translate)',
    observe() {},
    knows: () => false,
    predict: () => null,
    // The status quo never asks the reader to recall anything. That is the point of the baseline.
    challenge: () => [],
  };
}

/** The obvious heuristic: known after N unaided reads, with no notion of forgetting. */
export function countPolicy(n = 3): Policy {
  const reads = new Map<string, number>();
  return {
    name: 'count-3',
    label: `Counting rule (known after ${n} reads)`,
    observe(events) {
      for (const e of events) {
        if (e.type === 'read_unaided' || e.type === 'guess_correct') {
          reads.set(e.lemma, (reads.get(e.lemma) ?? 0) + 1);
        }
      }
    },
    knows: (lemma) => (reads.get(lemma) ?? 0) >= n,
    predict: () => null,
    // Same budget as ours, spent on any word not yet counted as known — including words with no
    // reads yet, or it could never get off zero. It ranks by how close a word is to the threshold,
    // which is the best it can do with no model of forgetting: once a word hits n reads it stops
    // being tested, however long ago those reads were.
    challenge(candidates, _now, budget) {
      return candidates
        .map((lemma) => ({ lemma, c: reads.get(lemma) ?? 0 }))
        .filter(({ c }) => c < n)
        .sort((a, b) => b.c - a.c)
        .slice(0, budget)
        .map(({ lemma }) => lemma);
    },
  };
}

export const allPolicies = (): Policy[] => [heirloomPolicy(), noFadePolicy(), countPolicy(3)];
