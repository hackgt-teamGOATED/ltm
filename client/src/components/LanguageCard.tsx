import type { Stage } from '@heirloom/learner';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { STAGE_LABEL } from '../learning/useLanguageView';
import { LANGUAGE_NAMES, NATIVE_NAMES } from '../lib/cast';
import { colors, fonts, PRESSED_OPACITY, radius, tabular, type } from '../theme/tokens';
import { scriptStyle } from './MessageBubble';

interface Props {
  lang: string;
  stage: Stage;
  fadePct: number;
  mastered: number;
  learning: number;
  fresh: number;
  onPress: () => void;
}

const SIZE = 72;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** One hero card per language on the Progress tab (PLAN.md §7.1, US-7). */
export function LanguageCard({ lang, stage, fadePct, mastered, learning, fresh, onPress }: Props) {
  const pct = Math.min(100, Math.max(0, fadePct));
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: PRESSED_OPACITY }]}
      accessibilityRole="button"
      accessibilityLabel={`${LANGUAGE_NAMES[lang] ?? lang}, ${STAGE_LABEL[stage]}, ${fadePct}% faded, ${mastered} words mastered`}
    >
      <View style={styles.top}>
        <View style={{ flex: 1, gap: 8, alignItems: 'flex-start' }}>
          <Text style={[scriptStyle(lang, type.display), styles.name]} numberOfLines={1}>
            {NATIVE_NAMES[lang] ?? lang}
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{STAGE_LABEL[stage]}</Text>
          </View>
        </View>
        <View style={styles.ring}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={colors.hairline} strokeWidth={STROKE} fill="none" />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={colors.heirloom}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct / 100)}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          <View style={[styles.ringLabel, { pointerEvents: 'none' }]}>
            <Text style={[styles.ringPct, tabular]}>{pct}%</Text>
            <Text style={styles.ringCaption}>faded</Text>
          </View>
        </View>
      </View>
      <View style={styles.tiles}>
        <Tile value={mastered} label="Mastered" color={colors.mastered} />
        <Tile value={learning} label="Learning" />
        <Tile value={fresh} label="New" />
      </View>
    </Pressable>
  );
}

function Tile({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={[styles.tileValue, tabular, color ? { color } : null]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.background,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { color: colors.textPrimary, letterSpacing: type.headingSpacing },
  pill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.heirloomTint },
  pillText: { fontSize: type.meta, fontFamily: fonts.semibold, color: colors.heirloomDeep },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  ringLabel: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontSize: type.secondary, fontFamily: fonts.semibold, color: colors.textPrimary },
  ringCaption: { fontSize: 11, fontFamily: fonts.regular, color: colors.textSecondary },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.surface, gap: 2 },
  tileValue: { fontSize: type.title, fontFamily: fonts.semibold, color: colors.textPrimary },
  tileLabel: { fontSize: type.caption, fontFamily: fonts.regular, color: colors.textSecondary },
});
