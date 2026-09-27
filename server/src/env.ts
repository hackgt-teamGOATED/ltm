import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';

// Secrets live OUTSIDE the repo by default so they can't be committed or read by
// coding agents working in the project folder. Lookup order:
//   1. DOTENV_CONFIG_PATH (explicit override)
//   2. ~/.config/heritage-chat/server.env   ← created by scripts/setup.sh
//   3. server/.env                          (legacy fallback, gitignored)
export const ENV_CANDIDATES = [
  process.env.DOTENV_CONFIG_PATH,
  join(homedir(), '.config', 'heritage-chat', 'server.env'),
  join(process.cwd(), '.env'),
].filter((p): p is string => Boolean(p));

export const ENV_FILE = ENV_CANDIDATES.find((p) => existsSync(p)) ?? null;
if (ENV_FILE) config({ path: ENV_FILE, quiet: true });

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Run npm run setup from the repo root to create your local secrets file.`,
    );
  }
  return value;
}

export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  // Dev origins allowed by CORS: the v0 Vite client (5173) and the Expo web dev server (8081).
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? 'http://localhost:5173,http://localhost:8081',
  // Built web client to serve in production, relative to the repo root (e.g. client/dist).
  STATIC_DIR: process.env.STATIC_DIR ?? '',
  // Accept a pasted REST endpoint: strip a trailing /rest/v1 and slashes.
  SUPABASE_URL: required('SUPABASE_URL').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  OPENAI_API_KEY: required('OPENAI_API_KEY'),
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  // whisper-1 returns word-level timestamps (needed for karaoke highlighting later).
  OPENAI_STT_MODEL: process.env.OPENAI_STT_MODEL ?? 'whisper-1',
  // Structured word-by-word analysis for the learning layer (PLAN.md §6.2).
  OPENAI_ANALYZE_MODEL: process.env.OPENAI_ANALYZE_MODEL ?? 'gpt-4o-mini',
  OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
  OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE ?? 'alloy',
  AUDIO_BUCKET: process.env.AUDIO_BUCKET ?? 'audio',
};
