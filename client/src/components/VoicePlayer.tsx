import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { play, usePlayer } from '../audio/player';
import { colors } from '../theme/tokens';

const BARS = 28;

/** Deterministic pseudo-waveform per message (we don't decode audio on the client). */
function bars(seed: string): { id: string; x: number; h: number }[] {
  let h = 7;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    const env = Math.sin((Math.PI * (i + 1)) / (BARS + 1));
    return { id: `bar${i}`, x: i, h: 0.25 + 0.75 * env * ((h % 1000) / 1000) };
  });
}

export type VoiceSource = 'translated' | 'original';

interface Props {
  messageId: string;
  onSent: boolean;
  /** Which recording this is. Each language gets its own player; the key `${id}:original` drives karaoke. */
  source: VoiceSource;
  url: string | null;
  pending?: boolean;
}

export function VoicePlayer({ messageId, onSent, source, url, pending }: Props) {
  const key = `${messageId}:${source}`;
  const active = usePlayer((s) => s.key === key);
  const playing = usePlayer((s) => s.key === key && s.playing);
  const loading = usePlayer((s) => s.key === key && s.loading);
  const progress = usePlayer((s) => (s.key === key && s.duration ? s.position / s.duration : 0));
  const heights = useMemo(() => bars(messageId), [messageId]);
  const fg = onSent ? colors.textOnSent : colors.textPrimary;
  const dim = onSent ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.25)';

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause voice note' : 'Play voice note'}
          disabled={!url}
          hitSlop={5}
          onPress={() => url && play(key, url)}
          style={[styles.btn, { backgroundColor: onSent ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.07)' }]}
        >
          {pending || (active && loading) ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color={fg} />
          )}
        </Pressable>
        <Svg width={BARS * 5} height={28}>
          {heights.map((b) => (
            <Rect
              key={b.id}
              x={b.x * 5}
              y={14 - b.h * 12}
              width={3}
              height={b.h * 24}
              rx={1.5}
              fill={b.x / BARS < progress ? fg : dim}
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
