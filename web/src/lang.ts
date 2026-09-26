import { api } from './api';

const NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', es: 'Spanish', bn: 'Bengali', ur: 'Urdu', pa: 'Punjabi',
  gu: 'Gujarati', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', mr: 'Marathi', zh: 'Chinese',
  vi: 'Vietnamese', ko: 'Korean', ja: 'Japanese', ar: 'Arabic', fr: 'French',
  pt: 'Portuguese', tl: 'Tagalog', yo: 'Yoruba', am: 'Amharic',
};

// Locales for the browser's speech engine (text read-aloud).
const SPEECH_LOCALES: Record<string, string> = {
  en: 'en-US', hi: 'hi-IN', es: 'es-ES', bn: 'bn-IN', ur: 'ur-PK', pa: 'pa-IN', gu: 'gu-IN',
  ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN', mr: 'mr-IN', zh: 'zh-CN', vi: 'vi-VN', ko: 'ko-KR',
  ja: 'ja-JP', ar: 'ar-SA', fr: 'fr-FR', pt: 'pt-BR', tl: 'fil-PH',
};

export const langName = (code: string) => NAMES[code] ?? code;

// Either path works in a browser: an installed voice, or the server's TTS.
export const canSpeak = () => typeof window !== 'undefined';

const hasSynthesis = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// Chrome populates getVoices() asynchronously, so an early call sees an empty list and
// would wrongly conclude the language has no voice. Wait once for it to fill.
let voicesLoaded: Promise<void> | null = null;
function loadVoices(): Promise<void> {
  if (!hasSynthesis()) return Promise.resolve();
  if (!voicesLoaded) {
    voicesLoaded = new Promise((resolve) => {
      if (window.speechSynthesis.getVoices().length) return resolve();
      const done = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', done);
        resolve();
      };
      window.speechSynthesis.addEventListener('voiceschanged', done);
      setTimeout(done, 1000); // some browsers never fire the event
    });
  }
  return voicesLoaded;
}

// Match on the primary subtag only: an 'hi-IN' voice can read 'hi'.
const baseTag = (tag: string) => tag.toLowerCase().replace(/_/g, '-').split('-')[0];

function localVoice(lang: string): SpeechSynthesisVoice | null {
  if (!hasSynthesis()) return null;
  const want = baseTag(lang);
  return window.speechSynthesis.getVoices().find((v) => baseTag(v.lang) === want) ?? null;
}

// The server's mp3 for a given phrase never changes, so reuse it across taps.
const audioCache = new Map<string, string>();
let playing: HTMLAudioElement | null = null;

export function stopSpeaking() {
  if (hasSynthesis()) window.speechSynthesis.cancel();
  playing?.pause();
  playing = null;
}

export async function speak(text: string, lang: string): Promise<void> {
  if (!canSpeak()) return;
  stopSpeaking();
  await loadVoices();

  const voice = localVoice(lang);
  if (voice) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = SPEECH_LOCALES[lang] ?? lang;
    window.speechSynthesis.speak(utterance);
    return;
  }

  // No installed voice for this language (Urdu on macOS, for example). The browser would
  // silently fall back to a voice that can't pronounce the script, so use the server's TTS.
  const key = `${lang}:${text}`;
  let url = audioCache.get(key);
  if (!url) {
    url = URL.createObjectURL(await api.speech(text, lang));
    audioCache.set(key, url);
  }
  const audio = new Audio(url);
  playing = audio;
  await audio.play();
}
