import type { Stage } from '@heirloom/learner';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { LANGUAGE_NAMES } from '../lib/cast';
import { colors, fonts, radius } from '../theme/tokens';

const COPY: Record<Exclude<Stage, 'listener'>, (lang: string) => { title: string; body: string }> = {
  reader: (l) => ({ title: `You're a Reader in ${l}`, body: 'Original first now. The translation is one tap away.' }),
  conversant: (l) => ({ title: `Conversant in ${l}`, body: 'The translation stays hidden. Long-press a message if you need it.' }),
  fluent: (l) => ({ title: `Translation off for ${l}.`, body: "You don't need it anymore." }),
};

/** Stage-up moment (PLAN.md §7.4): slides in under the header, dismisses itself after a few seconds. */
export function StageUpCard({ stage, lang, onDone }: { stage: Stage; lang: string; onDone: () => void }) {
  const o = useSharedValue(0);
  const y = useSharedValue(-12);
  useEffect(() => {
    o.value = withTiming(1, { duration: 260 });
    y.value = withTiming(0, { duration: 260 });
    o.value = withDelay(4200, withTiming(0, { duration: 300 }, (done) => done && runOnJS(onDone)()));
  }, [o, y, onDone]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  if (stage === 'listener') return null;
  const { title, body } = COPY[stage](LANGUAGE_NAMES[lang] ?? lang);
  return (
    <Animated.View style={[styles.wrap, style]}>
      <Pressable onPress={onDone} accessibilityRole="button" accessibilityLabel={`${title}. ${body}`} style={styles.card}>
        <Text style={styles.title}>✦ {title}</Text>
        <Text style={styles.body}>{body}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, top: 64, zIndex: 10 },
  card: {
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.heirloomTint,
    borderWidth: 1.5,
    borderColor: colors.heirloom,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
  },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.textPrimary },
  body: { marginTop: 2, fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary },
});
