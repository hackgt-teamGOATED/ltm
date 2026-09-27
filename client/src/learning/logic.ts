// Pure client-side rules for the Heirloom layer (unit-tested in logic.test.ts; no React, no I/O).
import {
  type EventType,
  type Lang,
  type LearningEvent,
  languageStage,
  type Mastery,
  RECENT_MESSAGES,
  STAGES,
  type Stage,
  status,
  type TokenPlan,
  type WordStatus,
} from '@heirloom/learner';
import type { Message, MessageAnalysis, Token } from '../api/types';
import type { VoiceSource } from '../components/VoicePlayer';

/** Mirrors the server's backfill window (server/src/learning/analyze.ts BACKFILL_COUNT). */
export const BACKFILL_COUNT = 30;
/** A just-arrived message may still be analyzing for this long. */
export const FRESH_MS = 10 * 60_000;

export interface ViewResult {
  stage: Stage;
  readableShare: number;
  fadePct: number;
}

/** Tracked lemmas of the last 20 received, analyzed messages in `lang`. */
export function recentLemmas(
  messages: Message[],
  analyses: Record<string, MessageAnalysis> | undefined,
  meId: string,
  lang: string,
): string[] {
  return messages
    .filter((m) => m.senderId !== meId && m.originalLanguage === lang && analyses?.[m.id] && !analyses[m.id].failed)
    .slice(-RECENT_MESSAGES)
    .flatMap((m) => (analyses?.[m.id]?.tokens ?? []).filter((t) => !t.isPunct).map((t) => t.lemma));
}

/**
 * Stage with hysteresis remembered per `key` (profile + language: a Reader in Spanish must not hold Urdu at
 * Reader). `previous` is read, never mutated; the caller stores the returned stage in the shared map.
 */
export function computeView(
  mastery: Mastery,
  lemmas: string[],
  now: number,
  key: string,
  previous: ReadonlyMap<string, Stage>,
): ViewResult {
  const { stage, readableShare } = languageStage(mastery, lemmas, now, previous.get(key) ?? null);
  return { stage, readableShare, fadePct: Math.round(readableShare * 100) };
}

/** Voice default per stage (PLAN.md §7.4) unless the listener picked one: translated for Listeners. */
export const voiceSource = (override: VoiceSource | null, stage: Stage): VoiceSource =>
  override ?? (stage === 'listener' ? 'translated' : 'original');

/** Merge fetched analyses into what's already there (socket updates may have arrived first). */
export const mergeAnalyses = (
  existing: Record<string, MessageAnalysis> | undefined,
  fetched: MessageAnalysis[],
): Record<string, MessageAnalysis> => ({ ...existing, ...Object.fromEntries(fetched.map((a) => [a.messageId, a])) });

/**
 * Messages the server will still analyze for this learner: received, in `lang`, with text, and either in
 * the backfill window (last 30 received) or fresh. Only these show "annotating…"; the rest stay plain.
 */
export function annotatableIds(messages: Message[], meId: string, lang: string, now: number): Set<string> {
  const received = messages.filter(
    (m) => m.senderId !== meId && m.originalLanguage === lang && m.status === 'ready' && m.originalText?.trim(),
  );
  const ids = new Set(received.slice(-BACKFILL_COUNT).map((m) => m.id));
  for (const m of received) if (now - Date.parse(m.createdAt) < FRESH_MS) ids.add(m.id);
  return ids;
}

// ---------- Phase 5: which interactions become which learning events (PLAN.md §8.3) ----------

/** Minimum on-screen time before a view counts (PLAN.md §8.3). */
export const VIEW_MS = 2500;

export interface EventContext {
  messageId: string;
  threadId: string;
  lang: Lang;
  at: number;
}

/**
 * Events for one message view (≥ 2.5 s on screen): hinted words were seen with help, unhinted words were read
 * on their own (plus script evidence when romanization was hidden). Challenge words wait for the guess, and
 * words already tapped in this message don't count as read unaided. One event per lemma per view.
 */
export function viewEvents(
  tokens: Token[],
  plan: TokenPlan[],
  tapped: ReadonlySet<string>,
  ctx: EventContext,
): LearningEvent[] {
  const out: LearningEvent[] = [];
  const seen = new Set<string>();
  tokens.forEach((t, idx) => {
    const p = plan[idx];
    if (t.isPunct || !p || p.challenge || seen.has(t.lemma)) return;
    seen.add(t.lemma);
    const base = {
      lemma: t.lemma,
      lang: ctx.lang,
      at: ctx.at,
      form: t.surface.toLowerCase(),
      messageId: ctx.messageId,
      threadId: ctx.threadId,
    };
    if (p.hint || p.partialHint) out.push({ ...base, type: 'exposure_hinted' });
    else if (!tapped.has(t.lemma))
      out.push({ ...base, type: 'read_unaided', ...(t.romanization ? { romanizationShown: p.romanization } : {}) });
  });
  return out;
}

/** A tap on an original word: curiosity about a known word is free; otherwise it's a look-up. */
export const tapEventType = (status: WordStatus): EventType => (status === 'mastered' ? 'tap_explore' : 'tap_reveal');

/** Opening the full translation counts against the words that were shown without a hint. */
export function showTranslationEvents(tokens: Token[], plan: TokenPlan[], ctx: EventContext): LearningEvent[] {
  const lemmas = new Set<string>();
  tokens.forEach((t, idx) => {
    const p = plan[idx];
    if (!t.isPunct && p && !p.hint && !p.partialHint && !p.challenge) lemmas.add(t.lemma);
  });
  return [...lemmas].map((lemma) => ({
    lemma,
    lang: ctx.lang,
    at: ctx.at,
    type: 'show_translation',
    messageId: ctx.messageId,
    threadId: ctx.threadId,
  }));
}

/** Four options for an in-chat guess: the right gloss plus 3 others, in a stable order per word. */
export function guessOptions(answer: string, pool: string[], seed: string): string[] {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  };
  const others = [
    ...new Set(pool.map((g) => g.trim()).filter((g) => g && g.toLowerCase() !== answer.trim().toLowerCase())),
  ]
    .sort((a, b) => hash(seed + a) - hash(seed + b))
    .slice(0, 3);
  return [answer, ...others].sort((a, b) => hash(`${seed}|${a}`) - hash(`${seed}|${b}`));
}

/** Lemmas that are mastered now but weren't before (the gloss-dissolve moment). */
export function newlyMastered(before: Mastery, after: Mastery, lemmas: string[], now: number): string[] {
  return [...new Set(lemmas)].filter(
    (l) => status(after[l], now) === 'mastered' && status(before[l], now) !== 'mastered',
  );
}

/** True when `next` is a later stage than `prev` (stage-up card). */
export const isStageUp = (prev: Stage | undefined, next: Stage) =>
  prev !== undefined && STAGES.indexOf(next) > STAGES.indexOf(prev);

export const WEEK_MS = 7 * 24 * 60 * 60_000;
/** Most weeks the slider will offer, so a long log can't produce an unusable strip of buttons. */
export const MAX_DEMO_WEEKS = 8;

/**
 * Week cut-offs for the time-travel slider (PLAN.md §9.2): `weeks[i]` is the moment week `i + 1` ends,
 * so `replay(events, weeks[i])` is mastery as of the end of that week. Weeks run forward from the first
 * event, and the last one always covers the final event, so week N shows the whole log.
 */
export function weekBuckets(events: LearningEvent[], maxWeeks = MAX_DEMO_WEEKS): number[] {
  if (!events.length) return [];
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const e of events) {
    if (e.at < first) first = e.at;
    if (e.at > last) last = e.at;
  }
  const span = Math.max(last - first, 1);
  const count = Math.min(maxWeeks, Math.max(1, Math.ceil(span / WEEK_MS)));
  const step = span / count;
  // Round up to the millisecond so a boundary event lands inside its own week rather than the next one.
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? last : Math.ceil(first + step * (i + 1))));
}

/**
 * Fading words were mastered once and have slipped, so the Progress lists show them with Learning
 * rather than in a list of their own — a word that slipped must never be hidden from the learner.
 * Used for both the counts and the rows so the card and the detail screen can't drift apart.
 */
export function learningBucket<T>(
  buckets: Partial<Record<WordStatus, T[]>>,
): T[] {
  return [...(buckets.learning ?? []), ...(buckets.fading ?? [])];
}

/** The same merge for counts. */
export const learningCount = (counts: Partial<Record<WordStatus, number>>): number =>
  (counts.learning ?? 0) + (counts.fading ?? 0);
