---
name: test-changes
description: 'Pick and run the checks a change needs from the git diff, report pass/fail, and prepare the human iPhone checklist. Use after building and before a PR, or to verify a phase.'
---

# Test the current changes

1. Changed files: `git diff --name-only origin/main...HEAD` plus `git status --porcelain`.
2. Always: `npm run check` (lint, boundaries, allowlist, typecheck, learner tests) and `npm run build`.
3. By area:

| Changed | Also run |
| --- | --- |
| `packages/learner/**` | `npm test` (parity + scenarios); simulator invariants once they exist |
| `server/src/messages.ts`, `ai.ts`, learning routes | `verify-pipeline` skill (dev server running); curl the phase's endpoints |
| `server/src/scripts/seedDemo.ts` | `npm run seed:demo` twice; read the summary; confirm idempotent |
| `supabase/*.sql` | Ask the human to confirm it was applied; then `npm run doctor` |
| `client/**` | `npx expo export -p web` in `client/` succeeds; prepare the iPhone checklist |

4. Failures: rerun once for flakiness, then report. Never weaken assertions, skip tests or regenerate
   fixtures to get green (fixtures change only through `learner-model-change`).

## iPhone checklist (human runs; you prepare)
Standing items plus the phase's done-criteria:
- Loads from the home-screen icon, full-screen.
- Text and voice notes arrive live on the other phone.
- Mic prompt on first record; red mic indicator disappears after.
- Voice notes play on tap; Translated / Their voice toggle works.
- Word taps open the right card, including Urdu right-to-left.
- Slider Week 1 → 8 re-renders smoothly.

## Report
```
| Check | Result | Notes |
| --- | --- | --- |
iPhone checklist for the human: <numbered>
```
