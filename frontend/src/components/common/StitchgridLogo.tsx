import React from "react";

interface StitchgridLogoProps {
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}

export function StitchgridLogo({ subtitle, size = "md" }: StitchgridLogoProps) {
  const iconSize = size === "sm" ? 28 : size === "lg" ? 40 : 34;
  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-2xl" : "text-xl sm:text-2xl";

  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center justify-center gap-2.5">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 34 34"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="shrink-0 text-purple-700"
        >
          {/* Stylized 6-armed textile stitch asterisk matching reference */}
          <line x1="5" y1="17" x2="29" y2="17" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
          <line x1="11" y1="6.6" x2="23" y2="27.4" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
          <line x1="23" y1="6.6" x2="11" y2="27.4" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
        </svg>
        <span className={`font-sans font-bold tracking-tight text-gray-950 ${textSize}`}>
          STITCHGRID
        </span>
      </div>
      {subtitle && (
        <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-xs leading-relaxed font-normal">
          {subtitle}
        </p>
      )}
    </div>
  );
}
