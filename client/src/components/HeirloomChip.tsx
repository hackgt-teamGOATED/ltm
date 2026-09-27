import type { Stage } from '@heirloom/learner';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { LANGUAGE_NAMES } from '../lib/cast';
import { STAGE_LABEL } from '../learning/useLanguageView';
import { colors, fonts, radius } from '../theme/tokens';

interface Props {
  enabled: boolean;
  lang: string | null;
  stage: Stage;
  fadePct: number;
  onPress: () => void;
}

const R = 8;
const C = 2 * Math.PI * R;

/** Header chip: language + stage + a ring showing how far the translation has faded (PLAN.md §7.2). */
export function HeirloomChip({ enabled, lang, stage, fadePct, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={enabled ? `Heirloom on, ${lang ? LANGUAGE_NAMES[lang] : ''}, ${STAGE_LABEL[stage]}` : 'Heirloom off'}
      hitSlop={6}
      style={[styles.chip, !enabled && styles.off]}
    >
      <Text style={[styles.star, !enabled && { color: colors.textSecondary }]}>✦</Text>
      {enabled && lang ? (
        <>
          <Text style={styles.text}>
            {LANGUAGE_NAMES[lang]} · {STAGE_LABEL[stage]}
          </Text>
          <Svg width={R * 2 + 4} height={R * 2 + 4}>
            <Circle cx={R + 2} cy={R + 2} r={R} stroke={colors.hairline} strokeWidth={3} fill="none" />
            <Circle
              cx={R + 2}
              cy={R + 2}
              r={R}
              stroke={colors.heirloom}
              strokeWidth={3}
              fill="none"
              strokeDasharray={`${(C * Math.min(100, fadePct)) / 100} ${C}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${R + 2} ${R + 2})`}
            />
          </Svg>
        </>
      ) : (
        <Text style={[styles.text, { color: colors.textSecondary }]}>Heirloom</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.heirloomTint,
    borderWidth: 1,
    borderColor: colors.heirloom,
  },
  off: { backgroundColor: colors.surface, borderColor: colors.hairline },
  star: { color: colors.heirloom, fontSize: 14 },
  text: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textPrimary },
});
