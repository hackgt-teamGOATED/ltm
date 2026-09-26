import { useState } from 'react';
import { canSpeak, langName, speak } from '../lang';
import type { Message, Profile } from '../types';

type Props = { message: Message; me: Profile; members: Map<string, Profile> };

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function MessageBubble({ message, me, members }: Props) {
  const [showOther, setShowOther] = useState(false);
  const [speech, setSpeech] = useState<'idle' | 'loading' | 'error'>('idle');
  const mine = message.senderId === me.id;
  const sameLanguage = message.originalLanguage === me.language;
  const mineTranslation = message.translations.find((t) => t.language === me.language);

  // What this reader sees first: their own words if they sent it, otherwise the version in their language.
  const useTranslation = !mine && !sameLanguage && Boolean(mineTranslation);
  const primaryText = useTranslation ? mineTranslation!.text : message.originalText;
  const primaryLang = useTranslation ? me.language : message.originalLanguage;
  const primaryAudio = useTranslation ? mineTranslation!.audioUrl : message.audioUrl;

  // Incoming: the original. Outgoing: what each recipient received (the "reverse" view).
  const hasOther = mine ? message.translations.length > 0 : !sameLanguage && Boolean(message.originalText);
  const otherLabel = mine ? 'What they see' : `Original ${langName(message.originalLanguage)}`;

  const processingLabel = message.kind === 'voice' ? 'Transcribing and translating…' : 'Translating…';
  const recipientName = (lang: string) =>
    [...members.values()]
      .filter((m) => m.id !== me.id && m.language === lang)
      .map((m) => m.displayName)
      .join(', ') || langName(lang);

  // Languages the browser has no voice for fall back to the server's TTS, which takes a moment.
  async function readAloud() {
    if (!primaryText) return;
    setSpeech('loading');
    try {
      await speak(primaryText, primaryLang);
      setSpeech('idle');
    } catch {
      setSpeech('error');
    }
  }

  return (
    <article className={`bubble ${mine ? 'mine' : 'theirs'}`}>
      {message.kind === 'voice' && primaryAudio && (
        <audio className="voice" controls preload="none" src={primaryAudio} />
      )}

      {primaryText ? (
        <p className="text" lang={primaryLang} dir="auto">{primaryText}</p>
      ) : (
        message.status !== 'failed' && <p className="status">{processingLabel}</p>
      )}

      {message.status === 'processing' && primaryText && !mine && !sameLanguage && !mineTranslation && (
        <p className="status">{processingLabel}</p>
      )}
      {message.status === 'failed' && (
        <p className="status error">
          {message.kind === 'voice' && !message.originalText
            ? "Couldn't understand this voice note."
            : "Couldn't translate this message."}
        </p>
      )}

      <footer className="bubble-footer">
        <time dateTime={message.createdAt}>{timeFormat.format(new Date(message.createdAt))}</time>
        {message.kind === 'text' && primaryText && canSpeak() && (
          <button className="link-button" onClick={() => void readAloud()} disabled={speech === 'loading'}>
            {speech === 'loading' ? 'Loading…' : speech === 'error' ? "Couldn't read aloud" : 'Read aloud'}
          </button>
        )}
        {hasOther && (
          <button className="link-button" onClick={() => setShowOther((v) => !v)} aria-expanded={showOther}>
            {showOther ? 'Hide' : otherLabel}
          </button>
        )}
      </footer>

      {showOther && (
        <div className="alt">
          {mine ? (
            message.translations.map((t) => (
              <div key={t.language} className="alt-item">
                <p className="alt-label">{recipientName(t.language)} sees</p>
                <p lang={t.language} dir="auto">{t.text}</p>
                {t.audioUrl && <audio className="voice" controls preload="none" src={t.audioUrl} />}
              </div>
            ))
          ) : (
            <div className="alt-item">
              <p lang={message.originalLanguage} dir="auto">{message.originalText}</p>
              {message.kind === 'voice' && message.audioUrl && (
                <audio className="voice" controls preload="none" src={message.audioUrl} />
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
