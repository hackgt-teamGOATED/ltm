// Demo seed (PLAN.md §9.1): `npm run seed:demo`.
// Idempotent and namespaced: it only writes the demo cast's two threads, the seeded messages (fixed ids
// derived from thread + line), their translations/audio/analyses, Arjun's events tied to those messages,
// and Arjun's rebuilt mastery. Other rows in the shared database are never touched.
import { createHash } from 'node:crypto';
import {
  DAY_MS,
  type Lang,
  type LearningEvent,
  type LemmaState,
  replay,
  type TokenLike,
  wordLists,
} from '@heirloom/learner';
import { synthesize, transcribe, translate } from '../ai.js';
import { env } from '../env.js';
import { analyzeOne, type MsgRow } from '../learning/analyze.js';
import { insertEvents, listEvents, saveMastery } from '../learning/progress.js';
import type { Token } from '../learning/types.js';
import { must, supabase } from '../supabase.js';
import { SPANISH, type ScriptLine, URDU } from './demoContent.js';
import { type SimMessage, scheduleTimes, simulateLearner } from './simulate.js';

const id = (suffix: string) => `00000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
const ARJUN = { id: id('1'), lang: 'en' };
const CHATS = [
  { name: 'Arjun ↔ Abuela', threadId: id('a2'), other: { id: id('3'), lang: 'es' as Lang }, lines: SPANISH },
  { name: 'Arjun ↔ Zara', threadId: id('a4'), other: { id: id('5'), lang: 'ur' as Lang }, lines: URDU },
];
/** Fixed simulation seed; quoted in the write-up. */
export const SIM_SEED = 42;
const CONCURRENCY = 4;

/** Deterministic UUID (v5 layout) for a seeded row. */
function demoId(key: string): string {
  const h = createHash('sha1').update(`heirloom-demo:${key}`).digest('hex');
  const variant = ((Number.parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

async function upload(path: string, audio: Buffer, contentType: string) {
  const { error } = await supabase.storage.from(env.AUDIO_BUCKET).upload(path, audio, { contentType, upsert: true });
  if (error) throw new Error(`Audio upload failed: ${error.message}`);
}

type Seeded = { row: MsgRow; line: ScriptLine; fromArjun: boolean };

async function seedMessage(
  chat: (typeof CHATS)[number],
  line: ScriptLine,
  index: number,
  at: number,
  stats: { generated: number; reused: number },
): Promise<Seeded> {
  const fromArjun = line.from === 'arjun';
  const sender = fromArjun ? ARJUN : chat.other;
  const recipientLang = fromArjun ? chat.other.lang : ARJUN.lang;
  const messageId = demoId(`${chat.threadId}:${index}`);
  const kind = line.voice ? 'voice' : 'text';

  const existing = must<{ original_text: string | null; kind: string }[]>(
    await supabase.from('messages').select('original_text, kind').eq('id', messageId),
  )[0];
  const translations = must<{ language: string }[]>(
    await supabase.from('message_translations').select('language').eq('message_id', messageId),
  );
  const unchanged =
    existing?.original_text === line.text &&
    existing.kind === kind &&
    translations.some((t) => t.language === recipientLang);

  let audioPath: string | null = null;
  let words: MsgRow['word_timestamps'] = null;
  if (unchanged) {
    stats.reused++;
    must(await supabase.from('messages').update({ created_at: new Date(at).toISOString(), status: 'ready' }).eq('id', messageId));
  } else {
    stats.generated++;
    // This demo message changed (or is new): drop only its own derived rows, then regenerate.
    must(await supabase.from('message_translations').delete().eq('message_id', messageId));
    must(await supabase.from('message_analyses').delete().eq('message_id', messageId));
    if (kind === 'voice') {
      audioPath = `${chat.threadId}/${messageId}/original.mp3`;
      const speech = await synthesize(line.text, sender.lang);
      await upload(audioPath, speech, 'audio/mpeg');
      words = (await transcribe(speech, 'voice.mp3', 'audio/mpeg', sender.lang)).words;
    }
    must(
      await supabase.from('messages').upsert({
        id: messageId,
        thread_id: chat.threadId,
        sender_id: sender.id,
        kind,
        original_text: line.text,
        original_language: sender.lang,
        audio_path: audioPath,
        word_timestamps: words,
        status: 'ready',
        created_at: new Date(at).toISOString(),
      }),
    );
    const text = await translate(line.text, sender.lang, recipientLang);
    let translatedAudio: string | null = null;
    if (kind === 'voice') {
      translatedAudio = `${chat.threadId}/${messageId}/${recipientLang}.mp3`;
      await upload(translatedAudio, await synthesize(text, recipientLang), 'audio/mpeg');
    }
    must(
      await supabase
        .from('message_translations')
        .insert({ message_id: messageId, language: recipientLang, text, audio_path: translatedAudio }),
    );
  }
  const row = must<MsgRow>(
    await supabase
      .from('messages')
      .select('id, thread_id, sender_id, original_text, original_language, word_timestamps, status')
      .eq('id', messageId)
      .single(),
  );
  return { row, line, fromArjun };
}

async function main() {
  const started = Date.now();
  const end = started;
  const start = end - 8 * 7 * DAY_MS;

  // Preconditions: the cast and threads exist (seed.sql + 002_learning.sql).
  const threads = must<{ id: string }[]>(
    await supabase.from('threads').select('id').in('id', CHATS.map((c) => c.threadId)),
  );
  if (threads.length !== CHATS.length) {
    throw new Error('Demo threads missing: run supabase/seed.sql and supabase/002_learning.sql first.');
  }

  // Heirloom on for Arjun (Spanish, Urdu); off for the other side (they just chat).
  must(
    await supabase.from('thread_settings').upsert(
      CHATS.flatMap((c) => [
        { thread_id: c.threadId, profile_id: ARJUN.id, learning_enabled: true, learning_lang: c.other.lang },
        { thread_id: c.threadId, profile_id: c.other.id, learning_enabled: false, learning_lang: null },
      ]),
    ),
  );

  const summary: string[] = [];
  const allEvents: { lang: Lang; events: LearningEvent[] }[] = [];

  for (const chat of CHATS) {
    const times = scheduleTimes(chat.lines.map((l) => l.week), end);
    const stats = { generated: 0, reused: 0 };
    const seeded: Seeded[] = new Array(chat.lines.length);
    console.log(`\n${chat.name}: ${chat.lines.length} messages…`);
    await pool(chat.lines, CONCURRENCY, async (line, i) => {
      seeded[i] = await seedMessage(chat, line, i, times[i], stats);
    });

    // Analyses for what Arjun receives (cached per message; failures are retried on the next run).
    const received = seeded.filter((s) => !s.fromArjun);
    await pool(received, CONCURRENCY, async (s) => analyzeOne(null, s.row, ARJUN.lang));
    const analyses = new Map<string, { tokens: Token[]; failed: boolean }>();
    for (let k = 0; k < received.length; k += 100) {
      const rows = must<{ message_id: string; tokens: Token[]; failed: boolean }[]>(
        await supabase
          .from('message_analyses')
          .select('message_id, tokens, failed')
          .in(
            'message_id',
            received.slice(k, k + 100).map((s) => s.row.id),
          )
          .eq('viewer_lang', ARJUN.lang),
      );
      for (const r of rows) analyses.set(r.message_id, r);
    }
    const failed = received.filter((s) => !analyses.get(s.row.id) || analyses.get(s.row.id)?.failed).length;

    // Simulate Arjun reading, tapping, guessing and practicing through the real learner model.
    const simMessages: SimMessage[] = received
      .map((s) => ({ s, at: times[chat.lines.indexOf(s.line)] }))
      .filter(({ s }) => analyses.get(s.row.id) && !analyses.get(s.row.id)?.failed)
      .map(({ s, at }) => ({
        id: s.row.id,
        threadId: chat.threadId,
        at,
        lang: chat.other.lang,
        kind: s.line.voice ? 'voice' : 'text',
        text: s.line.text,
        tokens: (analyses.get(s.row.id)?.tokens ?? []) as TokenLike[],
      }));
    const sim = simulateLearner(simMessages, SIM_SEED, start, end);
    allEvents.push({ lang: chat.other.lang, events: sim.events });

    summary.push(
      `${chat.name}: ${seeded.length} messages (${seeded.filter((s) => s.line.voice).length} voice; ` +
        `${stats.generated} generated, ${stats.reused} reused), ${received.length - failed}/${received.length} analyzed, ` +
        `${sim.events.length} simulated events`,
      `  weekly stage: ${sim.weekly.map((w) => `W${w.week} ${w.stage} ${Math.round(w.readableShare * 100)}%`).join(' · ')}`,
    );
  }

  // Replace Arjun's events tied to seeded messages (only those), then rebuild his mastery from the full log.
  const seededIds = CHATS.flatMap((c) => c.lines.map((_, i) => demoId(`${c.threadId}:${i}`)));
  for (let k = 0; k < seededIds.length; k += 100) {
    must(
      await supabase
        .from('learning_events')
        .delete()
        .eq('profile_id', ARJUN.id)
        .in('message_id', seededIds.slice(k, k + 100)),
    );
  }
  for (const { events } of allEvents) await insertEvents(ARJUN.id, events);

  for (const { lang, events } of allEvents) {
    const all = await listEvents(ARJUN.id, lang);
    const mastery = replay(all, Date.now(), lang);
    must(await supabase.from('word_mastery').delete().eq('profile_id', ARJUN.id).eq('lang', lang));
    await saveMastery(ARJUN.id, Object.values(mastery) as LemmaState[]);
    const lists = wordLists(mastery, Date.now());
    summary.push(
      `${lang}: ${events.length} seeded events (${all.length} total), mastered ${lists.mastered.length}, ` +
        `learning ${lists.learning.length}, fading ${lists.fading.length}`,
    );
  }

  console.log(`\nDemo seed done in ${Math.round((Date.now() - started) / 1000)}s (simulation seed ${SIM_SEED}).`);
  for (const line of summary) console.log(line);
  console.log('\nAll seeded history is simulated; non-English lines still need a native check.');
}

main().catch((err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
