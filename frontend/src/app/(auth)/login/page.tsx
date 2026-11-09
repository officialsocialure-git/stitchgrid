"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import { StitchgridLogo } from "@/components/common/StitchgridLogo";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleClickLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"identifier" | "password" | null>(null);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotMsg, setForgotMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Google account picker modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);

  // Initialize remembered credentials if any
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedIdentifier = localStorage.getItem("sg_remembered_identifier");
      const savedRemember = localStorage.getItem("sg_remember_me");
      if (savedIdentifier) {
        setIdentifier(savedIdentifier);
      }
      if (savedRemember !== null) {
        setRememberMe(savedRemember === "true");
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Please enter your registered email address or mobile number.");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setLoading(true);

    try {
      if (typeof window !== "undefined") {
        if (rememberMe) {
          localStorage.setItem("sg_remembered_identifier", trimmed);
          localStorage.setItem("sg_remember_me", "true");
        } else {
          localStorage.removeItem("sg_remembered_identifier");
          localStorage.setItem("sg_remember_me", "false");
        }
      }

      const res = await authService.login(trimmed, password);
      const adminMembership = res.memberships?.find((membership) => membership.role === "ADMIN");
      if (adminMembership) {
        await authService.switchContext(adminMembership.organizationId, "ADMIN");
      }
      const chosenMembership = adminMembership || res.activeMembership;
      localStorage.setItem("sg_user", JSON.stringify(res.user));
      if (chosenMembership) {
        localStorage.setItem("sg_membership", JSON.stringify(chosenMembership));
      }
      window.dispatchEvent(new CustomEvent("sg_workspace_changed", { detail: chosenMembership }));
      window.location.href = adminMembership ? "/admin" : "/dashboard";
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to login. Please verify your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setError(null);
    setGoogleLoading(true);
    try {
      const res = await authService.googleLogin({ credential });
      const adminMembership = res.memberships?.find((membership) => membership.role === "ADMIN");
      if (adminMembership) {
        await authService.switchContext(adminMembership.organizationId, "ADMIN");
      }
      const chosenMembership = adminMembership || res.activeMembership;
      localStorage.setItem("sg_user", JSON.stringify(res.user));
      if (chosenMembership) {
        localStorage.setItem("sg_membership", JSON.stringify(chosenMembership));
      } else {
        localStorage.removeItem("sg_membership");
      }
      window.dispatchEvent(new CustomEvent("sg_workspace_changed", { detail: chosenMembership }));
      window.location.href = res.requiresOnboarding ? "/google-onboarding" : adminMembership ? "/admin" : "/dashboard";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleGoogleLoginClick = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setError(null);
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google sign-in is not configured yet. Please try email and password or contact support.");
      return;
    }

    if (googleClickLock.current) return;
    googleClickLock.current = true;
    setGoogleLoading(true);
    try {
      const googleWindow = window as typeof window & {
        google?: { accounts?: { id?: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void;
          prompt: () => void;
        } } };
        __stitchgridGoogleInitialized?: boolean;
        __stitchgridGoogleScriptLoading?: boolean;
      };

      const initializeGoogle = () => {
        const googleId = googleWindow.google?.accounts?.id;
        if (!googleId) throw new Error("Google sign-in could not be loaded. Please try again.");

        // Google Identity Services must be initialized only once per page.
        if (!googleWindow.__stitchgridGoogleInitialized) {
          googleId.initialize({
            client_id: clientId,
            callback: (response) => {
              if (response.credential) void handleGoogleCredential(response.credential);
              else {
                setGoogleLoading(false);
                googleClickLock.current = false;
              }
            },
            auto_select: false,
          });
          googleWindow.__stitchgridGoogleInitialized = true;
        }

        googleId.prompt();
        window.setTimeout(() => {
          setGoogleLoading(false);
          googleClickLock.current = false;
        }, 1500);
      };

      if (googleWindow.google?.accounts?.id) {
        initializeGoogle();
      } else {
        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
        if (existingScript) {
          existingScript.addEventListener("load", initializeGoogle, { once: true });
          existingScript.addEventListener("error", () => {
            setError("Unable to load Google sign-in. Please check your internet connection.");
            setGoogleLoading(false);
            googleClickLock.current = false;
          }, { once: true });
        } else if (!googleWindow.__stitchgridGoogleScriptLoading) {
          googleWindow.__stitchgridGoogleScriptLoading = true;
          const script = document.createElement("script");
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.defer = true;
          script.onload = initializeGoogle;
          script.onerror = () => {
            setError("Unable to load Google sign-in. Please check your internet connection.");
            setGoogleLoading(false);
            googleClickLock.current = false;
            googleWindow.__stitchgridGoogleScriptLoading = false;
          };
          document.head.appendChild(script);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in could not be started.");
      setGoogleLoading(false);
      googleClickLock.current = false;
    }
  };

  // Legacy account-picker actions now route to the verified Google Identity Services flow.
  const executeGoogleLogin = (_email?: string, _name?: string) => handleGoogleLoginClick();
  const handleCustomGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("Please use the secure Google account selector instead of entering an email manually.");
    setShowGoogleModal(false);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg(null);
    const trimmed = forgotIdentifier.trim();
    if (!trimmed) {
      setForgotMsg({ type: "error", text: "Please enter your registered email or mobile number." });
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authService.forgotPassword(trimmed);
      setForgotMsg({
        type: "success",
        text: res.message || `Password reset instructions have been generated for ${trimmed}.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to initiate password reset for this identifier.";
      setForgotMsg({ type: "error", text: msg });
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-[460px] mx-auto px-2 sm:px-0">
      {/* Main Authentication Card */}
      <div className="w-full bg-white rounded-[28px] sm:rounded-3xl shadow-[0_12px_45px_-10px_rgba(109,40,217,0.12),0_4px_16px_rgba(0,0,0,0.04)] border border-purple-100/80 p-6 sm:p-9 flex flex-col transition-all">
        {/* Brand Header */}
        <div className="mb-4 sm:mb-5">
          <StitchgridLogo subtitle="The operating network for garment manufacturing" size="md" />
        </div>

        {/* Sewing Machine Divider */}
        <div className="flex items-center justify-center w-full mb-6">
          <div className="h-[1.5px] flex-1 bg-purple-200/70"></div>
          <div className="px-3 shrink-0 flex items-center justify-center" aria-hidden="true">
            <svg
              width="30"
              height="22"
              viewBox="0 0 30 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-purple-600"
            >
              {/* Spool on top */}
              <rect x="11.5" y="1" width="3.2" height="3.5" rx="0.6" fill="currentColor" />
              <line x1="10" y1="1.5" x2="16" y2="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />

              {/* Sewing Machine Main Body */}
              <path
                d="M6 5.5H23C24.6569 5.5 26 6.84315 26 8.5V17H21.5V11C21.5 10.4477 21.0523 10 20.5 10H11.5C10.9477 10 10.5 10.4477 10.5 11V12.5H6C5.44772 12.5 5 12.0523 5 11.5V6.5C5 5.94772 5.44772 5.5 6 5.5Z"
                fill="currentColor"
              />

              {/* Needle Bar & Presser Foot */}
              <line x1="8" y1="12.5" x2="8" y2="17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="6.5" y1="17" x2="9.5" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />

              {/* Handwheel on Right */}
              <rect x="26.3" y="9" width="1.8" height="5.5" rx="0.9" fill="currentColor" />

              {/* Base Plate */}
              <rect x="2.5" y="17.2" width="25" height="2.5" rx="1.25" fill="currentColor" />
            </svg>
          </div>
          <div className="h-[1.5px] flex-1 bg-purple-200/70"></div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200/90 text-rose-700 text-xs sm:text-[13px] flex items-center gap-2.5 animate-fadeIn">
            <span className="material-symbols-outlined text-[19px] shrink-0 text-rose-600">error</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Registered Email or Mobile Number */}
          <div>
            <label
              htmlFor="identifier-input"
              className="block text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider mb-1.5 leading-[1.4]"
            >
              REGISTERED EMAIL OR MOBILE NUMBER
            </label>
            <div
              className={`relative flex items-center w-full bg-white rounded-xl transition-all shadow-2xs ${
                focusedField === "identifier"
                  ? "border-2 border-purple-600 ring-3 ring-purple-600/15"
                  : "border-2 border-purple-600 hover:border-purple-700"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px] text-purple-600 pl-3.5 pointer-events-none shrink-0"
                aria-hidden="true"
              >
                person
              </span>
              <input
                id="identifier-input"
                type="text"
                required
                value={identifier}
                onFocus={() => setFocusedField("identifier")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="name@company.com or 9842188302"
                className="flex-1 h-12 pl-2.5 pr-3.5 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Account Password */}
          <div>
            <label
              htmlFor="password-input"
              className="block text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider mb-1.5 leading-[1.4]"
            >
              ACCOUNT PASSWORD
            </label>
            <div
              className={`relative flex items-center w-full bg-white rounded-xl transition-all shadow-2xs ${
                focusedField === "password"
                  ? "border-2 border-purple-600 ring-3 ring-purple-600/15"
                  : "border border-gray-200 hover:border-gray-300"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px] text-purple-600 pl-3.5 pointer-events-none shrink-0"
                aria-hidden="true"
              >
                lock
              </span>
              <input
                id="password-input"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="flex-1 h-12 pl-2.5 pr-3 text-sm sm:text-base text-gray-900 placeholder:text-gray-400 bg-transparent focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="pr-3.5 text-gray-600 hover:text-purple-700 transition-colors cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs sm:text-[13px] pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:text-gray-900">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <span className="font-normal text-gray-700">Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotIdentifier(identifier);
                setShowForgotModal(true);
              }}
              className="font-semibold text-purple-700 hover:text-purple-900 hover:underline transition-colors cursor-pointer"
            >
              Forgot Password?
            </button>
          </div>

          {/* Primary Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white text-sm sm:text-base font-semibold leading-[1.4] flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/20 hover:shadow-lg hover:shadow-purple-600/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>{loading ? "Signing In..." : "Sign In"}</span>
            {!loading && <span className="material-symbols-outlined text-[19px]">arrow_forward</span>}
          </button>

          {/* OR Divider */}
          <div className="relative my-2.5 flex items-center justify-center">
            <div className="w-full h-[1px] bg-gray-200 absolute"></div>
            <span className="relative px-3 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500 uppercase tracking-widest font-semibold">
              OR
            </span>
          </div>

          {/* Login with Google Button */}
          <button
            type="button"
            onClick={handleGoogleLoginClick}
            disabled={googleLoading}
            className="w-full h-11 sm:h-12 rounded-xl bg-white text-gray-800 text-sm font-semibold leading-[1.4] flex items-center justify-center gap-2.5 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-2xs border border-gray-200 cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>{googleLoading ? "Signing in with Google..." : "Login with Google"}</span>
          </button>
        </form>

        {/* Footer Link */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <span className="text-xs sm:text-sm text-gray-500">New to STITCHGRID?</span>{" "}
          <Link
            href="/register"
            className="text-xs sm:text-sm font-semibold text-purple-700 hover:text-purple-900 hover:underline inline-flex items-center gap-1 ml-1"
          >
            <span>Register Organization</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>
      </div>

      {/* Step Indicator Pill */}
      <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-100/90 text-purple-900 text-xs font-medium border border-purple-200/70 shadow-2xs">
        <span className="w-5 h-5 rounded-full bg-purple-700 text-white text-[11px] font-bold flex items-center justify-center">
          1
        </span>
        <span className="font-semibold text-purple-900">Login Page</span>
      </div>

      {/* Google Account Selector Dialog */}
      {showGoogleModal && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (!googleLoading) {
              setShowGoogleModal(false);
              setShowCustomGoogleInput(false);
            }
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 flex flex-col relative z-[101]"
          >
            {/* Google Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span className="font-semibold text-gray-800 text-sm">Sign in with Google</span>
              </div>
              <button
                type="button"
                disabled={googleLoading}
                onClick={() => {
                  setShowGoogleModal(false);
                  setShowCustomGoogleInput(false);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {googleLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-700 rounded-full animate-spin"></div>
                <span className="text-sm font-semibold text-gray-800">Signing in with Google...</span>
                <span className="text-xs text-gray-500">Securing your STITCHGRID workspace</span>
              </div>
            ) : (
              <>
                <div className="py-4">
                  <h3 className="text-base font-bold text-gray-900">Choose an account</h3>
                  <p className="text-xs text-gray-500 mt-0.5">to continue to <strong className="font-semibold text-purple-700">STITCHGRID</strong></p>
                </div>

                {/* Account List */}
                <div className="flex flex-col gap-2">
                  {/* Account 1: Sumit (Buyer) */}
                  <button
                    type="button"
                    disabled={googleLoading}
                    onClick={() => executeGoogleLogin("sumit@gmail.com", "Sumit")}
                    className="w-full p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 flex items-center gap-3.5 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-purple-700 text-white font-bold flex items-center justify-center shrink-0 text-sm shadow-2xs">
                      S
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-purple-900">Sumit</span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700">Buyer</span>
                      </div>
                      <span className="text-xs text-gray-500 truncate block">sumit@gmail.com</span>
                    </div>
                    <span className="material-symbols-outlined text-gray-400 group-hover:text-purple-600 text-[18px]">
                      chevron_right
                    </span>
                  </button>

                  {/* Account 2: Pushpak (Supplier) */}
                  <button
                    type="button"
                    disabled={googleLoading}
                    onClick={() => executeGoogleLogin("pushpak@gmail.com", "Pushpak")}
                    className="w-full p-3 rounded-xl border border-gray-200 hover:border-purple-300 hover:bg-purple-50/40 flex items-center gap-3.5 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center shrink-0 text-sm shadow-2xs">
                      P
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-purple-900">Pushpak</span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">Supplier</span>
                      </div>
                      <span className="text-xs text-gray-500 truncate block">pushpak@gmail.com</span>
                    </div>
                    <span className="material-symbols-outlined text-gray-400 group-hover:text-purple-600 text-[18px]">
                      chevron_right
                    </span>
                  </button>

              {/* Option to use another Google account */}
              {!showCustomGoogleInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomGoogleInput(true)}
                  className="w-full p-3 rounded-xl border border-dashed border-gray-300 hover:border-purple-400 hover:bg-gray-50 flex items-center gap-3.5 transition-all text-left cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700">Use another Google account</span>
                </button>
              ) : (
                <form onSubmit={handleCustomGoogleSubmit} className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200 flex flex-col gap-2.5">
                  <span className="text-xs font-semibold text-gray-800">Enter your Google email:</span>
                  <input
                    type="email"
                    required
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    placeholder="youremail@gmail.com"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-purple-600"
                  />
                  <input
                    type="text"
                    value={customGoogleName}
                    onChange={(e) => setCustomGoogleName(e.target.value)}
                    placeholder="Your Name (Optional)"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm focus:outline-none focus:border-purple-600"
                  />
                  <div className="flex items-center justify-end gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogleInput(false)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 rounded-md"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={googleLoading}
                      className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-md shadow-2xs disabled:opacity-60"
                    >
                      {googleLoading ? "Signing In..." : "Continue"}
                    </button>
                  </div>
                </form>
              )}
            </div>
              </>
            )}

            <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
              <span>Secure Google Authentication</span>
              <span>Privacy & Terms</span>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn"
        >
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-purple-100 p-6 flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-700">lock_reset</span>
                <h3 className="text-base font-bold text-gray-900">Reset Account Password</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotMsg(null);
                }}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-600 mt-3 leading-relaxed">
              Enter your registered email address or mobile number to receive password reset instructions.
            </p>

            {forgotMsg && (
              <div
                className={`mt-3 p-3 rounded-xl text-xs sm:text-[13px] flex items-center gap-2 ${
                  forgotMsg.type === "success"
                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    : "bg-rose-50 border border-rose-200 text-rose-700"
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {forgotMsg.type === "success" ? "check_circle" : "error"}
                </span>
                <span>{forgotMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="mt-4 flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Registered Email or Phone
                </label>
                <input
                  type="text"
                  required
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="name@company.com or 9842188302"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/15"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotMsg(null);
                  }}
                  className="px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-5 py-2 text-xs sm:text-sm font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-all shadow-sm disabled:opacity-60"
                >
                  {forgotLoading ? "Submitting..." : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
