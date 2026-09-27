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

export interface ViewOverride {
  /** Mastery to render instead of the live store (the demo slider replays the event log into this). */
  mastery: Mastery;
  /** Separate hysteresis memory, so replay can never change how the live chat renders afterwards. */
  stages: Map<string, Stage>;
}

/**
 * `now` is passed in so the demo slider can render any moment (PLAN.md §9.2). Pass `override` to render
 * a replayed snapshot: it reads nothing from and writes nothing to the live learner store.
 */
export function useLanguageView(
  lang: string | null,
  messages: Message[],
  analyses: Record<string, MessageAnalysis> | undefined,
  meId: string,
  now: number,
  override?: ViewOverride,
): LanguageView {
  const live = useLearner((s) => (lang ? s.mastery[masteryKey(meId, lang)] : undefined)) ?? EMPTY;
  const mastery = override?.mastery ?? live;
  const stages = override?.stages ?? previousStages;
  const view = useMemo(() => {
    if (!lang) return { stage: 'listener' as Stage, readableShare: 0, fadePct: 0, mastery };
    const key = stageKey(meId, lang);
    const v = computeView(mastery, recentLemmas(messages, analyses, meId, lang), now, key, stages);
    stages.set(key, v.stage); // hysteresis memory: the shared map live, a throwaway map while replaying
    return { ...v, mastery };
  }, [messages, analyses, mastery, meId, lang, now, stages]);

  return view;
}

export const STAGE_LABEL: Record<Stage, string> = {
  listener: 'Listener',
  reader: 'Reader',
  conversant: 'Conversant',
  fluent: 'Fluent',
};
