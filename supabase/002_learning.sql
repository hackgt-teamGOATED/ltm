-- Heirloom learning layer (PLAN.md §5.2). Additive only; safe to re-run.
-- RLS on with no policies, as in 001: only the server key can read or write.

create table if not exists thread_settings (
  thread_id        uuid not null references threads(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  learning_enabled boolean not null default false,
  learning_lang    text check (learning_lang is null or learning_lang ~ '^[a-z]{2}$'),
  updated_at       timestamptz not null default now(),
  primary key (thread_id, profile_id)
);

create table if not exists message_analyses (
  message_id         uuid not null references messages(id) on delete cascade,
  viewer_lang        text not null,
  tokens             jsonb not null default '[]'::jsonb,
  phrases            jsonb not null default '[]'::jsonb,
  translation        text not null default '',
  model              text,
  needs_native_check boolean not null default true,
  failed             boolean not null default false,
  created_at         timestamptz not null default now(),
  primary key (message_id, viewer_lang)
);
create index if not exists message_analyses_message_idx on message_analyses (message_id);

create table if not exists word_notes (
  lang        text not null,
  lemma       text not null,
  viewer_lang text not null,
  grammar     text,
  culture     text,
  usage       text,
  examples    jsonb not null default '[]'::jsonb,
  is_idiom    boolean not null default false,
  created_at  timestamptz not null default now(),
  primary key (lang, lemma, viewer_lang)
);

-- Lemmas and counters only, never message text.
create table if not exists learning_events (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references profiles(id) on delete cascade,
  lang               text not null,
  lemma              text not null,
  form               text,
  event_type         text not null,
  message_id         uuid references messages(id) on delete set null,
  thread_id          uuid references threads(id) on delete set null,
  options            int,
  romanization_shown boolean,
  created_at         timestamptz not null default now()  -- client-supplied allowed (seeding)
);
create index if not exists learning_events_profile_lang_idx on learning_events (profile_id, lang, created_at);

create table if not exists word_mastery (
  profile_id uuid not null references profiles(id) on delete cascade,
  lang       text not null,
  lemma      text not null,
  state      jsonb not null,  -- serialized LemmaState from packages/learner
  updated_at timestamptz not null default now(),
  primary key (profile_id, lang, lemma)
);

alter table thread_settings  enable row level security;
alter table message_analyses enable row level security;
alter table word_notes       enable row level security;
alter table learning_events  enable row level security;
alter table word_mastery     enable row level security;

-- Cast (PLAN.md §1.2): Zara (Urdu) and the Arjun ↔ Zara thread. Arjun, Abuela and a2 come from seed.sql.
insert into profiles (id, display_name, language) values
  ('00000000-0000-0000-0000-000000000005', 'Zara', 'ur')
on conflict (id) do nothing;

insert into threads (id) values
  ('00000000-0000-0000-0000-0000000000a4')
on conflict (id) do nothing;

insert into thread_members (thread_id, profile_id) values
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000005')
on conflict do nothing;
