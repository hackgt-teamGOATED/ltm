// Demo seed (PLAN.md §9.1): `npm run seed:demo` (add `-- --reset` for a clean demo state).
// Idempotent and namespaced. Every seeded message id starts with `de300000-` (DEMO_PREFIX) and is derived from
// the line's content, so reordering the script changes nothing and an edited line becomes a new message. It
// writes only: settings for the demo cast's two threads, demo-prefixed messages (and their own translations,
// audio and analyses), Arjun's events on demo-prefixed messages, and Arjun's es/ur mastery (rebuilt from his
// event log). `--reset` additionally removes Arjun's NON-seeded messages and events in those two threads.
// Stop other writers for Arjun (e.g. a phone using the app) while it runs.
import { type Lang, type LearningEvent, type LemmaState, replay, type TokenLike, wordLists } from '@heirloom/learner';
import { synthesize, transcribe, translate } from '../ai.js';
import { env } from '../env.js';
import { analyzeOne, type MsgRow } from '../learning/analyze.js';
import { insertEvents, listEvents, saveMastery } from '../learning/progress.js';
import type { Token } from '../learning/types.js';
import { safeErr } from '../logSafe.js';
import { translateVoice, uploadAudio, voicePath } from '../messages.js';
import { must, supabase } from '../supabase.js';
import { SPANISH, type ScriptLine, URDU } from './demoContent.js';
import { DEMO_MAX, DEMO_MIN, scriptIds } from './demoIds.js';
import { type SimMessage, scheduleTimes, simulateLearner, windowStart } from './simulate.js';

const id = (suffix: string) => `00000000-0000-0000-0000-${suffix.padStart(12, '0')}`;
const ARJUN = { id: id('1'), lang: 'en' };
const CHATS = [
  { name: 'Arjun ↔ Abuela', threadId: id('a2'), other: { id: id('3'), lang: 'es' as Lang }, lines: SPANISH },
  { name: 'Arjun ↔ Zara', threadId: id('a4'), other: { id: id('5'), lang: 'ur' as Lang }, lines: URDU },
];
/** Fixed simulation seed; quoted in the write-up. */
export const SIM_SEED = 42;
const CONCURRENCY = 4;

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

const chunks = <T>(xs: T[], n = 100) => Array.from({ length: Math.ceil(xs.length / n) }, (_, k) => xs.slice(k * n, k * n + n));

type Existing = { id: string; original_text: string | null; kind: string; status: string; langs: string[] };
type Seeded = { row: MsgRow; line: ScriptLine; at: number };

async function existingMessages(ids: string[]): Promise<Map<string, Existing>> {
  const out = new Map<string, Existing>();
  for (const part of chunks(ids)) {
    const rows = must<
      { id: string; original_text: string | null; kind: string; status: string; message_translations: { language: string }[] }[]
    >(await supabase.from('messages').select('id, original_text, kind, status, message_translations(language)').in('id', part));
    for (const r of rows) out.set(r.id, { ...r, langs: r.message_translations.map((t) => t.language) });
  }
  return out;
}

/** Creates (or recreates) one seeded message: processing → translation (+ audio) → ready, or failed. */
async function generate(chat: (typeof CHATS)[number], line: ScriptLine, messageId: string, at: number) {
  const fromArjun = line.from === 'arjun';
  const sender = fromArjun ? ARJUN : chat.other;
  const to = fromArjun ? chat.other.lang : ARJUN.lang;
  const kind = line.voice ? 'voice' : 'text';
  // Drop this message and everything derived from it before regenerating. Events first: the FK would
  // otherwise null their message_id and they'd look like manual (non-seeded) history.
  must(await supabase.from('learning_events').delete().eq('message_id', messageId));
  must(await supabase.from('messages').delete().eq('id', messageId));

  let audioPath: string | null = null;
  let words: MsgRow['word_timestamps'] = null;
  if (kind === 'voice') {
    audioPath = voicePath(chat.threadId, messageId, 'original');
    const speech = await synthesize(line.text, sender.lang);
    await uploadAudio(audioPath, speech, 'audio/mpeg');
    words = (await transcribe(speech, 'voice.mp3', 'audio/mpeg', sender.lang)).words;
  }
  must(
    await supabase.from('messages').insert({
      id: messageId,
      thread_id: chat.threadId,
      sender_id: sender.id,
      kind,
      original_text: line.text,
      original_language: sender.lang,
      audio_path: audioPath,
      word_timestamps: words,
      status: 'processing',
      created_at: new Date(at).toISOString(),
    }),
  );
  try {
    const t =
      kind === 'voice'
        ? await translateVoice(chat.threadId, messageId, line.text, sender.lang, to)
        : { language: to, text: await translate(line.text, sender.lang, to), audio_path: null };
    must(await supabase.from('message_translations').insert({ message_id: messageId, ...t }));
    must(await supabase.from('messages').update({ status: 'ready' }).eq('id', messageId));
  } catch (err) {
    await supabase.from('messages').update({ status: 'failed' }).eq('id', messageId);
    throw err;
  }
}

async function main() {
  const reset = process.argv.includes('--reset');
  const started = Date.now();
  const end = started;
  const start = windowStart(end);

  const threads = must<{ id: string }[]>(
    await supabase
      .from('threads')
      .select('id')
      .in(
        'id',
        CHATS.map((c) => c.threadId),
      ),
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
  const simulated: { lang: Lang; events: LearningEvent[] }[] = [];
  const allIds: string[] = [];

  for (const chat of CHATS) {
    const ids = scriptIds(chat.threadId, chat.lines);
    allIds.push(...ids);
    const times = scheduleTimes(
      chat.lines.map((l) => l.week),
      end,
    );
    const existing = await existingMessages(ids);
    console.log(`\n${chat.name}: ${chat.lines.length} messages…`);

    // 1. Messages: reuse unchanged ones (just re-time them), generate the rest.
    let generated = 0;
    const retime: { id: string; at: number }[] = [];
    await pool(chat.lines, CONCURRENCY, async (line, i) => {
      const e = existing.get(ids[i]);
      const to = line.from === 'arjun' ? chat.other.lang : ARJUN.lang;
      const ok = e && e.status === 'ready' && e.kind === (line.voice ? 'voice' : 'text') && e.langs.includes(to);
      if (ok) retime.push({ id: ids[i], at: times[i] });
      else {
        generated++;
        await generate(chat, line, ids[i], times[i]);
      }
    });
    await pool(retime, CONCURRENCY, async (r) => {
      must(await supabase.from('messages').update({ created_at: new Date(r.at).toISOString() }).eq('id', r.id));
    });

    // 2. Remove demo messages this script no longer produces (edited or deleted lines), with their events.
    const stale = must<{ id: string }[]>(
      await supabase
        .from('messages')
        .select('id')
        .eq('thread_id', chat.threadId)
        .gte('id', DEMO_MIN)
        .lte('id', DEMO_MAX),
    )
      .map((r) => r.id)
      .filter((x) => !ids.includes(x));
    for (const part of chunks(stale)) {
      must(await supabase.from('learning_events').delete().in('message_id', part));
      must(await supabase.from('messages').delete().in('id', part));
    }

    // 3. Analyses for what Arjun receives (cached; failures are retried on the next run).
    const rows = new Map<string, MsgRow>();
    for (const part of chunks(ids)) {
      for (const r of must<MsgRow[]>(
        await supabase
          .from('messages')
          .select('id, thread_id, sender_id, original_text, original_language, word_timestamps, status')
          .in('id', part),
      ))
        rows.set(r.id, r);
    }
    const received: Seeded[] = chat.lines.flatMap((line, i) => {
      const row = rows.get(ids[i]);
      return line.from === 'them' && row ? [{ row, line, at: times[i] }] : [];
    });
    await pool(received, CONCURRENCY, async (s) => analyzeOne(null, s.row, ARJUN.lang));
    const analyses = new Map<string, Token[]>();
    for (const part of chunks(received.map((s) => s.row.id))) {
      for (const r of must<{ message_id: string; tokens: Token[] }[]>(
        await supabase
          .from('message_analyses')
          .select('message_id, tokens')
          .in('message_id', part)
          .eq('viewer_lang', ARJUN.lang)
          .eq('failed', false),
      ))
        analyses.set(r.message_id, r.tokens);
    }

    // 4. Simulate Arjun reading, tapping, guessing and practicing through the real learner model.
    const simMessages: SimMessage[] = received
      .filter((s) => analyses.has(s.row.id))
      .map((s) => ({
        id: s.row.id,
        threadId: chat.threadId,
        at: s.at,
        lang: chat.other.lang,
        kind: s.line.voice ? 'voice' : 'text',
        text: s.line.text,
        tokens: analyses.get(s.row.id) as TokenLike[],
      }));
    const sim = simulateLearner(simMessages, SIM_SEED, start, end);
    simulated.push({ lang: chat.other.lang, events: sim.events });

    summary.push(
      `${chat.name}: ${chat.lines.length} messages (${chat.lines.filter((l) => l.voice).length} voice; ` +
        `${generated} generated, ${chat.lines.length - generated} reused, ${stale.length} stale removed), ` +
        `${analyses.size}/${received.length} analyzed, ${sim.events.length} simulated events`,
      `  weekly stage: ${sim.weekly.map((w) => `W${w.week} ${w.stage} ${Math.round(w.readableShare * 100)}%`).join(' · ')}`,
    );
  }

  // 5. Optional reset: Arjun's non-seeded history in the demo threads (manual testing) goes away.
  const threadIds = CHATS.map((c) => c.threadId);
  const nonSeeded = must<{ id: string }[]>(
    await supabase
      .from('messages')
      .select('id')
      .in('thread_id', threadIds)
      .or(`id.lt.${DEMO_MIN},id.gt.${DEMO_MAX}`),
  ).map((r) => r.id);
  const nonSeededEvents = must<{ id: string }[]>(
    await supabase
      .from('learning_events')
      .select('id')
      .eq('profile_id', ARJUN.id)
      .in(
        'lang',
        CHATS.map((c) => c.other.lang),
      )
      .or(`message_id.is.null,message_id.lt.${DEMO_MIN},message_id.gt.${DEMO_MAX}`),
  ).map((r) => r.id);
  if (reset) {
    for (const part of chunks(nonSeededEvents)) must(await supabase.from('learning_events').delete().in('id', part));
    for (const part of chunks(nonSeeded)) must(await supabase.from('messages').delete().in('id', part));
    summary.push(`--reset: removed ${nonSeeded.length} non-seeded messages and ${nonSeededEvents.length} non-seeded events`);
  } else if (nonSeeded.length || nonSeededEvents.length) {
    summary.push(
      `Note: ${nonSeeded.length} non-seeded messages and ${nonSeededEvents.length} non-seeded events for Arjun are ` +
        'included (manual testing). Run with --reset for a clean demo.',
    );
  }

  // 6. Replace Arjun's seeded events, then rebuild his mastery from the full log: upsert first, then prune
  // lemmas the replay no longer has, so there is never a moment with no mastery.
  for (const part of chunks(allIds)) {
    must(await supabase.from('learning_events').delete().eq('profile_id', ARJUN.id).in('message_id', part));
  }
  for (const { events } of simulated) await insertEvents(ARJUN.id, events);

  for (const { lang, events } of simulated) {
    const all = await listEvents(ARJUN.id, lang);
    const now = Date.now();
    const mastery = replay(all, now, lang);
    await saveMastery(ARJUN.id, Object.values(mastery) as LemmaState[]);
    const stored = must<{ lemma: string }[]>(
      await supabase.from('word_mastery').select('lemma').eq('profile_id', ARJUN.id).eq('lang', lang),
    ).map((r) => r.lemma);
    const gone = stored.filter((l) => !mastery[l]);
    for (const part of chunks(gone)) {
      must(await supabase.from('word_mastery').delete().eq('profile_id', ARJUN.id).eq('lang', lang).in('lemma', part));
    }
    const lists = wordLists(mastery, now);
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
  // Our own precondition errors are safe to show; API errors only by name/code/status (they can echo content).
  const own = err instanceof Error && err.message.startsWith('Demo threads missing');
  console.error(`\nSeed failed: ${own ? err.message : safeErr(err)}`);
  process.exit(1);
});
