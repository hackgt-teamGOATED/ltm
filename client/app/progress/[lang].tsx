import type { WordStatus } from '@heirloom/learner';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/rest';
import type { LanguageDetail } from '../../src/api/types';
import { MiniChart } from '../../src/components/MiniChart';
import { WordRow } from '../../src/components/WordRow';
import { learningBucket, learningCount } from '../../src/learning/logic';
import { STAGE_LABEL } from '../../src/learning/useLanguageView';
import { LANGUAGE_NAMES } from '../../src/lib/cast';
import { useMe } from '../../src/store/session';
import { colors, fonts, radius } from '../../src/theme/tokens';

/** Lists in the order the fade moves through them; "fading" sits with Learning so it's never hidden. */
const TABS: { key: WordStatus; label: string }[] = [
  { key: 'mastered', label: 'Mastered' },
  { key: 'learning', label: 'Learning' },
  { key: 'new', label: 'New' },
];

/** Language detail (PLAN.md §7.1, US-7): stats, readable share over time, and the word lists. */
export default function LanguageDetailScreen() {
  const { lang } = useLocalSearchParams<{ lang: string }>();
  const me = useMe();
  const router = useRouter();
  const [detail, setDetail] = useState<LanguageDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<WordStatus>('mastered');

  const meId = me?.id;
  const refresh = useCallback(async () => {
    if (!meId || !lang) return;
    setRefreshing(true);
    try {
      setDetail(await api.progressDetail(meId, lang));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [meId, lang]);

  // Refetch on focus, not just on mount: coming back from a chat must not show stale counts.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const points = useMemo(
    () => (detail?.weekly ?? []).map((w) => ({ label: `${w.week}`, value: w.readableShare })),
    [detail?.weekly],
  );
  // Fading words were mastered once, so they belong with Learning rather than in a list of their own.
  const rows = useMemo(() => {
    if (!detail) return [];
    return tab === 'learning' ? learningBucket(detail.words) : (detail.words[tab] ?? []);
  }, [detail, tab]);

  if (!me) return <Redirect href="/" />;
  const name = LANGUAGE_NAMES[lang] ?? lang;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/progress'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={28} color={colors.bubbleSentTop} />
        </Pressable>
        <Text style={styles.title}>{name}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {error && <Text style={styles.error}>Couldn't load {name}: {error}</Text>}
        {detail === null && !error && !refreshing && <ActivityIndicator style={styles.loading} color={colors.heirloom} />}

        {detail && (
          <>
            <View style={styles.statsRow}>
              <Stat value={STAGE_LABEL[detail.stage]} label="Stage" />
              <Stat value={`${detail.fadePct}%`} label="Faded" />
              <Stat value={String(detail.counts.mastered ?? 0)} label="Mastered" />
            </View>

            <MiniChart
              title="How much you can read, week by week"
              points={points}
              marker={{ value: 0.9, label: '90% — the translation switches off' }}
            />

            <View style={styles.tabs}>
              {TABS.map((t) => {
                const on = t.key === tab;
                const n = t.key === 'learning' ? learningCount(detail.counts) : (detail.counts[t.key] ?? 0);
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    style={[styles.tab, on && styles.tabOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${t.label}, ${n} words`}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>
                      {t.label} {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {rows.length === 0 ? (
              <Text style={styles.empty}>Nothing here yet. Keep reading your chats.</Text>
            ) : (
              rows.map((w) => <WordRow key={`${w.status}:${w.lemma}`} word={w} lang={lang} />)
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 8 },
  title: { fontSize: 20, fontFamily: fonts.semibold, color: colors.textPrimary },
  content: { paddingHorizontal: 16, paddingBottom: 32, gap: 16 },
  error: { fontSize: 14, fontFamily: fonts.regular, color: colors.danger },
  loading: { marginTop: 24 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface, gap: 2 },
  statValue: { fontSize: 18, fontFamily: fonts.semibold, color: colors.textPrimary },
  statLabel: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  tabs: { flexDirection: 'row', gap: 6 },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.heirloom },
  tabText: { fontSize: 13, fontFamily: fonts.medium, color: colors.textPrimary },
  tabTextOn: { color: colors.textOnSent },
  empty: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary, paddingVertical: 16 },
});
