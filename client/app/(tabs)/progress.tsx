import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/rest';
import type { LanguageProgress } from '../../src/api/types';
import { LanguageCard } from '../../src/components/LanguageCard';
import { Skeleton } from '../../src/components/Skeleton';
import { learningCount } from '../../src/learning/logic';
import { useMe } from '../../src/store/session';
import { colors, fonts, type } from '../../src/theme/tokens';

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

  // Bottom tabs keep this screen mounted, so a mount-only fetch would show stale counts after
  // reading messages in a chat. Refetch whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={styles.title}>Progress</Text>
        {error && <Text style={styles.error}>Couldn't load progress: {error}</Text>}
        {langs === null && !error && (
          <>
            <Skeleton height={196} radius={16} />
            <Skeleton height={196} radius={16} />
          </>
        )}
        {langs?.length === 0 && (
          <>
            <Text style={styles.body}>Turn Heirloom on in a chat and pick a language. What you read there shows up here.</Text>
            <Pressable onPress={() => router.push('/chats')} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && { opacity: 0.7 }]}>
              <Text style={styles.actionText}>Open your chats</Text>
            </Pressable>
          </>
        )}
        {langs?.map((l) => (
          <LanguageCard
            key={l.lang}
            lang={l.lang}
            stage={l.stage}
            fadePct={l.fadePct}
            mastered={l.counts.mastered ?? 0}
            learning={learningCount(l.counts)}
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
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  title: { marginTop: 12, fontSize: type.display, fontFamily: fonts.semibold, letterSpacing: type.headingSpacing, color: colors.textPrimary },
  body: { fontSize: 15, fontFamily: fonts.regular, color: colors.textSecondary },
  error: { fontSize: 14, fontFamily: fonts.regular, color: colors.danger },
  action: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.heirloom },
  actionText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textOnSent },
});
