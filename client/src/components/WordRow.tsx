import { StyleSheet, Text, View } from 'react-native';
import type { WordRowData } from '../api/types';
import { colors, fonts, tabular, type } from '../theme/tokens';
import { scriptStyle } from './MessageBubble';

interface Props {
  word: WordRowData;
  lang: string;
}

/**
 * One word in a Progress list (PLAN.md §7.2, US-7): word, then romanization and meaning underneath, recall on
 * the right. A small orange dot marks a word that was mastered and is slipping (fading).
 */
export function WordRow({ word, lang }: Props) {
  const sub = [word.romanization, word.gloss].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <View style={styles.body}>
        <View style={styles.wordLine}>
          <Text
            style={[scriptStyle(lang, type.body), styles.word]}
            numberOfLines={1}
            accessibilityLabel={`${word.surface}${word.romanization ? `, ${word.romanization}` : ''}`}
          >
            {word.surface}
          </Text>
          {word.status === 'fading' && <View accessibilityLabel="Fading" style={styles.fading} />}
        </View>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={[styles.recall, tabular]}>{Math.round(word.recall * 100)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  body: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  wordLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  word: { fontFamily: fonts.semibold, color: colors.textPrimary, textAlign: 'left', writingDirection: 'ltr' },
  fading: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.fading },
  sub: { fontSize: type.meta, fontFamily: fonts.regular, color: colors.textSecondary },
  recall: { fontSize: type.meta, fontFamily: fonts.medium, color: colors.textSecondary, minWidth: 40, textAlign: 'right' },
});
