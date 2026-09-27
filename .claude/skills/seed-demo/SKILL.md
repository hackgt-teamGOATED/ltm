---
name: seed-demo
description: 'Build or run the idempotent demo seed for Arjun, Abuela and Zara with analyses and a simulated event log. Use for Phase 2b and any demo data change.'
---

# Seed demo data

1. `npm run seed:demo` (server workspace). Idempotent: rerunning replaces demo rows only.
2. Profiles and threads (PLAN.md §1.2): Arjun `…0001`, Abuela `…0003`, Zara `…0005`; threads `…00a2`
   (Arjun–Abuela) and `…00a4` (Arjun–Zara). Upsert them; never touch other profiles.
3. Content: ~40 messages per thread over 8 weeks, recurring everyday vocabulary, ~30% voice notes with
   synthesized original-language audio and timestamps. 3 hero messages per thread from
   `server/src/scripts/heroMessages.json` (native-written or approved, at least one idiom each). Everything
   else keeps `needs_native_check = true`.
4. Generate analyses for every seeded message (viewer language English).
5. Simulate Arjun's events with `@heirloom/learner` and the Python demo's behavior model; write them with
   historical `created_at`; rebuild `word_mastery` from the log. `thread_settings`: Arjun on (es, ur); others off.
6. Print a summary: messages per thread, events per language, final stage per language. Expect Spanish at
   Conversant or Fluent by Week 8 and Urdu behind.

**Guardrails:** never touch non-demo rows; never hand-edit mastery to force stages; no copyrighted text.
