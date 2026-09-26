# Heritage Chat — v0

Two-way translated messaging between family members who don't share a language.
Text and voice notes arrive already translated into the reader's language.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web | Vite + React + TypeScript | Fast dev server, what the team already knows |
| API | Express 5 + TypeScript (tsx) | Simple REST + holds all secrets |
| Realtime | Socket.IO | Pushes "new" and "translated" events to open chats |
| Dev proxy | Vite proxy | `/api` and `/socket.io` served from the web origin, so one tunnel URL covers everything |
| Database | Supabase Postgres | Tables for people, threads, messages, translations |
| Audio storage | Supabase Storage (private bucket) | Voice notes + TTS audio, served via 1-hour signed URLs |
| Translation | OpenAI chat model (`gpt-4o-mini`) | Handles tone, emoji, Hinglish |
| Speech → text | `whisper-1` | Also returns word timestamps for karaoke highlighting later |
| Text → speech | `gpt-4o-mini-tts` | Reads translated voice notes aloud |

All model names are env vars, so you can swap them without code changes.

The browser never talks to Supabase or OpenAI directly. Everything goes through the
Express server, so no key ever reaches the client.

## Teammate quickstart (about 5 minutes)

You need Node 22+ and the Supabase URL + secret key from Victor (sent privately).

```bash
git clone https://github.com/hackgt-teamGOATED/ltm.git heritage-chat
cd heritage-chat
npm run setup      # run this yourself, not through an agent: it asks for keys
npm run dev
```

Then open http://localhost:5173/split.html.

`npm run setup` checks Node, saves your keys to `~/.config/heritage-chat/server.env`
(outside the repo, readable only by you), installs dependencies, installs a git hook that
blocks committing keys, and runs `npm run doctor`.

- **Something broken?** `npm run doctor` checks keys, database, storage and OpenAI without
  printing any secrets, and tells you how to fix each problem.
- **Wrong key?** `npm run setup -- --reset`
- **Shared database:** everyone uses the same Supabase project, so you'll see each other's
  test messages. That's expected.

### First-time project setup (already done, for reference)

1. Create a Supabase project. In the SQL editor, run `supabase/001_init.sql`, then `supabase/seed.sql`.
2. Run `npm run setup` and paste the Project URL, the Secret key (`sb_secret_…`) and an OpenAI key.

## Keeping secrets safe (humans and agents)

- Keys never live in the repo. The server loads them from `~/.config/heritage-chat/server.env`
  (or `DOTENV_CONFIG_PATH` if set, or a gitignored `server/.env` as a fallback).
- `AGENTS.md` (also loaded by `CLAUDE.md`) tells coding agents the rules: never read the
  secrets file, never run setup, use `npm run doctor` to diagnose.
- `.claude/settings.json` denies Claude Code access to the secrets file, `.env` files and the
  setup script. `.cursorignore` does the same for Cursor.
- The pre-commit hook (`scripts/hooks/pre-commit`) rejects env files and key-shaped strings.
- Keep manual approval on for agent terminal commands. Ignore rules stop file reads, not a shell
  command an agent decides to run.

## Seeing both sides

- **Split screen:** `/split.html?left=Arjun&right=Nani` loads two copies of the app, one per person.
  Best for building and for recording the demo video.
- **Separate windows:** any URL accepts `?as=Nani` (name or profile id). Without it, each tab
  remembers its own person, so two windows in one browser also work.
- **Separate devices (phones, a teammate's laptop):** run a free HTTPS tunnel to the web port:
  ```bash
  brew install cloudflared            # or see cloudflare's docs for Windows/Linux
  cloudflared tunnel --url http://localhost:5173
  ```
  It prints an `https://<random>.trycloudflare.com` URL. Open it on any device, anywhere.
  One URL is enough because Vite proxies `/api` and `/socket.io` to the server.
  ngrok works the same way: `ngrok http 5173`.
  - HTTPS matters: browsers only allow microphone recording on HTTPS or localhost, so voice
    notes won't record over a plain `http://192.168.x.x` LAN address.
  - Campus Wi-Fi often blocks device-to-device traffic anyway, so the tunnel is the reliable option.
  - The laptop running `npm run dev` has to stay on. For a permanent deploy, host the server on a
    platform with long-running processes (Render, Railway, Fly) since Socket.IO needs websockets,
    host the web build anywhere static, and set `VITE_API_URL` + `WEB_ORIGIN`.

## How a message flows

**Text**
1. `POST /api/threads/:id/messages` stores the message with `status = processing`.
2. The server emits `message:new` right away, so the sender sees it instantly.
3. It translates into every other member's language, saves rows in `message_translations`,
   sets `status = ready`, and emits `message:updated`.

**Voice**
1. The browser records with `MediaRecorder` (webm on Chrome, mp4 on Safari) and uploads to
   `POST /api/threads/:id/voice`.
2. The server stores the original audio, emits `message:new`, then runs:
   Whisper transcript → translate → TTS → upload mp3 → `message:updated`.

**Reverse translation** costs nothing extra. The sender's bubble has a "What they see" toggle
that shows the stored translation the recipient received.

## API

| Method | Path | Body |
|---|---|---|
| GET | `/api/health` | |
| GET | `/api/profiles` | |
| GET | `/api/profiles/:id/threads` | |
| GET | `/api/threads/:id/messages` | |
| POST | `/api/threads/:id/messages` | JSON `{ senderId, text }` |
| POST | `/api/threads/:id/voice` | multipart: `senderId`, `audio` |

Socket events: client emits `thread:join` / `thread:leave` with a thread id; server emits
`message:new` and `message:updated` with the full message.

## Project layout

```
scripts/
  setup.sh            one-time setup: keys, deps, git hook, doctor
  hooks/pre-commit    blocks committing env files / API keys
.claude/
  settings.json       Claude Code deny rules for secrets
  skills/verify-pipeline/SKILL.md   end-to-end pipeline test for agents
AGENTS.md             rules + architecture for coding agents (CLAUDE.md imports it)
server/src/
  index.ts      Express + Socket.IO bootstrap
  doctor.ts     `npm run doctor` setup check (never prints secrets)
  routes.ts     REST endpoints
  messages.ts   message pipeline (store → translate → TTS → emit)
  ai.ts         translate / transcribe / synthesize (OpenAI)
  supabase.ts   server-only Supabase client
  env.ts        env loading (~/.config/heritage-chat/server.env first)
web/
  split.html                  two-pane view, one person per pane
web/src/
  App.tsx                     person picker (?as= param) + conversation list
  components/ThreadView.tsx   loads messages, joins socket room
  components/MessageBubble.tsx  translated view, original / "what they see" toggle, read aloud
  components/Composer.tsx     text input + voice recording
supabase/
  001_init.sql  schema, RLS lock-down, private audio bucket
  seed.sql      Arjun (en), Nani (hi), Abuela (es)
```

## Known v0 shortcuts

- **No auth.** The client says who the sender is. Fine for a demo, not for real use.
  Next step: Supabase Auth, then check the user on the server instead of trusting `senderId`.
- **Tables are locked to the server.** RLS is on with no policies, so the public key can read nothing.
- **Read aloud for text** uses the browser's built-in speech engine. Hindi voice quality depends on the OS.
- **Voice cloning** is out of scope for v0.

## Next (v1)

- `events`, `word_state` and `thread_vocab` tables for the learner model
- Structured translation output (per-word lemma, gloss, romanization) from the same translation call
- Word-level rendering states (translated / learning / known) and the word sheet
- Karaoke highlighting using `messages.word_timestamps`
