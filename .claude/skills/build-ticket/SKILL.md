---
name: build-ticket
description: 'Implement a planned phase task on its own branch with repo conventions, checks and a PR. Use after plan-ticket, when writing code.'
---

# Build and ship a phase task

## Start
1. `git fetch origin && git switch main && git pull --ff-only`, then `git switch -c <name>/phase<N>-<slug>`.
2. Mark the phase `in progress` in `docs/STATUS.md` (commit with the first change).

## Conventions (details in AGENTS.md and PLAN.md)
- **Client (`client/`):** Expo SDK 57; `npx expo install` for Expo-managed packages; React Native primitives
  only; browser APIs only in `*.web.ts(x)`; tokens from `client/src/theme/tokens.ts`; learning logic from
  `@heirloom/learner`.
- **Server (`server/`):** validate inputs, `{ error }` + status; OpenAI only in `ai.ts`; background work never
  blocks; new SQL in a new numbered file the human applies.
- **Learner (`packages/learner`):** pure; inject `now` and RNG; a scenario test for every behavior.
- **Contracts:** shape changes update PLAN.md §5.3/§6.4 and `client/src/api/types.ts` in the same PR.

## Loop
Small steps; after each, `npm run lint` and `npm run typecheck`. Commit `phase N: <what changed>`.

## Finish
1. Run `test-changes`; everything required passes.
2. Run `review-changes` on your own diff (a fresh reviewer at the end of Phases 2, 4, 5, 7). Fix Critical.
3. `git push -u origin <branch>`; `gh pr create --fill`; complete the template. Never push to `main`.
4. Update `docs/STATUS.md`: status + one line of notes. After merge and the done-criteria pass, mark done.
