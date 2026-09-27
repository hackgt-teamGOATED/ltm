# Decisions

Short, dated, append-only. Superseded decisions stay, marked as such.

| ID | Date | Decision | Why |
| --- | --- | --- | --- |
| D-001 | Sat Sep 26 | AI/ML track + Meta challenge | Meta rewards connection; the learner model carries the ML track |
| D-002 | Sat Sep 26 | ~~Keep the Vite web client~~ Superseded by D-011 | |
| D-003 | Sat Sep 26 | The LLM only annotates; the learner model decides what users see | Not a "GPT wrapper"; inspectable and testable |
| D-004 | Sat Sep 26 | ~~Server-only model~~ Superseded by D-013 | |
| D-005 | Sat Sep 26 | Sarosh's per-skill memory model (recognize, script, produce) with his constants; Python file is the reference | Written, simulated, research-grounded |
| D-006 | Sat Sep 26 | Analysis = Sarosh's tokens and phrases **plus `tSpans`** into the translation | Section 1 highlighting and tap-either-pane need an alignment |
| D-007 | Sat Sep 26 | Near-realtime voice notes only; no live calls; no voice cloning | Scope, honesty, consent |
| D-008 | Sat Sep 26 | Secrets outside the repo; Supabase stays; deploy on Render after CI | Already working |
| D-009 | Sat Sep 26 | Biome for lint only (hooks + CI); formatting only by explicit `npm run format`. Tests use `node --test`, no test framework | Avoid mass reformat conflicts; no extra dependency |
| D-010 | Sat Sep 26 | ~~server/src/lltm/core boundary~~ Superseded by D-013 | |
| D-011 | Sat Sep 26 | **React Native + Expo SDK 57**, deployed as a web build for iPhone Safari; code stays mobile-ready (browser APIs only in `*.web.ts(x)`) | Team choice; native build possible later without a rewrite |
| D-012 | Sat Sep 26 | Cast: Arjun (en) learns Spanish from Abuela and Urdu from friend Zara; Hindi and English selectable, not seeded | Broadens the story beyond family; two scripts incl. RTL |
| D-013 | Sat Sep 26 | Shared pure package `packages/learner` used by server (source of truth) and client (optimistic updates, slider replay) | One model everywhere; fast slider |
| D-014 | Sat Sep 26 | Four stages: Listener, Reader, Conversant, Fluent; stage per user per language | Fluent is the strongest demo moment; no flicker between bubbles |
| D-015 | Sat Sep 26 | One Render service serves the Expo web export (`STATIC_DIR=client/dist`); Vercel only as fallback | One URL, no CORS, CI-gated deploys already set up |
| D-016 | Sat Sep 26 | v0 `web/` stays untouched as a fallback until Phase 3 passes | Safety net |
| D-017 | Sat Sep 26 | Seed script moves to Phase 2b (right after the server layer) | Fade, slider and Progress can't be tested without data |
| D-018 | Sat Sep 26 | Light evaluation for the AI/ML track: simulator + 3 charts; Duolingo fit optional | The track needs ML evidence, not just an app |
| D-019 | Sat Sep 26 | Merged Sarosh's Agents.md/Skills.md into AGENTS.md and `.claude/skills/`; files not @-imported into CLAUDE.md | macOS treats Agents.md and AGENTS.md as the same file; skills load on demand |
| D-020 | Sat Sep 26 | `docs/reference/learner_model.py` is unavailable, so PLAN.md §8 is the reference. Parity fixtures are replaced by exact-formula tests plus the §8.6 scenarios. Gaps filled: default difficulty 0.5; `initialStability` is the first-contact value after the exposure/failure factor; exposure also resets `lastReview`; inflection transfer (×0.85) applies to a form not seen before; `used_suggested`/`used_unprompted` are produce successes at 0.5/1.0 | Unblocks Phase 1; if the Python file turns up, diff it against `packages/learner` and fix mismatches |
| D-021 | Sat Sep 26 | Analysis asks the model for words, not offsets: each token lists the exact translation substrings it maps to, and the server computes `tSpans` and token whitespace (`Token.pre`) itself. The stored message translation is passed in so Section 1 matches the bubble | Model-produced character offsets drift, especially in Urdu |
| D-022 | Sat Sep 26 | No Render service existed: add `render.yaml` and `STATIC_DIR` static serving in the server | One service, one URL (D-015) |
| D-023 | Sat Sep 26 | Hero messages drafted by the team (no native speaker yet), all flagged `needs_native_check = true` | Seed can't wait; a speaker can replace them in `heroMessages.json` |
| D-024 | Sat Sep 26 | Keep the learner model unchanged and seed a **realistic** arc: Spanish Listener → Reader by week 8 (about 30–40% readable), Urdu mostly Listener. No Conversant/Fluent in the seeded history. Simulated Arjun is engaged (reads everything, short daily 5-question practice), and Abuela's script adds 20 short daily check-ins | Team call: fluency in 8 weeks is unrealistic. The model is strict by design: hinted words only give exposure evidence, so without practice nothing is ever mastered |
| D-025 | Sat Sep 26 | **Open (spike pending).** Web recording uses `client/src/audio/recorder.web.ts` (MediaRecorder; prefers `audio/mp4`, falls back to WebM/Opus; releases mic tracks on stop). Native uses `recorder.ts` (expo-audio, .m4a). Neither has been tested on a real phone. Test: open the Render HTTPS URL in iPhone Safari → pick Arjun → open Abuela → tap 🎤, allow the mic, speak ~5 s, tap ■ → the bubble shows "Transcribing…" and then a transcript plus a translation on Abuela's side. Also record once in desktop Chrome (it may report `audio/mp4` support with Opus inside) and confirm a transcript comes back. Record pass/fail, browser and iOS version here | Direct MediaRecorder gives control over the format; iOS Safari is on the demo's critical path |
| D-026 | Sat Sep 26 | The web `<head>` (PWA meta, viewport-fit, apple-touch-icon, manifest) lives in `client/public/index.html`, not `app/+html.tsx` as PLAN §4/§7.9 say | Expo ignores `+html.tsx` when `web.output` is `"single"`; `public/index.html` is the template it uses. Don't "fix" it back |
