import React from "react";
import { cn } from "@/utils";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "success" | "warning" | "error" | "neutral";
  size?: "sm" | "md";
  className?: string;
  icon?: string;
}

export function Badge({
  children,
  variant = "neutral",
  size = "md",
  className,
  icon,
}: BadgeProps) {
  const variants = {
    primary: "bg-primary-fixed text-primary border-primary-fixed-dim",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-surface-container-high text-on-surface-variant border-outline-variant/40",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-semibold rounded-full border tracking-wide uppercase font-sans",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {icon && (
        <span className="material-symbols-outlined text-[13px] leading-none" style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

