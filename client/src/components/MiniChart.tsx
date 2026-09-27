import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme/tokens';

export interface ChartPoint {
  /** X label under the axis (week number). */
  label: string;
  /** 0–1. */
  value: number;
}

interface Props {
  title: string;
  points: ChartPoint[];
  /** Optional horizontal reference line, 0–1, e.g. the 95% comprehension line (PLAN.md §10). */
  marker?: { value: number; label: string };
  height?: number;
}

const PAD = { left: 30, right: 10, top: 10, bottom: 20 };

/**
 * Hand-rolled line chart (PLAN.md §3 allows no chart library): readable share per week.
 * Values are 0–1; the y axis is always the full 0–100% so weeks can't look better than they are.
 */
export function MiniChart({ title, points, marker, height = 130 }: Props) {
  const W = 300;
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const y = (v: number) => PAD.top + innerH * (1 - Math.min(1, Math.max(0, v)));

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {points.length === 0 ? (
        <Text style={styles.empty}>Not enough history yet.</Text>
      ) : (
        <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`}>
          {[0, 0.5, 1].map((t) => (
            <Line key={t} x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke={colors.hairline} strokeWidth={1} />
          ))}
          {[0, 0.5, 1].map((t) => (
            <SvgText key={t} x={4} y={y(t) + 4} fontSize={9} fill={colors.textSecondary}>
              {Math.round(t * 100)}%
            </SvgText>
          ))}
          {marker && (
            <Line
              x1={PAD.left}
              y1={y(marker.value)}
              x2={W - PAD.right}
              y2={y(marker.value)}
              stroke={colors.mastered}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}
          <Path d={path} stroke={colors.heirloom} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {points.map((p, i) => (
            <Circle key={p.label} cx={x(i)} cy={y(p.value)} r={3} fill={colors.heirloom} />
          ))}
          {points.map((p, i) => (
            <SvgText key={p.label} x={x(i)} y={height - 6} fontSize={9} fill={colors.textSecondary} textAnchor="middle">
              {p.label}
            </SvgText>
          ))}
        </Svg>
      )}
      {marker && points.length > 0 && <Text style={styles.markerLabel}>{marker.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  title: { fontSize: 14, fontFamily: fonts.semibold, color: colors.textPrimary },
  empty: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, paddingVertical: 12 },
  markerLabel: { fontSize: 11, fontFamily: fonts.regular, color: colors.mastered },
});
