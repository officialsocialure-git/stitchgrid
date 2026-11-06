"use client";

import React, { useState } from "react";
import { Button } from "@/components/common/Button";

interface ReviewItem {
  id: string;
  supplier: string;
  rating: number;
  date: string;
  po: string;
  comment: string;
}

export default function ReviewsPage() {
  const [reviews] = useState<ReviewItem[]>([]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
        <div>
          <h1 className="font-sans font-bold text-2xl text-on-surface">Manufacturer Ratings & Feedback</h1>
          <p className="text-xs text-secondary mt-1">
            Build your organization&apos;s verified buyer reputation across Indian textile hubs.
          </p>
        </div>

        <Button variant="primary" icon="rate_review">
          Leave New Review
        </Button>
      </div>

      {reviews.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-secondary mb-3">
            <span className="material-symbols-outlined text-[28px]">star_rate</span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">No reviews yet</h3>
          <p className="text-xs text-secondary mt-1 max-w-sm">
            Once a purchase order is fulfilled and delivered, you can rate and review the manufacturer here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-sans font-bold text-base text-on-surface">{r.supplier}</h3>
                  <span className="font-mono text-xs text-primary">{r.po}</span>
                </div>
                <div className="flex items-center gap-1 text-amber-500">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <span key={i} className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed mt-1">
                &quot;{r.comment}&quot;
              </p>
              <span className="text-[10px] text-secondary font-mono">{r.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
