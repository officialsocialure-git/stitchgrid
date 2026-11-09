import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthUser } from "../middleware/auth";

let io: SocketIOServer | null = null;

export interface RealtimeEventPayload {
  topic: string;
  action: "created" | "updated" | "deleted" | "status_changed" | "refresh";
  id?: string;
  data?: any;
  timestamp: string;
}

export function initRealtime(server: HttpServer): SocketIOServer {
  const allowedOrigins = new Set([
    ...env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
    "https://stitchgrid-three.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ]);

  const isLocalhostOrigin = (origin: string) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

  const isVercelOrigin = (origin: string) =>
    /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(origin);

  io = new SocketIOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.NODE_ENV !== "production" || allowedOrigins.has(origin) || isLocalhostOrigin(origin) || isVercelOrigin(origin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ["websocket", "polling"],
  });

  // Authentication Middleware for Handshake
  io.use((socket: Socket, next) => {
    const rawToken =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    // Allow unauthenticated connection for public:marketplace updates
    if (!rawToken) {
      socket.data.isGuest = true;
      return next();
    }

    try {
      const payload = jwt.verify(rawToken, env.JWT_ACCESS_SECRET) as AuthUser;
      if (payload?.userId) {
        socket.data.user = payload;
      }
      next();
    } catch {
      // Allow fallback as guest if token is invalid/expired
      socket.data.isGuest = true;
      next();
    }
  });

  io.on("connection", (socket: Socket) => {
    // 1. Join public room for marketplace broadcasts
    socket.join("public:marketplace");

    // 2. Join authenticated rooms if user is authenticated
    const user: AuthUser | undefined = socket.data.user;
    if (user && user.userId) {
      socket.join(`user:${user.userId}`);
      if (user.organizationId) {
        socket.join(`org:${user.organizationId}`);
      }
      if (user.role) {
        socket.join(`role:${user.role}`);
      }
    }

    // Client can explicitly subscribe to entity rooms (e.g. order tracking or chat room)
    socket.on("subscribe:channel", (channel: string) => {
      if (typeof channel === "string" && channel.length < 100) {
        socket.join(channel);
      }
    });

    socket.on("unsubscribe:channel", (channel: string) => {
      if (typeof channel === "string") {
        socket.leave(channel);
      }
    });
  });

  console.log("[REALTIME] Socket.IO server initialized successfully");
  return io;
}

export function getRealtimeServer(): SocketIOServer | null {
  return io;
}

// -------------------------------------------------------------
// BROADCAST HELPERS
// -------------------------------------------------------------

export function emitToUser(userId: string, event: string, data?: any) {
  if (!io) return;
  const payload: RealtimeEventPayload = {
    topic: event,
    action: "updated",
    data,
    timestamp: new Date().toISOString(),
  };
  io.to(`user:${userId}`).emit(event, payload);
  io.to(`user:${userId}`).emit("sync", payload);
}

export function emitToOrg(orgId: string, event: string, data?: any) {
  if (!io) return;
  const payload: RealtimeEventPayload = {
    topic: event,
    action: "updated",
    data,
    timestamp: new Date().toISOString(),
  };
  io.to(`org:${orgId}`).emit(event, payload);
  io.to(`org:${orgId}`).emit("sync", payload);
}

export function emitToRole(role: "BUYER" | "SUPPLIER" | "ADMIN", event: string, data?: any) {
  if (!io) return;
  const payload: RealtimeEventPayload = {
    topic: event,
    action: "updated",
    data,
    timestamp: new Date().toISOString(),
  };
  io.to(`role:${role}`).emit(event, payload);
  io.to(`role:${role}`).emit("sync", payload);
}

export function emitToChannel(channel: string, event: string, data?: any) {
  if (!io) return;
  const payload: RealtimeEventPayload = {
    topic: event,
    action: "updated",
    data,
    timestamp: new Date().toISOString(),
  };
  io.to(channel).emit(event, payload);
  io.to(channel).emit("sync", payload);
}

export function emitToMarketplace(event: string, data?: any) {
  if (!io) return;
  const payload: RealtimeEventPayload = {
    topic: event,
    action: "updated",
    data,
    timestamp: new Date().toISOString(),
  };
  io.to("public:marketplace").emit(event, payload);
  io.to("public:marketplace").emit("sync", payload);
}

export function emitGlobalSync(event: string, data?: any) {
  if (!io) return;
  const payload: RealtimeEventPayload = {
    topic: event,
    action: "refresh",
    data,
    timestamp: new Date().toISOString(),
  };
  io.emit(event, payload);
  io.emit("sync", payload);
}

