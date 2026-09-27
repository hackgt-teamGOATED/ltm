---
name: tappable-transcript
description: 'Render the tappable transcript and translation with hints, tSpans linking, Urdu RTL and karaoke. Use for TranscriptBox, TranslationText and WordCard work.'
---

# Render a tappable transcript

1. Get the analysis for `(messageId, viewerLang)`; if missing, render the plain transcript and wait for
   `analysis:ready`. If `failed`, keep the plain transcript.
2. Compute `renderPlan(tokens, mastery, now)` from `@heirloom/learner` (memoize per message + mastery version).
3. Render **one outer `<Text>`** with a nested `<Text onPress>` per token and the original whitespace
   between tokens. Nested presses work on web and native, and wrapping/bidi stay correct.
4. Styles by plan: hint → gold dotted underline (+ small gloss line when the stage shows hints);
   fading → orange underline; mastered → plain; challenge → gold outline with "?" (tap opens a guess
   card, not the answer); punctuation plain and not pressable.
5. Phrases: tapping any member selects all of `phrase.tokenIndices`.
6. **Translation pane (`TranslationText`):** split `analysis.translation` at the union of all `tSpans`
   boundaries; each piece knows which token or phrase it belongs to. Tapping it highlights the original
   tokens (gold tint) and opens the same card, logging `tap_explore`.
7. **Urdu:** `writingDirection: 'rtl'`, `textAlign: 'right'` on Urdu text only (Hindi is left-to-right).
   Noto Nastaliq Urdu, line height ~2.0. Romanization under the line when the plan says so. Identify tokens
   by `token.i` only.
8. **Karaoke:** while a voice note plays, poll the player position (~100ms) and highlight the token whose
   `[start, end]` contains it; stop when paused.

**Guardrails:** never split text on the client yourself (only server tokens and `tSpans`); never use
global RTL; no DOM elements.
