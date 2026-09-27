import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { CHART_PAD, CHART_W, chartScales } from '../lib/chart';
import { colors, fonts } from '../theme/tokens';

export interface ChartPoint {
  /** X label under the axis (week number). Must be unique within one chart: it is the React key. */
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


/**
 * Hand-rolled line chart (PLAN.md §3 allows no chart library): readable share per week.
 * Values are 0–1; the y axis is always the full 0–100% so weeks can't look better than they are.
 */
export function MiniChart({ title, points, marker, height = 130 }: Props) {
  const { x, y } = chartScales(points.length, height);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {points.length === 0 ? (
        <Text style={styles.empty}>Not enough history yet.</Text>
      ) : (
        <Svg width="100%" height={height} viewBox={`0 0 ${CHART_W} ${height}`}>
          <Line
            x1={CHART_PAD.left}
            y1={y(0)}
            x2={CHART_W - CHART_PAD.right}
            y2={y(0)}
            stroke={colors.hairline}
            strokeWidth={1}
          />
          {marker && (
            <Line
              x1={CHART_PAD.left}
              y1={y(marker.value)}
              x2={CHART_W - CHART_PAD.right}
              y2={y(marker.value)}
              stroke={colors.mastered}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          )}
          <Path d={path} stroke={colors.heirloom} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <Circle key={p.label} cx={x(i)} cy={y(p.value)} r={2.5} fill={colors.heirloom} />
          ))}
          {points.map((p, i) => (
            <SvgText key={p.label} x={x(i)} y={height - 4} fontSize={10} fontFamily={fonts.regular} fill={colors.textTertiary} textAnchor="middle">
              {p.label}
            </SvgText>
          ))}
          {[0, points.length - 1].map((i) => (
            <SvgText
              key={`end${i}`}
              x={x(i)}
              y={y(points[i].value) - 8}
              fontSize={11}
              fontFamily={fonts.semibold}
              fill={colors.heirloomDeep}
              textAnchor={i === 0 ? 'start' : 'end'}
            >
              {Math.round(points[i].value * 100)}%
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
  title: { fontSize: 15, fontFamily: fonts.semibold, letterSpacing: -0.3, color: colors.textPrimary },
  empty: { fontSize: 13, fontFamily: fonts.regular, color: colors.textSecondary, paddingVertical: 12 },
  markerLabel: { fontSize: 12, fontFamily: fonts.regular, color: colors.mastered },
});
