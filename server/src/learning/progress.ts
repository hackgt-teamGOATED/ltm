// Events, mastery, progress and practice (PLAN.md §6.4). The server is the source of truth for mastery;
// every rule comes from @heirloom/learner so client, server, slider and evaluation agree.
import {
  applyEvents,
  DAY_MS,
  type EventType,
  type LearningEvent,
  type LemmaState,
  languageStage,
  type Mastery,
  practiceItems,
  RECENT_MESSAGES,
  recognizeRecall,
  replay,
  status,
  wordLists,
} from '@heirloom/learner';
import type { Server } from 'socket.io';
import { HttpError } from '../messages.js';
import { supabase } from '../supabase.js';
import { must } from './analyze.js';
import { isLang, type Lang, type Token } from './types.js';

const EVENT_TYPES: EventType[] = [
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (x: unknown) => (typeof x === 'string' && UUID_RE.test(x) ? x : null);

type EventRow = {
  profile_id: string;
  lang: string;
  lemma: string;
  form: string | null;
  event_type: string;
  message_id: string | null;
  thread_id: string | null;
  options: number | null;
  romanization_shown: boolean | null;
  created_at: string;
};

const toEvent = (r: EventRow): LearningEvent => ({
  lemma: r.lemma,
  lang: r.lang as Lang,
  type: r.event_type as EventType,
  at: Date.parse(r.created_at),
  form: r.form ?? undefined,
  threadId: r.thread_id,
  messageId: r.message_id,
  options: r.options,
  ...(r.romanization_shown === null ? {} : { romanizationShown: r.romanization_shown }),
});

/** Validates one client event. `at` may be supplied (seeding, offline queue) but never in the future. */
export function parseEvent(x: unknown, now: number): LearningEvent {
  const e = (x ?? {}) as Record<string, unknown>;
  if (typeof e.lemma !== 'string' || !e.lemma.trim() || e.lemma.length > 80) throw new HttpError(400, 'event.lemma');
  if (!isLang(e.lang)) throw new HttpError(400, 'event.lang');
  if (!EVENT_TYPES.includes(e.type as EventType)) throw new HttpError(400, 'event.type');
  const at = typeof e.at === 'number' && Number.isFinite(e.at) ? Math.min(e.at, now) : now;
  return {
    lemma: e.lemma.trim(),
    lang: e.lang,
    type: e.type as EventType,
    at,
    form: typeof e.form === 'string' ? e.form.slice(0, 80) : undefined,
    threadId: uuidOrNull(e.threadId),
    messageId: uuidOrNull(e.messageId),
    options: typeof e.options === 'number' ? Math.round(e.options) : null,
    ...(typeof e.romanizationShown === 'boolean' ? { romanizationShown: e.romanizationShown } : {}),
  };
}

export async function loadMastery(profileId: string, lang: string, lemmas?: string[]): Promise<Mastery> {
  const out: Mastery = {};
  if (lemmas && !lemmas.length) return out;
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('word_mastery').select('lemma, state').eq('profile_id', profileId).eq('lang', lang);
    if (lemmas) q = q.in('lemma', lemmas);
    const rows = must<{ lemma: string; state: LemmaState }[]>(await q.range(from, from + 999));
    for (const r of rows) out[r.lemma] = r.state;
    if (rows.length < 1000) return out;
  }
}

export async function saveMastery(profileId: string, states: LemmaState[]) {
  if (!states.length) return;
  const updated_at = new Date().toISOString();
  const rows = states.map((s) => ({ profile_id: profileId, lang: s.lang, lemma: s.lemma, state: s, updated_at }));
  for (let k = 0; k < rows.length; k += 500) must(await supabase.from('word_mastery').upsert(rows.slice(k, k + 500)));
}

export async function insertEvents(profileId: string, events: LearningEvent[]) {
  const rows = events.map((e) => ({
    profile_id: profileId,
    lang: e.lang,
    lemma: e.lemma,
    form: e.form ?? null,
    event_type: e.type,
    message_id: e.messageId ?? null,
    thread_id: e.threadId ?? null,
    options: e.options ?? null,
    romanization_shown: e.romanizationShown ?? null,
    created_at: new Date(e.at).toISOString(),
  }));
  for (let k = 0; k < rows.length; k += 500) must(await supabase.from('learning_events').insert(rows.slice(k, k + 500)));
}

// One profile's events apply strictly in order, so two quick POSTs can't overwrite each other's mastery.
const chains = new Map<string, Promise<unknown>>();

export function recordEvents(io: Server, profileId: string, events: LearningEvent[]) {
  const prev = chains.get(profileId) ?? Promise.resolve();
  const job = prev
    .catch(() => undefined)
    .then(async () => {
      await insertEvents(profileId, events);
      const changed: { lang: Lang; lemma: string; state: LemmaState; status: string }[] = [];
      const now = Date.now();
      for (const lang of new Set(events.map((e) => e.lang))) {
        const mine = events.filter((e) => e.lang === lang);
        const before = await loadMastery(profileId, lang, [...new Set(mine.map((e) => e.lemma))]);
        const { mastery, changed: lemmas } = applyEvents(before, mine);
        const states = lemmas.map((l) => mastery[l]);
        await saveMastery(profileId, states);
        for (const s of states) changed.push({ lang, lemma: s.lemma, state: s, status: status(s, now) });
      }
      if (changed.length) io.to(`profile:${profileId}`).emit('mastery:updated', { profileId, changed });
      return { changed };
    });
  chains.set(profileId, job);
  void job.finally(() => chains.get(profileId) === job && chains.delete(profileId));
  return job;
}

export async function listEvents(profileId: string, lang?: string): Promise<LearningEvent[]> {
  const out: LearningEvent[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from('learning_events').select('*').eq('profile_id', profileId);
    if (lang) q = q.eq('lang', lang);
    const rows = must<EventRow[]>(await q.order('created_at', { ascending: true }).range(from, from + 999));
    out.push(...rows.map(toEvent));
    if (rows.length < 1000) return out;
  }
}

// ---------- thread settings ----------

export async function getSettings(threadId: string, profileId: string) {
  const rows = must<{ learning_enabled: boolean; learning_lang: string | null }[]>(
    await supabase
      .from('thread_settings')
      .select('learning_enabled, learning_lang')
      .eq('thread_id', threadId)
      .eq('profile_id', profileId),
  );
  return { learningEnabled: rows[0]?.learning_enabled ?? false, learningLang: rows[0]?.learning_lang ?? null };
}

export async function putSettings(threadId: string, profileId: string, learningEnabled: boolean, learningLang: Lang | null) {
  const member = must<unknown[]>(
    await supabase.from('thread_members').select('profile_id').eq('thread_id', threadId).eq('profile_id', profileId),
  );
  if (!member.length) throw new HttpError(403, 'Not a member of this thread');
  must(
    await supabase.from('thread_settings').upsert({
      thread_id: threadId,
      profile_id: profileId,
      learning_enabled: learningEnabled,
      learning_lang: learningLang,
      updated_at: new Date().toISOString(),
    }),
  );
  return { learningEnabled, learningLang };
}

// ---------- language context: the learner's received, analyzed messages in one language ----------

type ContextMessage = { id: string; threadId: string; at: number; text: string; tokens: Token[] };

async function languageContext(profileId: string, lang: string) {
  const profile = must<{ language: string }>(
    await supabase.from('profiles').select('language').eq('id', profileId).single(),
  );
  const settings = must<{ thread_id: string }[]>(
    await supabase
      .from('thread_settings')
      .select('thread_id')
      .eq('profile_id', profileId)
      .eq('learning_enabled', true)
      .eq('learning_lang', lang),
  );
  const threadIds = settings.map((s) => s.thread_id);
  if (!threadIds.length) return { viewerLang: profile.language, threadIds, messages: [] as ContextMessage[] };

  const msgs = must<{ id: string; thread_id: string; created_at: string; original_text: string | null }[]>(
    await supabase
      .from('messages')
      .select('id, thread_id, created_at, original_text')
      .in('thread_id', threadIds)
      .eq('status', 'ready')
      .eq('original_language', lang)
      .neq('sender_id', profileId)
      .order('created_at', { ascending: false })
      .limit(400),
  );
  const tokensById = new Map<string, Token[]>();
  for (let k = 0; k < msgs.length; k += 100) {
    const rows = must<{ message_id: string; tokens: Token[] }[]>(
      await supabase
        .from('message_analyses')
        .select('message_id, tokens')
        .in(
          'message_id',
          msgs.slice(k, k + 100).map((m) => m.id),
        )
        .eq('viewer_lang', profile.language)
        .eq('failed', false),
    );
    for (const r of rows) tokensById.set(r.message_id, r.tokens);
  }
  const messages: ContextMessage[] = msgs
    .filter((m) => tokensById.has(m.id))
    .map((m) => ({
      id: m.id,
      threadId: m.thread_id,
      at: Date.parse(m.created_at),
      text: m.original_text ?? '',
      tokens: tokensById.get(m.id) as Token[],
    }))
    .reverse(); // oldest first
  return { viewerLang: profile.language, threadIds, messages };
}

const trackedLemmas = (msgs: ContextMessage[]) => msgs.flatMap((m) => m.tokens.filter((t) => !t.isPunct).map((t) => t.lemma));
const recentBefore = (msgs: ContextMessage[], until: number) =>
  msgs.filter((m) => m.at <= until).slice(-RECENT_MESSAGES);

async function learningLangs(profileId: string): Promise<string[]> {
  const rows = must<{ learning_lang: string | null }[]>(
    await supabase
      .from('thread_settings')
      .select('learning_lang')
      .eq('profile_id', profileId)
      .eq('learning_enabled', true),
  );
  return [...new Set(rows.map((r) => r.learning_lang).filter((l): l is string => Boolean(l)))].sort();
}

function summarize(mastery: Mastery, messages: ContextMessage[], now: number) {
  const lists = wordLists(mastery, now);
  const seenNew = new Set(trackedLemmas(messages).filter((l) => !mastery[l]));
  const { stage, readableShare } = languageStage(mastery, trackedLemmas(recentBefore(messages, now)), now);
  return {
    stage,
    readableShare,
    fadePct: Math.round(readableShare * 100),
    counts: {
      mastered: lists.mastered.length,
      learning: lists.learning.length,
      fading: lists.fading.length,
      new: lists.new.length + seenNew.size,
    },
    lists,
    seenNew: [...seenNew].sort(),
  };
}

export async function progressOverview(profileId: string) {
  const now = Date.now();
  const langs = await learningLangs(profileId);
  return Promise.all(
    langs.map(async (lang) => {
      const [ctx, mastery] = await Promise.all([languageContext(profileId, lang), loadMastery(profileId, lang)]);
      const { lists: _l, seenNew: _s, ...s } = summarize(mastery, ctx.messages, now);
      return { lang, ...s, threads: ctx.threadIds };
    }),
  );
}

export const WEEKS = 8;

export async function progressDetail(profileId: string, lang: string) {
  const now = Date.now();
  const [ctx, mastery, events] = await Promise.all([
    languageContext(profileId, lang),
    loadMastery(profileId, lang),
    listEvents(profileId, lang),
  ]);
  const s = summarize(mastery, ctx.messages, now);

  // Latest gloss / romanization / example for every lemma the learner has received.
  const info = new Map<string, { surface: string; gloss: string; romanization?: string; messageId: string }>();
  for (const m of ctx.messages) {
    for (const t of m.tokens) {
      if (!t.isPunct) info.set(t.lemma, { surface: t.surface, gloss: t.gloss, romanization: t.romanization, messageId: m.id });
    }
  }
  const row = (lemma: string) => ({
    lemma,
    status: status(mastery[lemma], now),
    recall: recognizeRecall(mastery[lemma], now),
    ...(info.get(lemma) ?? { surface: lemma, gloss: '' }),
  });

  const weekly = Array.from({ length: WEEKS }, (_, k) => {
    const end = now - (WEEKS - 1 - k) * 7 * DAY_MS;
    const snap = replay(events, end, lang as Lang);
    const share = languageStage(snap, trackedLemmas(recentBefore(ctx.messages, end)), end).readableShare;
    return {
      week: k + 1,
      end,
      readableShare: share,
      mastered: wordLists(snap, end).mastered.length,
      messages: ctx.messages.filter((m) => m.at > end - 7 * DAY_MS && m.at <= end).length,
    };
  });

  return {
    lang,
    stage: s.stage,
    readableShare: s.readableShare,
    fadePct: s.fadePct,
    counts: s.counts,
    words: {
      mastered: s.lists.mastered.map(row),
      learning: s.lists.learning.map(row),
      fading: s.lists.fading.map(row),
      new: [...s.lists.new, ...s.seenNew].map(row),
    },
    weekly,
  };
}

export async function practice(profileId: string, lang: string) {
  const now = Date.now();
  const [ctx, mastery] = await Promise.all([languageContext(profileId, lang), loadMastery(profileId, lang)]);
  const sentences = ctx.messages.map((m) => ({ messageId: m.id, text: m.text, tokens: m.tokens }));
  return practiceItems(mastery, sentences, now, 5);
}
