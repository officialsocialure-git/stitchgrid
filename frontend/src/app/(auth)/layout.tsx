import React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-[#fbfbfe] overflow-x-hidden flex flex-col justify-center items-center py-6 px-4 sm:px-6 selection:bg-[#6D28D9] selection:text-white">
      {/* Decorative Fluid Corner Waves (Fixed and non-interactive to prevent overflow & scrolling) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        {/* Top-Left Wave */}
        <svg
          className="absolute -top-6 -left-6 w-[280px] sm:w-[420px] md:w-[520px] h-[220px] sm:h-[320px] md:h-[400px] text-purple-600/25 transition-all duration-700"
          viewBox="0 0 520 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="topLeftGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.45" />
              <stop offset="40%" stopColor="#8B5CF6" stopOpacity="0.30" />
              <stop offset="80%" stopColor="#C4B5FD" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="topLeftInnerGrad" x1="0%" y1="0%" x2="80%" y2="80%">
              <stop offset="0%" stopColor="#6D28D9" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Soft outer swell */}
          <path
            d="M 0,0 L 0,380 C 90,360 170,300 240,240 C 320,170 380,110 520,70 L 520,0 Z"
            fill="url(#topLeftGrad)"
          />
          {/* Inner vibrant accent curve */}
          <path
            d="M 0,0 L 0,260 C 70,240 130,190 190,140 C 260,80 320,40 400,0 Z"
            fill="url(#topLeftInnerGrad)"
          />
        </svg>

        {/* Bottom-Right Wave */}
        <svg
          className="absolute -bottom-6 -right-6 w-[280px] sm:w-[420px] md:w-[520px] h-[220px] sm:h-[320px] md:h-[400px] text-purple-600/25 transition-all duration-700"
          viewBox="0 0 520 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="bottomRightGrad" x1="100%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.45" />
              <stop offset="40%" stopColor="#8B5CF6" stopOpacity="0.30" />
              <stop offset="80%" stopColor="#C4B5FD" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="bottomRightInnerGrad" x1="100%" y1="100%" x2="20%" y2="20%">
              <stop offset="0%" stopColor="#6D28D9" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Soft outer swell */}
          <path
            d="M 520,400 L 520,20 C 430,40 350,100 280,160 C 200,230 140,290 0,330 L 0,400 Z"
            fill="url(#bottomRightGrad)"
          />
          {/* Inner vibrant accent curve */}
          <path
            d="M 520,400 L 520,140 C 450,160 390,210 330,260 C 260,320 200,360 120,400 Z"
            fill="url(#bottomRightInnerGrad)"
          />
        </svg>
      </div>

      {/* Main Card / Page Content (Centered above backdrop) */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
