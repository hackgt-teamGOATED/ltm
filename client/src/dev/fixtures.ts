// Sample messages and analyses for the dev fixtures page (dev builds only). Not used in the app.
import type { Mastery } from '@heirloom/learner';
import type { Message, MessageAnalysis, Span, Token } from '../api/types';

type Raw = [surface: string, lemma: string, gloss: string, translationWords: string[], extra?: Partial<Token>];

function build(id: string, original: string, translation: string, raw: Raw[], phrases: MessageAnalysis['phrases'] = []) {
  const tokens: Token[] = [];
  let cursor = 0;
  const claimed: Span[] = [];
  for (const [surface, lemma, gloss, tw, extra] of raw) {
    const at = original.indexOf(surface, cursor);
    const pre = original.slice(cursor, at);
    cursor = at + surface.length;
    const tSpans: Span[] = [];
    for (const w of tw) {
      let s = translation.indexOf(w);
      while (s !== -1 && claimed.some(([a, b]) => s < b && a < s + w.length)) s = translation.indexOf(w, s + 1);
      if (s !== -1) {
        tSpans.push([s, s + w.length]);
        claimed.push([s, s + w.length]);
      }
    }
    tokens.push({ i: tokens.length, surface, pre, lemma, gloss, ...(tSpans.length ? { tSpans } : {}), ...extra });
  }
  for (const p of phrases) for (const i of p.tokenIndices) tokens[i].phraseId = p.id;
  const analysis: MessageAnalysis = { messageId: id, viewerLang: 'en', translation, tokens, phrases, needsNativeCheck: true };
  return analysis;
}

const P = { isPunct: true } as const;
const span = (text: string, w: string): Span => [text.indexOf(w), text.indexOf(w) + w.length];

const esText = '¡Hola mijo! Te echo mucho de menos. Aquí hace un frío que pela.';
const esTr = 'Hi sweetie! I miss you so much. It is freezing cold here.';
export const esAnalysis = build(
  'fx-es',
  esText,
  esTr,
  [
    ['¡', '¡', '', [], P],
    ['Hola', 'hola', 'hi', ['Hi'], { pos: 'Interjection' }],
    ['mijo', 'mijo', 'sweetie (my son)', ['sweetie'], { pos: 'Noun', grammar: 'Short for "mi hijo", used with grandchildren too.' }],
    ['!', '!', '', [], P],
    ['Te', 'te', 'you', ['you']],
    ['echo', 'echar', 'miss (with de menos)', ['miss'], { grammar: 'Present tense, yo form of echar.' }],
    ['mucho', 'mucho', 'a lot', ['so much']],
    ['de', 'de', 'of', []],
    ['menos', 'menos', 'less', []],
    ['.', '.', '', [], P],
    ['Aquí', 'aquí', 'here', ['here']],
    ['hace', 'hacer', 'it is (weather)', ['It is']],
    ['un', 'un', 'a', []],
    ['frío', 'frío', 'cold', ['cold']],
    ['que', 'que', 'that', []],
    ['pela', 'pelar', 'peels', []],
    ['.', '.', '', [], P],
  ],
  [
    { id: 'p0', tokenIndices: [4, 5, 7, 8], meaning: 'to miss someone', isIdiom: false, tSpans: [span(esTr, 'miss')] },
    {
      id: 'p1',
      tokenIndices: [11, 12, 13, 14, 15],
      meaning: "it's freezing cold",
      isIdiom: true,
      culture: 'A playful, very common way to complain about the cold across Spain and Latin America.',
      tSpans: [span(esTr, 'freezing cold')],
    },
  ],
);

const urText = 'آج بہت گرمی ہے۔';
const urTr = 'It is very hot today.';
export const urAnalysis = build('fx-ur', urText, urTr, [
  ['آج', 'آج', 'today', ['today'], { romanization: 'aaj' }],
  ['بہت', 'بہت', 'very', ['very'], { romanization: 'bohat' }],
  ['گرمی', 'گرمی', 'heat', ['hot'], { romanization: 'garmi', grammar: 'Noun: "heat". With ہے it means "it is hot".' }],
  ['ہے', 'ہونا', 'is', ['is'], { romanization: 'hai' }],
  ['۔', '۔', '', [], P],
]);

const msg = (id: string, text: string, lang: string, translation: string, sender = 'x'): Message => ({
  id,
  threadId: 'fx',
  senderId: sender,
  kind: 'text',
  originalText: text,
  originalLanguage: lang,
  audioUrl: null,
  wordTimestamps: null,
  status: 'ready',
  createdAt: new Date().toISOString(),
  translations: [{ language: 'en', text: translation, audioUrl: null }],
});

export const esMessage = msg('fx-es', esText, 'es', esTr);
export const urMessage = msg('fx-ur', urText, 'ur', urTr);

/** A learner who has mastered "hola" and "mijo" and is learning "mucho". */
export function fixtureMastery(now: number): Mastery {
  const day = 86_400_000;
  const skill = (stability: number, lastReview: number, successDays: number[]) => ({
    stability,
    initialStability: 1.3,
    lastReview,
    successDays,
    successes: successDays.length,
    failures: 0,
    history: [],
  });
  const lemma = (l: string, s: ReturnType<typeof skill>) => ({
    lemma: l,
    lang: 'es' as const,
    difficulty: 0.4,
    formsSeen: [l],
    contexts: ['fx'],
    encounters: 5,
    wasMastered: s.stability >= 7,
    skills: { recognize: s },
  });
  const today = Math.floor(now / day);
  return {
    hola: lemma('hola', skill(40, now - 3600_000, [today - 3, today])),
    mijo: lemma('mijo', skill(30, now - 7200_000, [today - 5, today - 1])),
    mucho: lemma('mucho', skill(2, now - 2 * day, [today - 2])),
  };
}
