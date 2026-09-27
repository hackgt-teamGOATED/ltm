// CORS origin policy. Production is same-origin (the server serves the app), so only listed origins pass.
// In dev, any page on this machine or the local network may call the API, so the LAN phone test works
// when the page is served from http://<laptop-ip>:8081 and calls :4000.
const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|[\w-]+\.local)$/;

export function originAllowed(origin: string | undefined, listed: string[], production: boolean): boolean {
  if (!origin) return true; // same-origin requests and non-browser clients
  if (listed.includes(origin)) return true;
  if (production) return false;
  try {
    return PRIVATE_HOST.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}
