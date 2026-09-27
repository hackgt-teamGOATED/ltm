// Pure client-side rules for the Heirloom layer (unit-tested in logic.test.ts; no React, no I/O).
import { languageStage, type Mastery, RECENT_MESSAGES, type Stage } from '@heirloom/learner';
import type { Message, MessageAnalysis } from '../api/types';
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
