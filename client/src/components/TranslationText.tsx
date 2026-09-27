import { useMemo } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import type { MessageAnalysis } from '../api/types';
import { highlightMask, segmentTranslation } from '../learning/spans';
import { colors } from '../theme/tokens';
import { scriptStyle } from './MessageBubble';

interface Props {
  analysis: MessageAnalysis;
  viewerLang: string;
  selected: number | null;
  /** Tapping a translated word selects the original token it maps to (reverse direction, PLAN.md §5.3). */
  onPressToken?: (i: number) => void;
  onSent: boolean;
  style?: TextStyle;
}

export function TranslationText({ analysis, viewerLang, selected, onPressToken, onSent, style }: Props) {
  const segments = useMemo(() => segmentTranslation(analysis), [analysis]);
  const mask = useMemo(() => highlightMask(analysis, selected), [analysis, selected]);
  const color = onSent ? colors.textOnSent : colors.textPrimary;

  let offset = 0;
  return (
    <Text style={[scriptStyle(viewerLang), { color }, style]}>
      {segments.map((seg) => {
        const start = offset;
        offset += seg.text.length;
        // Split each segment where the highlight mask changes, so only the mapped characters get the tint.
        const parts: { text: string; on: boolean; key: string }[] = [];
        for (let c = 0; c < seg.text.length; c++) {
          const on = mask[start + c];
          const last = parts[parts.length - 1];
          if (last && last.on === on) last.text += seg.text[c];
          else parts.push({ text: seg.text[c], on, key: `${start + c}` });
        }
        const tappable = seg.tokenIndex !== null && onPressToken;
        return (
          <Text
            key={`s${start}`}
            onPress={tappable ? () => onPressToken(seg.tokenIndex as number) : undefined}
            suppressHighlighting
          >
            {parts.map((p) => (
              <Text key={p.key} style={p.on ? styles.on : undefined}>
                {p.text}
              </Text>
            ))}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  on: { backgroundColor: colors.heirloomHighlight, color: colors.textPrimary },
});
