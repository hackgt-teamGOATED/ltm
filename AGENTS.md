# AGENTS.md: rules for AI agents building Heirloom

Heirloom is a chat layer that translates between people who don't share a language and teaches the
learner until the translation fades (HackGT 13: AI/ML track + Meta challenge). These rules apply to every
agent and subagent in this repo and override convenience. If a rule blocks you, stop and ask the human.

**Read before any work, in this order:**
1. `docs/PROJECT.md`: scope, user stories, what's out of scope.
2. `docs/STATUS.md`: current phase, owners, blockers.
3. `PLAN.md`: your phase in §11 and the sections it references.
4. The matching skill in `.claude/skills/` (other agents: read its `SKILL.md` directly).

---

## 1. Hard rules (never break)

### Secrets and security
1. Never read, print, copy or summarize secrets: `.env*` files, `~/.config/heritage-chat/server.env`,
   Render/Supabase dashboards, or anything that looks like a key. Never echo environment variables.
2. Never put secrets in the client. `EXPO_PUBLIC_*` values are bundled and public; only the API URL may be one.
3. OpenAI and Supabase service-key calls live on the server only; OpenAI calls only in `server/src/ai.ts`.
4. Never log message content or audio in normal code paths; log ids and status.
5. Never run `setup.sh` / `npm run setup`. Use `npm run doctor` for config problems (it never prints secrets).
6. If you see a secret by accident, stop and tell the human so they can rotate it.

### Repo safety
7. Never commit with `--no-verify`, never force-push, never push to `main`, never rewrite shared history.
8. Never edit `supabase/001_init.sql`. Schema changes go in new numbered files; the human applies them.
9. Never modify or delete `web/` (v0 client). It's the fallback until Phase 3 passes.
10. Never run destructive SQL (`DROP`, `TRUNCATE`, `DELETE` without a demo-profile filter). **The Supabase
    database is shared by the whole team.**
11. The seed script only touches demo-namespaced rows (Arjun, Abuela, Zara, their threads, messages,
    analyses, events, mastery) and must be idempotent.

### Dependencies
12. Only packages in `PLAN.md` §3 / `scripts/allowed-deps.json` are approved. Anything else: ask the human
    first with the name, size and why the approved list can't do it. `npm run lint` and a Bash hook enforce this.
13. Install Expo-managed packages with `npx expo install` inside `client/`, never plain `npm install`.
    Never install `expo-av`. Never upgrade Expo or React Native past what SDK 57 pins (RN 0.86).

### Scope
14. Build only what `docs/PROJECT.md` marks MVP for the current phase. Out-of-scope items stay out even if small.
15. One phase at a time, in order, except phases `docs/STATUS.md` runs in parallel.
16. Don't redesign the architecture, rename core concepts or swap libraries mid-build. Propose instead.

### Mobile-ready (the demo ships on the web; the code must not)
17. Only React Native primitives and Expo modules in shared client code. No DOM elements, no CSS files.
18. Browser APIs (`window`, `document`, `navigator`, `MediaRecorder`, storage) only in `*.web.ts(x)` files
    with a native counterpart. No global `I18nManager` RTL. `npm run lint` enforces the first part.

### Brand and IP
19. No Meta logos, wordmarks, app names, icons, sounds or copied assets anywhere in the UI, icons, or
    display copy. The skin evokes conventions only.
20. No copyrighted lyrics, poems or book passages in seed content.

### Honesty
21. Never call voice translation "live" or "realtime calls"; it is "near-realtime voice notes".
22. Seeded history is labeled simulated. Never claim user studies, accuracy numbers or fitted parameters
    that no committed run produced.
23. Never mark generated Spanish/Urdu/Hindi content as native-verified; only a human flips `needs_native_check`.
24. Never invent cultural claims. If nothing genuine applies, omit the culture section.

### The learner model is fragile on purpose
25. `packages/learner` stays pure: no network, storage, timers or `Date.now()`; callers pass `now` and RNGs.
26. Constants live only in `packages/learner/src/constants.ts` and match `docs/reference/learner_model.py`.
    Changing a constant or formula follows the `learner-model-change` skill (human approval, Python first,
    parity test). Never special-case words or users to make the demo look better.

---

## 2. Stop and ask the human when
- A new dependency, or a schema change beyond `PLAN.md` §5.2, seems necessary.
- A done-criterion still fails after two honest attempts.
- Anything needs secrets, dashboards, DNS or billing.
- `PLAN.md` is ambiguous or contradicts itself or `docs/PROJECT.md`.
- A fix would touch a teammate's data, the v0 `web/` client, or learner constants.

When stopping, give what you tried, the exact error, and 1–2 options with a recommendation.

---

## 3. How to work

### Per ticket or phase task
1. **Plan** (`plan-ticket`): the phase, its done-criteria, files to touch, contract changes, test plan.
2. **Build** (`build-ticket`): branch `<name>/<phase>-<slug>` from fresh `main`, small commits
   (`phase N: <what>`), typecheck after each meaningful change, stay inside the phase.
3. **Test** (`test-changes`): `npm run check` plus the checks for what changed. Anything that needs a real
   iPhone goes on a checklist for the human; never claim it passed.
4. **Review** (`review-changes`): run by a reviewer with no build context at the end of Phases 2, 4, 5 and 7,
   and before any merge that touches contracts.
5. **Ship:** PR with the template; CI green; update `docs/STATUS.md` with one line of notes.

### Roles
- **Builder** implements; **Verifier** runs checks and prepares the iPhone checklist; **Reviewer** is a fresh
  context that reads the done-criteria, this file and the diff. Claude Code maps these to subagents
  (see `CLAUDE.md`). Subagents inherit every rule here.

### Change size
Prefer editing existing files; one component per file, under ~250 lines; no speculative configuration,
feature flags or generic frameworks. This is a demo.

---

## 4. Commands

| Command | What |
| --- | --- |
| `npm run dev` | Learner package watch + server (:4000); Expo web runs from `client/` (:8081) once Phase 0 adds it |
| `npm run check` | Lint + boundaries + dependency allowlist + typecheck + learner tests. Before every PR |
| `npm run lint` / `lint:fix` | Biome lint (+ safe fixes), boundaries, allowlist |
| `npm test` | `packages/learner` tests (compile, then `node --test`) |
| `npm run typecheck`, `npm run build`, `npm run doctor` | As named |
| `npm run seed:demo` | Demo seed (server workspace, from Phase 2b) |
| `npm run format` | Rewrites whole files; only when the team agrees |

---

## 5. Code conventions
- TypeScript `strict`; no `any` (use `unknown` and narrow). Shared types in `client/src/api/types.ts`
  mirror the server's.
- Server: every route validates input and returns `{ error }` with a proper status; background work
  (analysis, backfill) never blocks a response or crashes the process.
- Client: function components and hooks; `StyleSheet.create` with tokens from `client/src/theme/tokens.ts`;
  no hardcoded colors elsewhere. Everything works in iOS Safari: no autoplay, no `position: fixed` hacks.
- Accessibility: labels on tappable tokens and buttons; touch targets ≥ 44px except inline word tokens.

---

## 6. Definition of done (project)
- All phases done with notes in `docs/STATUS.md`.
- `npm run check`, `npm run build`, `npm run doctor` pass; CI green on `main`.
- Render deployment live over HTTPS; the iPhone checklist passed by a human.
- Seed rerun from scratch reproduces the Week 1 → Week 8 arc; evaluation charts come from committed runs.
- README explains architecture, the learner model, what is simulated, and how to run locally.
- Hackathon window respected: no code from prior projects.
