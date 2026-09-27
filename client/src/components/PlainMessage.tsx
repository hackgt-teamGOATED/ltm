import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { Message } from '../api/types';
import { colors, fonts } from '../theme/tokens';
import { Bubble, bubbleText, type GroupPos, plainText, StatusLine } from './MessageBubble';
import { type VoiceSource, VoicePlayer } from './VoicePlayer';

/** A message with Heirloom off: a normal translated chat (US-1, US-10). */
export function PlainMessage({ m, mine, pos, viewerLang }: { m: Message; mine: boolean; pos: GroupPos; viewerLang: string }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [source, setSource] = useState<VoiceSource>(mine ? 'original' : 'translated');
  const { main, mainLang, secondary } = plainText(m, viewerLang, mine);
  const translatedAudio = m.translations.find((t) => t.language === viewerLang)?.audioUrl ?? null;

  return (
    <Bubble mine={mine} pos={pos}>
      {m.kind === 'voice' && (
        <VoicePlayer
          messageId={m.id}
          onSent={mine}
          source={source}
          onSourceChange={mine ? undefined : setSource}
          urls={{ translated: mine ? null : translatedAudio, original: m.audioUrl }}
          pending={m.status === 'processing' && !mine}
        />
      )}
      {!!main && <Text style={[bubbleText(mine, mainLang), m.kind === 'voice' && styles.transcript]}>{main}</Text>}
      {secondary && showOriginal && <Text style={[bubbleText(mine, m.originalLanguage), styles.original]}>{secondary}</Text>}
      {secondary && (
        <Pressable onPress={() => setShowOriginal((v) => !v)} hitSlop={6} accessibilityRole="button">
          <Text style={styles.link}>{showOriginal ? 'Hide original' : 'See original'}</Text>
        </Pressable>
      )}
      <StatusLine m={m} mine={mine} />
    </Bubble>
  );
}

const styles = StyleSheet.create({
  transcript: { marginTop: 6 },
  original: { marginTop: 4, opacity: 0.75, fontSize: 14 },
  link: { marginTop: 4, fontSize: 12, fontFamily: fonts.semibold, color: colors.textSecondary },
});
