// Must stay identical to docs/reference/learner_model.py (see PLAN.md §8.2).
// Changing any value follows the learner-model-change skill: human approval, Python first, parity test.
export const TARGET_RETENTION = 0.9;
export const MASTERED_R = 0.9;
export const FADING_R = 0.7;
export const ROMANIZATION_OFF_R = 0.8;
export const MIN_S = 0.1;
export const MAX_S = 365;
export const SUCCESS_GAIN = 2.5;
export const FAIL_KEEP = 0.4;
export const RELEARN_FLOOR = 0.8;
export const MASTERY_MIN_S = 7.0;
export const EXPOSURE_GAIN = 0.25;
export const SPACING_CAP = 3.0;
export const INFLECTION_TRANSFER = 0.85;
export const CHALLENGE_DENSITY = 0.05;
export const MIN_CHALLENGES = 2;
export const CHALLENGE_BAND: readonly [number, number] = [0.35, 0.9];
export const D_LEARNING_RATE = 0.05;
