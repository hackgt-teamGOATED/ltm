import { useRef, useState, type KeyboardEvent } from 'react';

type Props = {
  placeholder: string;
  onSendText: (text: string) => Promise<unknown>;
  onSendVoice: (audio: Blob) => Promise<unknown>;
};

const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];

export function Composer({ placeholder, onSendText, onSendVoice }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function sendText() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    try {
      await onSendText(value);
      setText('');
    } catch (e) {
      setError(`Message not sent: ${(e as Error).message}`);
    } finally {
      setSending(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access is blocked. Allow it in your browser settings to send voice notes.');
      return;
    }
    const mimeType = PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const audio = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
      if (audio.size < 2000) return; // ignore accidental taps
      setSending(true);
      try {
        await onSendVoice(audio);
      } catch (e) {
        setError(`Voice note not sent: ${(e as Error).message}`);
      } finally {
        setSending(false);
      }
    };
    rec.start();
    recorder.current = rec;
    setRecording(true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendText();
    }
  }

  return (
    <div className="composer">
      {error && <p className="composer-error" role="alert">{error}</p>}
      <div className="composer-row">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={recording ? 'Recording… tap Stop to send' : placeholder}
          aria-label="Message"
          disabled={recording}
        />
        {text.trim() ? (
          <button className="primary" onClick={() => void sendText()} disabled={sending}>
            Send
          </button>
        ) : (
          <button
            className={`record ${recording ? 'on' : ''}`}
            onClick={() => void toggleRecording()}
            disabled={sending}
            aria-pressed={recording}
          >
            {recording ? 'Stop' : 'Record'}
          </button>
        )}
      </div>
    </div>
  );
}
