// Mapping between original tokens and character spans of the translation (PLAN.md §5.3 tSpans).
import type { MessageAnalysis, Span } from '../api/types';

export interface Segment {
  text: string;
  /** Index of the token (token.i) this piece of the translation belongs to, if any. */
  tokenIndex: number | null;
}

/** Spans belonging to a token, or to its whole phrase when it is part of one. */
export function spansForToken(a: MessageAnalysis, tokenIndex: number): Span[] {
  const t = a.tokens[tokenIndex];
  if (!t) return [];
  const phrase = t.phraseId ? a.phrases.find((p) => p.id === t.phraseId) : undefined;
  return [...(t.tSpans ?? []), ...(phrase?.tSpans ?? [])];
}

/** Tokens highlighted together with `tokenIndex` (its phrase members, or just itself). */
export function groupOf(a: MessageAnalysis, tokenIndex: number): number[] {
  const t = a.tokens[tokenIndex];
  if (!t?.phraseId) return [tokenIndex];
  return a.phrases.find((p) => p.id === t.phraseId)?.tokenIndices ?? [tokenIndex];
}

/**
 * Cuts the translation into segments, each owned by at most one token. Single-token spans win over
 * phrase spans, so tapping a word inside an idiom's translation still finds that word when it maps.
 */
export function segmentTranslation(a: MessageAnalysis): Segment[] {
  const owner: (number | null)[] = new Array(a.translation.length).fill(null);
  for (const p of a.phrases) {
    const first = p.tokenIndices[0];
    for (const [s, e] of p.tSpans ?? []) for (let c = s; c < e; c++) owner[c] = first ?? null;
  }
  for (const t of a.tokens) {
    for (const [s, e] of t.tSpans ?? []) for (let c = s; c < e; c++) owner[c] = t.i;
  }
  const out: Segment[] = [];
  for (let c = 0; c < a.translation.length; c++) {
    const last = out[out.length - 1];
    if (last && last.tokenIndex === owner[c]) last.text += a.translation[c];
    else out.push({ text: a.translation[c], tokenIndex: owner[c] });
  }
  return out;
}

/** Which translation characters to highlight for the selected token. */
export function highlightMask(a: MessageAnalysis, tokenIndex: number | null): boolean[] {
  const mask = new Array(a.translation.length).fill(false);
  if (tokenIndex === null) return mask;
  for (const [s, e] of spansForToken(a, tokenIndex)) for (let c = s; c < e && c < mask.length; c++) mask[c] = true;
  return mask;
}
