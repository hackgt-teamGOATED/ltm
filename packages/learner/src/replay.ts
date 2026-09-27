// Rebuild mastery from the event log (time-travel slider, seed, server rebuilds).
import { applyEvents, status } from './model.js';
import type { Lang, LearningEvent, Mastery, WordStatus } from './types.js';

/** Mastery for one language from every event up to and including `untilMs`. */
export function replay(events: LearningEvent[], untilMs: number, lang?: Lang): Mastery {
  const picked = events.filter((e) => e.at <= untilMs && (!lang || e.lang === lang));
  return applyEvents({}, picked).mastery;
}

export type WordLists = Record<WordStatus, string[]>;

/** Lemmas grouped by status, each list sorted alphabetically. */
export function wordLists(mastery: Mastery, now: number): WordLists {
  const out: WordLists = { mastered: [], learning: [], new: [], fading: [] };
  for (const [lemma, state] of Object.entries(mastery)) out[status(state, now)].push(lemma);
  for (const list of Object.values(out)) list.sort();
  return out;
}
