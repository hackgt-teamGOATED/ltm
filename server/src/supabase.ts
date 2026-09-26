import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// Server-only client. Uses the service role key, so it bypasses RLS.
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Unwraps a Supabase result, throwing its error. */
export function must<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}
