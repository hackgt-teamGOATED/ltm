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
  loadAnalyses: (threadId: string, viewerLang: string) => Promise<void>;
  setSettings: (threadId: string, s: ThreadSettings) => void;
}

const OFF: ThreadSettings = { learningEnabled: false, learningLang: null };

export const useThreads = create<ThreadsState>((set) => ({
  threads: [],
  messages: {},
  analyses: {},
  settings: {},

  loadThreads: async (profileId) => {
    const threads = await api.threads(profileId);
    set({ threads });
    // Previews and ✦ chips for the chat list. Always refetched, so pull-to-refresh is never stale.
    await Promise.all(
      threads.map(async (t) => {
        const [msgs, s] = await Promise.all([api.messages(t.id), api.settings(t.id, profileId).catch(() => OFF)]);
        set((st) => ({ messages: { ...st.messages, [t.id]: msgs }, settings: { ...st.settings, [t.id]: s } }));
      }),
    );
  },

  loadThread: async (threadId, profileId, viewerLang) => {
    // Settings and analyses are optional: if the learning layer is down, the chat still loads.
    const [msgs, s, analyses] = await Promise.all([
      api.messages(threadId),
      api.settings(threadId, profileId).catch(() => OFF),
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
      // Never downgrade: a late 202 response ('processing') must not overwrite a socket update that finished it.
      if (idx !== -1 && list[idx].status !== 'processing' && m.status === 'processing') return st;
      const next = idx === -1 ? [...list, m] : list.map((x) => (x.id === m.id ? m : x));
      return { messages: { ...st.messages, [m.threadId]: next } };
    }),

  loadAnalyses: async (threadId, viewerLang) => {
    const list = await api.analyses(threadId, viewerLang);
    set((st) => ({
      analyses: { ...st.analyses, [threadId]: { ...st.analyses[threadId], ...Object.fromEntries(list.map((a) => [a.messageId, a])) } },
    }));
  },

  setAnalysis: (threadId, a) =>
    set((st) => ({ analyses: { ...st.analyses, [threadId]: { ...st.analyses[threadId], [a.messageId]: a } } })),

  setSettings: (threadId, s) => set((st) => ({ settings: { ...st.settings, [threadId]: s } })),
}));

/** Live previews for the chat list: joins every listed thread's room. Returns an unsubscribe function. */
export function subscribeThreadList(threadIds: string[], profileId: string) {
  const socket = getSocket(profileId);
  const { upsertMessage } = useThreads.getState();
  const join = () => {
    for (const id of threadIds) socket.emit('thread:join', id);
  };
  const onMsg = (m: Message) => threadIds.includes(m.threadId) && upsertMessage(m);
  join();
  socket.on('connect', join);
  socket.on('message:new', onMsg);
  socket.on('message:updated', onMsg);
  return () => {
    socket.off('connect', join);
    socket.off('message:new', onMsg);
    socket.off('message:updated', onMsg);
  };
}

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
  // No thread:leave: the chat list shares this room for its live previews.
  return () => {
    socket.off('connect', join);
    socket.off('message:new', onMsg);
    socket.off('message:updated', onMsg);
    socket.off('analysis:ready', onAnalysis);
  };
}
