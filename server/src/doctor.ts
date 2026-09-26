// `npm run doctor`: checks the local setup without ever printing a secret.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';

const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string, fix?: string) => {
  console.log(`  ✗ ${msg}${fix ? `\n      → ${fix}` : ''}`);
  failures++;
};
let failures = 0;

async function main() {
  console.log('\nHeritage Chat setup check\n');

  // Node
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19)) ok(`Node ${process.versions.node}`);
  else bad(`Node ${process.versions.node} is too old`, 'Install Node 22 LTS (nvm install 22 or brew install node@22).');

  // Secrets file
  const candidates = [
    process.env.DOTENV_CONFIG_PATH,
    join(homedir(), '.config', 'heritage-chat', 'server.env'),
    join(process.cwd(), '.env'),
  ].filter((p): p is string => Boolean(p));
  const file = candidates.find((p) => existsSync(p));
  if (!file) {
    bad('No secrets file found', 'Run npm run setup from the repo root.');
    return;
  }
  config({ path: file, quiet: true });
  if (file.startsWith(process.cwd())) {
    console.log(`  ! Secrets are inside the repo (${file.replace(process.cwd(), 'server')}).`);
    console.log('      → Safer: run npm run setup to move them to ~/.config/heritage-chat/');
  } else ok('Secrets file is outside the repo');

  // Key shapes (catches the classic copy-paste mistakes)
  const url = process.env.SUPABASE_URL?.trim() ?? '';
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const oaKey = process.env.OPENAI_API_KEY?.trim() ?? '';

  if (!url) bad('SUPABASE_URL is empty');
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url))
    bad('SUPABASE_URL has the wrong shape', 'It should be exactly https://<project-ref>.supabase.co with nothing after .co');
  else ok('SUPABASE_URL looks right');

  if (!sbKey) bad('SUPABASE_SERVICE_ROLE_KEY is empty');
  else if (sbKey.startsWith('sb_publishable_'))
    bad('SUPABASE_SERVICE_ROLE_KEY is the publishable (public) key', 'Use the Secret key (sb_secret_…) or legacy service_role key.');
  else ok('Supabase server key is set');

  if (!oaKey) bad('OPENAI_API_KEY is empty');
  else if (oaKey.startsWith('sk-sk-')) bad('OPENAI_API_KEY starts with "sk-sk-"', 'Remove the duplicated "sk-" prefix.');
  else if (!oaKey.startsWith('sk-')) bad('OPENAI_API_KEY should start with "sk-"');
  else ok('OpenAI key is set');

  if (failures) return;

  // Live checks
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url.replace(/\/+$/, ''), sbKey, { auth: { persistSession: false } });

  const profiles = await supabase.from('profiles').select('id', { count: 'exact', head: true });
  if (profiles.error)
    bad(`Supabase query failed: ${profiles.error.message}`, 'Run supabase/001_init.sql and supabase/seed.sql in the Supabase SQL editor.');
  else if (!profiles.count) bad('Database has no profiles', 'Run supabase/seed.sql in the Supabase SQL editor.');
  else ok(`Supabase connected (${profiles.count} profiles)`);

  const bucket = await supabase.storage.getBucket(process.env.AUDIO_BUCKET ?? 'audio');
  if (bucket.error) bad(`Audio storage bucket missing: ${bucket.error.message}`, 'Re-run supabase/001_init.sql.');
  else ok('Audio storage bucket exists');

  const { default: OpenAI } = await import('openai');
  try {
    await new OpenAI({ apiKey: oaKey }).models.retrieve(process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini');
    ok('OpenAI key works');
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401) bad('OpenAI rejected the key (401)', 'Create a new key and re-run npm run setup -- --reset.');
    else if (status === 429) bad('OpenAI says no credits or rate limited (429)', 'Check billing/credits on the OpenAI project.');
    else bad(`OpenAI check failed: ${(err as Error).message}`);
  }
}

main()
  .catch((err) => bad(`Unexpected error: ${(err as Error).message}`))
  .finally(() => {
    console.log(failures ? `\n${failures} problem(s) found.\n` : '\nAll good. Run: npm run dev\n');
    process.exit(failures ? 1 : 0);
  });
