# Heirloom

**Translation that fades. Fluency that stays.**

A messenger that translates between people who don't share a language, and quietly teaches the
learner the other person's language from their own conversations, until the translation isn't needed.
Built at HackGT 13 (Oracle of the Deep track, Meta challenge).

**Try it:** https://ltm-sp5l.onrender.com/?as=arjun (free hosting, so the first load can take about a minute).
Pick a person with `?as=`:

| `?as=` | Person | Speaks | Heirloom |
|---|---|---|---|
| `arjun` | Arjun, the learner | English | On for Abuela (Spanish) and Zara (Urdu), with 8 weeks of simulated history |
| `abuela` | Abuela | Spanish | Off |
| `zara` | Zara | Urdu | Off |
| `sarosh` | Sarosh | Urdu | Off |
| `victor` | Victor | English | On, learning Urdu (starts as a Listener) |

## What it does

- **Two-way translated chat.** Text and voice notes arrive translated, transcribed and read aloud.
  For the other person it is a normal chat.
- **Heirloom (per chat, opt-in).** Tap a word for its meaning, grammar and cultural context, with the matching
  word highlighted in the translation. Reading without help, tapping, guessing and replaying a voice note
  all feed a per-word memory model.
- **The fade.** Each language has four stages: Listener, Reader, Conversant, Fluent. Each shows less
  translation, and a word's hint dissolves once you know it.
- **Progress tab** with Mastered / Learning / New words and how much you can read on your own.
- **Time-travel slider:** long-press the header chip for 1.5 s (or add `?demo=1` to a chat URL) to replay
  eight weeks through the real model. It is read-only and logs nothing.

## How it works

The LLM only annotates messages; the learner model decides what to show.

```
client (Expo, web) ──/api + /socket.io──▶ server (Express + Socket.IO) ──▶ Supabase (Postgres + private audio bucket)
                                                   └──▶ OpenAI: Whisper, gpt-4o-mini, gpt-4o-mini-tts
packages/learner: pure TypeScript memory model, used by the server, the client, the slider and the evaluation
```

1. A message is stored and shown at once (`message:new`), then translated (`message:updated`).
   Voice notes go through Whisper, translation and text-to-speech first.
2. For every member learning that language, the server analyzes the message into words
   (lemma, romanization, meaning, matching translation words), computes the character spans itself and
   validates them, then emits `analysis:ready`.
3. Learning events (views, taps, guesses) update per-word, per-skill half-life-regression state on the
   server and, optimistically, in the client with the same code. `mastery:updated` keeps other views live.

| Layer | Choice |
|---|---|
| Client | Expo / React Native for web, expo-router, Zustand, Reanimated |
| Server | Node 22, Express 5, Socket.IO |
| Data | Supabase Postgres; private bucket for audio (signed URLs) |
| AI | `gpt-4o-mini` (translate, analyze), `whisper-1`, `gpt-4o-mini-tts` (model names are env vars) |
| Model | `packages/learner`, half-life regression over `recognize` / `script` / `produce` skills |
| Hosting | One Render service serves the API, the sockets and the web build |

The browser never talks to Supabase or OpenAI; every key stays on the server.

## Run it locally

You need **Node 22.18 or newer** and the Supabase URL + secret key from a teammate.

```bash
git clone https://github.com/hackgt-teamGOATED/ltm.git
cd ltm
npm run setup      # run it yourself: it prompts for keys and saves them outside the repo
npm run dev        # app on http://localhost:8081, API + sockets on :4000
```

Open http://localhost:8081/?as=arjun. `npm run doctor` checks keys, database, storage and OpenAI without
printing any secret. Everyone shares one Supabase project, so you will see each other's test messages.
Database changes are numbered files in `supabase/`; run new ones in the Supabase SQL editor.

| Command | Does |
|---|---|
| `npm run check` | lint + typecheck + all tests |
| `npm run build` | build the learner, the server and the web export (`client/dist`) |
| `npm run seed:demo` | seed the demo history (idempotent, ids start with `de300000-`) |
| `npm run seed:demo -w server -- --reset` | dry run: shows the non-seeded demo-thread messages a reset would delete. Add `--yes` to delete them |
| `npm run analysis` | rerun the evaluation and write the charts to `analysis/out/` |
| `npm run dev:v0` | the original v0 web client on :5173 |

## Deploy

`render.yaml` describes one Render web service. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and
`OPENAI_API_KEY` in the dashboard (they are never committed); `STATIC_DIR=client/dist` makes the server serve
the web build. Every merge to `main` redeploys. Voice recording needs HTTPS, which Render provides.

## Layout

```
packages/learner/   memory model, stages, render plan, replay (pure functions, no I/O)
server/src/         Express, Socket.IO, message pipeline (messages.ts), OpenAI (ai.ts), learning/ (analysis, events, progress)
server/src/scripts/ demo seed and learner simulator
client/             Expo app: app/ (screens), src/ (components, stores, learning logic)
analysis/           evaluation run and charts
supabase/           001 schema, 002 learning tables, 003 Urdu demo user, 004 team accounts, seed.sql
docs/               PROJECT.md (scope), STATUS.md, DECISIONS.md; PLAN.md at the root
web/                the v0 client, kept as a fallback
```

## Secrets

Keys live in `~/.config/heritage-chat/server.env`, outside the repo. A pre-commit hook blocks env files and
key-shaped strings. Coding agents follow `AGENTS.md`: they never read that file and never run setup.

## Honest notes

- The demo history is **simulated** (seeded, fixed random seed). The evaluation is a simulation of 200
  learners with hand-set constants, not a study of real people.
- Spanish and Urdu annotations are AI-generated and **not yet checked by a native speaker**; the word card says so.
- There is no login: the client says who is speaking. Fine for a demo, not for real use.
- Recording on iPhone Safari has not been verified on a real device.
