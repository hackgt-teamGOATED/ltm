---
name: verify-pipeline
description: End-to-end check of the Heritage Chat message pipeline (text translation, voice transcription + translation + TTS, and socket delivery). Use after changing server/src/messages.ts, server/src/ai.ts, the schema, or when a teammate says messages aren't translating.
---

# Verify the message pipeline

Never read secrets or `.env` files. If config looks wrong, run `npm run doctor` and report
its output; the human fixes keys.

## 0. Preconditions

1. `npm run doctor` passes. If not, stop and report the failing lines.
2. The dev server is running (`npm run dev`). Check with `curl -s localhost:5173/api/health`,
   which should return `{"ok":true}`. If it isn't running, start it in the background and wait
   until the health check passes.

Seed IDs:
- Arjun (en): `00000000-0000-0000-0000-000000000001`
- Nani (hi): `00000000-0000-0000-0000-000000000002`
- Arjun–Nani thread: `00000000-0000-0000-0000-0000000000a1`

## 1. Text, English → Hindi

```bash
T=00000000-0000-0000-0000-0000000000a1
A=00000000-0000-0000-0000-000000000001
curl -s -X POST localhost:5173/api/threads/$T/messages \
  -H 'Content-Type: application/json' \
  -d "{\"senderId\":\"$A\",\"text\":\"Hi Nani, did you eat yet?\"}"
sleep 5
curl -s localhost:5173/api/threads/$T/messages | tail -c 1500
```

Pass: the newest message has `"status":"ready"` and a `translations` entry with
`"language":"hi"` written in Devanagari.

## 2. Text, Hindi → English

Same as step 1 with `senderId` = Nani's id and text `"बेटा, खाना खा लिया?"`.
Pass: an `"en"` translation.

## 3. Voice (no microphone needed, macOS)

```bash
say -o /tmp/hc-test.m4a --data-format=aac "Hi Nani, I miss you. I'll call you this weekend."
curl -s -F senderId=$A -F "audio=@/tmp/hc-test.m4a;type=audio/mp4" localhost:5173/api/threads/$T/voice
sleep 12
curl -s localhost:5173/api/threads/$T/messages | tail -c 2000
```

Pass: newest message is `"kind":"voice"`, `"status":"ready"`, has `originalText` (the
transcript), and its `"hi"` translation has a non-null `audioUrl`.

## 4. Report

Summarize pass/fail per step. On failure, quote the relevant `[text <id>]` or
`[voice <id>]` error from the server output, with no secrets, and propose the smallest fix.
Test messages stay in the shared database; mention that so the team isn't surprised.
