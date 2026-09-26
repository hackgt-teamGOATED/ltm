import { io, type Socket } from 'socket.io-client';
import { apiBase } from './config';

let socket: Socket | null = null;
let socketProfile: string | null = null;

/** One socket per app, reconnected when the persona changes. Joins room `profile:<id>` on connect. */
export function getSocket(profileId: string): Socket {
  if (socket && socketProfile === profileId) return socket;
  socket?.disconnect();
  socket = io(apiBase(), { transports: ['websocket', 'polling'], query: { profileId } });
  socketProfile = profileId;
  return socket;
}
