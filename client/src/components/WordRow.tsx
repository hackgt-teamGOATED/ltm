import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WordRowData } from '../api/types';
import { isRtl } from '../lib/cast';
import { colors, fonts, radius } from '../theme/tokens';

interface Props {
  word: WordRowData;
  lang: string;
  /** "Hear it": server TTS. Omitted when the platform has no voice for this language. */
  onPlay?: () => void;
}

const DOT: Record<string, string> = {
  mastered: colors.mastered,
  fading: colors.fading,
  learning: colors.heirloom,
  new: colors.textSecondary,
};

/** One word in a Progress list (PLAN.md §7.2, US-7): word, romanization, meaning, recall. */
export function WordRow({ word, lang, onPlay }: Props) {
  const rtl = isRtl(lang);
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: DOT[word.status] ?? colors.textSecondary }]} />
      <View style={styles.body}>
        <Text
          style={[styles.word, rtl && styles.rtl]}
          numberOfLines={1}
          accessibilityLabel={`${word.surface}${word.romanization ? `, ${word.romanization}` : ''}`}
        >
          {word.surface}
        </Text>
        {word.romanization ? <Text style={styles.roman}>{word.romanization}</Text> : null}
        <Text style={styles.gloss} numberOfLines={1}>
          {word.gloss}
        </Text>
      </View>
      <Text style={styles.recall}>{Math.round(word.recall * 100)}%</Text>
      {onPlay && (
        <Pressable
          onPress={onPlay}
          hitSlop={10}
          style={styles.play}
          accessibilityRole="button"
          accessibilityLabel={`Hear ${word.surface}`}
        >
          <Text style={styles.playText}>▶</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: 44 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  body: { flex: 1, minWidth: 0 },
  word: { fontSize: 16, fontFamily: fonts.medium, color: colors.textPrimary },
  rtl: { writingDirection: 'rtl', textAlign: 'right' },
  roman: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  gloss: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  recall: { fontSize: 12, fontFamily: fonts.medium, color: colors.textSecondary, minWidth: 36, textAlign: 'right' },
  play: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  playText: { fontSize: 14, color: colors.bubbleSentTop },
});
