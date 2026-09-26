import { createServer } from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { env } from './env.js';
import { buildRouter } from './routes.js';
import { HttpError } from './messages.js';

const origins = env.WEB_ORIGIN.split(',').map((o) => o.trim());

const app = express();
app.use(cors({ origin: origins }));
app.use(express.json({ limit: '1mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: origins } });

// Each open chat joins its thread's room; the server pushes new/updated messages there.
io.on('connection', (socket) => {
  socket.on('thread:join', (threadId: unknown) => {
    if (typeof threadId === 'string') socket.join(`thread:${threadId}`);
  });
  socket.on('thread:leave', (threadId: unknown) => {
    if (typeof threadId === 'string') socket.leave(`thread:${threadId}`);
  });
});

app.use('/api', buildRouter(io));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
});

httpServer.listen(env.PORT, () => {
  console.log(`API + sockets on http://localhost:${env.PORT}`);
});
