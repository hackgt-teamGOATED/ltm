import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoiceRecorder } from '../audio/recorder';
import { colors, fonts } from '../theme/tokens';

interface Props {
  onSendText: (text: string) => Promise<void>;
  onSendVoice: (uri: string) => Promise<void>;
}

export function Composer({ onSendText, onSendVoice }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useVoiceRecorder();
  const insets = useSafeAreaInsets();
  const recording = rec.phase === 'recording';

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendText(t);
      setText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const toggleRecording = async () => {
    if (rec.phase === 'idle') return rec.start();
    if (!recording) return;
    const uri = await rec.stop();
    if (!uri) return;
    setSending(true);
    setError(null);
    try {
      await onSendVoice(uri);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const err = error ?? rec.error;
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {err && <Text style={styles.error}>{err}</Text>}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={recording ? 'Stop and send voice note' : 'Record a voice note'}
          onPress={toggleRecording}
          style={[styles.mic, recording && { backgroundColor: colors.danger }]}
        >
          {rec.phase === 'starting' || rec.phase === 'stopping' ? (
            <ActivityIndicator size="small" color={colors.bubbleSentTop} />
          ) : (
            <Ionicons name={recording ? 'stop' : 'mic'} size={22} color={recording ? '#fff' : colors.bubbleSentTop} />
          )}
        </Pressable>
        {recording ? (
          <Text style={styles.recording}>● Recording {rec.seconds}s: tap ■ to send</Text>
        ) : (
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={send}
            returnKeyType="send"
            submitBehavior="submit"
            multiline={false}
          />
        )}
        {!recording && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={send}
            disabled={!text.trim() || sending}
            style={styles.send}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.bubbleSentTop} />
            ) : (
              <Ionicons name="send" size={22} color={text.trim() ? colors.bubbleSentTop : colors.hairline} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mic: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.surface,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  recording: { flex: 1, color: colors.danger, fontFamily: fonts.medium, fontSize: 15 },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, paddingHorizontal: 8, paddingBottom: 4 },
});
