// Log-safe error descriptions. Errors from OpenAI or Supabase can echo request content (user messages), so
// server logs only ever get an error's name, code and status, never its message or the object itself.
export function safeErr(err: unknown): string {
  if (!err || typeof err !== 'object') return typeof err;
  const e = err as { name?: unknown; code?: unknown; status?: unknown };
  const parts = [typeof e.name === 'string' ? e.name : 'Error'];
  if (typeof e.code === 'string' || typeof e.code === 'number') parts.push(`code=${e.code}`);
  if (typeof e.status === 'number') parts.push(`status=${e.status}`);
  return parts.join(' ');
}
