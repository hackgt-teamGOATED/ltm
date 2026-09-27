import type { Stage } from '@heirloom/learner';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_NAMES } from '../lib/cast';
import { STAGE_LABEL } from '../learning/useLanguageView';
import { type DemoWeek, useDemo } from '../store/demo';
import { colors, fonts, radius } from '../theme/tokens';

interface Props {
  lang: string | null;
  stage: Stage;
  fadePct: number;
  /** Mastered / tracked counts for the week on screen, so the numbers move with the slider. */
  mastered: number;
  tracked: number;
}

/**
 * Hidden demo panel (PLAN.md §9.2): replays Arjun's real event log week by week through the learner
 * model. Read-only — picking a week re-renders the chat, it never logs an event or changes mastery.
 */
export function DemoPanel({ lang, stage, fadePct, mastered, tracked }: Props) {
  const { week, weeks, loading, error, setWeek, close } = useDemo();
  const steps: DemoWeek[] = [...weeks.map((_, i) => i + 1), null];

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Time travel</Text>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close time travel">
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>
        Replays the simulated history through the learner model. Nothing is recorded.
      </Text>

      {loading && <ActivityIndicator style={styles.loading} color={colors.heirloom} />}
      {error && <Text style={styles.error}>Couldn't load the history: {error}</Text>}

      {!loading && !error && weeks.length > 0 && (
        <>
          <View style={styles.steps}>
            {steps.map((w) => {
              const on = w === week;
              return (
                <Pressable
                  key={w ?? 'now'}
                  onPress={() => setWeek(w)}
                  style={[styles.step, on && styles.stepOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={w === null ? 'Now' : `Week ${w}`}
                >
                  <Text style={[styles.stepText, on && styles.stepTextOn]}>{w === null ? 'Now' : w}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.readout}>
            <Text style={styles.when}>{week === null ? 'Now' : `End of week ${week}`}</Text>
            <Text style={styles.stat}>
              {lang ? LANGUAGE_NAMES[lang] : '—'} · {STAGE_LABEL[stage]} · {fadePct}% faded
            </Text>
            <Text style={styles.stat}>
              {mastered} of {tracked} words in this chat mastered
            </Text>
          </View>
        </>
      )}

      {!loading && !error && weeks.length === 0 && (
        <Text style={styles.empty}>No learning history yet. Run the demo seed to see the arc.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontFamily: fonts.semibold, color: colors.textPrimary },
  done: { fontSize: 16, fontFamily: fonts.semibold, color: colors.bubbleSentTop, paddingVertical: 6 },
  sub: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
  loading: { marginVertical: 20 },
  error: { fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  empty: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, paddingVertical: 12 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  step: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  stepOn: { backgroundColor: colors.heirloom },
  stepText: { fontSize: 15, fontFamily: fonts.medium, color: colors.textPrimary },
  stepTextOn: { color: colors.textOnSent },
  readout: {
    gap: 2,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.heirloomTint,
    borderWidth: 1,
    borderColor: colors.heirloomHighlight,
  },
  when: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textPrimary },
  stat: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary },
});
