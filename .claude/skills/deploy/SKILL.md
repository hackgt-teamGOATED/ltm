---
name: deploy
description: 'Deploy the Expo web build from the existing Render service (STATIC_DIR) with CI gating. Use for Phase 0 deploy setup or any deploy change.'
---

# Deploy (Render, one service)

1. **Build:** the root build must also export the client. Add to root `package.json` (Phase 0):
   `"build": "npm run build -w packages/learner && npm run build -w server && npm run build -w web && npm run export:web -w client"`
   and in `client/package.json`: `"export:web": "expo export -p web --output-dir dist"`.
2. **Serve the Expo export from Express** (Phase 0, if not already done). In `server/src/index.ts` replace
   the fixed `web/dist` path with:
   ```ts
   const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
   const webDist = join(repoRoot, process.env.STATIC_DIR ?? 'web/dist');
   ```
   and add `http://localhost:8081` to `WEB_ORIGIN` in the human's secrets file for local Expo dev (tell them;
   don't edit it).
3. **Render service** (existing, `render.yaml`): build `npm ci --include=dev && npm run build`, start
   `npm start`, health check `/api/health`. The human sets `STATIC_DIR=client/dist` in the dashboard once
   Phase 3 passes (until then `web/dist`). Auto-deploy after CI passes stays on.
4. **Client config:** `EXPO_PUBLIC_API_URL` empty for the web build (same origin); required for native builds.
   `app.json` web `output: "single"`; SPA routes are served by the server's fallback.
5. **Before filming:** open the app on both iPhones 2 minutes early (or use the Starter plan); hard-refresh
   after each deploy (home-screen apps cache aggressively).
6. **Fallback:** only if Render static serving fails, deploy `client/dist` to Vercel with an SPA rewrite and
   add its origin to `WEB_ORIGIN`. Record it in `docs/DECISIONS.md`.

**Guardrails:** agents never read or paste env values; they name the variables the human must set.
