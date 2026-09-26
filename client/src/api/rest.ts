import type { LearningEvent } from '@heirloom/learner';
import { apiBase } from './config';
import type {
  LanguageDetail,
  LanguageProgress,
  Message,
  MessageAnalysis,
  PracticeItem,
  Profile,
  Thread,
  ThreadSettings,
  WordNotes,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}/api${path}`, init);
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch {}
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const q = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined)).toString();

export const api = {
  profiles: () => request<Profile[]>('/profiles'),
  threads: (profileId: string) => request<Thread[]>(`/profiles/${profileId}/threads`),
  messages: (threadId: string) => request<Message[]>(`/threads/${threadId}/messages`),
  sendText: (threadId: string, senderId: string, text: string) =>
    request<Message>(`/threads/${threadId}/messages`, json('POST', { senderId, text })),
  sendVoice: (threadId: string, form: FormData) =>
    request<Message>(`/threads/${threadId}/voice`, { method: 'POST', body: form }),

  settings: (threadId: string, profileId: string) =>
    request<ThreadSettings>(`/threads/${threadId}/settings?${q({ profileId })}`),
  putSettings: (threadId: string, profileId: string, s: ThreadSettings) =>
    request<ThreadSettings>(`/threads/${threadId}/settings`, json('PUT', { profileId, ...s })),

  analyses: (threadId: string, lang: string) =>
    request<MessageAnalysis[]>(`/threads/${threadId}/analyses?${q({ lang })}`),
  analysis: (messageId: string, lang: string) =>
    request<MessageAnalysis>(`/messages/${messageId}/analysis?${q({ lang })}`),
  wordNotes: (lang: string, lemma: string, viewerLang: string, profileId: string) =>
    request<WordNotes>(`/words/${lang}/${encodeURIComponent(lemma)}/notes?${q({ viewerLang, profileId })}`),

  postEvents: (profileId: string, events: LearningEvent[]) =>
    request<{ changed: unknown[] }>('/events', json('POST', { profileId, events })),
  mastery: (profileId: string, lang: string) =>
    request<Record<string, import('@heirloom/learner').LemmaState>>(`/profiles/${profileId}/mastery?${q({ lang })}`),
  events: (profileId: string, lang?: string) =>
    request<LearningEvent[]>(`/profiles/${profileId}/events?${q({ lang })}`),
  progress: (profileId: string) => request<LanguageProgress[]>(`/profiles/${profileId}/progress`),
  progressDetail: (profileId: string, lang: string) =>
    request<LanguageDetail>(`/profiles/${profileId}/progress/${lang}`),
  practice: (profileId: string, lang: string) => request<PracticeItem[]>(`/practice/${profileId}/${lang}`),

  /** mp3 URL for reading a word or text aloud (server TTS). */
  speechUrl: () => `${apiBase()}/api/speech`,
};
