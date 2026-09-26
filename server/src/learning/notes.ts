// "View more" notes (PLAN.md §6.3): generated once per (lang, lemma, viewer_lang), then cached.
import { explainWord } from '../ai.js';
import { supabase } from '../supabase.js';
import { must } from './analyze.js';
import type { WordNotes } from './types.js';

type NotesRow = {
  lang: string;
  lemma: string;
  viewer_lang: string;
  usage: string | null;
  grammar: string | null;
  culture: string | null;
  examples: { text: string; translation: string }[];
  is_idiom: boolean;
};

const toNotes = (r: NotesRow): WordNotes => ({
  lang: r.lang,
  lemma: r.lemma,
  viewerLang: r.viewer_lang,
  usage: r.usage ?? '',
  grammar: r.grammar ?? '',
  culture: r.culture,
  examples: r.examples ?? [],
  isIdiom: r.is_idiom,
});

const inFlight = new Map<string, Promise<WordNotes>>();

/** Up to 3 real sentences from this user's chats that contain the word. */
async function contextSentences(profileId: string | null, lang: string, lemma: string): Promise<string[]> {
  if (!profileId) return [];
  const threads = must<{ thread_id: string }[]>(
    await supabase.from('thread_members').select('thread_id').eq('profile_id', profileId),
  ).map((t) => t.thread_id);
  if (!threads.length) return [];
  const escaped = lemma.replace(/[%_\\]/g, (c) => `\\${c}`);
  const rows = must<{ original_text: string | null }[]>(
    await supabase
      .from('messages')
      .select('original_text')
      .in('thread_id', threads)
      .eq('original_language', lang)
      .ilike('original_text', `%${escaped}%`)
      .order('created_at', { ascending: false })
      .limit(3),
  );
  return rows.map((r) => r.original_text ?? '').filter((t) => t && t.length <= 300);
}

export async function getWordNotes(lang: string, lemma: string, viewerLang: string, profileId: string | null) {
  const key = `${lang}:${lemma}:${viewerLang}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    const cached = must<NotesRow[]>(
      await supabase.from('word_notes').select('*').eq('lang', lang).eq('lemma', lemma).eq('viewer_lang', viewerLang),
    );
    if (cached[0]) return toNotes(cached[0]);
    const raw = await explainWord(lemma, lang, viewerLang, await contextSentences(profileId, lang, lemma));
    const row: NotesRow = {
      lang,
      lemma,
      viewer_lang: viewerLang,
      usage: raw.usage,
      grammar: raw.grammar,
      culture: raw.culture?.trim() || null,
      examples: raw.examples.slice(0, 3),
      is_idiom: raw.isIdiom,
    };
    must(await supabase.from('word_notes').upsert(row));
    return toNotes(row);
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}
