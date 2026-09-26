import { randomUUID } from 'node:crypto';
import type { Server } from 'socket.io';
import { supabase } from './supabase.js';
import { env } from './env.js';
import { synthesize, transcribe, translate } from './ai.js';

// ---------- types ----------

type ProfileRow = { id: string; display_name: string; language: string };
type TranslationRow = { message_id: string; language: string; text: string; audio_path: string | null };
type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  kind: 'text' | 'voice';
  original_text: string | null;
  original_language: string;
  audio_path: string | null;
  word_timestamps: unknown;
  status: 'processing' | 'ready' | 'failed';
  created_at: string;
  message_translations?: TranslationRow[];
};

export type Profile = { id: string; displayName: string; language: string };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------- helpers ----------

function must<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const toProfile = (p: ProfileRow): Profile => ({ id: p.id, displayName: p.display_name, language: p.language });

const room = (threadId: string) => `thread:${threadId}`;

async function uploadAudio(path: string, audio: Buffer, contentType: string) {
  const { error } = await supabase.storage.from(env.AUDIO_BUCKET).upload(path, audio, { contentType, upsert: true });
  if (error) throw new Error(`Audio upload failed: ${error.message}`);
}

/** Turns DB rows into API messages, swapping storage paths for 1-hour signed URLs. */
async function serialize(rows: MessageRow[]) {
  const paths = rows
    .flatMap((r) => [r.audio_path, ...(r.message_translations ?? []).map((t) => t.audio_path)])
    .filter((p): p is string => Boolean(p));

  const urls = new Map<string, string>();
  if (paths.length) {
    const { data, error } = await supabase.storage.from(env.AUDIO_BUCKET).createSignedUrls(paths, 60 * 60);
    if (error) throw new Error(error.message);
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  const url = (p: string | null) => (p ? urls.get(p) ?? null : null);

  return rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    senderId: r.sender_id,
    kind: r.kind,
    originalText: r.original_text,
    originalLanguage: r.original_language,
    audioUrl: url(r.audio_path),
    wordTimestamps: r.word_timestamps ?? null,
    status: r.status,
    createdAt: r.created_at,
    translations: (r.message_translations ?? []).map((t) => ({
      language: t.language,
      text: t.text,
      audioUrl: url(t.audio_path),
    })),
  }));
}
export type ApiMessage = Awaited<ReturnType<typeof serialize>>[number];

async function loadMessage(id: string): Promise<ApiMessage> {
  const row = must<MessageRow>(
    await supabase.from('messages').select('*, message_translations(*)').eq('id', id).single(),
  );
  return (await serialize([row]))[0];
}

async function getMembers(threadId: string): Promise<Profile[]> {
  const rows = must<{ profiles: ProfileRow }[]>(
    await supabase.from('thread_members').select('profiles(id, display_name, language)').eq('thread_id', threadId),
  );
  return rows.map((r) => toProfile(r.profiles));
}

/** Checks the sender belongs to the thread and works out which languages to translate into. */
async function resolveThread(threadId: string, senderId: string) {
  const members = await getMembers(threadId);
  const sender = members.find((m) => m.id === senderId);
  if (!sender) throw new HttpError(403, 'Sender is not a member of this thread');
  const targets = [...new Set(members.filter((m) => m.id !== senderId).map((m) => m.language))].filter(
    (lang) => lang !== sender.language,
  );
  return { sender, targets };
}

async function finish(io: Server, row: MessageRow, status: 'ready' | 'failed') {
  await supabase.from('messages').update({ status }).eq('id', row.id);
  io.to(room(row.thread_id)).emit('message:updated', await loadMessage(row.id));
}

// ---------- reads ----------

export async function listProfiles(): Promise<Profile[]> {
  const rows = must<ProfileRow[]>(
    await supabase.from('profiles').select('id, display_name, language').order('display_name'),
  );
  return rows.map(toProfile);
}

export async function listThreadsForProfile(profileId: string) {
  const mine = must<{ thread_id: string }[]>(
    await supabase.from('thread_members').select('thread_id').eq('profile_id', profileId),
  );
  const ids = mine.map((m) => m.thread_id);
  if (!ids.length) return [];

  const rows = must<{ thread_id: string; profiles: ProfileRow }[]>(
    await supabase
      .from('thread_members')
      .select('thread_id, profiles(id, display_name, language)')
      .in('thread_id', ids),
  );
  const byThread = new Map<string, Profile[]>();
  for (const r of rows) {
    const list = byThread.get(r.thread_id) ?? [];
    list.push(toProfile(r.profiles));
    byThread.set(r.thread_id, list);
  }
  return ids.map((id) => ({ id, members: byThread.get(id) ?? [] }));
}

export async function listMessages(threadId: string) {
  const rows = must<MessageRow[]>(
    await supabase
      .from('messages')
      .select('*, message_translations(*)')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(200),
  );
  return serialize(rows);
}

// ---------- text messages ----------

export async function createTextMessage(io: Server, threadId: string, senderId: string, text: string) {
  const { sender, targets } = await resolveThread(threadId, senderId);

  const row = must<MessageRow>(
    await supabase
      .from('messages')
      .insert({
        thread_id: threadId,
        sender_id: senderId,
        kind: 'text',
        original_text: text,
        original_language: sender.language,
        status: 'processing',
      })
      .select('*')
      .single(),
  );

  const message = (await serialize([row]))[0];
  io.to(room(threadId)).emit('message:new', message); // show it instantly, translation follows
  void processText(io, row, targets);
  return message;
}

async function processText(io: Server, row: MessageRow, targets: string[]) {
  try {
    const translations = await Promise.all(
      targets.map(async (language) => ({
        message_id: row.id,
        language,
        text: await translate(row.original_text ?? '', row.original_language, language),
        audio_path: null,
      })),
    );
    if (translations.length) must(await supabase.from('message_translations').insert(translations));
    await finish(io, row, 'ready');
  } catch (err) {
    console.error(`[text ${row.id}]`, err);
    await finish(io, row, 'failed');
  }
}

// ---------- voice messages ----------

const AUDIO_TYPES: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

function audioType(mimetype: string) {
  const contentType = mimetype.split(';')[0].trim().toLowerCase();
  const ext = AUDIO_TYPES[contentType];
  if (!ext) throw new HttpError(415, `Unsupported audio type: ${contentType}`);
  return { ext, contentType };
}

export async function createVoiceMessage(
  io: Server,
  threadId: string,
  senderId: string,
  file: { buffer: Buffer; mimetype: string },
) {
  const { sender, targets } = await resolveThread(threadId, senderId);
  const { ext, contentType } = audioType(file.mimetype);

  const id = randomUUID();
  const path = `${threadId}/${id}/original.${ext}`;
  await uploadAudio(path, file.buffer, contentType);

  const row = must<MessageRow>(
    await supabase
      .from('messages')
      .insert({
        id,
        thread_id: threadId,
        sender_id: senderId,
        kind: 'voice',
        original_language: sender.language,
        audio_path: path,
        status: 'processing',
      })
      .select('*')
      .single(),
  );

  const message = (await serialize([row]))[0];
  io.to(room(threadId)).emit('message:new', message);
  void processVoice(io, row, file.buffer, ext, contentType, targets);
  return message;
}

async function processVoice(
  io: Server,
  row: MessageRow,
  audio: Buffer,
  ext: string,
  contentType: string,
  targets: string[],
) {
  try {
    // 1. Speech → text in the sender's language
    const { text, words } = await transcribe(audio, `voice.${ext}`, contentType, row.original_language);
    if (!text) throw new Error('No speech detected');
    must(await supabase.from('messages').update({ original_text: text, word_timestamps: words }).eq('id', row.id));

    // 2. Text → each recipient language → speech
    const translations = await Promise.all(
      targets.map(async (language) => {
        const translated = await translate(text, row.original_language, language);
        const speech = await synthesize(translated, language);
        const audioPath = `${row.thread_id}/${row.id}/${language}.mp3`;
        await uploadAudio(audioPath, speech, 'audio/mpeg');
        return { message_id: row.id, language, text: translated, audio_path: audioPath };
      }),
    );
    if (translations.length) must(await supabase.from('message_translations').insert(translations));
    await finish(io, row, 'ready');
  } catch (err) {
    console.error(`[voice ${row.id}]`, err);
    await finish(io, row, 'failed');
  }
}
