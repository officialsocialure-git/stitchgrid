"use client";

import React from "react";
import { Button } from "@/components/common/Button";

export default function DisputesPage() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
        <div>
          <h1 className="font-extrabold text-3xl text-on-surface leading-[1.2]">Mediation & Quality Disputes</h1>
          <p className="text-sm text-secondary mt-1 leading-[1.5]">
            Fair resolution backed by independent fabric lab reports and AQL standards.
          </p>
        </div>

        <Button variant="outline" icon="add">
          Raise New Dispute
        </Button>
      </div>

      <div className="p-8 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-center flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-[32px]">verified_user</span>
        </div>
        <h3 className="font-sans font-bold text-lg text-on-surface">No Active Disputes</h3>
        <p className="text-xs text-secondary max-w-md mt-1">
          All your orders are operating smoothly within contract tolerance and milestone agreements.
        </p>
      </div>
    </div>
  );
}

