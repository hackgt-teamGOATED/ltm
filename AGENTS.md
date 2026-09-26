# Heritage Chat: notes for coding agents

Two-way translated family messaging (HackGT 13, AI/ML track + Meta challenge).
A grandchild writes in English, a grandparent reads in Hindi, and back. Voice notes
are transcribed, translated and read back in the recipient's language.

## Secrets: hard rules

- API keys live in `~/.config/heritage-chat/server.env`, outside the repo. **Never read,
  print, cat, grep, copy, or edit that file**, or any `.env` file, and never echo
  environment variables (`env`, `printenv`, `echo $OPENAI_API_KEY`, etc.).
- Never run `scripts/setup.sh` / `npm run setup`. It prompts for keys; humans run it.
- To diagnose config problems, run `npm run doctor`. It checks everything and never prints secrets.
- Never put keys in code, tests, logs, commits, or the web app. The Supabase secret key and
  OpenAI key are server-only. The browser must only talk to our Express server.
- Never commit with `--no-verify`. The pre-commit hook blocks env files and key-shaped strings.
- If you ever see a secret by accident, stop and tell the human so they can rotate it.

## Commands

- `npm run dev`: web on http://localhost:5173, API + Socket.IO on :4000
- `npm run doctor`: config and connectivity check (safe to run)
- `npm run typecheck` / `npm run build`
- Split-screen test: http://localhost:5173/split.html?left=Arjun&right=Nani

## Architecture (see README.md for detail)

- `web/`: Vite + React + TS. Talks to the server only through `/api` and `/socket.io`
  (Vite proxies both). No Supabase or OpenAI client in the browser.
- `server/src/messages.ts`: message pipeline: store → emit `message:new` → translate
  (and for voice: Whisper → translate → TTS → storage) → emit `message:updated`.
- `server/src/ai.ts`: all OpenAI calls. Model names come from env vars.
- `supabase/001_init.sql`: schema. RLS is on with no policies: only the server key can read.
  Schema changes go in a new numbered SQL file (`002_...sql`); tell the human to run it.

## Working rules

- Keep changes small and focused. Explain what you changed and why.
- Ask before adding dependencies or changing the stack.
- Hackathon rule: hacking window is Fri 8 PM to Sun 8 AM. Don't pull in prior projects' code.
- Use the `verify-pipeline` skill (or its steps) after touching the message pipeline.
