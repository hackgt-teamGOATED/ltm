export type Profile = { id: string; displayName: string; language: string };
export type Thread = { id: string; members: Profile[] };
export type Translation = { language: string; text: string; audioUrl: string | null };
export type WordTiming = { word: string; start: number; end: number };
export type Message = {
  id: string;
  threadId: string;
  senderId: string;
  kind: 'text' | 'voice';
  originalText: string | null;
  originalLanguage: string;
  audioUrl: string | null;
  wordTimestamps: WordTiming[] | null;
  status: 'processing' | 'ready' | 'failed';
  createdAt: string;
  translations: Translation[];
};
