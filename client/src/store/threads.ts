import { create } from 'zustand';
import { api } from '../api/rest';
import { getSocket } from '../api/socket';
import type { Message, MessageAnalysis, Thread, ThreadSettings } from '../api/types';

interface ThreadsState {
  threads: Thread[];
  messages: Record<string, Message[]>;
  /** analyses[threadId][messageId] for the viewer's language */
  analyses: Record<string, Record<string, MessageAnalysis>>;
  settings: Record<string, ThreadSettings>;
  loadThreads: (profileId: string) => Promise<void>;
  loadThread: (threadId: string, profileId: string, viewerLang: string) => Promise<void>;
  upsertMessage: (m: Message) => void;
  setAnalysis: (threadId: string, a: MessageAnalysis) => void;
  setSettings: (threadId: string, s: ThreadSettings) => void;
}

export const useThreads = create<ThreadsState>((set, get) => ({
  threads: [],
  messages: {},
  analyses: {},
  settings: {},

  loadThreads: async (profileId) => {
    const threads = await api.threads(profileId);
    set({ threads });
    // Previews and ✦ chips for the chat list.
    await Promise.all(
      threads.map(async (t) => {
        const [msgs, s] = await Promise.all([
          get().messages[t.id] ? Promise.resolve(get().messages[t.id]) : api.messages(t.id),
          api.settings(t.id, profileId).catch(() => ({ learningEnabled: false, learningLang: null })),
        ]);
        set((st) => ({ messages: { ...st.messages, [t.id]: msgs }, settings: { ...st.settings, [t.id]: s } }));
      }),
    );
  },

  loadThread: async (threadId, profileId, viewerLang) => {
    const [msgs, s, analyses] = await Promise.all([
      api.messages(threadId),
      api.settings(threadId, profileId),
      api.analyses(threadId, viewerLang).catch(() => [] as MessageAnalysis[]),
    ]);
    set((st) => ({
      messages: { ...st.messages, [threadId]: msgs },
      settings: { ...st.settings, [threadId]: s },
      analyses: { ...st.analyses, [threadId]: Object.fromEntries(analyses.map((a) => [a.messageId, a])) },
    }));
  },

  upsertMessage: (m) =>
    set((st) => {
      const list = st.messages[m.threadId] ?? [];
      const idx = list.findIndex((x) => x.id === m.id);
      const next = idx === -1 ? [...list, m] : list.map((x) => (x.id === m.id ? m : x));
      return { messages: { ...st.messages, [m.threadId]: next } };
    }),

  setAnalysis: (threadId, a) =>
    set((st) => ({ analyses: { ...st.analyses, [threadId]: { ...st.analyses[threadId], [a.messageId]: a } } })),

  setSettings: (threadId, s) => set((st) => ({ settings: { ...st.settings, [threadId]: s } })),
}));

/** Live updates for one open conversation. Returns an unsubscribe function. */
export function subscribeThread(threadId: string, profileId: string, viewerLang: string) {
  const socket = getSocket(profileId);
  const { upsertMessage, setAnalysis } = useThreads.getState();
  const join = () => socket.emit('thread:join', threadId);
  const onMsg = (m: Message) => m.threadId === threadId && upsertMessage(m);
  const onAnalysis = async (e: { messageId: string; viewerLang: string }) => {
    if (e.viewerLang !== viewerLang) return;
    try {
      setAnalysis(threadId, await api.analysis(e.messageId, viewerLang));
    } catch {}
  };
  join();
  socket.on('connect', join); // rejoin after reconnects
  socket.on('message:new', onMsg);
  socket.on('message:updated', onMsg);
  socket.on('analysis:ready', onAnalysis);
  return () => {
    socket.emit('thread:leave', threadId);
    socket.off('connect', join);
    socket.off('message:new', onMsg);
    socket.off('message:updated', onMsg);
    socket.off('analysis:ready', onAnalysis);
  };
}
