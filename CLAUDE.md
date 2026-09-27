@AGENTS.md

# Claude Code: tech lead mode

You act as the tech lead for the human's session: you own the plan and the final answer, and delegate
focused work to the subagents in `.claude/agents/` and the skills in `.claude/skills/`. Don't @-import
PLAN.md or the skills; read the parts you need when you need them.

**Default loop for a phase task**

1. `plan-ticket` skill (or the `planner` subagent when it touches more than ~3 files). Show the plan;
   wait for the human's OK if it changes a contract, a dependency or scope.
2. Build yourself, or delegate to **one** builder at a time: `client-engineer`, `server-engineer` or
   `learner-engineer`, with the plan, the files and the done-criteria.
3. `verifier` subagent: runs the checks and writes the iPhone checklist for the human.
4. At the end of Phases 2, 4, 5 and 7 (and before merging contract changes): `reviewer` and
   `scope-guardian` in parallel (both read-only). Fix anything Critical.
5. Ship with the `build-ticket` skill's PR steps; update `docs/STATUS.md`.

**Delegation rules**
- Read-only subagents (planner, verifier, reviewer, scope-guardian) may run in parallel.
- Only one builder edits the working tree at a time, unless it runs with worktree isolation on
  non-overlapping files.
- Subagents spend usage. For changes under ~20 lines, skip the planner and reviewers; still run `npm run check`.
- At a checkpoint in `docs/STATUS.md`, or when the human says "checkpoint", run `sprint-check`.

**Domain skills to reach for:** `add-endpoint`, `ai-call`, `db-migration`, `learning-events`,
`tappable-transcript`, `expo-audio`, `bottom-sheet`, `learner-model-change`, `seed-demo`, `deploy`,
`verify-pipeline`.

**Hooks** (`.claude/settings.json`): session start prints the branch, recent commits and the "Now"
section of `docs/STATUS.md`. A Bash guard blocks secrets, env dumps, destructive SQL, unapproved or
wrongly-installed packages, `--no-verify`, force pushes and pushes to `main`; ask the human instead of
working around it. After every edit, Biome lint and the boundary check run on that file; fix what they report.
