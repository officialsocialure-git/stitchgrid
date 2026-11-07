import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  signup,
  login,
  googleLogin,
  completeGoogleOnboarding,
  switchContext,
  me,
  forgotPassword,
  resetPassword,
  legacyVerifyOtp,
  legacyResendOtp,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Dedicated rate limiter for authentication endpoints: max 30 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: "Too many authentication requests from this IP. Please try again after 15 minutes.",
      code: "RATE_LIMITED",
    },
  },
  skip: (req) => req.method === "OPTIONS" || process.env.NODE_ENV === "test",
});

router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleLogin);
router.post("/google/onboarding", authenticate, completeGoogleOnboarding);
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPassword);
router.post("/switch-context", authenticate, switchContext);
router.get("/me", authenticate, me);

// Deprecated routes kept to avoid 404s for cached or legacy clients
router.post("/verify-otp", legacyVerifyOtp);
router.post("/resend-otp", legacyResendOtp);

export default router;
