import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../src/components/Avatar';
import { castById, LANGUAGE_NAMES } from '../../src/lib/cast';
import { preview, shortTime } from '../../src/lib/format';
import { useMe } from '../../src/store/session';
import { useThreads } from '../../src/store/threads';
import { colors, fonts } from '../../src/theme/tokens';

export default function Chats() {
  const me = useMe();
  const router = useRouter();
  const threads = useThreads((s) => s.threads);
  const messages = useThreads((s) => s.messages);
  const settings = useThreads((s) => s.settings);
  const loadThreads = useThreads((s) => s.loadThreads);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!me) return;
    setRefreshing(true);
    try {
      await loadThreads(me.id);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [me, loadThreads]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/chat/${t.id}`)}
            >
              <Avatar id={other.id} name={other.displayName} size={56} ring={Boolean(s?.learningEnabled)} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{other.displayName}</Text>
                  {s?.learningEnabled && s.learningLang && (
                    <Text style={styles.chip}>✦ {LANGUAGE_NAMES[s.learningLang]}</Text>
                  )}
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {preview(last, me.language, me.id)}
                  {last ? ` · ${shortTime(last.createdAt)}` : ''}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !refreshing ? <Text style={styles.empty}>No chats yet. Is the server running and seeded?</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  title: { fontSize: 26, fontFamily: fonts.semibold, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontFamily: fonts.medium, color: colors.textPrimary },
  chip: { fontSize: 12, fontFamily: fonts.medium, color: colors.heirloom },
  preview: { marginTop: 2, fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  empty: { padding: 24, textAlign: 'center', color: colors.textSecondary, fontFamily: fonts.regular },
  error: { paddingHorizontal: 16, color: colors.danger, fontFamily: fonts.regular },
});
