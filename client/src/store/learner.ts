import { applyEvents, type LearningEvent, type LemmaState, type Mastery, type Stage } from '@heirloom/learner';
import { create } from 'zustand';
import { api } from '../api/rest';
import { getSocket } from '../api/socket';
import { newlyMastered } from '../learning/logic';

/** Mastery is kept per profile and language, so switching persona never shows someone else's words. */
export const masteryKey = (profileId: string, lang: string) => `${profileId}:${lang}`;
export const stageKey = masteryKey;

/**
 * Last stage shown per `${profileId}:${lang}`, shared by every view (header chip, settings sheet, bubbles) so
 * the hysteresis band can't make two views disagree. Plain mutable map: it's memory, not something to render.
 */
export const previousStages = new Map<string, Stage>();

/** How long a just-mastered word keeps its "You know this now" moment. */
export const DISSOLVE_MS = 1200;

interface LearnerState {
  /** mastery[`${profileId}:${lang}`] (the server is the source of truth; local events apply optimistically). */
  mastery: Record<string, Mastery>;
  /** lemma → time it became mastered, per mastery key (drives the gloss dissolve). */
  justMastered: Record<string, Record<string, number>>;
  /** Taps per message in this session ("✦ Read on your own" = viewed with zero taps). */
  reads: Record<string, { viewed: boolean; taps: number; tapped: string[] }>;
  loadMastery: (profileId: string, lang: string) => Promise<void>;
  mergeStates: (profileId: string, lang: string, states: LemmaState[]) => void;
  /** Apply events locally with the same model the server runs (optimistic update). */
  applyLocal: (profileId: string, events: LearningEvent[]) => void;
  markViewed: (messageId: string) => void;
  markTap: (messageId: string, lemma: string) => void;
}

export const useLearner = create<LearnerState>((set) => ({
  mastery: {},
  justMastered: {},
  reads: {},
  loadMastery: async (profileId, lang) => {
    const m = await api.mastery(profileId, lang);
    set((s) => ({ mastery: { ...s.mastery, [masteryKey(profileId, lang)]: m } }));
  },
  mergeStates: (profileId, lang, states) =>
    set((s) => {
      const key = masteryKey(profileId, lang);
      const next = { ...s.mastery[key] };
      for (const st of states) next[st.lemma] = st;
      return { mastery: { ...s.mastery, [key]: next } };
    }),
  applyLocal: (profileId, events) =>
    set((s) => {
      const now = Date.now();
      const mastery = { ...s.mastery };
      const justMastered = { ...s.justMastered };
      for (const lang of new Set(events.map((e) => e.lang))) {
        const key = masteryKey(profileId, lang);
        const before = mastery[key] ?? {};
        const mine = events.filter((e) => e.lang === lang);
        const after = applyEvents(before, mine).mastery;
        mastery[key] = after;
        const fresh = newlyMastered(
          before,
          after,
          mine.map((e) => e.lemma),
          now,
        );
        if (fresh.length) justMastered[key] = { ...justMastered[key], ...Object.fromEntries(fresh.map((l) => [l, now])) };
      }
      return { mastery, justMastered };
    }),
  markViewed: (messageId) =>
    set((s) => ({
      reads: { ...s.reads, [messageId]: { ...(s.reads[messageId] ?? { taps: 0, tapped: [] }), viewed: true } },
    })),
  markTap: (messageId, lemma) =>
    set((s) => {
      const r = s.reads[messageId] ?? { viewed: false, taps: 0, tapped: [] };
      return { reads: { ...s.reads, [messageId]: { ...r, taps: r.taps + 1, tapped: [...r.tapped, lemma] } } };
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
    for (const [lang, states] of byLang) useLearner.getState().mergeStates(profileId, lang, states);
  };
  socket.on('mastery:updated', onUpdate);
  return () => {
    socket.off('mastery:updated', onUpdate);
  };
}
