// Fade stage per user per language (PLAN.md §7.4).
import { status } from './model.js';
import type { Mastery, Stage } from './types.js';

export const STAGES: Stage[] = ['listener', 'reader', 'conversant', 'fluent'];
/** Minimum readable share to be in each stage. */
export const STAGE_MIN: Record<Stage, number> = { listener: 0, reader: 0.3, conversant: 0.7, fluent: 0.9 };
/** A stage only drops once the share falls this far below its threshold. */
export const STAGE_BUFFER = 0.05;
/** How many recent received messages feed the readable share. */
export const RECENT_MESSAGES = 20;

const stageFor = (share: number): Stage =>
  share >= STAGE_MIN.fluent
    ? 'fluent'
    : share >= STAGE_MIN.conversant
      ? 'conversant'
      : share >= STAGE_MIN.reader
        ? 'reader'
        : 'listener';

/** Share of `lemmas` (tracked tokens of recent received messages, repeats count) that are mastered. */
export function readableShare(mastery: Mastery, lemmas: string[], now: number): number {
  if (!lemmas.length) return 0;
  let known = 0;
  for (const l of lemmas) if (status(mastery[l], now) === 'mastered') known++;
  return known / lemmas.length;
}

export function languageStage(
  mastery: Mastery,
  recentLemmas: string[],
  now: number,
  previousStage?: Stage | null,
): { stage: Stage; readableShare: number } {
  const share = readableShare(mastery, recentLemmas, now);
  let stage = stageFor(share);
  if (previousStage && STAGES.indexOf(stage) < STAGES.indexOf(previousStage)) {
    // Hysteresis: hold the previous stage until the share is clearly below its threshold.
    if (share >= STAGE_MIN[previousStage] - STAGE_BUFFER) stage = previousStage;
  }
  return { stage, readableShare: share };
}
