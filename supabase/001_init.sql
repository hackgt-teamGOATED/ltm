-- v0 schema: profiles, threads, messages, per-language translations.
-- Run in the Supabase SQL editor (or `supabase db push` if you use the CLI).

create extension if not exists pgcrypto;

create table profiles (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null,
  language     text not null check (language ~ '^[a-z]{2}$'),  -- ISO 639-1: en, hi, es...
  created_at   timestamptz not null default now()
);

create table threads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table thread_members (
  thread_id  uuid not null references threads(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  primary key (thread_id, profile_id)
);

create table messages (
  id                uuid primary key default gen_random_uuid(),
  thread_id         uuid not null references threads(id) on delete cascade,
  sender_id         uuid not null references profiles(id),
  kind              text not null check (kind in ('text', 'voice')),
  original_text     text,          -- typed text, or the transcript of a voice note
  original_language text not null,
  audio_path        text,          -- storage path of the original voice note
  word_timestamps   jsonb,         -- Whisper word timings, for karaoke highlighting later
  status            text not null default 'processing'
                    check (status in ('processing', 'ready', 'failed')),
  created_at        timestamptz not null default now()
);
create index messages_thread_created_idx on messages (thread_id, created_at);

create table message_translations (
  message_id uuid not null references messages(id) on delete cascade,
  language   text not null,
  text       text not null,
  audio_path text,                 -- TTS audio for translated voice notes
  created_at timestamptz not null default now(),
  primary key (message_id, language)
);

-- Lock every table to the server. RLS on + no policies = the anon/public key
-- can read nothing. The Express server uses the service role key, which
-- bypasses RLS. Add real policies when you add Supabase Auth.
alter table profiles             enable row level security;
alter table threads              enable row level security;
alter table thread_members       enable row level security;
alter table messages             enable row level security;
alter table message_translations enable row level security;

-- Private bucket for voice notes. Clients only ever get short-lived signed URLs.
insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do nothing;
