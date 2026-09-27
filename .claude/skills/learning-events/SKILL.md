---
name: learning-events
description: 'Log learning events from the client through the event queue with optimistic updates. Use when wiring any interaction that feeds the learner model.'
---

# Log a learning event from the UI

1. Emit events only through `client/src/learning/eventQueue.ts`:
   `enqueue({ lang, lemma, form, eventType, messageId, threadId, options?, romanizationShown })`.
2. The queue applies each event optimistically with `@heirloom/learner` to the local mastery store, then
   flushes to `POST /api/events` every 3 seconds, on leaving a chat, and when the app goes to the background
   (`AppState` on native; `visibilitychange` in a `*.web.ts` helper).
3. Server responses replace local entries for the returned lemmas (server wins).
4. Triggers (PLAN.md §8.3):
   - Message viewed ≥ 2.5s (FlatList `viewabilityConfig`, `minimumViewTime: 2500`): per tracked token,
     `exposure_hinted` if its hint was visible, else `read_unaided`. Once per message per session.
   - Tap on a hinted or unknown token: `tap_reveal`. Tap on a mastered token or a translation word: `tap_explore`.
   - "Hear it": `audio_play`. "Show translation": `show_translation` for the message's unhinted tokens.
   - Practice or in-chat guess: `guess_correct` / `guess_wrong` with `options: 4`.
5. Only for threads where the current user has Heirloom on, only tokens in their learning language, never punctuation.

**Guardrails:** never log events in demo replay mode; the slider is read-only.
