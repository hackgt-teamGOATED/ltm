// The analyze step (PLAN.md §6.1): runs after `message:updated`, never blocks text or audio.
import type { Server } from 'socket.io';
import { analyzeMessage, type WordTiming } from '../ai.js';
import { env } from '../env.js';
import { must, supabase } from '../supabase.js';
import { safeErr } from '../logSafe.js';
import { AnalysisInvalid, alignAnalysis, attachTimings } from './align.js';
import type { Lang, MessageAnalysis, Phrase, Token } from './types.js';

type AnalysisRow = {
  message_id: string;
  viewer_lang: string;
  tokens: Token[];
  phrases: Phrase[];
  translation: string;
  needs_native_check: boolean;
  failed: boolean;
};

export type MsgRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  original_text: string | null;
  original_language: string;
  word_timestamps: WordTiming[] | null;
  status: string;
};

export const toAnalysis = (r: AnalysisRow): MessageAnalysis => ({
  messageId: r.message_id,
  viewerLang: r.viewer_lang as Lang,
  translation: r.translation,
  tokens: r.tokens,
  phrases: r.phrases,
  needsNativeCheck: r.needs_native_check,
  ...(r.failed ? { failed: true } : {}),
});

const inFlight = new Map<string, Promise<void>>();

/** Viewer languages that need an analysis of this message: members learning its language, minus the sender. */
async function viewerLangsFor(msg: MsgRow): Promise<string[]> {
  const rows = must<{ profile_id: string; profiles: { language: string } }[]>(
    await supabase
      .from('thread_settings')
      .select('profile_id, profiles(language)')
      .eq('thread_id', msg.thread_id)
      .eq('learning_enabled', true)
      .eq('learning_lang', msg.original_language),
  );
  return [...new Set(rows.filter((r) => r.profile_id !== msg.sender_id).map((r) => r.profiles.language))].filter(
    (l) => l !== msg.original_language,
  );
}

/** Analyze one message for one viewer language (cached). `io` is null when run from a script. */
export async function analyzeOne(io: Server | null, msg: MsgRow, viewerLang: string): Promise<void> {
  const key = `${msg.id}:${viewerLang}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    // A stored failure (e.g. an OpenAI 429) is retried the next time the pipeline or a backfill asks.
    const cached = must<{ message_id: string }[]>(
      await supabase
        .from('message_analyses')
        .select('message_id')
        .eq('message_id', msg.id)
        .eq('viewer_lang', viewerLang)
        .eq('failed', false),
    );
    if (cached.length) return;
    const text = msg.original_text?.trim();
    if (!text) return;

    const existing = must<{ text: string }[]>(
      await supabase
        .from('message_translations')
        .select('text')
        .eq('message_id', msg.id)
        .eq('language', viewerLang),
    );
    const fixed = existing[0]?.text ?? null;
    const needsRoman = msg.original_language === 'ur' || msg.original_language === 'hi';

    let row: Omit<AnalysisRow, 'needs_native_check'> & { model: string } = {
      message_id: msg.id,
      viewer_lang: viewerLang,
      tokens: [],
      phrases: [],
      translation: fixed ?? '',
      failed: true,
      model: env.OPENAI_ANALYZE_MODEL,
    };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await analyzeMessage(text, msg.original_language, viewerLang, fixed);
        const translation = fixed ?? raw.translation.trim();
        const { tokens, phrases } = alignAnalysis(text, raw, translation, needsRoman);
        attachTimings(tokens, msg.word_timestamps);
        row = { ...row, tokens, phrases, translation, failed: false };
        break;
      } catch (err) {
        const why = err instanceof AnalysisInvalid ? `invalid:${err.message}` : `model_or_network_error (${safeErr(err)})`;
        console.warn(`[analyze ${msg.id} → ${viewerLang}] attempt ${attempt} failed (${why})`);
      }
    }
    must(await supabase.from('message_analyses').upsert(row));
    io?.to(`thread:${msg.thread_id}`).emit('analysis:ready', { messageId: msg.id, viewerLang });
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

const MSG_COLUMNS = 'id, thread_id, sender_id, original_text, original_language, word_timestamps, status';

/** Pipeline hook: analyze a just-finished message for every member learning its language. */
export async function analyzeForViewers(io: Server, messageId: string): Promise<void> {
  try {
    const msg = must<MsgRow>(await supabase.from('messages').select(MSG_COLUMNS).eq('id', messageId).single());
    if (msg.status !== 'ready') return;
    for (const lang of await viewerLangsFor(msg)) await analyzeOne(io, msg, lang);
  } catch (err) {
    console.error(`[analyze ${messageId}] ${safeErr(err)}`);
  }
}

export const BACKFILL_COUNT = 30;

/** Analyze the thread's last 30 messages for this learner (background, a few at a time). */
export async function backfillThread(io: Server, threadId: string, profileId: string, learningLang: string) {
  try {
    const viewer = must<{ language: string }>(
      await supabase.from('profiles').select('language').eq('id', profileId).single(),
    );
    if (viewer.language === learningLang) return;
    const msgs = must<MsgRow[]>(
      await supabase
        .from('messages')
        .select(MSG_COLUMNS)
        .eq('thread_id', threadId)
        .eq('status', 'ready')
        .eq('original_language', learningLang)
        .neq('sender_id', profileId)
        .order('created_at', { ascending: false })
        .limit(BACKFILL_COUNT),
    );
    const queue = [...msgs];
    const worker = async () => {
      for (let m = queue.shift(); m; m = queue.shift()) await analyzeOne(io, m, viewer.language);
    };
    await Promise.all([worker(), worker(), worker()]);
  } catch (err) {
    console.error(`[backfill ${threadId}] ${safeErr(err)}`);
  }
}

export async function getAnalysis(messageId: string, viewerLang: string): Promise<MessageAnalysis | null> {
  const rows = must<AnalysisRow[]>(
    await supabase.from('message_analyses').select('*').eq('message_id', messageId).eq('viewer_lang', viewerLang),
  );
  return rows[0] ? toAnalysis(rows[0]) : null;
}

export async function listThreadAnalyses(threadId: string, viewerLang: string): Promise<MessageAnalysis[]> {
  const ids = must<{ id: string }[]>(
    await supabase
      .from('messages')
      .select('id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(200),
  ).map((m) => m.id);
  // Chunked: 200 UUIDs in one `in` filter make a URL long enough to be rejected.
  const out: MessageAnalysis[] = [];
  for (let k = 0; k < ids.length; k += 100) {
    const rows = must<AnalysisRow[]>(
      await supabase
        .from('message_analyses')
        .select('*')
        .in('message_id', ids.slice(k, k + 100))
        .eq('viewer_lang', viewerLang),
    );
    out.push(...rows.map(toAnalysis));
  }
  return out;
}
