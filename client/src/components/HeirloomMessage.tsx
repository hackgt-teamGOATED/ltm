import { renderPlan } from '@heirloom/learner';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Message, MessageAnalysis } from '../api/types';
import { usePlayer } from '../audio/player';
import { voiceSource } from '../learning/logic';
import type { LanguageView } from '../learning/useLanguageView';
import { useSelection } from '../store/selection';
import { colors, fonts } from '../theme/tokens';
import { Bubble, type GroupPos, StatusLine } from './MessageBubble';
import { PlainMessage } from './PlainMessage';
import { TranscriptBox } from './TranscriptBox';
import { TranslationText } from './TranslationText';
import { type VoiceSource, VoicePlayer } from './VoicePlayer';
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
}

/**
 * A received message in a chat where Heirloom is on (PLAN.md §7.4–§7.5). Phase 4 renders the Listener
 * layout: translation first (tappable), the original underneath with every word tappable and hints from the
 * learner model, and the word card under the bubble. Phase 5 adds the other stage layouts.
 */
export function HeirloomMessage({ m, pos, analysis, view, viewerLang, profileId, now, analyzable }: Props) {
  const selected = useSelection((s) => (s.selected?.messageId === m.id ? s.selected.tokenIndex : null));
  const select = useSelection((s) => s.select);
  // The listener's own pick wins; until then the default follows the stage as mastery loads.
  const [override, setOverride] = useState<VoiceSource | null>(null);
  const source = voiceSource(override, view.stage);
  const originalKey = `${m.id}:original`;
  const speaking = usePlayer((s) => {
    if (s.key !== originalKey || !s.playing || !analysis) return null;
    const t = analysis.tokens.find((x) => x.start !== undefined && x.end !== undefined && s.position >= x.start && s.position < x.end);
    return t ? t.i : null;
  });
  const plan = useMemo(
    () => (analysis ? renderPlan(analysis.tokens, view.mastery, now, view.stage).tokens : null),
    [analysis, view.mastery, view.stage, now],
  );

  // Not annotated yet (or annotation failed): a normal translated bubble, with a quiet gold marker.
  if (!analysis || analysis.failed || !analysis.tokens.length) {
    return (
      <>
        <PlainMessage m={m} mine={false} pos={pos} viewerLang={viewerLang} />
        {m.status === 'ready' && !analysis && analyzable && <Text style={styles.pending}>✦ annotating…</Text>}
      </>
    );
  }

  const translatedAudio = m.translations.find((t) => t.language === viewerLang)?.audioUrl ?? null;
  const toggle = (i: number) => select(selected === i ? null : { messageId: m.id, tokenIndex: i });

  return (
    <Bubble
      mine={false}
      pos={pos}
      heirloom
      onPress={() => select(null)}
      footer={
        selected !== null ? (
          <WordCard
            analysis={analysis}
            tokenIndex={selected}
            lang={m.originalLanguage}
            viewerLang={viewerLang}
            profileId={profileId}
            audioUrl={m.audioUrl}
            onSelect={(i) => select({ messageId: m.id, tokenIndex: i })}
            onClose={() => select(null)}
          />
        ) : null
      }
    >
      {m.kind === 'voice' && (
        <VoicePlayer
          messageId={m.id}
          onSent={false}
          source={source}
          onSourceChange={setOverride}
          urls={{ translated: translatedAudio, original: m.audioUrl }}
        />
      )}
      <TranslationText
        analysis={analysis}
        viewerLang={viewerLang}
        selected={selected}
        onPressToken={toggle}
        onSent={false}
        style={m.kind === 'voice' ? { marginTop: 6 } : undefined}
      />
      <View style={styles.divider} />
      <TranscriptBox
        analysis={analysis}
        lang={m.originalLanguage}
        plan={plan}
        selected={selected}
        speaking={speaking}
        onPressToken={toggle}
        onSent={false}
        size={14}
      />
      <StatusLine m={m} mine={false} />
    </Bubble>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, marginVertical: 6, backgroundColor: 'rgba(0,0,0,0.08)' },
  pending: {
    marginLeft: 16,
    marginTop: 2,
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.heirloom,
  },
});
