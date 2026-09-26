import { io } from 'socket.io-client';
import { API_URL } from './api';

// No URL = connect to the page's own origin, which the Vite proxy forwards to the server.
export const socket = API_URL ? io(API_URL) : io();
