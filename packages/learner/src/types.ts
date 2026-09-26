export type Lang = 'en' | 'es' | 'ur' | 'hi';
export type Skill = 'recognize' | 'script' | 'produce';
export type EvidenceKind = 'success' | 'failure' | 'exposure';
export type WordStatus = 'new' | 'learning' | 'mastered' | 'fading';
export type Stage = 'listener' | 'reader' | 'conversant' | 'fluent';

export type EventType =
  | 'exposure_hinted'
  | 'read_unaided'
  | 'tap_reveal'
  | 'tap_explore'
  | 'guess_correct'
  | 'guess_wrong'
  | 'audio_play'
  | 'show_translation'
  | 'used_suggested'
  | 'used_unprompted';

/** One learner interaction with one word. `at` is epoch milliseconds. */
export interface LearningEvent {
  lemma: string;
  lang: Lang;
  type: EventType;
  at: number;
  form?: string;
  threadId?: string | null;
  messageId?: string | null;
  /** Number of choices for guesses (default 4). */
  options?: number | null;
  /** False when the word was shown without romanization (earns script evidence). */
  romanizationShown?: boolean;
}

export interface HistoryEntry {
  t: number;
  kind: EvidenceKind;
  w: number;
  r: number;
}

export interface SkillState {
  stability: number;
  initialStability: number;
  lastReview: number;
  /** UTC day numbers (floor(ms / 1 day)) with at least one success. */
  successDays: number[];
  successes: number;
  failures: number;
  history: HistoryEntry[];
}

export interface LemmaState {
  lemma: string;
  lang: Lang;
  difficulty: number;
  formsSeen: string[];
  contexts: string[];
  encounters: number;
  wasMastered: boolean;
  skills: Partial<Record<Skill, SkillState>>;
}

/** Mastery for one user in one language, keyed by lemma. */
export type Mastery = Record<string, LemmaState>;

/** The minimal token shape the model needs (a subset of the server's Token). */
export interface TokenLike {
  i: number;
  lemma: string;
  surface?: string;
  gloss?: string;
  romanization?: string;
  isPunct?: boolean;
}
