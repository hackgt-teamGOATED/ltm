// "View more" notes (PLAN.md §6.3). The generic notes are generated once per (lang, lemma, viewer_lang) and
// cached for everyone, so they never contain anyone's messages. Sentences from the viewer's own chats are
// looked up per request and returned alongside, never cached.
import { explainWord } from '../ai.js';
import { must, supabase } from '../supabase.js';
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

const toNotes = (r: NotesRow): Omit<WordNotes, 'yourExamples'> => ({
  lang: r.lang,
  lemma: r.lemma,
  viewerLang: r.viewer_lang,
  usage: r.usage ?? '',
  grammar: r.grammar ?? '',
  culture: r.culture,
  examples: r.examples ?? [],
  isIdiom: r.is_idiom,
});

const inFlight = new Map<string, Promise<Omit<WordNotes, 'yourExamples'>>>();

async function genericNotes(lang: string, lemma: string, viewerLang: string) {
  const key = `${lang}:${lemma}:${viewerLang}`;
  const running = inFlight.get(key);
  if (running) return running;
  const job = (async () => {
    const cached = must<NotesRow[]>(
      await supabase.from('word_notes').select('*').eq('lang', lang).eq('lemma', lemma).eq('viewer_lang', viewerLang),
    );
    if (cached[0]) return toNotes(cached[0]);
    const raw = await explainWord(lemma, lang, viewerLang);
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

/** Up to 3 sentences with the word from threads this profile is in, with the viewer's translation. */
async function yourExamples(profileId: string | null, lang: string, lemma: string, viewerLang: string) {
  if (!profileId) return [];
  const threads = must<{ thread_id: string }[]>(
    await supabase.from('thread_members').select('thread_id').eq('profile_id', profileId),
  ).map((t) => t.thread_id);
  if (!threads.length) return [];
  const escaped = lemma.replace(/[%_\\]/g, (c) => `\\${c}`);
  const rows = must<{ original_text: string | null; message_translations: { language: string; text: string }[] }[]>(
    await supabase
      .from('messages')
      .select('original_text, message_translations(language, text)')
      .in('thread_id', threads)
      .eq('original_language', lang)
      .ilike('original_text', `%${escaped}%`)
      .order('created_at', { ascending: false })
      .limit(3),
  );
  return rows
    .filter((r) => r.original_text && r.original_text.length <= 300)
    .map((r) => ({
      text: r.original_text as string,
      translation: r.message_translations.find((t) => t.language === viewerLang)?.text ?? '',
    }));
}

export async function getWordNotes(
  lang: string,
  lemma: string,
  viewerLang: string,
  profileId: string | null,
): Promise<WordNotes> {
  const [notes, mine] = await Promise.all([
    genericNotes(lang, lemma, viewerLang),
    yourExamples(profileId, lang, lemma, viewerLang),
  ]);
  return { ...notes, yourExamples: mine };
}
