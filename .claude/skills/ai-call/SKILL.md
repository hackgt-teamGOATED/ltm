---
name: ai-call
description: 'Add or change an OpenAI call (analyze, explain word, ask) with structured outputs, validation, retry and caching. Use for any change in server/src/ai.ts.'
---

# Add or change an AI call

1. Only in `server/src/ai.ts`. Model name from an env var with a documented default.
2. Structured outputs with a JSON schema; validate the parsed result; one retry; then a typed error.
3. Cache in the database (`message_analyses`, `word_notes`) and check the cache first.
4. Prompts state: beginner-friendly one-line grammar; romanization mandatory for Urdu and Hindi; never
   invent cultural notes; joined token surfaces reproduce the original exactly; `tSpans` are valid ranges
   of the returned translation.
5. After parsing an analysis: rejoin `tokens` surfaces (with original whitespace) and compare to the text;
   check every `tSpans` range. On failure retry once, then store with `failed = true`; the client shows the
   plain transcript.
6. Send only the message text, languages and (for word notes) a few example sentences from the same
   user's threads. Never secrets or unrelated user data.

**Guardrails:** no AI calls from the client; no new AI providers without approval; the LLM annotates,
it never decides what the learner sees.
