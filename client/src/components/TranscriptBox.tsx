import type { TokenPlan } from '@heirloom/learner';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import type { MessageAnalysis } from '../api/types';
import { isRtl } from '../lib/cast';
import { groupOf } from '../learning/spans';
import { DISSOLVE_MS } from '../store/learner';
import { colors, fonts } from '../theme/tokens';
import { scriptStyle } from './MessageBubble';

interface Props {
  analysis: MessageAnalysis;
  lang: string;
  plan: TokenPlan[] | null;
  selected: number | null;
  /** Token being spoken in a playing voice note (karaoke). */
  speaking: number | null;
  onPressToken: (i: number) => void;
  onSent: boolean;
  size?: number;
  /** Lemmas that just became mastered: their gloss dissolves ("You know this now"). */
  dissolving?: ReadonlySet<string>;
}

/** A gloss fading out over 1.2 s. State-driven (a nested <Text> can't host a native-driven animation). */
function DissolvingGloss({ text, style }: { text: string; style: TextStyle[] }) {
  const [opacity, setOpacity] = useState(1);
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      const left = 1 - (Date.now() - started) / DISSOLVE_MS;
      setOpacity(Math.max(0, left));
      if (left <= 0) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, []);
  if (opacity <= 0) return null;
  return <Text style={[...style, { opacity }]}>{text}</Text>;
}

/**
 * The original, word by word (PLAN.md §7.5): one outer <Text> with a nested <Text onPress> per token and the
 * original whitespace between, so wrapping and right-to-left text work on web and native. Tokens are always
 * addressed by token.i, never by screen position.
 */
export function TranscriptBox({ analysis, lang, plan, selected, speaking, onPressToken, onSent, size = 16, dissolving }: Props) {
  const group = selected === null ? [] : groupOf(analysis, selected);
  const base = [scriptStyle(lang, size), { color: onSent ? colors.textOnSent : colors.textPrimary }];
  return (
    <Text style={[base, isRtl(lang) && styles.rtl]}>
      {analysis.tokens.map((t) => {
        const p = plan?.[t.i];
        const style: TextStyle[] = [];
        if (!t.isPunct && p) {
          if (p.challenge) style.push(styles.challenge);
          else if (p.status === 'fading') style.push(styles.fading);
          else if (p.hint || p.partialHint) style.push(styles.hinted);
        }
        if (group.includes(t.i)) style.push(styles.selected);
        if (speaking === t.i) style.push(styles.speaking);
        return (
          <Text key={t.i}>
            {t.pre}
            {t.isPunct ? (
              <Text>{t.surface}</Text>
            ) : (
              <Text
                onPress={() => onPressToken(t.i)}
                style={style}
                accessibilityRole="button"
                accessibilityLabel={`${t.surface}${t.gloss ? `, ${t.gloss}` : ''}`}
              >
                {t.surface}
                {p?.challenge ? <Text style={styles.q}>?</Text> : null}
              </Text>
            )}
            {glossFor(t, p, size, dissolving)}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  hinted: { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: colors.heirloom },
  fading: { textDecorationLine: 'underline', textDecorationColor: colors.fading },
  // Borders are ignored on nested <Text> on iOS/Android, so a tint + solid underline marks challenges.
  challenge: {
    backgroundColor: colors.heirloomTint,
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationColor: colors.heirloom,
  },
  q: { color: colors.heirloom, fontFamily: fonts.semibold },
  selected: { backgroundColor: colors.heirloomHighlight, color: colors.textPrimary },
  speaking: { backgroundColor: colors.heirloomKaraoke, color: colors.textPrimary },
  gloss: { color: colors.heirloom, fontFamily: fonts.medium, writingDirection: 'ltr' },
  roman: { color: colors.textSecondary, fontFamily: fonts.regular, writingDirection: 'ltr' },
});

/** The small text after a word: romanization (until the script is learned) and/or the gloss (when hinted). */
function glossFor(
  t: MessageAnalysis['tokens'][number],
  p: TokenPlan | undefined,
  size: number,
  dissolving: ReadonlySet<string> | undefined,
) {
  if (t.isPunct || !p) return null;
  const small = { fontSize: Math.round(size * 0.7) };
  if (dissolving?.has(t.lemma) && t.gloss) {
    return <DissolvingGloss key={`d${t.i}`} text={` (${t.gloss} ✓)`} style={[styles.gloss, small]} />;
  }
  const showGloss = p.hint && !p.partialHint && Boolean(t.gloss);
  const roman = p.romanization && t.romanization ? t.romanization : null;
  if (!showGloss && !roman) return null;
  const parts = [roman, showGloss ? t.gloss : null].filter(Boolean).join(' · ');
  return <Text style={[showGloss ? styles.gloss : styles.roman, small]}> ({parts})</Text>;
}
