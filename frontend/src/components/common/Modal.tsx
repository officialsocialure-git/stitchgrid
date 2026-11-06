"use client";

import React, { useEffect } from "react";
import { cn } from "@/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-on-surface/50 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative w-full max-w-lg bg-surface-container-lowest rounded-2xl shadow-2xl border border-outline-variant/30 p-6 z-10 max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-3 pb-4 border-b border-surface-container-high">
          <div className="min-w-0 flex-1">
            <h3 className="font-sans font-bold text-lg text-on-surface break-words">{title}</h3>
            {description && (
              <p className="text-xs text-on-surface-variant mt-0.5 break-words">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="mt-4 min-w-0">{children}</div>
      </div>
    </div>
  );
}

