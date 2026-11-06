import express from "express";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./routes/auth.routes";
import marketplaceRoutes from "./routes/marketplace.routes";
import workflowRoutes from "./routes/workflow.routes";
import { errorHandler, notFound } from "./middleware/error";

const app = express();
// Render runs this service behind one trusted reverse proxy.
// This preserves correct client IP detection for express-rate-limit.
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
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

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin header or matching allowed origins, localhost in dev, or any vercel.app deployment
      if (!origin || env.NODE_ENV !== "production" || allowedOrigins.has(origin) || isLocalhostOrigin(origin) || isVercelOrigin(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

if (env.NODE_ENV !== "test") app.use(morgan("combined"));

// Public health endpoint for Render and uptime checks; it must not require authentication.
app.get("/api/health", (_req, res) =>
  res.json({ success: true, service: "STITCHGRID API", status: "healthy" })
);

// Rate limiting: disabled in development, active in production
if (env.NODE_ENV === "production") {
  app.use(
    "/api",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 1000,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: (req) => req.method === "OPTIONS",
    })
  );
  app.use(
    "/api/auth",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: (req) => req.method === "OPTIONS",
    })
  );
}

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", marketplaceRoutes);
app.use("/api", workflowRoutes);
app.use(notFound);
app.use(errorHandler);
export default app;