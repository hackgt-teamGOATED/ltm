import { type Lang, renderPlan } from '@heirloom/learner';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import type { Message, MessageAnalysis } from '../api/types';
import { usePlayer } from '../audio/player';
import { logEvents } from '../learning/eventQueue';
import { guessOptions, showTranslationEvents, tapEventType } from '../learning/logic';
import type { LanguageView } from '../learning/useLanguageView';
import { DISSOLVE_MS, masteryKey, useLearner } from '../store/learner';
import { useSelection } from '../store/selection';
import { colors, fonts } from '../theme/tokens';
import { Bubble, type GroupPos, StatusLine } from './MessageBubble';
import { LangSection, SectionDivider } from './LangSection';
import { PlainMessage } from './PlainMessage';
import { TranscriptBox } from './TranscriptBox';
import { TranslationText } from './TranslationText';
import { VoicePlayer } from './VoicePlayer';
import { WordCard } from './WordCard';

interface Props {
  m: Message;
  pos: GroupPos;
  analysis: MessageAnalysis | undefined;
  view: LanguageView;
  viewerLang: string;
  profileId: string;
  now: number;
  /** The server will still analyze this message (show "annotating…" while it's missing). */
  analyzable: boolean;
  /** Glosses from this chat, for the distractors of in-chat guesses. */
  guessPool: string[];
  /** Replaying history (demo slider): render only, never log. */
  readOnly?: boolean;
}

const NO_LEMMAS: ReadonlySet<string> = new Set();

/**
 * A received message in a chat where Heirloom is on (PLAN.md §7.4–§7.5). The layout follows the learner's
 * stage in this language (never per bubble):
 * Every layout puts the original first (its own voice note + tappable text, labeled), then the translation as a
 * second labeled section (its own voice note + text, and the word card with idioms and context):
 *   Listener    both sections shown
 *   Reader      translation collapsed behind "Show translation"
 *   Conversant  original only; long-press the bubble for the translation
 *   Fluent      original only; long-press stays as the safety net
 * Every interaction becomes a learning event (PLAN.md §8.3), applied locally at once and synced.
 */
export function HeirloomMessage(props: Props) {
  const { m, pos, analysis, view, viewerLang, profileId, now, analyzable, guessPool, readOnly } = props;
  const selection = useSelection((s) => (s.selected?.messageId === m.id ? s.selected : null));
  const select = useSelection((s) => s.select);
  const markTap = useLearner((s) => s.markTap);
  const read = useLearner((s) => s.reads[m.id]);
  const justMastered = useLearner((s) => s.justMastered[masteryKey(profileId, m.originalLanguage)]);
  const [showTranslation, setShowTranslation] = useState(false);
  const [answered, setAnswered] = useState<string | null>(null); // `${messageId}:${tokenIndex}` of the last guess
  const speaking = usePlayer((s) => {
    if (s.key !== `${m.id}:original` || !s.playing || !analysis) return null;
    const t = analysis.tokens.find((x) => x.start !== undefined && x.end !== undefined && s.position >= x.start && s.position < x.end);
    return t ? t.i : null;
  });
  const plan = useMemo(
    () => (analysis ? renderPlan(analysis.tokens, view.mastery, now, view.stage).tokens : null),
    [analysis, view.mastery, view.stage, now],
  );
  // Words in this message that became mastered in the last 1.2 s: their gloss dissolves.
  const [tick, setTick] = useState(0); // re-render once the moment is over, so the pill unmounts
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick re-evaluates the time window
  const dissolving = useMemo(() => {
    if (!analysis || !justMastered) return NO_LEMMAS;
    const t = Date.now();
    return new Set(analysis.tokens.map((x) => x.lemma).filter((l) => justMastered[l] && t - justMastered[l] < DISSOLVE_MS));
  }, [analysis, justMastered, tick]);
  useEffect(() => {
    if (!dissolving.size) return;
    const timer = setTimeout(() => setTick((n) => n + 1), DISSOLVE_MS + 50);
    return () => clearTimeout(timer);
  }, [dissolving]);

  // Collapse the translation again when the stage changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the stage is the trigger
  useEffect(() => setShowTranslation(false), [view.stage]);

  if (!analysis || analysis.failed || !analysis.tokens.length || !plan) {
    return (
      <>
        <PlainMessage m={m} mine={false} pos={pos} viewerLang={viewerLang} />
        {m.status === 'ready' && !analysis && analyzable && <Text style={styles.pending}>✦ annotating…</Text>}
      </>
    );
  }

  const lang = m.originalLanguage as Lang;
  const ctx = { messageId: m.id, threadId: m.threadId, lang };
  const log = (events: Parameters<typeof logEvents>[1]) => !readOnly && logEvents(profileId, events);
  // Replay (the demo slider) and the fixtures page render only: they must not touch read state either.
  const tap = (messageId: string, lemma: string) => !readOnly && markTap(messageId, lemma);
  const selected = selection?.tokenIndex ?? null;
  // While guessing, highlighting the matching translation words would give the answer away.
  const guessing = Boolean(selection?.guess) && answered !== `${selection?.messageId}:${selection?.tokenIndex}`;

  const tapOriginal = (i: number) => {
    const t = analysis.tokens[i];
    const p = plan[i];
    if (!t || !p) return;
    if (selected === i) return select(null);
    if (p.challenge && !readOnly) return select({ messageId: m.id, tokenIndex: i, guess: true });
    log([{ ...ctx, lemma: t.lemma, form: t.surface.toLowerCase(), type: tapEventType(p.status), at: Date.now() }]);
    tap(m.id, t.lemma);
    select({ messageId: m.id, tokenIndex: i });
  };
  const tapTranslation = (i: number) => {
    const t = analysis.tokens[i];
    if (!t) return;
    if (selected === i) return select(null);
    log([{ ...ctx, lemma: t.lemma, type: 'tap_explore', at: Date.now() }]); // curiosity is never penalized
    select({ messageId: m.id, tokenIndex: i });
  };
  const revealTranslation = () => {
    if (showTranslation) return setShowTranslation(false);
    log(showTranslationEvents(analysis.tokens, plan, { ...ctx, at: Date.now() }));
    tap(m.id, '');
    setShowTranslation(true);
  };

  const listener = view.stage === 'listener';
  const reader = view.stage === 'reader';
  const longPressOnly = view.stage === 'conversant' || view.stage === 'fluent';
  const translatedAudio = m.translations.find((t) => t.language === viewerLang)?.audioUrl ?? null;
  const readAlone = !listener && read?.viewed && read.taps === 0;
  const t = selected !== null ? analysis.tokens[selected] : undefined;

  const translation = (
    <TranslationText
      analysis={analysis}
      viewerLang={viewerLang}
      selected={guessing ? null : selected}
      onPressToken={tapTranslation}
      onSent={false}
      style={listener ? undefined : styles.secondary}
    />
  );
  const original = (
    <TranscriptBox
      analysis={analysis}
      lang={lang}
      plan={plan}
      selected={selected}
      speaking={speaking}
      onPressToken={tapOriginal}
      onSent={false}
      size={16}
      dissolving={dissolving}
    />
  );

  const translationVisible = listener || showTranslation;
  const wordCard =
    selection && t ? (
              <WordCard
                key={`${m.id}:${selected}:${selection.guess ? 'g' : 'c'}`}
                analysis={analysis}
                tokenIndex={selection.tokenIndex}
                lang={lang}
                viewerLang={viewerLang}
                profileId={profileId}
                audioUrl={m.audioUrl}
                onSelect={tapTranslation}
                onClose={() => select(null)}
                onHear={() => log([{ ...ctx, lemma: t.lemma, type: 'audio_play', at: Date.now() }])}
                guess={
                  selection.guess
                    ? {
                        options: guessOptions(t.gloss, guessPool, `${m.id}:${t.lemma}`),
                        onAnswer: (correct) => {
                          log([
                            {
                              ...ctx,
                              lemma: t.lemma,
                              form: t.surface.toLowerCase(),
                              type: correct ? 'guess_correct' : 'guess_wrong',
                              options: 4,
                              at: Date.now(),
                            },
                          ]);
                          tap(m.id, t.lemma);
                          setAnswered(`${m.id}:${selection.tokenIndex}`);
                        },
                      }
                    : undefined
                }
              />
            ) : null;

  return (
    <View>
      {dissolving.size > 0 && <KnowThisNow />}
      <Bubble
        mine={false}
        pos={pos}
        heirloom
        onPress={() => select(null)}
        onLongPress={longPressOnly ? revealTranslation : undefined}
      >
        <LangSection kind="Original" lang={lang}>
          {m.kind === 'voice' && <VoicePlayer messageId={m.id} onSent={false} source="original" url={m.audioUrl} />}
          {original}
        </LangSection>
        {reader && (
          <Text onPress={revealTranslation} style={styles.toggle} suppressHighlighting>
            {showTranslation ? 'Hide translation' : 'Show translation'}
          </Text>
        )}
        {translationVisible && (
          <>
            <SectionDivider />
            <LangSection kind="Translation" lang={viewerLang}>
              {m.kind === 'voice' && (
                <VoicePlayer messageId={m.id} onSent={false} source="translated" url={translatedAudio} pending={!translatedAudio && m.status === 'processing'} />
              )}
              {translation}
              {wordCard}
            </LangSection>
          </>
        )}
        {!translationVisible && wordCard}
        {readAlone && <Text style={styles.readAlone}>✦ Read on your own</Text>}
        <StatusLine m={m} mine={false} />
      </Bubble>
    </View>
  );
}

/** "You know this now": a small gold pill that rises and fades over 1.2 s (PLAN.md §7.4). */
function KnowThisNow() {
  const o = useSharedValue(0);
  const y = useSharedValue(6);
  useEffect(() => {
    o.value = withTiming(1, { duration: 200 });
    y.value = withTiming(0, { duration: 200 });
    o.value = withDelay(DISSOLVE_MS - 300, withTiming(0, { duration: 300 }));
  }, [o, y]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[styles.pill, style]} pointerEvents="none">
      <Text style={styles.pillText}>✦ You know this now</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: 6, backgroundColor: colors.divider },
  secondary: { fontSize: 14, color: '#3A3B3C' },
  toggle: { marginTop: 6, fontSize: 12, fontFamily: fonts.semibold, color: colors.heirloom },
  pending: { marginLeft: 16, marginTop: 2, fontSize: 11, fontFamily: fonts.medium, color: colors.heirloom },
  readAlone: { marginTop: 3, marginLeft: 4, fontSize: 11, fontFamily: fonts.semibold, color: colors.heirloom },
  pill: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.heirloom,
  },
  pillText: { color: colors.textOnSent, fontSize: 12, fontFamily: fonts.semibold },
});
