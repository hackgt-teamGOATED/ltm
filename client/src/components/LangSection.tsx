import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_NAMES } from '../lib/cast';
import { colors, fonts } from '../theme/tokens';

/** One language's half of a bilingual bubble: a clear label ("Original · Spanish"), then its voice note and text. */
export function LangSection({
  kind,
  lang,
  accessory,
  children,
}: {
  kind: 'Original' | 'Translation';
  lang: string;
  /** Sits at the right end of the label line. The line keeps its height, so it can appear without moving anything. */
  accessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, kind === 'Translation' && styles.translation]}>
          {kind} · {LANGUAGE_NAMES[lang] ?? lang}
        </Text>
        {accessory}
      </View>
      {children}
    </View>
  );
}

/** Hairline between the two sections. */
export const SectionDivider = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  section: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 20 },
  label: { fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
  translation: { color: colors.heirloom },
  divider: { height: 1, marginVertical: 8, backgroundColor: 'rgba(0,0,0,0.08)' },
});
