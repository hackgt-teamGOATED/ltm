// Native voice-note recording with expo-audio (PLAN.md §7.7): records .m4a (AAC), which Whisper accepts.
// The web build uses recorder.web.ts (MediaRecorder) instead. Neither has been verified on a real phone
// yet: the Phase 0 iPhone spike is still open (D-025).
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useState } from 'react';

import type { RecorderPhase } from './recorderTypes';

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  /** Must be called from a tap: iOS only shows the mic prompt in response to a user gesture. */
  const start = useCallback(async () => {
    setError(null);
    setPhase('starting');
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('Microphone permission was denied');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (e) {
      setError((e as Error).message);
      setPhase('idle');
    }
  }, [recorder]);

  /** Stops (which also releases the mic tracks) and returns the recording's URI. */
  const stop = useCallback(async (): Promise<string | null> => {
    setPhase('stopping');
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      return recorder.uri;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setPhase('idle');
    }
  }, [recorder]);

  return { phase, error, seconds: Math.floor((state.durationMillis ?? 0) / 1000), start, stop };
}
