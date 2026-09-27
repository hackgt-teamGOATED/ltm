import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '../../src/theme/tokens';

// Phase 6 fills this in (language cards, word lists, charts, practice).
export default function Progress() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>Progress</Text>
      <Text style={styles.body}>Your languages will show up here.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16 },
  title: { marginTop: 10, fontSize: 26, fontFamily: fonts.semibold, color: colors.textPrimary },
  body: { marginTop: 8, fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary },
});
