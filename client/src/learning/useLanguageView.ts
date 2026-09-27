// Stage and fade for one learner in one language (PLAN.md §7.4), from the same @heirloom/learner functions
// the server uses. Stage is per user per language, never per bubble.
import type { Mastery, Stage } from '@heirloom/learner';
import { useMemo } from 'react';
import type { Message, MessageAnalysis } from '../api/types';
import { masteryKey, previousStages, stageKey, useLearner } from '../store/learner';
import { computeView, recentLemmas } from './logic';

const EMPTY: Mastery = {};

export interface LanguageView {
  stage: Stage;
  readableShare: number;
  fadePct: number;
  mastery: Mastery;
}

/** `now` is passed in so a demo slider can render any moment (Phase 7). */
export function useLanguageView(
  lang: string | null,
  messages: Message[],
  analyses: Record<string, MessageAnalysis> | undefined,
  meId: string,
  now: number,
): LanguageView {
  const mastery = useLearner((s) => (lang ? s.mastery[masteryKey(meId, lang)] : undefined)) ?? EMPTY;
  const view = useMemo(() => {
    if (!lang) return { stage: 'listener' as Stage, readableShare: 0, fadePct: 0, mastery };
    const key = stageKey(meId, lang);
    const v = computeView(mastery, recentLemmas(messages, analyses, meId, lang), now, key, previousStages);
    previousStages.set(key, v.stage); // shared hysteresis memory (see store/learner.ts)
    return { ...v, mastery };
  }, [messages, analyses, mastery, meId, lang, now]);

  return view;
}

export const STAGE_LABEL: Record<Stage, string> = {
  listener: 'Listener',
  reader: 'Reader',
  conversant: 'Conversant',
  fluent: 'Fluent',
};
