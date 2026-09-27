import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View, type ViewToken } from 'react-native';
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
import { type Lang, renderPlan, type Stage, status } from '@heirloom/learner';
import { StageUpCard } from '../../src/components/StageUpCard';
import { logEvents } from '../../src/learning/eventQueue';
import { annotatableIds, isStageUp, recentLemmas, VIEW_MS, viewEvents } from '../../src/learning/logic';
import { useLanguageView } from '../../src/learning/useLanguageView';
import { stageKey, subscribeMastery, useLearner } from '../../src/store/learner';
import { useSelection } from '../../src/store/selection';
import { useSheet } from '../../src/store/sheet';
import { DemoPanel } from '../../src/components/DemoPanel';
import { demoMastery, demoNow, demoStages, useDemo } from '../../src/store/demo';
import { useMe } from '../../src/store/session';
import { subscribeThread, useThreads } from '../../src/store/threads';
import { dividerLabel, needsDivider } from '../../src/lib/format';
import { colors, fonts, type } from '../../src/theme/tokens';

const GROUP_GAP_MS = 5 * 60_000;
/** Last stage announced per profile+language (the first one seen is the baseline, not a stage-up). */
const announcedStages = new Map<string, Stage>();
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
  const { threadId, demo: demoParam } = useLocalSearchParams<{ threadId: string; demo?: string }>();
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
  const demoActive = useDemo((s) => s.active);
  const demoWeek = useDemo((s) => s.week);
  const demoWeeks = useDemo((s) => s.weeks);
  const demoEvents = useDemo((s) => s.events);
  const openDemo = useDemo((s) => s.open);
  const closeDemo = useDemo((s) => s.close);
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
  // Time travel (PLAN.md §9.2): the chosen week's cut-off becomes the clock, and mastery is replayed
  // from the event log into a throwaway snapshot. Messages don't change, only how they render.
  const replaying = demoActive && demoWeek !== null;
  const renderNow = demoActive ? demoNow(demoWeek, demoWeeks, now) : now;
  const replayed = useMemo(
    () => (replaying ? demoMastery(demoWeek, demoWeeks, demoEvents, learning) : undefined),
    [replaying, demoWeek, demoWeeks, demoEvents, learning],
  );
  const override = useMemo(() => (replayed ? { mastery: replayed, stages: demoStages } : undefined), [replayed]);
  const view = useLanguageView(learning, messages, analyses, meId ?? '', renderNow, override);
  // Distractors for in-chat guesses: every gloss seen in this chat.
  const guessPool = useMemo(
    () => [...new Set(Object.values(analyses ?? {}).flatMap((a) => a.tokens.filter((t) => !t.isPunct).map((t) => t.gloss)))],
    [analyses],
  );

  // Stage-up card: the first stage seen per profile+language is the baseline; any later rise is announced.
  const [stageUp, setStageUp] = useState<Stage | null>(null);
  useEffect(() => {
    if (!learning || !meId || !analyses || demoActive) return; // replay never announces a stage-up
    const key = stageKey(meId, learning);
    const before = announcedStages.get(key);
    announcedStages.set(key, view.stage);
    if (isStageUp(before, view.stage)) setStageUp(view.stage);
  }, [view.stage, learning, meId, analyses, demoActive]);

  // A received message on screen for ≥ 2.5 s is a view (PLAN.md §8.3): log it once per session.
  const latest = useRef({ learning, analyses, meId, view, demoActive });
  latest.current = { learning, analyses, meId, view, demoActive };
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Message>[] }) => {
    const L = latest.current;
    if (!L.learning || !L.meId || L.demoActive) return;
    for (const v of viewableItems) {
      const m = v.item;
      if (!m || m.senderId === L.meId || m.originalLanguage !== L.learning) continue;
      const a = L.analyses?.[m.id];
      const read = useLearner.getState().reads[m.id];
      if (!a || a.failed || read?.viewed) continue;
      const at = Date.now();
      const plan = renderPlan(a.tokens, L.view.mastery, at, L.view.stage).tokens;
      const ctx = { messageId: m.id, threadId: m.threadId, lang: m.originalLanguage as Lang, at };
      logEvents(L.meId, viewEvents(a.tokens, plan, new Set(read?.tapped ?? []), ctx));
      useLearner.getState().markViewed(m.id);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60, minimumViewTime: VIEW_MS }).current;

  const analyzable = useMemo(
    () => (learning && meId ? annotatableIds(messages, meId, learning, renderNow) : new Set<string>()),
    [messages, meId, learning, renderNow],
  );

  // Mastered / tracked words in this chat, for the demo readout (follows the slider through `view`).
  const trackedLemmas = useMemo(
    () => (learning ? recentLemmas(messages, analyses, meId ?? '', learning) : []),
    [messages, analyses, meId, learning],
  );
  const masteredCount = useMemo(
    () => new Set(trackedLemmas.filter((l) => status(view.mastery[l], renderNow) === 'mastered')).size,
    [trackedLemmas, view.mastery, renderNow],
  );

  const showDemo = useCallback(() => {
    if (meId) openDemo(meId);
  }, [meId, openDemo]);
  // `?demo=1` opens it without the long-press (handy on a laptop while filming).
  useEffect(() => {
    if (demoParam === '1' && meId && !demoActive) openDemo(meId);
  }, [demoParam, meId, demoActive, openDemo]);
  // Leaving the chat must not strand the app in replay.
  useEffect(() => () => closeDemo(), [closeDemo]);

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
        {other && <Avatar id={other.id} name={other.displayName} size={40} />}
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
          onLongPress={showDemo}
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
      {demoActive && (
        <DemoPanel
          lang={learning}
          stage={view.stage}
          fadePct={view.fadePct}
          mastered={masteredCount}
          tracked={new Set(trackedLemmas).size}
        />
      )}
      {stageUp && learning && !demoActive && (
        <StageUpCard stage={stageUp} lang={learning} onDone={() => setStageUp(null)} />
      )}
      {loadError && <Text style={styles.error}>Couldn't load this chat: {loadError}</Text>}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={reversed}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          extraData={view}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          renderItem={({ item, index }) => {
            const pos = positions.get(item.id) ?? { first: true, last: true };
            const mine = item.senderId === me.id;
            // Heirloom annotates only what I receive in the language I'm learning here.
            const divider = needsDivider(reversed[index + 1]?.createdAt, item.createdAt) ? (
              <Text style={styles.divider}>{dividerLabel(item.createdAt)}</Text>
            ) : null;
            if (!mine && learning && item.originalLanguage === learning) {
              return (
                <View>
                  {divider}
                  <HeirloomMessage
                  m={item}
                  pos={pos}
                  analysis={analyses?.[item.id]}
                  view={view}
                  viewerLang={me.language}
                  profileId={me.id}
                  now={renderNow}
                  analyzable={analyzable.has(item.id)}
                  guessPool={guessPool}
                  readOnly={demoActive}
                  />
                </View>
              );
            }
            return (
              <View>
                {divider}
                <PlainMessage m={item} mine={mine} pos={pos} viewerLang={me.language} />
              </View>
            );
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
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  name: { fontSize: type.body, fontFamily: fonts.semibold, letterSpacing: type.headingSpacing, color: colors.textPrimary },
  active: { fontSize: type.meta, fontFamily: fonts.regular, color: colors.textTertiary },
  divider: { alignSelf: 'center', marginTop: 16, marginBottom: 4, fontSize: type.caption, fontFamily: fonts.medium, color: colors.textTertiary },
  error: { padding: 12, color: colors.danger, fontFamily: fonts.regular },
});
