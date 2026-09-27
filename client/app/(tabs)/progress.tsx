import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/rest';
import type { LanguageProgress } from '../../src/api/types';
import { LanguageCard } from '../../src/components/LanguageCard';
import { useMe } from '../../src/store/session';
import { colors, fonts } from '../../src/theme/tokens';

/** Progress tab (PLAN.md §7.1, US-7): one card per language Heirloom is on for. */
export default function Progress() {
  const me = useMe();
  const router = useRouter();
  const [langs, setLangs] = useState<LanguageProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const meId = me?.id;
  const refresh = useCallback(async () => {
    if (!meId) return;
    setRefreshing(true);
    try {
      setLangs(await api.progress(meId));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [meId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={styles.title}>Progress</Text>
        {error && <Text style={styles.error}>Couldn't load progress: {error}</Text>}
        {langs === null && !error && <ActivityIndicator style={styles.loading} color={colors.heirloom} />}
        {langs?.length === 0 && (
          <Text style={styles.body}>
            Turn Heirloom on in a chat and pick a language. What you read there shows up here.
          </Text>
        )}
        {langs?.map((l) => (
          <LanguageCard
            key={l.lang}
            lang={l.lang}
            stage={l.stage}
            fadePct={l.fadePct}
            mastered={l.counts.mastered ?? 0}
            learning={(l.counts.learning ?? 0) + (l.counts.fading ?? 0)}
            fresh={l.counts.new ?? 0}
            onPress={() => router.push(`/progress/${l.lang}`)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  title: { marginTop: 10, fontSize: 26, fontFamily: fonts.semibold, color: colors.textPrimary },
  body: { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary },
  error: { fontSize: 14, fontFamily: fonts.regular, color: colors.danger },
  loading: { marginTop: 24 },
});
