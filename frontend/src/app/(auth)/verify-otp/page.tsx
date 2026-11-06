"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth.service";
import { StitchgridLogo } from "@/components/common/StitchgridLogo";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") || "";
  const destination = searchParams.get("dest") || "";
  const mode = searchParams.get("mode") || "signup"; // "login" | "signup"
  const devOtp = searchParams.get("devOtp") || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(45);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (devOtp && devOtp.length === 6) {
      setOtp(devOtp.split(""));
    }
  }, [devOtp]);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) {
      val = val.slice(-1);
    }
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    // Auto advance focus
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      const lastInput = document.getElementById("otp-input-5");
      lastInput?.focus();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setError("Please enter the complete 6-digit verification code");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await authService.verifyOtp(userId, code, destination);
      setSuccess("Verification successful! Opening your workspace...");
      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid OTP code. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0 || !destination) return;
    try {
      const res: any = await authService.resendOtp(destination);
      const remainingSeconds = Number(res?.cooldownRemaining) || 45;
      setTimer(remainingSeconds);
      if (res?.devOtp) {
        setOtp(String(res.devOtp).split(""));
      }
      setSuccess("A new 6-digit verification code has been sent!");
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
        // If error message contains remaining seconds, sync the timer immediately
        const match = err.message.match(/(\d+)\s*s/i);
        if (match && match[1]) {
          setTimer(parseInt(match[1], 10));
        }
      } else {
        setError("Could not resend code. Please try again.");
      }
    }
  };

  const isEmail = destination.includes("@");
  const formattedDest = isEmail
    ? destination
    : destination.startsWith("+")
    ? destination
    : `+91 ${destination}`;

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto">
      {/* Main Card */}
      <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/80 p-7 sm:p-8 flex flex-col items-center text-center">
        {/* Brand Header */}
        <div className="mb-5">
          <StitchgridLogo size="md" />
        </div>

        {/* Title & Subtitle */}
        <h1 className="font-sans font-bold text-xl sm:text-2xl text-slate-900 tracking-tight">
          {isEmail ? "Verify Your Email Address" : "Verify Your Mobile Number"}
        </h1>
        <p className="text-xs text-slate-500 mt-1.5 max-w-xs">
          We&apos;ve sent a 6-digit OTP to{" "}
          <strong className="text-slate-800 font-mono font-bold">{formattedDest}</strong>
        </p>

        {error && (
          <div className="w-full mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="w-full mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>{success}</span>
          </div>
        )}

        {/* Dev OTP Helper */}
        {devOtp && (
          <div className="w-full mt-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono font-bold">
              <span className="material-symbols-outlined text-[16px] text-amber-600">bolt</span>
              <span>Dev OTP: {devOtp}</span>
            </div>
            <button
              type="button"
              onClick={() => setOtp(devOtp.split(""))}
              className="text-[11px] font-bold text-amber-700 underline hover:text-amber-900"
            >
              Fill Code
            </button>
          </div>
        )}

        <form onSubmit={handleVerify} className="w-full flex flex-col gap-5 mt-6">
          {/* 6 OTP Input Boxes */}
          <div className="flex items-center justify-between gap-2 sm:gap-2.5 w-full on-paste" onPaste={handlePaste}>
            {otp.map((digit, idx) => (
              <input
                key={idx}
                id={`otp-input-${idx}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-14 sm:w-13 sm:h-15 text-center text-xl font-bold font-mono rounded-2xl bg-white border border-slate-200/90 text-slate-900 focus:border-[#4f14e2] focus:ring-3 focus:ring-[#4f14e2]/15 focus:outline-none transition-all shadow-xs"
              />
            ))}
          </div>

          {/* Resend Prompt */}
          <div className="text-xs text-slate-500">
            <span>Didn&apos;t receive the OTP? </span>
            {timer > 0 ? (
              <span className="text-[#4f14e2] font-semibold">Resend in {timer}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="text-[#4f14e2] font-bold hover:underline"
              >
                Resend Code
              </button>
            )}
          </div>

          {/* Main Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#4f14e2] hover:bg-[#4310c4] active:bg-[#380da5] text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span>
              {loading
                ? "Verifying..."
                : mode === "login"
                ? "Verify & Sign In"
                : "Verify & Create Account"}
            </span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </form>
      </div>

      {/* Step Indicator Pill */}
      <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200/80 shadow-xs">
        <span className="w-5 h-5 rounded-full bg-[#4f14e2] text-white text-[11px] font-bold flex items-center justify-center">
          4
        </span>
        <span className="font-semibold text-slate-800">OTP Verification</span>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={<div className="text-center p-8 text-xs font-mono text-slate-500">Loading verification...</div>}
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
