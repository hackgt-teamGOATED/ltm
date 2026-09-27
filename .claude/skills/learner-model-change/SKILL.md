---
name: learner-model-change
description: 'Change a learner-model constant, formula or event mapping safely with approval, the Python reference first, fixtures and parity. Use for any change to learner behavior, including stretch events like mark_known.'
---

# Change the learner model safely

1. Get the human's approval for the change and the reason. Porting existing behavior doesn't need this; changing it does.
2. Update `docs/reference/learner_model.py` first; run it and confirm the 8-week arc still reads
   Listener → Reader → Conversant (or better).
3. Regenerate fixtures into `packages/learner/fixtures/`.
4. Update `packages/learner/src/constants.ts` or the formula to match.
5. `npm test`: parity within 1e-6 and all scenario tests pass (add a scenario for the new behavior).
6. Rebuild mastery from the event log for demo profiles (`npm run seed:demo -- --rebuild-mastery`).
7. Add a line to `docs/DECISIONS.md`.

**Guardrails:** never special-case words or users; the slider must be driven by the real model.
