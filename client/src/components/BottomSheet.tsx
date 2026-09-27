import { type ReactNode, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSheet } from '../store/sheet';
import { colors, radius, shadow } from '../theme/tokens';

const DURATION = 220;

// Hand-rolled sheet (no bottom-sheet library, PLAN.md §3): slides up, drag down or tap outside to close.
export function BottomSheetHost() {
  const content = useSheet((s) => s.content);
  const close = useSheet((s) => s.close);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState<ReactNode | null>(null);
  const y = useSharedValue(height);
  const fade = useSharedValue(0);
  const isOpen = content !== null;

  // Swap content in place; only animate when the sheet opens or closes.
  useEffect(() => {
    if (content) setShown(content);
  }, [content]);

  useEffect(() => {
    if (isOpen) {
      y.value = height;
      y.value = withSpring(0, { damping: 22, stiffness: 240, mass: 0.9 });
      fade.value = withTiming(1, { duration: DURATION });
    } else {
      fade.value = withTiming(0, { duration: DURATION });
      y.value = withTiming(height, { duration: DURATION }, (done) => {
        if (done) runOnJS(setShown)(null);
      });
    }
  }, [isOpen, height, y, fade]);

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) runOnJS(close)();
      else y.value = withTiming(0, { duration: 150 });
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!shown) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheet, { maxHeight: height * 0.85, paddingBottom: insets.bottom + 16 }, sheetStyle]}>
        <GestureDetector gesture={drag}>
          <View style={styles.handleArea}>
            <View style={styles.handle} />
          </View>
        </GestureDetector>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} bounces={false}>
          {shown}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.overlay },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    ...shadow,
  },
  handleArea: { alignItems: 'center', paddingVertical: 10 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D4D4D9' },
});
