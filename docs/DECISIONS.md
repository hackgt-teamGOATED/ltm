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
