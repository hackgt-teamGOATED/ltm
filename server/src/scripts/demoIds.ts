// Stable ids for seeded demo messages (pure, so it's unit-tested without a database).
import { createHash } from 'node:crypto';
import type { ScriptLine } from './demoContent.js';

/** Every seeded message id lives in this UUID range, so demo rows can be found with one range filter. */
export const DEMO_PREFIX = 'de300000';
export const DEMO_MIN = `${DEMO_PREFIX}-0000-0000-0000-000000000000`;
export const DEMO_MAX = `${DEMO_PREFIX}-ffff-ffff-ffff-ffffffffffff`;

/** Content-derived id: thread + sender + text + occurrence (for repeated lines like "Buenos días"). */
export function demoId(threadId: string, line: ScriptLine, occurrence: number): string {
  const h = createHash('sha1').update(`${threadId}|${line.from}|${line.text}|${occurrence}`).digest('hex');
  const variant = ((Number.parseInt(h[7], 16) & 0x3) | 0x8).toString(16);
  return `${DEMO_PREFIX}-${h.slice(0, 4)}-5${h.slice(4, 7)}-${variant}${h.slice(8, 11)}-${h.slice(11, 23)}`;
}

export function scriptIds(threadId: string, lines: ScriptLine[]): string[] {
  const seen = new Map<string, number>();
  return lines.map((l) => {
    const k = `${l.from}|${l.text}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    return demoId(threadId, l, n);
  });
}

