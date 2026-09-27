---
name: sprint-check
description: 'Checkpoint review: compares merged and open work to docs/STATUS.md and PLAN.md phases, checks main is green, flags drift and time risk, proposes cuts, updates STATUS. Use at checkpoints or when someone says "checkpoint".'
---

# Sprint check

1. **Gather:** `git fetch origin`; `git log origin/main --since="4 hours ago" --oneline`;
   `gh pr list --state open`; `gh run list --branch main --limit 3`; read `docs/STATUS.md`.
2. **Is main green?** `git worktree add /tmp/hl-main origin/main`, then `npm ci && npm run check` there.
   Report failures first; remove the worktree after.
3. **Phase reality:** for each phase, done / in review / in progress / not started, from merged work and PRs,
   not from what STATUS claims. Check each done-criterion with evidence (commit, PR, or what to click).
4. **Drift:** anything outside `docs/PROJECT.md` scope or against `docs/DECISIONS.md` / AGENTS.md rules.
5. **Time math:** hours to freeze (2:30 AM) vs remaining phases. If short, propose cuts in the STATUS cut
   order. Never cut without the human's OK; never cut the "never cut" items.
6. **Update after the human confirms:** the "Now" section, phase statuses and notes, a dated checkpoint
   log entry; cuts and reversals in `docs/DECISIONS.md`. Commit on `status/<time>` and open a PR.

## Report (under 20 lines)
```
Checkpoint <time>: PASS | AT RISK | FAIL
Main: green/red (<first failure>)
Phases: done ... | in progress ... | not started ...
Drift: none | <item>
Hours to freeze: <n>; remaining: <estimate>
Proposed cuts: <items or none>
Next focus: <1-3 bullets>
```
