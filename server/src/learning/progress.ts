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
  status,
  wordLists,
} from '@heirloom/learner';
import type { Server } from 'socket.io';
import { HttpError } from '../http.js';
import { must, supabase } from '../supabase.js';
import { runExclusive } from './queue.js';
import type { Lang, Token } from './types.js';

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
  for (let k = 0; k < rows.length; k += 500) {
    const res = await supabase.from('learning_events').insert(rows.slice(k, k + 500));
    // 23503 = foreign key violation: an unknown profile, thread or message id is a client error.
    if (res.error?.code === '23503') throw new HttpError(400, 'Unknown profileId, threadId or messageId');
    must(res);
  }
}

/** Stores events and applies them to mastery, one request per profile at a time. */
export function recordEvents(io: Server, profileId: string, events: LearningEvent[]) {
  return runExclusive(profileId, async () => {
    await insertEvents(profileId, events);
    const changed: { lang: Lang; lemma: string; state: LemmaState; status: string }[] = [];
    const now = Date.now();
    for (const lang of new Set(events.map((e) => e.lang))) {
      const mine = events.filter((e) => e.lang === lang);
      const before = await loadMastery(profileId, lang, [...new Set(mine.map((e) => e.lemma))]);
      const { mastery, changed: lemmas } = applyEvents(before, mine);
      const states = lemmas.map((l) => mastery[l]);
      await saveMastery(profileId, states);
      for (const st of states) changed.push({ lang, lemma: st.lemma, state: st, status: status(st, now) });
    }
    if (changed.length) io.to(`profile:${profileId}`).emit('mastery:updated', { profileId, changed });
    return { changed };
  });
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

  // One pass over the sorted log, snapshotting mastery at each week boundary.
  const sorted = [...events].sort((a, b) => a.at - b.at);
  let snap: Mastery = {};
  let cursor = 0;
  const weekly = Array.from({ length: WEEKS }, (_, k) => {
    const end = now - (WEEKS - 1 - k) * 7 * DAY_MS;
    let upTo = cursor;
    while (upTo < sorted.length && sorted[upTo].at <= end) upTo++;
    snap = applyEvents(snap, sorted.slice(cursor, upTo)).mastery;
    cursor = upTo;
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
