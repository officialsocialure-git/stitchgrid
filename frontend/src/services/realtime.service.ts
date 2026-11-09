import { io, Socket } from "socket.io-client";
import { SOCKET_SERVER_URL } from "@/constants";

class RealtimeClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting: boolean = false;

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("sg_token");
  }

  public getSocket(): Socket | null {
    if (typeof window === "undefined") return null;

    if (!this.socket && !this.isConnecting) {
      this.initSocket();
    }
    return this.socket;
  }

  public initSocket(): void {
    if (typeof window === "undefined" || this.socket) return;

    this.isConnecting = true;
    const token = this.getToken();

    const targetUrl = SOCKET_SERVER_URL || "https://stitchgrid-backend.onrender.com";

    this.socket = io(targetUrl, {
      auth: { token: token || undefined },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    this.socket.on("connect", () => {
      this.isConnecting = false;
      // Re-register channel subscriptions if any
    });

    this.socket.on("disconnect", () => {
      this.isConnecting = false;
    });

    this.socket.on("connect_error", () => {
      this.isConnecting = false;
    });

    // Universal sync handler
    this.socket.on("sync", (payload: any) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("stitchgrid:sync", { detail: payload }));
      }
      if (payload?.topic) {
        this.notify(payload.topic, payload);
      }
    });
  }

  public subscribe(topics: string | string[], handler: (data: any) => void): () => void {
    const topicList = Array.isArray(topics) ? topics : [topics];
    const s = this.getSocket();

    topicList.forEach((topic) => {
      if (!this.listeners.has(topic)) {
        this.listeners.set(topic, new Set());
      }
      this.listeners.get(topic)!.add(handler);

      // Listen directly on the socket for that event if socket exists
      if (s) {
        s.on(topic, handler);
      }
    });

    // Return unsubscribe function
    return () => {
      topicList.forEach((topic) => {
        const set = this.listeners.get(topic);
        if (set) {
          set.delete(handler);
        }
        if (s) {
          s.off(topic, handler);
        }
      });
    };
  }

  public notify(topic: string, data: any) {
    const handlers = this.listeners.get(topic);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (err) {
          console.warn("[REALTIME HANDLER ERROR]", err);
        }
      });
    }
  }

  public joinChannel(channel: string) {
    const s = this.getSocket();
    if (s && s.connected) {
      s.emit("subscribe:channel", channel);
    }
  }

  public leaveChannel(channel: string) {
    const s = this.getSocket();
    if (s && s.connected) {
      s.emit("unsubscribe:channel", channel);
    }
  }

  public refreshAuthToken() {
    if (!this.socket) return;
    const token = this.getToken();
    this.socket.auth = { token: token || undefined };
    if (this.socket.connected) {
      this.socket.disconnect().connect();
    }
  }
}

export const realtime = new RealtimeClient();

