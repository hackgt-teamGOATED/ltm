import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../src/components/Avatar';
import { SkeletonRow } from '../../src/components/Skeleton';
import { castById, LANGUAGE_NAMES } from '../../src/lib/cast';
import { preview, shortTime } from '../../src/lib/format';
import { useMe } from '../../src/store/session';
import { subscribeThreadList, useThreads } from '../../src/store/threads';
import { colors, fonts, PRESSED_OPACITY, type } from '../../src/theme/tokens';

export default function Chats() {
  const me = useMe();
  const router = useRouter();
  const threads = useThreads((s) => s.threads);
  const messages = useThreads((s) => s.messages);
  const settings = useThreads((s) => s.settings);
  const loadThreads = useThreads((s) => s.loadThreads);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const meId = me?.id;
  const refresh = useCallback(async () => {
    if (!meId) return;
    setRefreshing(true);
    try {
      await loadThreads(meId);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [meId, loadThreads]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const threadKey = threads.map((t) => t.id).join(',');
  useEffect(() => {
    if (!meId || !threadKey) return;
    return subscribeThreadList(threadKey.split(','), meId);
  }, [meId, threadKey]);

  if (!me) return null;

  // Only threads with a cast member on the other side (v0 threads like Nani/Dada stay hidden).
  const visible = threads
    .map((t) => ({ t, other: t.members.find((m) => m.id !== me.id) }))
    .filter((x) => x.other && castById(x.other.id))
    .sort((a, b) => {
      const la = messages[a.t.id]?.at(-1)?.createdAt ?? '';
      const lb = messages[b.t.id]?.at(-1)?.createdAt ?? '';
      return lb.localeCompare(la);
    });

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/?pick=1')} accessibilityRole="button" accessibilityLabel="Switch person">
          <Avatar id={me.id} name={me.displayName} size={36} />
        </Pressable>
        <Text style={styles.title}>Chats</Text>
      </View>
      {error && <Text style={styles.error}>Couldn't load chats: {error}</Text>}
      <FlatList
        data={visible}
        keyExtractor={(x) => x.t.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item: { t, other } }) => {
          const last = messages[t.id]?.at(-1);
          const s = settings[t.id];
          if (!other) return null;
          return (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && { opacity: PRESSED_OPACITY }]}
              onPress={() => router.push(`/chat/${t.id}`)}
            >
              <Avatar id={other.id} name={other.displayName} size={56} ring={Boolean(s?.learningEnabled)} />
              <View style={styles.rowBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {other.displayName}
                  </Text>
                  {s?.learningEnabled && s.learningLang && (
                    <Text style={styles.chip}>✦ {LANGUAGE_NAMES[s.learningLang]}</Text>
                  )}
                  <View style={{ flex: 1 }} />
                  {last && <Text style={styles.time}>{shortTime(last.createdAt)}</Text>}
                </View>
                <View style={styles.previewRow}>
                  {last?.kind === 'voice' && <Ionicons name="mic" size={14} color={colors.textSecondary} />}
                  <Text style={styles.preview} numberOfLines={1}>
                    {preview(last, me.language, me.id)}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          refreshing ? (
            <View>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>No conversations yet.</Text>
              <Pressable onPress={() => router.push('/?pick=1')} accessibilityRole="button" style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: PRESSED_OPACITY }]}>
                <Text style={styles.emptyBtnText}>Switch person</Text>
              </Pressable>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: type.display, fontFamily: fonts.semibold, letterSpacing: type.headingSpacing, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: type.body, fontFamily: fonts.semibold, letterSpacing: type.headingSpacing, color: colors.textPrimary },
  chip: { fontSize: type.caption, fontFamily: fonts.semibold, color: colors.heirloomDeep },
  time: { fontSize: type.meta, fontFamily: fonts.regular, color: colors.textTertiary },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  preview: { flex: 1, fontSize: type.secondary, fontFamily: fonts.regular, color: colors.textSecondary },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 84, backgroundColor: colors.hairline },
  emptyWrap: { alignItems: 'center', gap: 16, padding: 32 },
  empty: { textAlign: 'center', fontSize: type.secondary, color: colors.textSecondary, fontFamily: fonts.regular },
  emptyBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, backgroundColor: colors.heirloom },
  emptyBtnText: { fontSize: type.secondary, fontFamily: fonts.semibold, color: colors.textOnSent },
  error: { paddingHorizontal: 16, color: colors.danger, fontFamily: fonts.regular },
});
