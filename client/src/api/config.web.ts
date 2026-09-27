// Web: same origin in production (the server serves this app). In `expo start` on :8081 the API runs on :4000.
export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const { protocol, hostname, port, origin } = window.location;
  return port === '8081' ? `${protocol}//${hostname}:4000` : origin;
}
