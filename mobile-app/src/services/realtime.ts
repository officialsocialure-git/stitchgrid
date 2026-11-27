import { AppState, AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

export type RealtimeSyncPayload = {
  topic: string;
  action?: string;
  id?: string;
  data?: unknown;
  timestamp?: string;
};

type RealtimeListener = (payload: RealtimeSyncPayload) => void;

const REALTIME_URL = API_BASE_URL.replace(/api\/?$/, '').replace(/\/$/, '');
// (/\\/api\\/?$/, '').replace(/\\/$/, '');
const listeners = new Set<RealtimeListener>();
let socket: Socket | null = null;
let activeToken: string | null = null;
let appStateSubscription: { remove: () => void } | null = null;

function notify(payload: RealtimeSyncPayload) {
  listeners.forEach(listener => {
    try { listener(payload); } catch (error) { console.warn('[REALTIME] Listener failed', error); }
  });
}

export function connectRealtime(token: string) {
  if (!token) return;
  if (socket && activeToken === token) {
    // A socket can be active while its initial handshake is still pending.
    // Calling connect() again during that window can restart the handshake.
    if (!socket.connected && !socket.active) socket.connect();
    return;
  }
  if (activeToken !== token) {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  }
  activeToken = token;
  if (!socket) {
    socket = io(REALTIME_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      // Render free instances can take a while to wake from idle.
      // Give the first handshake enough time before Socket.IO retries.
      timeout: 120000,
    });
    socket.on('connect', () => {
      console.info('[REALTIME] Connected');
      notify({ topic: 'connection:restored', action: 'refresh' });
    });
    socket.on('disconnect', reason => console.info('[REALTIME] Disconnected', reason));
    socket.on('connect_error', error => {
      console.warn('[REALTIME] Connection error', error.message, {
        url: REALTIME_URL,
        transport: socket?.io.engine?.transport?.name || 'handshake',
      });
    });
    // The backend sends a normalized sync envelope alongside domain-specific events.
    socket.on('sync', (payload: RealtimeSyncPayload) => {
      if (payload && typeof payload.topic === 'string') notify(payload);
    });
  }
}

export async function initializeRealtime() {
  try {
    const token = await SecureStore.getItemAsync('sg_token');
    if (token) connectRealtime(token);
  } catch (error) {
    console.warn('[REALTIME] Unable to restore socket session', error);
  }
}

export function disconnectRealtime() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  activeToken = null;
}

export function isRealtimeConnected() {
  return Boolean(socket?.connected);
}

export function subscribeRealtime(listener: RealtimeListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function onRealtimeAppStateChange(callback: (state: AppStateStatus) => void) {
  const subscription = AppState.addEventListener('change', callback);
  return () => subscription.remove();
}

if (!appStateSubscription) {
  appStateSubscription = AppState.addEventListener('change', state => {
    if (state === 'active' && !socket?.connected) void initializeRealtime();
  });
}
