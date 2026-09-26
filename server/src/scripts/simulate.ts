// Simulated learner behavior for the demo seed (PLAN.md §9.1). Pure and seeded: the same inputs always give
// the same event log. Arjun has a hidden "true" memory per word; the real learner model only sees his
// interactions (the events), exactly as it would in the app.
import {
  applyEvents,
  DAY_MS,
  type Lang,
  type LearningEvent,
  languageStage,
  type Mastery,
  practiceItems,
  RECENT_MESSAGES,
  renderPlan,
  type Stage,
  type TokenLike,
} from '@heirloom/learner';

export interface SimMessage {
  id: string;
  threadId: string;
  at: number;
  lang: Lang;
  kind: 'text' | 'voice';
  text: string;
  tokens: TokenLike[];
}

/** mulberry32: tiny seeded PRNG. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Behavior knobs (simulated, stated in the write-up). Tuned for a realistic arc with the model unchanged
 * (D-024): an engaged learner stays at Listener for most of 8 weeks and reaches Reader in Spanish by week 8.
 */
export const BEHAVIOR = {
  readDelayMin: 10, // minutes after a message arrives
  readDelayMax: 180,
  skimRate: 0.08, // opens the chat but doesn't linger (no events)
  curiousTapRate: 0.2, // taps a hinted word he doesn't know yet
  audioPlayRate: 0.4, // plays a word of a voice note
  practiceWeekdays: [0, 1, 2, 3, 4, 5, 6] as number[], // a short 5-question practice session each day
  // Hidden memory: half-life in days, multiplied on each kind of contact.
  firstHalfLife: 2,
  gain: { exposure: 1.8, reveal: 2.0, recall: 2.6, guess: 2.4 },
  stickiness: 0.25, // words that recur a lot are easier: extra gain per prior contact (capped)
};

interface TrueMemory {
  halfLife: number;
  last: number;
  contacts: number;
}

export interface SimResult {
  events: LearningEvent[];
  weekly: { week: number; stage: Stage; readableShare: number }[];
}

export function simulateLearner(messages: SimMessage[], seed: number, start: number, end: number): SimResult {
  const rand = rng(seed);
  const lang = messages[0]?.lang;
  const events: LearningEvent[] = [];
  const memory = new Map<string, TrueMemory>();
  let mastery: Mastery = {};
  let stage: Stage | null = null;
  const seen: SimMessage[] = [];

  const pKnow = (lemma: string, now: number) => {
    const m = memory.get(lemma);
    if (!m) return 0;
    return 2 ** (-(now - m.last) / DAY_MS / m.halfLife);
  };
  const touch = (lemma: string, now: number, kind: keyof typeof BEHAVIOR.gain) => {
    const m = memory.get(lemma);
    if (!m) {
      memory.set(lemma, { halfLife: BEHAVIOR.firstHalfLife, last: now, contacts: 1 });
      return;
    }
    const boost = 1 + Math.min(1, m.contacts * BEHAVIOR.stickiness * 0.1);
    m.halfLife = Math.min(120, m.halfLife * BEHAVIOR.gain[kind] * boost);
    m.last = now;
    m.contacts += 1;
  };
  const emit = (e: Omit<LearningEvent, 'lang'>) => {
    const ev = { ...e, lang: lang as Lang };
    events.push(ev);
    mastery = applyEvents(mastery, [ev]).mastery;
  };
  const recentLemmas = (now: number) =>
    seen
      .filter((m) => m.at <= now)
      .slice(-RECENT_MESSAGES)
      .flatMap((m) => m.tokens.filter((t) => !t.isPunct).map((t) => t.lemma));

  // Reading sessions (one per received message) and weekly practice, in time order.
  type Session = { at: number; kind: 'read'; msg: SimMessage } | { at: number; kind: 'practice' };
  const sessions: Session[] = messages.map((msg) => ({
    at: Math.min(end, msg.at + (BEHAVIOR.readDelayMin + rand() * (BEHAVIOR.readDelayMax - BEHAVIOR.readDelayMin)) * 60_000),
    kind: 'read',
    msg,
  }));
  for (let t = start; t < end; t += DAY_MS) {
    if (BEHAVIOR.practiceWeekdays.includes(new Date(t).getUTCDay())) sessions.push({ at: t + 20 * 3600_000, kind: 'practice' });
  }
  sessions.sort((a, b) => a.at - b.at);

  const weekly: SimResult['weekly'] = [];
  let nextWeekEnd = start + 7 * DAY_MS;
  const snapshotWeeks = (until: number) => {
    while (nextWeekEnd <= until && weekly.length < 8) {
      const s = languageStage(mastery, recentLemmas(nextWeekEnd), nextWeekEnd, stage);
      weekly.push({ week: weekly.length + 1, stage: s.stage, readableShare: s.readableShare });
      nextWeekEnd += 7 * DAY_MS;
    }
  };

  for (const s of sessions) {
    if (s.at > end) continue;
    snapshotWeeks(s.at);
    const now = s.at;
    if (s.kind === 'practice') {
      const sentences = seen.map((m) => ({ messageId: m.id, text: m.text, tokens: m.tokens }));
      for (const item of practiceItems(mastery, sentences, now, 5)) {
        const correct = rand() < Math.max(pKnow(item.lemma, now), 0.25);
        emit({
          lemma: item.lemma,
          type: correct ? 'guess_correct' : 'guess_wrong',
          at: now,
          messageId: item.messageId,
          threadId: messages.find((m) => m.id === item.messageId)?.threadId,
          options: 4,
        });
        touch(item.lemma, now, correct ? 'guess' : 'reveal');
      }
      continue;
    }

    const msg = s.msg;
    seen.push(msg);
    stage = languageStage(mastery, recentLemmas(now), now, stage).stage;
    if (rand() < BEHAVIOR.skimRate) continue;

    const plan = renderPlan(msg.tokens, mastery, now, stage);
    const base = { messageId: msg.id, threadId: msg.threadId };
    msg.tokens.forEach((t, idx) => {
      if (t.isPunct) return;
      const p = plan.tokens[idx];
      const know = rand() < pKnow(t.lemma, now);
      const at = now + idx * 1000;
      const form = t.surface?.toLowerCase();
      if (p.challenge) {
        emit({ ...base, lemma: t.lemma, form, type: know ? 'guess_correct' : 'guess_wrong', at, options: 4 });
        touch(t.lemma, at, know ? 'guess' : 'reveal');
      } else if (p.hint) {
        emit({ ...base, lemma: t.lemma, form, type: 'exposure_hinted', at });
        touch(t.lemma, at, 'exposure');
        if (!know && rand() < BEHAVIOR.curiousTapRate) {
          emit({ ...base, lemma: t.lemma, form, type: 'tap_reveal', at: at + 500 });
          touch(t.lemma, at, 'reveal');
        }
      } else if (know) {
        emit({ ...base, lemma: t.lemma, form, type: 'read_unaided', at, romanizationShown: p.romanization });
        touch(t.lemma, at, 'recall');
      } else {
        emit({ ...base, lemma: t.lemma, form, type: 'tap_reveal', at });
        touch(t.lemma, at, 'reveal');
      }
    });
    if (msg.kind === 'voice' && rand() < BEHAVIOR.audioPlayRate) {
      const words = msg.tokens.filter((t) => !t.isPunct);
      const w = words[Math.floor(rand() * words.length)];
      if (w) emit({ ...base, lemma: w.lemma, type: 'audio_play', at: now + 60_000 });
    }
  }
  snapshotWeeks(end);
  return { events, weekly };
}

/** Spreads each week's lines over that week's days: strictly increasing, the last one 2 hours before `end`. */
export function scheduleTimes(weeks: number[], end: number): number[] {
  const start = Math.floor((end - 8 * 7 * DAY_MS) / DAY_MS) * DAY_MS; // midnight UTC, 8 weeks back
  const out: number[] = [];
  for (let w = 1; w <= 8; w++) {
    const idxs = weeks.flatMap((wk, i) => (wk === w ? [i] : []));
    idxs.forEach((lineIdx, k) => {
      const day = Math.min(6, Math.floor((k * 7) / idxs.length));
      out[lineIdx] = start + (w - 1) * 7 * DAY_MS + day * DAY_MS + (14 + (k % 3) * 2) * 3600_000 + k * 60_000;
    });
  }
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1] + 5 * 60_000);
  const shift = Math.max(0, out[out.length - 1] - (end - 2 * 3600_000));
  return out.map((t) => t - shift);
}
