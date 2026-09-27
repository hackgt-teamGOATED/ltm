// Web voice-note recorder (PLAN.md §7.7, §7.8): MediaRecorder directly, so we control the format.
// Prefers audio/mp4 (what iOS Safari produces; Whisper accepts it) and falls back to WebM/Opus (Chrome,
// Firefox). Same interface as the native recorder.ts. Recording on iOS Safari is UNVERIFIED until the
// Phase 0 spike passes on a real iPhone (D-025).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecorderPhase } from './recorderTypes';

const PREFERRED_TYPES = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm'];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useVoiceRecorder() {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop(); // turns the mic indicator off
    stream.current = null;
    recorder.current = null;
  }, []);

  useEffect(() => release, [release]);

  /** Must be called from a tap: iOS only shows the mic prompt in response to a user gesture. */
  const start = useCallback(async () => {
    setError(null);
    setPhase('starting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Recording needs HTTPS (or localhost) and a browser with microphone support');
      }
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.start(250); // timeslice so data arrives even if stop fires early
      recorder.current = rec;
      const began = Date.now();
      setSeconds(0);
      timer.current = setInterval(() => setSeconds(Math.floor((Date.now() - began) / 1000)), 250);
      setPhase('recording');
    } catch (e) {
      release();
      const err = e as Error;
      setError(err.name === 'NotAllowedError' ? 'Microphone permission was denied' : err.message);
      setPhase('idle');
    }
  }, [release]);

  /** Stops, releases the mic, and returns a blob: URL of the recording (upload.web.ts reads it back). */
  const stop = useCallback(async (): Promise<string | null> => {
    const rec = recorder.current;
    if (!rec) return null;
    setPhase('stopping');
    try {
      const done = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
      });
      rec.stop();
      await done;
      const type = (rec.mimeType || chunks.current[0]?.type || 'audio/mp4').split(';')[0];
      const blob = new Blob(chunks.current, { type });
      if (!blob.size) throw new Error('Nothing was recorded');
      return URL.createObjectURL(blob);
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      release();
      setPhase('idle');
    }
  }, [release]);

  return { phase, error, seconds, start, stop };
}
