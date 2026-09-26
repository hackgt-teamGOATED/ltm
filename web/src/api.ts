import type { Message, Profile, Thread } from './types';

// Empty = same origin: requests go through the Vite proxy (see vite.config.ts).
// Set VITE_API_URL only if the API is hosted somewhere else (e.g. a deployed server).
export const API_URL = import.meta.env.VITE_API_URL ?? '';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function fileExtension(mime: string) {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

export const api = {
  profiles: () => fetch(`${API_URL}/api/profiles`).then((r) => json<Profile[]>(r)),

  threads: (profileId: string) =>
    fetch(`${API_URL}/api/profiles/${profileId}/threads`).then((r) => json<Thread[]>(r)),

  messages: (threadId: string) =>
    fetch(`${API_URL}/api/threads/${threadId}/messages`).then((r) => json<Message[]>(r)),

  sendText: (threadId: string, senderId: string, text: string) =>
    fetch(`${API_URL}/api/threads/${threadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId, text }),
    }).then((r) => json<Message>(r)),

  // Server-side text-to-speech, used only when the browser has no voice for the language.
  speech: async (text: string, language: string) => {
    const res = await fetch(`${API_URL}/api/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Request failed (${res.status})`);
    }
    return res.blob();
  },

  sendVoice: (threadId: string, senderId: string, audio: Blob) => {
    const form = new FormData();
    form.append('senderId', senderId); // text fields before the file so the server sees them
    form.append('audio', audio, `voice.${fileExtension(audio.type)}`);
    return fetch(`${API_URL}/api/threads/${threadId}/voice`, { method: 'POST', body: form }).then((r) =>
      json<Message>(r),
    );
  },
};
