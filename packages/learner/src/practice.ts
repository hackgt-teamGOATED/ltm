// Practice quiz items (PLAN.md §8.5): the weakest known words, each in a sentence from the user's own chats.
import { recognizeRecall, status } from './model.js';
import type { Mastery, TokenLike } from './types.js';

export interface PracticeSentence {
  messageId: string;
  text: string;
  tokens: TokenLike[];
}

export interface PracticeItem {
  lemma: string;
  messageId: string;
  text: string;
  /** `token.i` of the highlighted word. */
  tokenIndex: number;
  surface: string;
  options: string[];
  answerIndex: number;
}

/** Small deterministic hash so the same inputs always produce the same quiz. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function practiceItems(mastery: Mastery, sentences: PracticeSentence[], now: number, k = 5): PracticeItem[] {
  // Every lemma with a gloss and the first sentence it appears in.
  const where = new Map<string, { sentence: PracticeSentence; token: TokenLike }>();
  const glosses = new Map<string, string>();
  for (const s of sentences) {
    for (const t of s.tokens) {
      if (t.isPunct || !t.gloss) continue;
      if (!where.has(t.lemma)) where.set(t.lemma, { sentence: s, token: t });
      if (!glosses.has(t.lemma)) glosses.set(t.lemma, t.gloss);
    }
  }

  // Seen words that aren't mastered, weakest recall first; fall back to mastered ones if too few.
  const ranked = [...where.keys()]
    .filter((l) => mastery[l])
    .map((l) => ({ l, st: status(mastery[l], now), r: recognizeRecall(mastery[l], now) }))
    .sort((a, b) => Number(a.st === 'mastered') - Number(b.st === 'mastered') || a.r - b.r || (a.l < b.l ? -1 : 1));

  const allGlosses = [...new Set(glosses.values())];
  const items: PracticeItem[] = [];
  for (const { l } of ranked.slice(0, k)) {
    const { sentence, token } = where.get(l) as { sentence: PracticeSentence; token: TokenLike };
    const answer = glosses.get(l) as string;
    const distractors = allGlosses
      .filter((g) => g !== answer)
      .sort((a, b) => hash(l + a) - hash(l + b))
      .slice(0, 3);
    if (distractors.length < 3) continue;
    const options = [answer, ...distractors].sort((a, b) => hash(`${l}|${a}`) - hash(`${l}|${b}`));
    items.push({
      lemma: l,
      messageId: sentence.messageId,
      text: sentence.text,
      tokenIndex: token.i,
      surface: token.surface ?? l,
      options,
      answerIndex: options.indexOf(answer),
    });
  }
  return items;
}
