import type { Stage } from '@heirloom/learner';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { STAGE_LABEL } from '../learning/useLanguageView';
import { LANGUAGE_NAMES } from '../lib/cast';
import { colors, fonts, radius } from '../theme/tokens';

interface Props {
  lang: string;
  stage: Stage;
  fadePct: number;
  mastered: number;
  learning: number;
  fresh: number;
  onPress: () => void;
}

const R = 22;
const C = 2 * Math.PI * R;

/** One card per language on the Progress tab (PLAN.md §7.1, US-7). */
export function LanguageCard({ lang, stage, fadePct, mastered, learning, fresh, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${LANGUAGE_NAMES[lang] ?? lang}, ${STAGE_LABEL[stage]}, ${fadePct}% faded, ${mastered} words mastered`}
    >
      <Svg width={R * 2 + 6} height={R * 2 + 6}>
        <Circle cx={R + 3} cy={R + 3} r={R} stroke={colors.hairline} strokeWidth={5} fill="none" />
        <Circle
          cx={R + 3}
          cy={R + 3}
          r={R}
          stroke={colors.heirloom}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - Math.min(1, Math.max(0, fadePct / 100)))}
          transform={`rotate(-90 ${R + 3} ${R + 3})`}
        />
      </Svg>
      <View style={styles.body}>
        <Text style={styles.name}>{LANGUAGE_NAMES[lang] ?? lang}</Text>
        <Text style={styles.stage}>
          {STAGE_LABEL[stage]} · {fadePct}% faded
        </Text>
        <Text style={styles.counts}>
          <Text style={styles.mastered}>{mastered} mastered</Text> · {learning} learning · {fresh} new
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 17, fontFamily: fonts.semibold, color: colors.textPrimary },
  stage: { fontSize: 13, fontFamily: fonts.medium, color: colors.heirloom },
  counts: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  mastered: { color: colors.mastered, fontFamily: fonts.medium },
  chevron: { fontSize: 26, color: colors.textSecondary, paddingHorizontal: 4 },
});
