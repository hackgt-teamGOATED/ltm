import { create } from 'zustand';

/** The one open word card in a conversation (PLAN.md §7.5): a token, or a whole phrase. */
export interface Selection {
  messageId: string;
  tokenIndex: number;
}

interface SelectionState {
  selected: Selection | null;
  select: (s: Selection | null) => void;
}

export const useSelection = create<SelectionState>((set) => ({
  selected: null,
  select: (selected) => set({ selected }),
}));
