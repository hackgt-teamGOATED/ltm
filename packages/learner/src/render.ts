// What each token of a message shows, given the learner's mastery (PLAN.md §7.4, §8.5).
import { CHALLENGE_BAND, CHALLENGE_DENSITY, FADING_R, MIN_CHALLENGES, ROMANIZATION_OFF_R } from './constants.js';
import { recognizeRecall, skillRecall, status } from './model.js';
import type { Mastery, Stage, TokenLike, WordStatus } from './types.js';

export interface TokenPlan {
  i: number;
  status: WordStatus;
  /** Show the inline gloss. */
  hint: boolean;
  /** A lighter hint (dotted underline, gloss on tap) for well-recalled learning words. */
  partialHint: boolean;
  /** Show romanization (only when the token has one and the script skill isn't there yet). */
  romanization: boolean;
  /** Offer this word as a guess instead of glossing it. */
  challenge: boolean;
  recall: number;
}

export interface RenderPlan {
  tokens: TokenPlan[];
  /** Percent of tracked tokens already mastered. */
  fadePct: number;
}

function hintFor(stage: Stage, st: WordStatus, encounters: number): boolean {
  switch (stage) {
    case 'listener':
      return true;
    case 'reader':
      return st !== 'mastered';
    case 'conversant':
      return st === 'new' || st === 'fading';
    case 'fluent':
      return st === 'new' && encounters === 0;
  }
}

export function renderPlan(tokens: TokenLike[], mastery: Mastery, now: number, stage: Stage = 'listener'): RenderPlan {
  const tracked = tokens.filter((t) => !t.isPunct);
  const plans: TokenPlan[] = tokens.map((t) => {
    if (t.isPunct) {
      return { i: t.i, status: 'new', hint: false, partialHint: false, romanization: false, challenge: false, recall: 0 };
    }
    const l = mastery[t.lemma];
    const st = status(l, now);
    const r = recognizeRecall(l, now);
    const hint = hintFor(stage, st, l?.encounters ?? 0);
    return {
      i: t.i,
      status: st,
      hint,
      partialHint: hint && st === 'learning' && r >= FADING_R,
      romanization: Boolean(t.romanization) && skillRecall(l?.skills.script, now) < ROMANIZATION_OFF_R,
      challenge: false,
      recall: r,
    };
  });

  // Challenges: words in the "almost know it" band, weakest first, up to max(2, 5% of tokens).
  const maxChallenges = Math.max(MIN_CHALLENGES, Math.floor(CHALLENGE_DENSITY * tracked.length));
  const seen = new Set<string>();
  const candidates = plans
    .filter((p, idx) => {
      const lemma = tokens[idx].lemma;
      if (tokens[idx].isPunct || p.status === 'mastered' || seen.has(lemma)) return false;
      if (p.recall < CHALLENGE_BAND[0] || p.recall > CHALLENGE_BAND[1]) return false;
      seen.add(lemma);
      return true;
    })
    .sort((a, b) => a.recall - b.recall || a.i - b.i)
    .slice(0, maxChallenges);
  for (const c of candidates) {
    c.challenge = true;
    c.hint = false;
    c.partialHint = false;
  }

  const mastered = plans.filter((p, idx) => !tokens[idx].isPunct && p.status === 'mastered').length;
  return { tokens: plans, fadePct: tracked.length ? Math.round((100 * mastered) / tracked.length) : 0 };
}
