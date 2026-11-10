import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "../constants/config";
import { storage } from "../utils/storage";

let socket: Socket | null = null;
const listeners = new Map<string, Set<(data: any) => void>>();

export const realtimeService = {
  async connect(): Promise<Socket> {
    if (socket?.connected) {
      return socket;
    }

    const token = await storage.getToken();

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected to Stitchguard server");
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket.IO] Connection error:", err.message);
    });

    // Wire registered listeners
    listeners.forEach((callbacks, event) => {
      socket?.on(event, (data) => {
        callbacks.forEach((cb) => cb(data));
      });
    });

    return socket;
  },

  disconnect(): void {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
      if (socket) {
        socket.on(event, (data) => {
          listeners.get(event)?.forEach((cb) => cb(data));
        });
      }
    }
    listeners.get(event)?.add(callback);

    return () => {
      listeners.get(event)?.delete(callback);
      if (listeners.get(event)?.size === 0) {
        listeners.delete(event);
        socket?.off(event);
      }
    };
  },

  getSocket(): Socket | null {
    return socket;
  },
};

