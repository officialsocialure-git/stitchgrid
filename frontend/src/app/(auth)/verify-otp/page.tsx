"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authService } from "@/services/auth.service";
import { StitchgridLogo } from "@/components/common/StitchgridLogo";

type ToastState = { type: "success" | "error" | "warning"; message: string } | null;

function VerifyOtpContent() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const destination = searchParams.get("dest") || "";
  const mode = searchParams.get("mode") || "signup";
  const channel = searchParams.get("channel") || (destination.includes("@") ? "email" : "sms");

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(45);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    // OTP verification is deprecated; redirect to dashboard or login
    const token = typeof window !== "undefined" ? localStorage.getItem("sg_token") : null;
    window.location.href = token ? "/dashboard" : "/login";
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = window.setInterval(() => setTimer((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), toast.type === "success" ? 1600 : 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = (type: NonNullable<ToastState>["type"], message: string) => {
    setToast({ type, message });
  };

  const focusInput = (index: number) => {
    document.getElementById(`otp-input-${index}`)?.focus();
  };

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\\D/g, "");
    if (!digits) {
      setOtp((current) => current.map((digit, i) => i === index ? "" : digit));
      return;
    }

    if (digits.length > 1) {
      const pasted = digits.slice(0, 6).split("");
      setOtp((current) => current.map((digit, i) => pasted[i] ?? digit));
      focusInput(Math.min(pasted.length - 1, 5));
      return;
    }

    setOtp((current) => current.map((digit, i) => i === index ? digits : digit));
    if (index < 5) focusInput(index + 1);
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) focusInput(index - 1);
    if (event.key === "ArrowLeft" && index > 0) focusInput(index - 1);
    if (event.key === "ArrowRight" && index < 5) focusInput(index + 1);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\\D/g, "").slice(0, 6);
    if (pasted.length) {
      setOtp(pasted.split("").concat(Array(6 - pasted.length).fill("")));
      focusInput(Math.min(pasted.length - 1, 5));
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = otp.join("");
    if (!userId || !destination) {
      showToast("error", "Verification session expired. Please sign in again.");
      return;
    }
    if (code.length !== 6) {
      showToast("warning", "Please enter the complete 6-digit verification code.");
      focusInput(otp.findIndex((digit) => !digit));
      return;
    }

    setLoading(true);
    try {
      const session = await authService.verifyOtp(userId, code, destination);
      const adminMembership = session.memberships?.find((membership) => membership.role === "ADMIN");
      if (adminMembership) {
        await authService.switchContext(adminMembership.organizationId, "ADMIN");
      }
      showToast("success", "OTP verified successfully! Welcome to STITCHGRID.");
      window.setTimeout(() => {
        window.location.href = adminMembership ? "/admin" : "/dashboard";
      }, 1500);
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || resending || !destination) return;
    setResending(true);
    try {
      const response = await authService.resendOtp(destination);
      setOtp(["", "", "", "", "", ""]);
      setTimer(Number(response.cooldownRemaining) || 45);
      showToast("success", "A new verification code has been sent.");
      focusInput(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not resend the code. Please try again.";
      const wait = message.match(/(\\d+)\\s*s/i);
      if (wait?.[1]) setTimer(Number(wait[1]));
      showToast("error", message);
    } finally {
      setResending(false);
    }
  };

  const isEmail = channel === "email" || destination.includes("@");
  const formattedDestination = isEmail
    ? destination
    : destination.startsWith("+") ? destination : `+91 ${destination}`;

  const toastStyles = toast?.type === "success"
    ? "border-emerald-200 bg-white text-emerald-900"
    : toast?.type === "warning"
      ? "border-amber-200 bg-white text-amber-900"
      : "border-rose-200 bg-white text-rose-900";

  return (
    <div className="relative z-10 flex w-full flex-col items-center px-0">
      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`fixed left-4 right-4 top-4 z-[100] mx-auto flex w-auto max-w-[390px] items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl sm:left-auto sm:right-6 sm:top-6 sm:w-[390px] ${toastStyles}`}
        >
          <span className={`material-symbols-outlined text-[22px] ${toast.type === "success" ? "text-emerald-600" : toast.type === "warning" ? "text-amber-600" : "text-rose-600"}`}>
            {toast.type === "success" ? "check_circle" : toast.type === "warning" ? "warning" : "error"}
          </span>
          <span className="flex-1 text-sm font-semibold">{toast.message}</span>
          <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <section className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-5 text-center shadow-sm sm:p-8">
        <div className="mb-5 flex justify-center">
          <StitchgridLogo size="md" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 leading-[1.2]">
          {isEmail ? "Verify Your Email Address" : "Verify Your Mobile Number"}
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-[1.5] text-slate-500">
          We&apos;ve sent a 6-digit OTP to{" "}
          <strong className="break-all font-mono font-bold text-slate-800">{formattedDestination}</strong>
        </p>

        <div className="mt-7 flex w-full items-center justify-between gap-1.5 sm:gap-2.5" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              id={`otp-input-${index}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`OTP digit ${index + 1}`}
              maxLength={6}
              value={digit}
              onChange={(event) => handleOtpChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className="h-12 min-w-0 max-w-[52px] flex-1 rounded-xl border border-slate-200 bg-white text-center font-mono text-xl font-bold text-slate-900 shadow-sm outline-none transition focus:border-[#4f14e2] focus:ring-4 focus:ring-[#4f14e2]/10 sm:h-14 sm:rounded-2xl sm:text-2xl"
            />
          ))}
        </div>

        <div className="mt-6 text-xs text-slate-500 sm:text-sm">
          <span>Didn&apos;t receive the OTP? </span>
          {timer > 0 ? (
            <span className="font-semibold text-[#4f14e2]">Resend in {timer}s</span>
          ) : (
            <button type="button" onClick={handleResend} disabled={resending} className="font-bold text-[#4f14e2] hover:underline disabled:opacity-60">
              {resending ? "Sending..." : "Resend Code"}
            </button>
          )}
        </div>

        <form onSubmit={handleVerify} className="mt-7">
          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#4f14e2] text-sm font-semibold text-white shadow-md transition hover:bg-[#4310c4] active:bg-[#380da5] disabled:cursor-not-allowed disabled:opacity-60 sm:h-14"
          >
            <span>{loading ? "Verifying..." : mode === "login" ? "Verify & Sign In" : "Verify & Create Account"}</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>
      </section>

      <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4f14e2] text-[11px] font-bold text-white">4</span>
        <span className="font-semibold text-slate-800">OTP Verification</span>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading verification...</div>}>
      <VerifyOtpContent />
    </Suspense>
  );
}
