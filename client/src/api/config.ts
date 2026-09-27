// Native: the API URL must be configured (PLAN.md §7.8).
export function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (!fromEnv) throw new Error('Set EXPO_PUBLIC_API_URL to the Heirloom server URL');
  return fromEnv.replace(/\/+$/, '');
}
