import type { TokenPlan } from '@heirloom/learner';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import type { MessageAnalysis } from '../api/types';
import { isRtl } from '../lib/cast';
import { groupOf } from '../learning/spans';
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
}

/**
 * The original, word by word (PLAN.md §7.5): one outer <Text> with a nested <Text onPress> per token and the
 * original whitespace between, so wrapping and right-to-left text work on web and native. Tokens are always
 * addressed by token.i, never by screen position.
 */
export function TranscriptBox({ analysis, lang, plan, selected, speaking, onPressToken, onSent, size = 16 }: Props) {
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
            {!t.isPunct && p?.hint && !p.partialHint && t.gloss ? (
              <Text style={[styles.gloss, { fontSize: Math.round(size * 0.7) }]}> ({t.gloss})</Text>
            ) : null}
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
  challenge: { borderWidth: 1, borderColor: colors.heirloom, borderRadius: 4 },
  q: { color: colors.heirloom, fontFamily: fonts.semibold },
  selected: { backgroundColor: colors.heirloomHighlight, color: colors.textPrimary },
  speaking: { backgroundColor: '#FFE9B8', color: colors.textPrimary },
  gloss: { color: colors.heirloom, fontFamily: fonts.medium, writingDirection: 'ltr' },
});
