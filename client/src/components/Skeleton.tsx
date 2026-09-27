import { useEffect } from 'react';
import { type DimensionValue, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors } from '../theme/tokens';

/** A soft pulsing placeholder block. Used instead of spinners while something loads. */
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: DimensionValue; height?: number; radius?: number; style?: ViewStyle }) {
  const o = useSharedValue(0.55);
  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface }, anim, style]} />;
}

/** Placeholder for a list row: avatar circle + two lines. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <Skeleton width={56} height={56} radius={28} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="40%" height={16} />
        <Skeleton width="80%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
