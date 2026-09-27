// Cohort simulator for the evaluation (PLAN.md §10 E2). Pure: the caller passes the seed, so the
// same inputs always produce the same run and every reported number is reproducible.
//
// The point of simulating is that we get ground truth. Each learner has a hidden memory the policies
// never see; they only see interactions, exactly as in the app. That lets us ask two honest questions:
// does fading help someone actually learn, and are our recall predictions calibrated?
import { CHALLENGE_DENSITY, MIN_CHALLENGES } from '../constants.js';
import { DAY_MS } from '../model.js';
import type { LearningEvent } from '../types.js';
import { type Policy, type PolicyName, allPolicies } from './policies.js';

/** mulberry32: small seeded PRNG, same one the demo seed uses. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const WEEKS = 8;
export const MESSAGES_PER_WEEK = 12;
export const WORDS_PER_MESSAGE = 8;

export interface CohortConfig {
  learners: number;
  seed: number;
  /** Size of the vocabulary the conversation draws on. */
  vocabulary: number;
  start: number;
}

export const DEFAULT_CONFIG: CohortConfig = {
  learners: 200,
  seed: 20260927,
  vocabulary: 120,
  start: Date.UTC(2026, 6, 6),
};

/**
 * Hidden truth for one learner. `halfLife` is how long a word survives in memory, in days; it grows
 * with each genuine retrieval and barely at all with passive exposure. Learners differ in how fast
 * they forget and how attentive they are, which is what makes a cohort worth simulating.
 */
interface Hidden {
  halfLife: Map<string, number>;
  last: Map<string, number>;
  /** Multiplier on every memory gain: some people simply pick words up faster. */
  aptitude: number;
  /** Chance of skimming a message without taking anything in. */
  skim: number;
}

function makeLearner(rand: () => number): Hidden {
  return {
    halfLife: new Map(),
    last: new Map(),
    // Log-normal-ish spread: most learners near 1, a long tail either side.
    aptitude: Math.exp((rand() - 0.5) * 1.2),
    skim: 0.05 + rand() * 0.2,
  };
}

/** True probability this learner recalls the word unaided right now. */
function trueRecall(h: Hidden, lemma: string, now: number): number {
  const hl = h.halfLife.get(lemma);
  const last = h.last.get(lemma);
  if (hl === undefined || last === undefined) return 0;
  return 2 ** (-Math.max(0, now - last) / DAY_MS / hl);
}

/** Retrieval strengthens memory far more than being shown the answer — the testing effect. */
function reinforce(h: Hidden, lemma: string, now: number, kind: 'retrieval' | 'exposure'): void {
  const gain = (kind === 'retrieval' ? 2.4 : 1.25) * h.aptitude;
  const hl = h.halfLife.get(lemma);
  h.halfLife.set(lemma, Math.min(180, hl === undefined ? 1.2 * h.aptitude : hl * gain));
  h.last.set(lemma, now);
}

export interface WeekPoint {
  week: number;
  /** Share of words in that week's messages the learner could genuinely read unaided. */
  readableShare: number;
}

export interface CalibrationBucket {
  /** Bucket midpoint of predicted recall, 0–1. */
  predicted: number;
  /** Observed rate of successful unaided recall in that bucket. */
  actual: number;
  n: number;
}

export interface TraceEvent {
  at: number;
  kind: 'retrieval' | 'exposure';
}
export interface WordTrace {
  lemma: string;
  /** Sampled true recall over time, for the forgetting-curve chart. */
  curve: { at: number; recall: number }[];
  events: TraceEvent[];
}

/**
 * How well a policy's "they know this" decision matches the truth. Getting this wrong is what the
 * learner actually feels: `strandedRate` is the share of unhelped words they genuinely could not
 * recall — staring at a word with the gloss withheld. `wastedRate` is the opposite, glossing a word
 * they already knew, which is merely noise.
 */
export interface DecisionQuality {
  unhelped: number;
  stranded: number;
  strandedRate: number;
  helped: number;
  wasted: number;
  wastedRate: number;
}

export interface CohortResult {
  config: CohortConfig;
  /** Readable share per week, averaged over the cohort, per policy. */
  weekly: Record<PolicyName, WeekPoint[]>;
  /** Calibration of our model's predicted recall against what actually happened. */
  calibration: CalibrationBucket[];
  /** Words a learner ends up able to read unaided, averaged over the cohort, per policy. */
  finalKnown: Record<PolicyName, number>;
  /** One learner's word traces, for the forgetting-curve chart. */
  traces: WordTrace[];
  /** Quality of each policy's stop-helping decision, the measure the learner actually feels. */
  decisions: Record<PolicyName, DecisionQuality>;
}

const bucketOf = (p: number) => Math.min(9, Math.floor(p * 10));

/**
 * Run the cohort. Every learner reads the same message schedule; the only differences are their
 * hidden memory and the policy deciding when to stop helping them.
 */
export function runCohort(config: CohortConfig = DEFAULT_CONFIG): CohortResult {
  const { learners, seed, vocabulary, start } = config;
  const vocab = Array.from({ length: vocabulary }, (_, i) => `w${i}`);

  const weekly = {} as Record<PolicyName, WeekPoint[]>;
  const finalKnown = {} as Record<PolicyName, number>;
  for (const p of allPolicies()) {
    weekly[p.name] = Array.from({ length: WEEKS }, (_, i) => ({ week: i + 1, readableShare: 0 }));
    finalKnown[p.name] = 0;
  }
  // Calibration is pooled over every prediction the model makes, across the whole cohort.
  const buckets = Array.from({ length: 10 }, () => ({ hits: 0, n: 0 }));
  let traces: WordTrace[] = [];
  const decisions = {} as Record<PolicyName, DecisionQuality>;
  for (const p of allPolicies()) {
    decisions[p.name] = { unhelped: 0, stranded: 0, strandedRate: 0, helped: 0, wasted: 0, wastedRate: 0 };
  }
  const RECALLED = 0.5;

  for (let li = 0; li < learners; li++) {
    // Each learner gets their own stream, derived from the run seed, so a run is reproducible
    // and one learner's randomness can't shift another's.
    const rand = rng(seed + li * 7919);
    const policies = allPolicies();
    const hidden: Record<PolicyName, Hidden> = {
      heirloom: makeLearner(rng(seed + li * 7919)),
      'no-fade': makeLearner(rng(seed + li * 7919)),
      'count-3': makeLearner(rng(seed + li * 7919)),
    };
    const traced = li === 0 ? { curves: new Map<string, WordTrace>() } : null;

    for (let week = 0; week < WEEKS; week++) {
      const readable: Record<PolicyName, { seen: number; known: number }> = {
        heirloom: { seen: 0, known: 0 },
        'no-fade': { seen: 0, known: 0 },
        'count-3': { seen: 0, known: 0 },
      };

      for (let m = 0; m < MESSAGES_PER_WEEK; m++) {
        const at = start + (week * 7 + (m * 7) / MESSAGES_PER_WEEK) * DAY_MS;
        // Zipf-ish draw: a handful of words recur constantly, most are rare — like real conversation.
        const words = Array.from({ length: WORDS_PER_MESSAGE }, () => {
          const r = rand() ** 2;
          return vocab[Math.min(vocabulary - 1, Math.floor(r * vocabulary))] as string;
        });
        const skimmed = rand() < hidden.heirloom.skim;

        for (const policy of policies) {
          const h = hidden[policy.name];
          const events: LearningEvent[] = [];
          // Same budget for every policy (the app's rule); only the choice of words differs.
          const budget = Math.max(MIN_CHALLENGES, Math.round(words.length * CHALLENGE_DENSITY));
          const challenged = skimmed ? new Set<string>() : new Set(policy.challenge([...new Set(words)], at, budget));
          for (const lemma of words) {
            const truth = trueRecall(h, lemma, at);
            readable[policy.name].seen += 1;
            if (truth >= 0.5) readable[policy.name].known += 1;

            if (skimmed) continue;
            const isChallenge = challenged.has(lemma);
            const helped = !isChallenge && !policy.knows(lemma, at);

            // Score the decision against the truth the policy can't see. A challenge is not a
            // withheld gloss — the learner is being asked, and the answer follows — so only plain
            // helped/unhelped words count.
            if (!isChallenge) {
              const d = decisions[policy.name];
              if (helped) {
                d.helped += 1;
                if (truth >= RECALLED) d.wasted += 1;
              } else {
                d.unhelped += 1;
                if (truth < RECALLED) d.stranded += 1;
              }
            }

            if (isChallenge) {
              // Asked to guess: a real retrieval attempt even though the word isn't mastered yet.
              // This is how a glossed word ever earns success evidence.
              const predicted = policy.predict(lemma, at);
              const success = rand() < truth;
              if (predicted !== null) {
                const b = buckets[bucketOf(predicted)] as { hits: number; n: number };
                b.n += 1;
                if (success) b.hits += 1;
              }
              reinforce(h, lemma, at, success ? 'retrieval' : 'exposure');
              events.push({ lemma, lang: 'es', type: success ? 'guess_correct' : 'guess_wrong', at, options: 4 });
            } else if (helped) {
              // The word is glossed: the learner reads the meaning rather than retrieving it.
              reinforce(h, lemma, at, 'exposure');
              events.push({ lemma, lang: 'es', type: 'exposure_hinted', at });
            } else {
              // No help: this is a genuine retrieval attempt, and it can fail.
              const predicted = policy.predict(lemma, at);
              const success = rand() < truth;
              if (predicted !== null) {
                const b = buckets[bucketOf(predicted)] as { hits: number; n: number };
                b.n += 1;
                if (success) b.hits += 1;
              }
              if (success) {
                reinforce(h, lemma, at, 'retrieval');
                events.push({ lemma, lang: 'es', type: 'read_unaided', at });
              } else {
                // Failed to recall, so the learner taps to reveal it: weaker reinforcement.
                reinforce(h, lemma, at, 'exposure');
                events.push({ lemma, lang: 'es', type: 'tap_reveal', at });
              }
            }
            if (traced && policy.name === 'heirloom') {
              const t = traced.curves.get(lemma) ?? { lemma, curve: [], events: [] };
              t.events.push({ at, kind: helped ? 'exposure' : 'retrieval' });
              traced.curves.set(lemma, t);
            }
          }
          policy.observe(events);
        }
      }

      for (const p of policies) {
        const r = readable[p.name];
        const point = weekly[p.name][week] as WeekPoint;
        point.readableShare += r.seen ? r.known / r.seen : 0;
      }
    }

    for (const p of policies) {
      const h = hidden[p.name];
      const end = start + WEEKS * 7 * DAY_MS;
      finalKnown[p.name] += vocab.filter((w) => trueRecall(h, w, end) >= 0.5).length;
    }

    if (traced) {
      // Sample the true forgetting curve of the three most-encountered words for the curve chart.
      const top = [...traced.curves.values()].sort((a, b) => b.events.length - a.events.length).slice(0, 3);
      const h = hidden.heirloom;
      const end = start + WEEKS * 7 * DAY_MS;
      traces = top.map((t) => {
        // Replay this word's own history to recover its curve without disturbing the finished run.
        const solo: Hidden = { halfLife: new Map(), last: new Map(), aptitude: h.aptitude, skim: h.skim };
        const curve: { at: number; recall: number }[] = [];
        let next = start;
        for (const e of t.events) {
          while (next <= e.at) {
            curve.push({ at: next, recall: trueRecall(solo, t.lemma, next) });
            next += DAY_MS / 2;
          }
          reinforce(solo, t.lemma, e.at, e.kind);
        }
        while (next <= end) {
          curve.push({ at: next, recall: trueRecall(solo, t.lemma, next) });
          next += DAY_MS / 2;
        }
        return { lemma: t.lemma, curve, events: t.events };
      });
    }
  }

  for (const p of allPolicies()) {
    for (const point of weekly[p.name]) point.readableShare /= learners;
    finalKnown[p.name] /= learners;
    const d = decisions[p.name];
    d.strandedRate = d.unhelped ? d.stranded / d.unhelped : 0;
    d.wastedRate = d.helped ? d.wasted / d.helped : 0;
  }

  const calibration: CalibrationBucket[] = buckets
    .map((b, i) => ({ predicted: (i + 0.5) / 10, actual: b.n ? b.hits / b.n : 0, n: b.n }))
    .filter((b) => b.n > 0);

  return { config, weekly, calibration, finalKnown, traces, decisions };
}
