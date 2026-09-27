---
name: plan-ticket
description: 'Turn a phase task into a short plan checked against scope, PLAN.md, contracts and current code. Use before starting any phase task or any change touching more than a couple of files.'
---

# Plan a phase task

1. **Locate it.** The phase and its done-criteria in PLAN.md §11, its owner and status in `docs/STATUS.md`,
   and the user story in `docs/PROJECT.md`. Previous phases must be done unless STATUS runs them in parallel.
2. **Check scope.** Against the "Out" list and principles in `docs/PROJECT.md` and `docs/DECISIONS.md`.
3. **Read the spec** sections the phase references (§5 data, §6 server, §7 client, §8 learner) and the
   matching domain skill.
4. **Read the code.** `git log --oneline -10`, `git diff --stat origin/main...HEAD`, search for pieces to reuse.
5. **Write the plan**, under 30 lines:

```
Phase/task: <phase N: task> → US-<n>
Goal: <one sentence, user-visible>
Files: <path: change>
Contract changes: none | <what> → needs human OK + PLAN.md/types updated in the same PR
Dependencies: none | <package> → must be on the allowlist, else ask
Data/events touched: <tables, endpoints, socket events, learning events>
Checks: <npm run check, learner tests, verify-pipeline, seed summary, iPhone items>
Risks: <top 1-3 and fallback>
Size: S (<1h) | M (1-2h) | L (>2h → split)
Done-criteria: <copied from PLAN.md §11>
```

6. **Stop and ask** for contract, scope or dependency changes, or size L.
