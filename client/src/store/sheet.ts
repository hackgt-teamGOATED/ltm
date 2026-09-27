import type { ReactNode } from 'react';
import { create } from 'zustand';

interface SheetState {
  content: ReactNode | null;
  open: (content: ReactNode) => void;
  close: () => void;
}

/** One app-wide bottom sheet (settings, View more, demo panel). */
export const useSheet = create<SheetState>((set) => ({
  content: null,
  open: (content) => set({ content }),
  close: () => set({ content: null }),
}));
