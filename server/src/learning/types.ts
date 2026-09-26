// Shared API types for the learning layer (PLAN.md §5.3). client/src/api/types.ts mirrors these.
export type Lang = 'en' | 'es' | 'ur' | 'hi';
export const LANGS: Lang[] = ['en', 'es', 'ur', 'hi'];
export const isLang = (x: unknown): x is Lang => typeof x === 'string' && (LANGS as string[]).includes(x);

export type Span = [number, number];

export interface Token {
  i: number; // position in the original text
  surface: string; // as written
  pre: string; // whitespace before this token in the original (joined pre + surface reproduces it)
  lemma: string; // dictionary form: the mastery key
  romanization?: string; // required for ur and hi
  gloss: string; // meaning in the viewer's language
  pos?: string;
  grammar?: string; // one short line
  phraseId?: string; // member of a multi-word unit
  isPunct?: boolean; // not tappable, not tracked
  tSpans?: Span[]; // char ranges in `translation`
  start?: number; // seconds, voice notes only
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
