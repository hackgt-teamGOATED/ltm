import type { LemmaState, Mastery, Stage } from '@heirloom/learner';
import { create } from 'zustand';
import { api } from '../api/rest';
import { getSocket } from '../api/socket';

/**
 * Last stage shown per `${profileId}:${lang}`, shared by every view (header chip, settings sheet, bubbles) so
 * the hysteresis band can't make two views disagree. Plain mutable map: it's memory, not something to render.
 */
export const previousStages = new Map<string, Stage>();
export const stageKey = (profileId: string, lang: string) => `${profileId}:${lang}`;

interface LearnerState {
  /** mastery[lang] for the signed-in learner (the server is the source of truth). */
  mastery: Record<string, Mastery>;
  loadMastery: (profileId: string, lang: string) => Promise<void>;
  mergeStates: (lang: string, states: LemmaState[]) => void;
}

export const useLearner = create<LearnerState>((set) => ({
  mastery: {},
  loadMastery: async (profileId, lang) => {
    const m = await api.mastery(profileId, lang);
    set((s) => ({ mastery: { ...s.mastery, [lang]: m } }));
  },
  mergeStates: (lang, states) =>
    set((s) => {
      const next = { ...s.mastery[lang] };
      for (const st of states) next[st.lemma] = st;
      return { mastery: { ...s.mastery, [lang]: next } };
    }),
}));

type MasteryUpdate = { profileId: string; changed: { lang: string; lemma: string; state: LemmaState }[] };

/** Keeps mastery live from `mastery:updated` (room profile:<id>). Returns an unsubscribe function. */
export function subscribeMastery(profileId: string) {
  const socket = getSocket(profileId);
  const onUpdate = (u: MasteryUpdate) => {
    if (u.profileId !== profileId) return;
    const byLang = new Map<string, LemmaState[]>();
    for (const c of u.changed) byLang.set(c.lang, [...(byLang.get(c.lang) ?? []), c.state]);
    for (const [lang, states] of byLang) useLearner.getState().mergeStates(lang, states);
  };
  socket.on('mastery:updated', onUpdate);
  return () => {
    socket.off('mastery:updated', onUpdate);
  };
}
