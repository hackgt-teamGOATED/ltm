// Learning events: applied locally at once (optimistic, same model as the server), then posted in batches.
// Failed posts stay queued and retry with backoff; the server's mastery:updated reply then confirms them.
import type { LearningEvent } from '@heirloom/learner';
import { api } from '../api/rest';
import { useLearner } from '../store/learner';

const FLUSH_MS = 1500;
const MAX_BATCH = 200;
const MAX_BACKOFF_MS = 30_000;

let queue: { profileId: string; event: LearningEvent }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let backoff = FLUSH_MS;
let flushing = false;
/** Set by the demo slider (Phase 7): replaying history must never log events. */
let paused = false;

export function setLoggingPaused(p: boolean) {
  paused = p;
}

export function logEvents(profileId: string, events: LearningEvent[]) {
  if (paused || !events.length) return;
  useLearner.getState().applyLocal(profileId, events);
  for (const event of events) queue.push({ profileId, event });
  schedule(FLUSH_MS);
}

function schedule(ms: number) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, ms);
}

async function flush() {
  if (flushing || !queue.length) return;
  flushing = true;
  const profileId = queue[0].profileId;
  const batch = queue.filter((q) => q.profileId === profileId).slice(0, MAX_BATCH);
  try {
    await api.postEvents(
      profileId,
      batch.map((b) => b.event),
    );
    queue = queue.filter((q) => !batch.includes(q));
    backoff = FLUSH_MS;
  } catch (e) {
    // 4xx means the server rejected these events for good (e.g. validation); don't retry them forever.
    const status = (e as { status?: number }).status;
    if (status && status >= 400 && status < 500) queue = queue.filter((q) => !batch.includes(q));
    else backoff = Math.min(MAX_BACKOFF_MS, backoff * 2);
  } finally {
    flushing = false;
    if (queue.length) schedule(backoff);
  }
}

export const pendingEvents = () => queue.length;
