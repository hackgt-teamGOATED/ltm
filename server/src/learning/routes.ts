// Learning-layer endpoints (PLAN.md §6.4). Mounted under /api next to the v0 routes.
import { type NextFunction, type Request, type Response, Router } from 'express';
import type { Server } from 'socket.io';
import { HttpError } from '../messages.js';
import { backfillThread, getAnalysis, listThreadAnalyses } from './analyze.js';
import { getWordNotes } from './notes.js';
import {
  getSettings,
  listEvents,
  loadMastery,
  parseEvent,
  practice,
  progressDetail,
  progressOverview,
  putSettings,
  recordEvents,
} from './progress.js';
import { isLang } from './types.js';

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const str = (x: unknown, name: string): string => {
  if (typeof x !== 'string' || !x.trim()) throw new HttpError(400, `${name} is required`);
  return x.trim();
};
const lang = (x: unknown, name: string) => {
  if (!isLang(x)) throw new HttpError(400, `${name} must be one of en, es, ur, hi`);
  return x;
};

export const MAX_EVENTS_PER_POST = 500;

export function buildLearningRouter(io: Server) {
  const r = Router();

  r.get(
    '/threads/:id/settings',
    wrap(async (req, res) => res.json(await getSettings(String(req.params.id), str(req.query.profileId, 'profileId')))),
  );

  r.put(
    '/threads/:id/settings',
    wrap(async (req, res) => {
      const threadId = String(req.params.id);
      const { profileId, learningEnabled, learningLang } = req.body ?? {};
      if (typeof learningEnabled !== 'boolean') throw new HttpError(400, 'learningEnabled must be a boolean');
      const langOrNull = learningLang == null ? null : lang(learningLang, 'learningLang');
      if (learningEnabled && !langOrNull) throw new HttpError(400, 'learningLang is required when turning Heirloom on');
      const saved = await putSettings(threadId, str(profileId, 'profileId'), learningEnabled, langOrNull);
      if (learningEnabled && langOrNull) void backfillThread(io, threadId, profileId, langOrNull);
      res.json(saved);
    }),
  );

  r.get(
    '/messages/:id/analysis',
    wrap(async (req, res) => {
      const analysis = await getAnalysis(String(req.params.id), lang(req.query.lang, 'lang'));
      if (!analysis) return res.status(404).json({ error: 'Analysis pending' });
      res.json(analysis);
    }),
  );

  // Batch read for a whole conversation (one request instead of one per bubble).
  r.get(
    '/threads/:id/analyses',
    wrap(async (req, res) => res.json(await listThreadAnalyses(String(req.params.id), lang(req.query.lang, 'lang')))),
  );

  r.get(
    '/words/:lang/:lemma/notes',
    wrap(async (req, res) => {
      const lemma = String(req.params.lemma).trim();
      if (!lemma || lemma.length > 80) throw new HttpError(400, 'lemma');
      const profileId = typeof req.query.profileId === 'string' ? req.query.profileId : null;
      res.json(
        await getWordNotes(lang(req.params.lang, 'lang'), lemma, lang(req.query.viewerLang, 'viewerLang'), profileId),
      );
    }),
  );

  r.post(
    '/events',
    wrap(async (req, res) => {
      const { profileId, events } = req.body ?? {};
      if (!Array.isArray(events) || !events.length) throw new HttpError(400, 'events must be a non-empty array');
      if (events.length > MAX_EVENTS_PER_POST) throw new HttpError(413, `At most ${MAX_EVENTS_PER_POST} events per post`);
      const now = Date.now();
      const parsed = events.map((e: unknown) => parseEvent(e, now));
      res.json(await recordEvents(io, str(profileId, 'profileId'), parsed));
    }),
  );

  r.get(
    '/profiles/:id/mastery',
    wrap(async (req, res) => res.json(await loadMastery(String(req.params.id), lang(req.query.lang, 'lang')))),
  );

  r.get('/profiles/:id/progress', wrap(async (req, res) => res.json(await progressOverview(String(req.params.id)))));

  r.get(
    '/profiles/:id/progress/:lang',
    wrap(async (req, res) => res.json(await progressDetail(String(req.params.id), lang(req.params.lang, 'lang')))),
  );

  r.get(
    '/profiles/:id/events',
    wrap(async (req, res) => {
      const l = req.query.lang === undefined ? undefined : lang(req.query.lang, 'lang');
      res.json(await listEvents(String(req.params.id), l));
    }),
  );

  r.get(
    '/practice/:profileId/:lang',
    wrap(async (req, res) => res.json(await practice(String(req.params.profileId), lang(req.params.lang, 'lang')))),
  );

  return r;
}
