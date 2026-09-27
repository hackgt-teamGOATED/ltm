// Stage and fade for one learner in one language (PLAN.md §7.4), from the same @heirloom/learner functions
// the server uses. Stage is per user per language, never per bubble.
import { languageStage, type Mastery, RECENT_MESSAGES, type Stage } from '@heirloom/learner';
import { useMemo, useRef } from 'react';
import type { Message, MessageAnalysis } from '../api/types';
import { useLearner } from '../store/learner';

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
  const mastery = useLearner((s) => (lang ? s.mastery[lang] : undefined)) ?? EMPTY;
  const previous = useRef<Stage | null>(null);

  const view = useMemo(() => {
    const recent = messages
      .filter((m) => m.senderId !== meId && m.originalLanguage === lang && analyses?.[m.id] && !analyses[m.id].failed)
      .slice(-RECENT_MESSAGES)
      .flatMap((m) => (analyses?.[m.id]?.tokens ?? []).filter((t) => !t.isPunct).map((t) => t.lemma));
    const { stage, readableShare } = languageStage(mastery, recent, now, previous.current);
    return { stage, readableShare, fadePct: Math.round(readableShare * 100), mastery };
  }, [messages, analyses, mastery, meId, lang, now]);

  previous.current = view.stage;
  return view;
}

export const STAGE_LABEL: Record<Stage, string> = {
  listener: 'Listener',
  reader: 'Reader',
  conversant: 'Conversant',
  fluent: 'Fluent',
};
