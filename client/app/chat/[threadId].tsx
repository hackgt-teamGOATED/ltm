import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/rest';
import type { Message } from '../../src/api/types';
import { voiceForm } from '../../src/audio/upload';
import { Avatar } from '../../src/components/Avatar';
import { Composer } from '../../src/components/Composer';
import type { GroupPos } from '../../src/components/MessageBubble';
import { PlainMessage } from '../../src/components/PlainMessage';
import { useMe } from '../../src/store/session';
import { subscribeThread, useThreads } from '../../src/store/threads';
import { colors, fonts } from '../../src/theme/tokens';

const GROUP_GAP_MS = 5 * 60_000;
const EMPTY: Message[] = [];

function groupPositions(list: Message[]): Map<string, GroupPos> {
  const out = new Map<string, GroupPos>();
  list.forEach((m, i) => {
    const prev = list[i - 1];
    const next = list[i + 1];
    const joins = (a?: Message, b?: Message) =>
      Boolean(a && b && a.senderId === b.senderId && Date.parse(b.createdAt) - Date.parse(a.createdAt) < GROUP_GAP_MS);
    out.set(m.id, { first: !joins(prev, m), last: !joins(m, next) });
  });
  return out;
}

export default function Conversation() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const me = useMe();
  const router = useRouter();
  const thread = useThreads((s) => s.threads.find((t) => t.id === threadId));
  const messages = useThreads((s) => s.messages[threadId] ?? EMPTY);
  const loadThread = useThreads((s) => s.loadThread);
  const loadThreads = useThreads((s) => s.loadThreads);
  const upsertMessage = useThreads((s) => s.upsertMessage);
  const [loadError, setLoadError] = useState<string | null>(null);
  const meId = me?.id;
  const meLang = me?.language;

  useEffect(() => {
    if (!meId || !meLang || !threadId) return;
    setLoadError(null);
    loadThread(threadId, meId, meLang).catch((e) => setLoadError((e as Error).message));
    return subscribeThread(threadId, meId, meLang);
  }, [threadId, meId, meLang, loadThread]);

  // Deep link or reload straight into a chat: the thread list (and so the header) isn't loaded yet.
  const haveThread = Boolean(thread);
  useEffect(() => {
    if (meId && !haveThread) loadThreads(meId).catch(() => {});
  }, [meId, haveThread, loadThreads]);

  const positions = useMemo(() => groupPositions(messages), [messages]);
  const reversed = useMemo(() => [...messages].reverse(), [messages]);

  const sendText = useCallback(
    async (text: string) => {
      if (!me) return;
      upsertMessage(await api.sendText(threadId, me.id, text));
    },
    [me, threadId, upsertMessage],
  );
  const sendVoice = useCallback(
    async (uri: string) => {
      if (!me) return;
      upsertMessage(await api.sendVoice(threadId, await voiceForm(uri, me.id)));
    },
    [me, threadId, upsertMessage],
  );

  if (!me) return <Redirect href="/" />;
  const other = thread?.members.find((m) => m.id !== me.id);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/chats'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={28} color={colors.bubbleSentTop} />
        </Pressable>
        {other && <Avatar id={other.id} name={other.displayName} size={36} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{other?.displayName ?? ''}</Text>
          <Text style={styles.active}>Active now</Text>
        </View>
      </View>
      {loadError && <Text style={styles.error}>Couldn't load this chat: {loadError}</Text>}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={reversed}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <PlainMessage
              m={item}
              mine={item.senderId === me.id}
              pos={positions.get(item.id) ?? { first: true, last: true }}
              viewerLang={me.language}
            />
          )}
        />
        <Composer onSendText={sendText} onSendVoice={sendVoice} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  name: { fontSize: 16, fontFamily: fonts.semibold, color: colors.textPrimary },
  active: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary },
  error: { padding: 12, color: colors.danger, fontFamily: fonts.regular },
});
