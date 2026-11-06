import React from "react";
import { cn } from "@/utils";

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export function SearchInput({ className, value, onClear, ...props }: SearchInputProps) {
  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <span className="material-symbols-outlined absolute left-3.5 text-secondary text-[20px] pointer-events-none">
        search
      </span>
      <input
        type="text"
        value={value}
        className="w-full h-11 pl-11 pr-10 rounded-xl bg-surface-container-lowest border border-outline-variant/50 focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface text-sm transition-all placeholder:text-outline/70 shadow-sm"
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-3 p-1 rounded-full text-secondary hover:text-on-surface hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
}

