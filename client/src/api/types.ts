// Mirrors the server's API shapes (server/src/messages.ts, server/src/learning/types.ts).
export type Lang = 'en' | 'es' | 'ur' | 'hi';

export interface Profile {
  id: string;
  displayName: string;
  language: string;
}

export interface Thread {
  id: string;
  members: Profile[];
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface Translation {
  language: string;
  text: string;
  audioUrl: string | null;
}

export interface Message {
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
}

export type Span = [number, number];

export interface Token {
  i: number;
  surface: string;
  pre: string;
  lemma: string;
  romanization?: string;
  gloss: string;
  pos?: string;
  grammar?: string;
  phraseId?: string;
  isPunct?: boolean;
  tSpans?: Span[];
  start?: number;
  end?: number;
}

export interface Phrase {
  id: string;
  tokenIndices: number[];
  meaning: string;
  isIdiom: boolean;
  culture?: string;
  tSpans?: Span[];
}

export interface MessageAnalysis {
  messageId: string;
  viewerLang: Lang;
  translation: string;
  tokens: Token[];
  phrases: Phrase[];
  needsNativeCheck: boolean;
  failed?: boolean;
}

export interface ThreadSettings {
  learningEnabled: boolean;
  learningLang: Lang | null;
}

export interface WordNotes {
  lang: string;
  lemma: string;
  viewerLang: string;
  usage: string;
  grammar: string;
  culture: string | null;
  examples: { text: string; translation: string }[];
  isIdiom: boolean;
}

export type Stage = 'listener' | 'reader' | 'conversant' | 'fluent';
export type WordStatus = 'new' | 'learning' | 'mastered' | 'fading';

export interface LanguageProgress {
  lang: Lang;
  stage: Stage;
  readableShare: number;
  fadePct: number;
  counts: Record<WordStatus, number>;
  threads: string[];
}

export interface WordRowData {
  lemma: string;
  status: WordStatus;
  recall: number;
  surface: string;
  gloss: string;
  romanization?: string;
  messageId?: string;
}

export interface LanguageDetail {
  lang: Lang;
  stage: Stage;
  readableShare: number;
  fadePct: number;
  counts: Record<WordStatus, number>;
  words: Record<WordStatus, WordRowData[]>;
  weekly: { week: number; end: number; readableShare: number; mastered: number; messages: number }[];
}

export interface PracticeItem {
  lemma: string;
  messageId: string;
  text: string;
  tokenIndex: number;
  surface: string;
  options: string[];
  answerIndex: number;
}
