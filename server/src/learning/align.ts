// Turns the model's raw analysis into validated tokens and spans (PLAN.md §6.2).
// The model returns words; we compute every offset ourselves, because model-produced offsets drift.
import type { RawAnalysis, WordTiming } from '../ai.js';
import type { Phrase, Span, Token } from './types.js';

export type AnalysisInvalidCode =
  | 'surface_not_found'
  | 'skipped_text'
  | 'missing_romanization'
  | 'unanalyzed_tail'
  | 'rejoin_mismatch'
  | 'span_out_of_range';

/** Why an analysis was rejected. Carries a code and an offset, never message text (it gets logged). */
export class AnalysisInvalid extends Error {
  constructor(
    readonly code: AnalysisInvalidCode,
    readonly at?: number,
  ) {
    super(at === undefined ? code : `${code}@${at}`);
    this.name = 'AnalysisInvalid';
  }
}

const PUNCT_RE = /^[\p{P}\p{S}\s]+$/u;

/**
 * Words the model left out (common in garbled voice transcripts) stay in the message as plain, non-tappable
 * text. Past this share of the message the analysis is not trustworthy and is rejected instead.
 */
export const MAX_SKIPPED_SHARE = 0.25;

/** Finds `needle` in `hay`, preferring an occurrence that no earlier word already claimed. */
function locate(hay: string, needle: string, claimed: Span[]): Span | null {
  const n = needle.trim();
  if (!n) return null;
  const candidates: Span[] = [];
  // Exact pass first, then a case-folded pass (the needle is folded by pass, not by comparing strings).
  for (const fold of [false, true]) {
    const h = fold ? hay.toLowerCase() : hay;
    const target = fold ? n.toLowerCase() : n;
    for (let at = h.indexOf(target); at !== -1; at = h.indexOf(target, at + 1)) candidates.push([at, at + n.length]);
    if (candidates.length) break;
  }
  if (!candidates.length) return null;
  const free = candidates.find(([a, b]) => !claimed.some(([c, d]) => a < d && c < b));
  return free ?? candidates[0];
}

function spansFor(translation: string, words: string[], claimed: Span[]): Span[] | undefined {
  const spans: Span[] = [];
  for (const w of words) {
    const s = locate(translation, w, claimed);
    if (s) {
      spans.push(s);
      claimed.push(s);
    }
  }
  return spans.length ? spans : undefined;
}

export function alignAnalysis(
  original: string,
  raw: RawAnalysis,
  translation: string,
  needsRomanization: boolean,
): { tokens: Token[]; phrases: Phrase[] } {
  // 1. Walk the original, matching each surface in order. Unmatched gaps may only be whitespace or punctuation.
  const tokens: Token[] = [];
  const rawIndexToToken = new Map<number, number>();
  let cursor = 0;
  let skipped = 0; // characters of real words the model skipped, kept as plain text
  let firstSkipAt: number | undefined;
  const skip = (text: string, at: number) => {
    skipped += text.replace(/\s/g, '').length;
    firstSkipAt ??= at;
  };
  const pushPunct = (text: string) => {
    const m = /^(\s*)([\s\S]*?)$/.exec(text) as RegExpExecArray;
    if (m[2]) tokens.push({ i: tokens.length, surface: m[2].trimEnd(), pre: m[1], lemma: m[2].trim(), gloss: '', isPunct: true });
  };

  raw.tokens.forEach((t, rawIdx) => {
    const surface = t.surface.trim();
    if (!surface) return;
    const at = original.indexOf(surface, cursor);
    if (at === -1) throw new AnalysisInvalid('surface_not_found', rawIdx);
    const gap = original.slice(cursor, at);
    const lead = /^\s*/.exec(gap)?.[0] ?? '';
    if (gap.trim()) {
      if (!PUNCT_RE.test(gap)) skip(gap, cursor);
      pushPunct(gap);
    }
    const isPunct = t.isPunct || PUNCT_RE.test(surface);
    const lemma = (t.lemma || surface).trim();
    if (!isPunct && needsRomanization && !t.romanization?.trim()) {
      throw new AnalysisInvalid('missing_romanization', rawIdx);
    }
    rawIndexToToken.set(rawIdx, tokens.length);
    tokens.push({
      i: tokens.length,
      surface,
      pre: gap.trim() ? (/\s*$/.exec(gap)?.[0] ?? '') : lead,
      lemma: isPunct ? surface : lemma.toLocaleLowerCase(),
      gloss: isPunct ? '' : t.gloss.trim(),
      ...(t.romanization && !isPunct ? { romanization: t.romanization.trim() } : {}),
      ...(t.pos ? { pos: t.pos } : {}),
      ...(t.grammar ? { grammar: t.grammar } : {}),
      ...(isPunct ? { isPunct: true } : {}),
    });
    cursor = at + surface.length;
  });
  const tail = original.slice(cursor);
  if (tail.trim()) {
    if (!PUNCT_RE.test(tail)) skip(tail, cursor);
    pushPunct(tail);
  }
  if (skipped > original.replace(/\s/g, '').length * MAX_SKIPPED_SHARE) throw new AnalysisInvalid('skipped_text', firstSkipAt);

  const rejoined = tokens.map((t) => t.pre + t.surface).join('');
  if (rejoined.trim() !== original.trim()) throw new AnalysisInvalid('rejoin_mismatch');

  // 2. Spans into the translation. Phrases first so they claim multi-word stretches.
  const claimed: Span[] = [];
  const phrases: Phrase[] = [];
  raw.phrases.forEach((p, k) => {
    const members = p.tokenIndices
      .map((ri) => rawIndexToToken.get(ri))
      .filter((x): x is number => x !== undefined && !tokens[x].isPunct);
    if (members.length < 1) return;
    const id = `p${k}`;
    for (const m of members) tokens[m].phraseId = id;
    const tSpans = spansFor(translation, p.translationWords, claimed);
    phrases.push({
      id,
      tokenIndices: members,
      meaning: p.meaning.trim(),
      isIdiom: p.isIdiom,
      ...(p.culture?.trim() ? { culture: p.culture.trim() } : {}),
      ...(tSpans ? { tSpans } : {}),
    });
  });
  raw.tokens.forEach((t, rawIdx) => {
    const ti = rawIndexToToken.get(rawIdx);
    if (ti === undefined || tokens[ti].isPunct) return;
    const tSpans = spansFor(translation, t.translationWords, claimed);
    if (tSpans) tokens[ti].tSpans = tSpans;
  });

  for (const s of [...tokens.flatMap((t) => t.tSpans ?? []), ...phrases.flatMap((p) => p.tSpans ?? [])]) {
    if (!(s[0] >= 0 && s[1] <= translation.length && s[0] < s[1])) throw new AnalysisInvalid('span_out_of_range');
  }
  return { tokens, phrases };
}

const norm = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFC')
    .replace(/[\p{P}\p{S}\s]/gu, '');

/** Attaches Whisper word timings to tokens, matching in order on normalized surface. */
export function attachTimings(tokens: Token[], words: WordTiming[] | null | undefined): void {
  if (!words?.length) return;
  let w = 0;
  for (const t of tokens) {
    if (t.isPunct) continue;
    const target = norm(t.surface);
    for (let look = w; look < Math.min(words.length, w + 4); look++) {
      if (norm(words[look].word) === target) {
        t.start = words[look].start;
        t.end = words[look].end;
        w = look + 1;
        break;
      }
    }
  }
}
