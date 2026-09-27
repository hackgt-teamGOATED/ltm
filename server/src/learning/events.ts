// Validation for client-posted learning events. Pure (no database), so it's unit-tested.
import type { EventType, LearningEvent } from '@heirloom/learner';
import { HttpError } from '../http.js';
import { isLang } from './types.js';

export const EVENT_TYPES: EventType[] = [
  'exposure_hinted',
  'read_unaided',
  'tap_reveal',
  'tap_explore',
  'guess_correct',
  'guess_wrong',
  'audio_play',
  'show_translation',
  'used_suggested',
  'used_unprompted',
];
/** Oldest client-supplied timestamp we accept (seeded history spans 8 weeks). */
export const MAX_EVENT_AGE_MS = 365 * 86_400_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (x: unknown) => (typeof x === 'string' && UUID_RE.test(x) ? x : null);

/** Validates one event. `at` may be supplied (seeding, offline queue) but never in the future or over a year old. */
export function parseEvent(x: unknown, now: number): LearningEvent {
  const e = (x ?? {}) as Record<string, unknown>;
  if (typeof e.lemma !== 'string' || !e.lemma.trim() || e.lemma.length > 80) throw new HttpError(400, 'event.lemma');
  if (!isLang(e.lang)) throw new HttpError(400, 'event.lang');
  if (!EVENT_TYPES.includes(e.type as EventType)) throw new HttpError(400, 'event.type');
  let at = now;
  if (e.at !== undefined) {
    if (typeof e.at !== 'number' || !Number.isFinite(e.at) || e.at < now - MAX_EVENT_AGE_MS) {
      throw new HttpError(400, 'event.at must be epoch milliseconds within the last year');
    }
    at = Math.min(e.at, now);
  }
  return {
    lemma: e.lemma.trim(),
    lang: e.lang,
    type: e.type as EventType,
    at,
    form: typeof e.form === 'string' ? e.form.slice(0, 80) : undefined,
    threadId: uuidOrNull(e.threadId),
    messageId: uuidOrNull(e.messageId),
    options: typeof e.options === 'number' && Number.isFinite(e.options) ? Math.round(e.options) : null,
    ...(typeof e.romanizationShown === 'boolean' ? { romanizationShown: e.romanizationShown } : {}),
  };
}
