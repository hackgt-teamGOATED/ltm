// Time-travel slider state (PLAN.md §9.2). Strictly read-only: it fetches Arjun's event log once and
// replays it through the real learner model. It never logs an event and never writes to the learner store.
import type { LearningEvent, Mastery, Stage } from '@heirloom/learner';
import { replay } from '@heirloom/learner';
import { create } from 'zustand';
import { api } from '../api/rest';
import { setLoggingPaused } from '../learning/eventQueue';
import { weekBuckets } from '../learning/logic';

/** `null` week means "Now": the live view, no replay. */
export type DemoWeek = number | null;

/**
 * Stage hysteresis memory for replay only. The live map in store/learner.ts must never see demo stages,
 * or scrubbing would change how the chat renders after the panel closes.
 */
export const demoStages = new Map<string, Stage>();

interface DemoState {
  active: boolean;
  week: DemoWeek;
  events: LearningEvent[];
  /** Millisecond cut-off per week index (1-based); `weeks.length` is how many the log spans. */
  weeks: number[];
  loading: boolean;
  error: string | null;
  open: (profileId: string) => Promise<void>;
  setWeek: (week: DemoWeek) => void;
  close: () => void;
}

export const useDemo = create<DemoState>((set, get) => ({
  active: false,
  week: null,
  events: [],
  weeks: [],
  loading: false,
  error: null,

  open: async (profileId) => {
    if (get().active) return;
    demoStages.clear();
    setLoggingPaused(true); // replay is render-only (§9.2)
    set({ active: true, loading: true, error: null, week: null });
    try {
      const events = await api.events(profileId);
      set({ events, weeks: weekBuckets(events), loading: false });
    } catch (e) {
      // Leave the panel open so the human sees why; "Now" still renders the live view.
      set({ error: (e as Error).message, loading: false });
    }
  },

  setWeek: (week) => {
    // Each week is an independent snapshot of history, so it must not inherit the stage of whichever
    // week was looked at before. Hysteresis exists to stop a *live* view flickering across the
    // threshold; carried across a scrub it makes the stage depend on click order — preview week 8,
    // rewind to week 7, and week 7 would still render as Reader.
    demoStages.clear();
    set({ week });
  },

  close: () => {
    setLoggingPaused(false);
    demoStages.clear();
    set({ active: false, week: null });
  },
}));

/** The clock the model renders against: the chosen week's cut-off, or the real now. */
export function demoNow(week: DemoWeek, weeks: number[], realNow: number): number {
  if (week === null) return realNow;
  return weeks[week - 1] ?? realNow;
}

/** Mastery as of the chosen week, or `undefined` to use the live store. */
export function demoMastery(
  week: DemoWeek,
  weeks: number[],
  events: LearningEvent[],
  lang: string | null,
): Mastery | undefined {
  if (week === null || !lang) return undefined;
  const until = weeks[week - 1];
  if (until === undefined) return undefined;
  return replay(events, until, lang as Parameters<typeof replay>[2]);
}
