import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Copy server/.env.example to server/.env and fill it in.`);
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  // whisper-1 returns word-level timestamps (needed for karaoke highlighting later).
  OPENAI_STT_MODEL: process.env.OPENAI_STT_MODEL ?? 'whisper-1',
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE ?? 'alloy',
  AUDIO_BUCKET: process.env.AUDIO_BUCKET ?? 'audio',
};
