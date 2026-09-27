---
name: add-endpoint
description: 'Add a server endpoint following PLAN.md §6.4 with validation, background work and socket events. Use when adding or changing an API route.'
---

# Add a server endpoint

1. Add the route in `server/src/routes.ts` (or `server/src/learning/`) using the path from PLAN.md §6.4 exactly.
2. Validate params and body first (types, required fields, languages `en|es|ur|hi`). Invalid → `400 { error }`.
3. Keep data access in small functions beside existing query code, using the server's Supabase client.
4. Long work (AI, backfill) runs in the background after responding; catch errors and log ids only.
5. If the endpoint changes data a client shows, emit the socket event (`analysis:ready`, `mastery:updated`).
6. Mirror response types in `client/src/api/types.ts`.
7. Test with curl against the local server; put the command in the PR description.

**Guardrails:** the server trusts `profileId` from the client (known demo shortcut). Don't add auth, and
don't widen trust (no endpoint that edits another profile's settings unless the plan says so).
