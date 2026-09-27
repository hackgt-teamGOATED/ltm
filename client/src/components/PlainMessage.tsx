import { StyleSheet, Text } from 'react-native';
import type { Message } from '../api/types';
import { Bubble, bubbleText, type GroupPos, plainText, StatusLine } from './MessageBubble';
import { LangSection, SectionDivider } from './LangSection';
import { VoicePlayer } from './VoicePlayer';

/**
 * A message with Heirloom off: a normal translated chat (US-1, US-10). A received translated message shows both
 * halves, each labeled with its language and with its own voice note: the original, then the translation.
 */
export function PlainMessage({ m, mine, pos, viewerLang }: { m: Message; mine: boolean; pos: GroupPos; viewerLang: string }) {
  const { main, mainLang, secondary } = plainText(m, viewerLang, mine);
  const translatedAudio = m.translations.find((t) => t.language === viewerLang)?.audioUrl ?? null;
  const voice = m.kind === 'voice';
  const translatedText = !!main && (
    <Text style={[bubbleText(mine, mainLang), voice && styles.transcript]}>{main}</Text>
  );

  if (!mine && secondary) {
    return (
      <Bubble mine={false} pos={pos}>
        <LangSection kind="Original" lang={m.originalLanguage}>
          {voice && <VoicePlayer messageId={m.id} onSent={false} source="original" url={m.audioUrl} />}
          <Text style={bubbleText(false, m.originalLanguage)}>{secondary}</Text>
        </LangSection>
        <SectionDivider />
        <LangSection kind="Translation" lang={viewerLang}>
          {voice && <VoicePlayer messageId={m.id} onSent={false} source="translated" url={translatedAudio} pending={!translatedAudio && m.status === 'processing'} />}
          {translatedText}
        </LangSection>
        <StatusLine m={m} mine={false} />
      </Bubble>
    );
  }

  return (
    <Bubble mine={mine} pos={pos}>
      {voice && (
        <VoicePlayer messageId={m.id} onSent={mine} source="original" url={m.audioUrl} pending={m.status === 'processing' && !mine} />
      )}
      {translatedText}
      <StatusLine m={m} mine={mine} />
    </Bubble>
  );
}

const styles = StyleSheet.create({
  transcript: { marginTop: 6 },
});
