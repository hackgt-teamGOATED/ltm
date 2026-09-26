import { create } from 'zustand';
import type { Profile } from '../api/types';
import { castBySlug } from '../lib/cast';
import { storage } from '../lib/storage';

const KEY = 'heirloom.as';

interface SessionState {
  /** Persona slug (arjun, abuela, zara). */
  as: string | null;
  profiles: Profile[];
  setAs: (slug: string | null) => void;
  setProfiles: (p: Profile[]) => void;
}

export const useSession = create<SessionState>((set) => ({
  as: castBySlug(storage.get(KEY))?.slug ?? null,
  profiles: [],
  setAs: (slug) => {
    storage.set(KEY, slug);
    set({ as: slug });
  },
  setProfiles: (profiles) => set({ profiles }),
}));

/** The signed-in persona as a full profile (falls back to the cast table before profiles load). */
export function useMe(): Profile | null {
  const as = useSession((s) => s.as);
  const profiles = useSession((s) => s.profiles);
  const c = castBySlug(as);
  if (!c) return null;
  return profiles.find((p) => p.id === c.id) ?? { id: c.id, displayName: c.name, language: c.language };
}
