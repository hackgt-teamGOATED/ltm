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

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text: string, lang: string) {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LOCALES[lang] ?? lang;
  window.speechSynthesis.speak(utterance);
}
