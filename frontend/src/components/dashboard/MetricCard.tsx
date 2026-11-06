import React from "react";
import { cn } from "@/utils";

export interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon: string;
  iconBg?: string;
  subtitle?: string;
}

export function MetricCard({
  title,
  value,
  change,
  isPositive = true,
  icon,
  iconBg = "bg-primary-fixed text-primary",
  subtitle,
}: MetricCardProps) {
  return (
    <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-secondary font-sans">
          {title}
        </span>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm", iconBg)}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold font-sans text-on-surface tracking-tight">
          {value}
        </span>
        {change && (
          <span
            className={cn(
              "text-xs font-bold font-mono px-1.5 py-0.5 rounded",
              isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            )}
          >
            {isPositive ? "+" : ""}{change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-secondary">{subtitle}</p>
      )}
    </div>
  );
}

