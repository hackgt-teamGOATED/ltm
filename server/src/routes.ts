import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import type { Server } from 'socket.io';
import * as svc from './messages.js';

// Whisper's upload limit is 25 MB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

export function buildRouter(io: Server) {
  const r = Router();

  r.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  r.get('/profiles', wrap(async (_req, res) => res.json(await svc.listProfiles())));

  r.get(
    '/profiles/:id/threads',
    wrap(async (req, res) => res.json(await svc.listThreadsForProfile(String(req.params.id)))),
  );

  r.get(
    '/threads/:id/messages',
    wrap(async (req, res) => res.json(await svc.listMessages(String(req.params.id)))),
  );

  r.post(
    '/threads/:id/messages',
    wrap(async (req, res) => {
      const { senderId, text } = req.body ?? {};
      if (typeof senderId !== 'string' || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'senderId and text are required' });
      }
      const message = await svc.createTextMessage(io, String(req.params.id), senderId, text.trim());
      res.status(202).json(message); // 202: translation still running, result arrives over the socket
    }),
  );

  r.post(
    '/threads/:id/voice',
    upload.single('audio'),
    wrap(async (req, res) => {
      const senderId = req.body?.senderId;
      if (typeof senderId !== 'string' || !req.file) {
        return res.status(400).json({ error: 'senderId and an audio file are required' });
      }
      const message = await svc.createVoiceMessage(io, String(req.params.id), senderId, req.file);
      res.status(202).json(message);
    }),
  );

  return r;
}
