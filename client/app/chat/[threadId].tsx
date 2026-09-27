import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../src/api/rest';
import type { Message } from '../../src/api/types';
import { voiceForm } from '../../src/audio/upload';
import { Avatar } from '../../src/components/Avatar';
import { Composer } from '../../src/components/Composer';
import type { GroupPos } from '../../src/components/MessageBubble';
import { ChatSettingsSheet } from '../../src/components/ChatSettingsSheet';
import { HeirloomChip } from '../../src/components/HeirloomChip';
import { HeirloomMessage } from '../../src/components/HeirloomMessage';
import { PlainMessage } from '../../src/components/PlainMessage';
import { annotatableIds } from '../../src/learning/logic';
import { useLanguageView } from '../../src/learning/useLanguageView';
import { subscribeMastery, useLearner } from '../../src/store/learner';
import { useSelection } from '../../src/store/selection';
import { useSheet } from '../../src/store/sheet';
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
  const analyses = useThreads((s) => s.analyses[threadId]);
  const settings = useThreads((s) => s.settings[threadId]);
  const loadMastery = useLearner((s) => s.loadMastery);
  const loadAnalyses = useThreads((s) => s.loadAnalyses);
  const openSheet = useSheet((s) => s.open);
  const clearSelection = useSelection((s) => s.select);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The clock the learner model renders against; ticks each minute (Phase 7's slider will override it).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const meId = me?.id;
  const meLang = me?.language;

  useEffect(() => {
    if (!meId || !meLang || !threadId) return;
    setLoadError(null);
    loadThread(threadId, meId, meLang).catch((e) => setLoadError((e as Error).message));
    return subscribeThread(threadId, meId, meLang);
  }, [threadId, meId, meLang, loadThread]);

  const learning = settings?.learningEnabled ? settings.learningLang : null;
  useEffect(() => {
    if (!meId || !learning) return;
    loadMastery(meId, learning).catch(() => {});
    return subscribeMastery(meId);
  }, [meId, learning, loadMastery]);
  // Turning Heirloom on (or switching language) after the chat loaded: cached analyses produce no
  // analysis:ready, so fetch them. On open, loadThread already fetched them.
  const learningAtOpen = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (settings === undefined) return; // settings not loaded yet
    if (learningAtOpen.current === undefined) {
      learningAtOpen.current = learning;
      return;
    }
    if (learning && learning !== learningAtOpen.current && meLang) loadAnalyses(threadId, meLang).catch(() => {});
    learningAtOpen.current = learning;
  }, [settings, learning, meLang, threadId, loadAnalyses]);
  // Opening a chat, or turning Heirloom on/off, starts with no word card open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: threadId and learning are the triggers
  useEffect(() => {
    clearSelection(null);
  }, [threadId, learning, clearSelection]);
  const view = useLanguageView(learning, messages, analyses, meId ?? '', now);
  const analyzable = useMemo(
    () => (learning && meId ? annotatableIds(messages, meId, learning, now) : new Set<string>()),
    [messages, meId, learning, now],
  );

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
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>
            {other?.displayName ?? ''}
          </Text>
          <Text style={styles.active}>Active now</Text>
        </View>
        <HeirloomChip
          enabled={Boolean(learning)}
          lang={learning}
          stage={view.stage}
          fadePct={view.fadePct}
          onPress={() =>
            openSheet(
              <ChatSettingsSheet
                threadId={threadId}
                profileId={me.id}
                myLang={me.language}
                otherName={other?.displayName ?? ''}
                suggestedLang={other?.language ?? 'es'}
              />,
            )
          }
        />
      </View>
      {loadError && <Text style={styles.error}>Couldn't load this chat: {loadError}</Text>}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={reversed}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          extraData={view}
          renderItem={({ item }) => {
            const pos = positions.get(item.id) ?? { first: true, last: true };
            const mine = item.senderId === me.id;
            // Heirloom annotates only what I receive in the language I'm learning here.
            if (!mine && learning && item.originalLanguage === learning) {
              return (
                <HeirloomMessage
                  m={item}
                  pos={pos}
                  analysis={analyses?.[item.id]}
                  view={view}
                  viewerLang={me.language}
                  profileId={me.id}
                  now={now}
                  analyzable={analyzable.has(item.id)}
                />
              );
            }
            return <PlainMessage m={item} mine={mine} pos={pos} viewerLang={me.language} />;
          }}
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
