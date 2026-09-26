import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { env } from './env.js';
import { buildRouter } from './routes.js';
import { buildLearningRouter } from './learning/routes.js';
import { safeErr } from './logSafe.js';
import { HttpError } from './messages.js';
import { originAllowed } from './origins.js';

const listed = env.WEB_ORIGIN.split(',').map((o) => o.trim());
const production = process.env.NODE_ENV === 'production';
const origin = (o: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
  cb(null, originAllowed(o, listed, production));

const app = express();
app.use(cors({ origin }));
app.use(express.json({ limit: '1mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin } });

// Each open chat joins its thread's room; the server pushes new/updated messages there.
// Each profile also has a room for its own mastery updates (`mastery:updated`).
io.on('connection', (socket) => {
  const profileId = socket.handshake.query.profileId;
  if (typeof profileId === 'string' && profileId) socket.join(`profile:${profileId}`);
  socket.on('profile:join', (id: unknown) => {
    if (typeof id === 'string') socket.join(`profile:${id}`);
  });
  socket.on('thread:join', (threadId: unknown) => {
    if (typeof threadId === 'string') socket.join(`thread:${threadId}`);
  });
  socket.on('thread:leave', (threadId: unknown) => {
    if (typeof threadId === 'string') socket.leave(`thread:${threadId}`);
  });
});

app.use('/api', buildRouter(io));
app.use('/api', buildLearningRouter(io));

// Production: serve the Expo web export from the same origin (PLAN.md §2, §6.5). STATIC_DIR is relative
// to the repo root, e.g. client/dist. Unknown non-API paths fall back to index.html (single-page app).
if (env.STATIC_DIR) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const dir = resolve(repoRoot, env.STATIC_DIR);
  if (existsSync(join(dir, 'index.html'))) {
    // Hashed bundles under /_expo can be cached for a long time; the HTML shell must never be, or an
    // installed iPhone web app keeps loading an old shell that points at deleted bundles after a deploy.
    const shell = (res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(dir, 'index.html'));
    };
    app.use('/_expo', express.static(join(dir, '_expo'), { immutable: true, maxAge: '365d' }));
    app.use(express.static(dir, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) => shell(res));
    console.log(`Serving the web app from ${dir}`);
  } else {
    console.warn(`STATIC_DIR is set but ${dir}/index.html is missing; did the web export run?`);
  }
}

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(`[${req.method} ${req.path}] ${safeErr(err)}`);
  res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
});

httpServer.listen(env.PORT, () => {
  console.log(`API + sockets on http://localhost:${env.PORT}`);
});
