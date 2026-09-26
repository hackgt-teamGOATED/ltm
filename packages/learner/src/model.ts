// Per-word, per-skill memory model (PLAN.md §8.1–8.5). Pure: callers pass `now` in epoch ms.
import {
  D_LEARNING_RATE,
  EXPOSURE_GAIN,
  FADING_R,
  FAIL_KEEP,
  INFLECTION_TRANSFER,
  MASTERED_R,
  MASTERY_MIN_S,
  MAX_S,
  MIN_S,
  RELEARN_FLOOR,
  SPACING_CAP,
  SUCCESS_GAIN,
  TARGET_RETENTION,
} from './constants.js';
import type {
  EventType,
  EvidenceKind,
  LearningEvent,
  LemmaState,
  Mastery,
  Skill,
  SkillState,
  WordStatus,
} from './types.js';

export const DAY_MS = 86_400_000;
export const DEFAULT_DIFFICULTY = 0.5;
const HISTORY_CAP = 30;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const dayOf = (ms: number) => Math.floor(ms / DAY_MS);

/** Recall probability after `days` since last review, for stability `s` (half-life, days). */
export const recall = (days: number, s: number): number => 2 ** (-days / s);

export function skillRecall(skill: SkillState | undefined, now: number): number {
  if (!skill) return 0;
  return recall(Math.max(0, now - skill.lastReview) / DAY_MS, skill.stability);
}

export interface Evidence {
  skill: Skill;
  kind: EvidenceKind;
  w: number;
}

/** Event → evidence table (PLAN.md §8.3). Curiosity (`tap_explore`) yields none. */
export function evidenceFor(e: Pick<LearningEvent, 'type' | 'options' | 'romanizationShown'>): Evidence[] {
  const t: EventType = e.type;
  switch (t) {
    case 'exposure_hinted':
      return [{ skill: 'recognize', kind: 'exposure', w: 0.3 }];
    case 'read_unaided': {
      const out: Evidence[] = [{ skill: 'recognize', kind: 'success', w: 0.4 }];
      if (e.romanizationShown === false) out.push({ skill: 'script', kind: 'success', w: 0.4 });
      return out;
    }
    case 'tap_reveal':
      return [{ skill: 'recognize', kind: 'failure', w: 1.0 }];
    case 'tap_explore':
      return [];
    case 'guess_correct': {
      const n = e.options && e.options > 1 ? e.options : 4;
      return [{ skill: 'recognize', kind: 'success', w: 1.0 * (1 - 1 / n) }];
    }
    case 'guess_wrong':
      return [{ skill: 'recognize', kind: 'failure', w: 1.0 }];
    case 'audio_play':
      return [{ skill: 'recognize', kind: 'exposure', w: 0.2 }];
    case 'show_translation':
      return [{ skill: 'recognize', kind: 'failure', w: 0.3 }];
    case 'used_suggested':
      return [{ skill: 'produce', kind: 'success', w: 0.5 }];
    case 'used_unprompted':
      return [{ skill: 'produce', kind: 'success', w: 1.0 }];
  }
}

export function newLemma(lemma: string, lang: LemmaState['lang']): LemmaState {
  return {
    lemma,
    lang,
    difficulty: DEFAULT_DIFFICULTY,
    formsSeen: [],
    contexts: [],
    encounters: 0,
    wasMastered: false,
    skills: {},
  };
}

const cloneSkill = (s: SkillState): SkillState => ({
  ...s,
  successDays: [...s.successDays],
  history: [...s.history],
});

export const cloneLemma = (l: LemmaState): LemmaState => ({
  ...l,
  formsSeen: [...l.formsSeen],
  contexts: [...l.contexts],
  skills: Object.fromEntries(Object.entries(l.skills).map(([k, v]) => [k, cloneSkill(v as SkillState)])),
});

/** Apply one piece of evidence to one skill. Mutates `lemma` (callers pass a clone). */
function applyEvidence(lemma: LemmaState, ev: Evidence, now: number): void {
  const d = lemma.difficulty;
  const prev = lemma.skills[ev.skill];
  const rBefore = skillRecall(prev, now);
  let s: SkillState;

  if (!prev) {
    // First contact: stability from difficulty; halved for exposure, ×0.4 for failure.
    let s0 = 0.3 + 2.0 * (1 - d);
    if (ev.kind === 'exposure') s0 *= 0.5;
    if (ev.kind === 'failure') s0 *= FAIL_KEEP;
    s0 = clamp(s0, MIN_S, MAX_S);
    s = { stability: s0, initialStability: s0, lastReview: now, successDays: [], successes: 0, failures: 0, history: [] };
  } else {
    s = prev;
    const spacing = Math.min(SPACING_CAP, (1 - rBefore) / (1 - TARGET_RETENTION));
    if (ev.kind === 'success') {
      s.stability *= 1 + ev.w * SUCCESS_GAIN * (1 - d) * spacing;
    } else if (ev.kind === 'failure') {
      s.stability = Math.max(s.stability * (1 - ev.w * (1 - FAIL_KEEP)), RELEARN_FLOOR * s.initialStability);
    } else {
      const multiContext = lemma.contexts.length >= 2 ? 1.5 : 1;
      s.stability *= 1 + ev.w * EXPOSURE_GAIN * spacing * multiContext;
    }
    s.stability = clamp(s.stability, MIN_S, MAX_S);
    s.lastReview = now;
  }

  if (ev.kind === 'success') {
    s.successes += 1;
    const day = dayOf(now);
    if (!s.successDays.includes(day)) s.successDays.push(day);
  } else if (ev.kind === 'failure') {
    s.failures += 1;
  }
  if (ev.kind !== 'exposure') {
    const outcome = ev.kind === 'success' ? 1 : 0;
    lemma.difficulty = clamp(d + D_LEARNING_RATE * ev.w * (rBefore - outcome), 0.05, 0.95);
  }
  s.history.push({ t: now, kind: ev.kind, w: ev.w, r: rBefore });
  if (s.history.length > HISTORY_CAP) s.history.splice(0, s.history.length - HISTORY_CAP);
  lemma.skills[ev.skill] = s;
}

/** Returns the updated state for the event's lemma, or `prev` unchanged when the event carries no evidence. */
export function applyEvent(prev: LemmaState | undefined, e: LearningEvent): LemmaState | undefined {
  let evidence = evidenceFor(e);
  if (!evidence.length) return prev;

  const lemma = prev ? cloneLemma(prev) : newLemma(e.lemma, e.lang);
  const form = e.form?.trim().toLowerCase();
  if (form) {
    // Evidence on an inflected form we haven't seen transfers at a discount.
    if (lemma.formsSeen.length > 0 && !lemma.formsSeen.includes(form)) {
      evidence = evidence.map((ev) => ({ ...ev, w: ev.w * INFLECTION_TRANSFER }));
    }
    if (!lemma.formsSeen.includes(form)) lemma.formsSeen.push(form);
  }
  if (e.threadId && !lemma.contexts.includes(e.threadId)) lemma.contexts.push(e.threadId);
  lemma.encounters += 1;

  for (const ev of evidence) applyEvidence(lemma, ev, e.at);
  if (isMastered(lemma, e.at)) lemma.wasMastered = true;
  return lemma;
}

/** Apply events to a mastery map without mutating it. Returns the new map and the lemmas that changed. */
export function applyEvents(mastery: Mastery, events: LearningEvent[]): { mastery: Mastery; changed: string[] } {
  const next: Mastery = { ...mastery };
  const changed = new Set<string>();
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    const updated = applyEvent(next[e.lemma], e);
    if (updated && updated !== next[e.lemma]) {
      next[e.lemma] = updated;
      changed.add(e.lemma);
    }
  }
  return { mastery: next, changed: [...changed] };
}

function isMastered(l: LemmaState, now: number): boolean {
  const s = l.skills.recognize;
  if (!s) return false;
  return skillRecall(s, now) >= MASTERED_R && s.stability >= MASTERY_MIN_S && s.successDays.length >= 2;
}

/** mastered / fading / learning / new (PLAN.md §8.5), from the recognize skill. */
export function status(l: LemmaState | undefined, now: number): WordStatus {
  if (!l?.skills.recognize) return 'new';
  if (isMastered(l, now)) return 'mastered';
  if (l.wasMastered && skillRecall(l.skills.recognize, now) < FADING_R) return 'fading';
  return 'learning';
}

export const recognizeRecall = (l: LemmaState | undefined, now: number) => skillRecall(l?.skills.recognize, now);
