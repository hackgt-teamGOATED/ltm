---
name: review-changes
description: 'Fresh-context review of a diff against the phase done-criteria, AGENTS.md hard rules, contracts, UX and tests. Use at the end of Phases 2, 4, 5, 7, before merging contract changes, or when asked to review.'
---

# Review the diff

Get the diff: `git diff origin/main...HEAD` or `gh pr diff <n>`. Read the phase's done-criteria in PLAN.md §11.

## Checklist
- **Done-criteria:** each one met, or clearly listed for the human's iPhone check.
- **Hard rules (AGENTS.md §1):** no secrets or `.env` references; no keys in `EXPO_PUBLIC_*`; OpenAI only in
  `server/src/ai.ts`; no message text in logs; no edits to `web/` or `001_init.sql`; no destructive SQL;
  only allowlisted packages, Expo ones via `npx expo install`; no Meta names or assets; no "live" wording;
  no invented culture or numbers; `needs_native_check` untouched by code.
- **Mobile-ready:** React Native primitives only; browser APIs only in `*.web.ts(x)`; no global RTL.
- **Contracts:** types match PLAN.md §5.3 and §6.4; event names and weights match §8.3; `tSpans` validated.
- **Learner purity:** no I/O, time or randomness inside `packages/learner`; no special-casing words or users.
- **Correctness:** failed or missing analysis, Urdu RTL tapping by `token.i`, voice without timestamps,
  socket reconnects, slider never logs events.
- **UX:** tokens only; gold for Heirloom additions; stages per language; tap-to-play audio; 44px targets.
- **Tests:** behavior changes have scenario tests; nothing weakened.

## Output
```
Verdict: approve | changes needed
Critical: file:line — problem — fix
Should fix: ...
Nice to have: ...
```
Short. No praise, no restating the diff.
