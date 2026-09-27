# Status board

Updated by the `sprint-check` skill at each checkpoint and by whoever finishes a phase. The "Now"
section is injected into every Claude Code session, so keep it short and current. Mark a phase done
only when every done-criterion in PLAN.md §11 passed; add one line of notes.

## Now

- **Current:** Phase 0 (Victor), Phase 1 (Lexi), Phase 2 (Sarosh) in parallel.
- **Next checkpoint:** 9:30 PM. Passes when Phase 0 is done, `npm test` passes the parity fixtures,
  and a real message gets a stored analysis with valid `tSpans`.
- **Freeze:** 2:30 AM Sunday. **Submit:** 5:00 AM (hard deadline 8:00 AM).
- **Blockers:** Supabase secret key rejected (`Invalid Compact JWS`); run `supabase/002_learning.sql`. Urdu/Spanish native speaker to check hero messages.

## Phases

| Phase | Owner | Target | Status | Notes |
| --- | --- | --- | --- | --- |
| 0 Foundations and spikes | Victor | 7:30 PM | built | Expo SDK 57 client, web export OK, STATIC_DIR serving, render.yaml. Needs: Render service + iPhone recording test |
| 1 Learner package | Lexi | 9:00 PM | done | Built from PLAN §8 (no Python reference, D-020); 18 tests pass |
| 2 Server learning layer | Sarosh | 9:30 PM | built | Typecheck + build pass; live check blocked on Supabase key + `002_learning.sql` |
| 2b Seed script | Sarosh | 10:30 PM | built | Script + simulator + tests (arc Listener → Reader, D-024). Needs a live run: Supabase key + `002_learning.sql` |
| 3 Chat core | Victor | 9:30 PM | built | Chat list, conversation, bubbles, composer (text + voice), live updates, voice player. Needs: two-iPhone test |
| 4 Heirloom layer | Victor + Sarosh | 11:30 PM | built | Chip, settings sheet, tappable transcript + translation, word card, View more, RTL, karaoke. Checked on fixtures (`/dev/heirloom`); needs live data + iPhone |
| 5 The fade | Victor + Lexi | 12:45 AM | todo | |
| 6 Progress and practice | Lexi | 1:45 AM | todo | |
| E Evaluation charts (§10) | Lexi | 1:45 AM | todo | |
| 7 Demo mode and polish | Victor + Sarosh | 2:30 AM | todo | |
| 8 Ship | Everyone | 5:00 AM | todo | |

Cut order if behind: karaoke → messages-per-week chart → practice → Urdu → stage-up animations.
Never cut: word card, the fade, the slider, Progress word lists, one evaluation chart.

## Checkpoint log

<!-- sprint-check appends: time, what passed, what slipped, decisions, cuts -->

## Risks

- Urdu analysis quality: needs a native speaker for hero messages.
- `expo-audio` recording on iOS Safari: resolved by the Phase 0 spike.
