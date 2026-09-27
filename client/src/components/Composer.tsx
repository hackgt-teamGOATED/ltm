import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoiceRecorder } from '../audio/recorder';
import { colors, fonts, PRESSED_OPACITY, radius } from '../theme/tokens';

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
  const hasText = text.trim().length > 0;

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
        {recording ? (
          <Text style={styles.recording}>● Recording {rec.seconds}s · tap ■ to send</Text>
        ) : (
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={colors.textTertiary}
            onSubmitEditing={send}
            returnKeyType="send"
            submitBehavior="submit"
            multiline={false}
          />
        )}
        {hasText && !recording ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={send}
            disabled={sending}
            style={({ pressed }) => [styles.action, styles.sendBtn, pressed && styles.pressed]}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? 'Stop and send voice note' : 'Record a voice note'}
            onPress={toggleRecording}
            style={({ pressed }) => [styles.action, recording && { backgroundColor: colors.danger }, pressed && styles.pressed]}
          >
            {rec.phase === 'starting' || rec.phase === 'stopping' || (sending && !hasText) ? (
              <ActivityIndicator size="small" color={colors.bubbleSentTop} />
            ) : (
              <Ionicons name={recording ? 'stop' : 'mic'} size={22} color={recording ? '#fff' : colors.bubbleSentTop} />
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
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.background,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.textPrimary,
  },
  action: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sendBtn: { backgroundColor: colors.bubbleSentTop },
  pressed: { opacity: PRESSED_OPACITY },
  recording: { flex: 1, minHeight: 44, textAlignVertical: 'center', lineHeight: 44, color: colors.danger, fontFamily: fonts.medium, fontSize: 15 },
  error: { color: colors.danger, fontFamily: fonts.regular, fontSize: 13, paddingHorizontal: 8, paddingBottom: 4 },
});
