"use client";

import React from "react";
import Link from "next/link";
import { Modal } from "@/components/common/Modal";

interface RfqDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfq: any;
  onOpenInvite?: () => void;
  onDelete?: (rfqId: string) => void;
}

export function RfqDetailsModal({
  isOpen,
  onClose,
  rfq,
  onOpenInvite,
  onDelete,
}: RfqDetailsModalProps) {
  if (!rfq) return null;

  const quoteCount = rfq.quotations?.length || 0;
  const isAwarded = rfq.status === "AWARDED";
  const isDraft = rfq.status === "DRAFT";
  const isOpenStatus = rfq.status === "OPEN";

  const displayStatus = isAwarded
    ? "Awarded"
    : isOpenStatus && quoteCount > 0
    ? "Quotes Received"
    : isOpenStatus
    ? "Open"
    : isDraft
    ? "Draft"
    : rfq.status;

  const statusBadgeStyle = isAwarded || displayStatus === "Quotes Received"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : displayStatus === "Open"
    ? "bg-amber-50 text-amber-800 border-amber-200"
    : "bg-gray-100 text-gray-700 border-gray-200";

  const formattedDate = rfq.targetDate
    ? new Date(rfq.targetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Flexible";

  const createdDateFormatted = rfq.createdAt
    ? new Date(rfq.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Recent";

  const rfqIdDisplay = `#RFQ-${(rfq.id || "0000").slice(-4).toUpperCase()}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rfq.title || "RFQ Details"}
      description={`Request ID: ${rfqIdDisplay} • Created on ${createdDateFormatted}`}
      className="w-full max-w-2xl p-4 sm:p-6 max-h-[calc(100dvh-1rem)] sm:max-h-[90vh]"
    >
      <div className="space-y-4 pt-1">
        {/* Status & Category Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-purple-50/50 border border-purple-100">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary bg-primary-fixed px-2.5 py-0.5 rounded-full">
              {rfqIdDisplay}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeStyle}`}>
              <span>{displayStatus}</span>
            </span>
          </div>

          <div className="text-xs font-semibold text-gray-700">
            Category: <span className="text-primary font-bold">{rfq.garmentType || "Garment"}</span>
          </div>
        </div>

        {/* Core Specs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Target Quantity</span>
            <span className="text-sm font-bold text-gray-900 mt-0.5 block">
              {rfq.targetQuantity?.toLocaleString()} {rfq.items?.[0]?.unit || "pcs"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Target Delivery</span>
            <span className="text-sm font-bold text-gray-900 mt-0.5 block">{formattedDate}</span>
          </div>

          <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Target Unit Price</span>
            <span className="text-sm font-bold text-primary mt-0.5 block">
              {rfq.targetPrice ? `₹${Number(rfq.targetPrice).toFixed(0)} / pc` : "Competitive Bidding"}
            </span>
          </div>
        </div>

        {/* Fabric & Materials */}
        {rfq.fabricSpec && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Fabric &amp; Material Spec</h4>
            <div className="p-3 rounded-xl bg-white border border-gray-200 text-xs sm:text-sm text-gray-800">
              {rfq.fabricSpec}
            </div>
          </div>
        )}

        {/* Detailed Requirements Description */}
        {rfq.description && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Production Specifications &amp; Notes</h4>
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-700 leading-relaxed max-h-[140px] overflow-y-auto">
              {rfq.description}
            </div>
          </div>
        )}

        {/* Received Quotes Section */}
        {rfq.quotations && rfq.quotations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Received Supplier Quotes ({rfq.quotations.length})
              </h4>
              <Link
                href={`/quotations?rfqId=${rfq.id}`}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5"
              >
                <span>Compare All Quotes</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto">
              {rfq.quotations.map((q: any) => (
                <div
                  key={q.id}
                  className="p-3 rounded-xl bg-white border border-gray-200 flex items-center justify-between gap-3 hover:border-purple-200 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-xs text-gray-900 block truncate">
                      {q.supplier?.name || "Textile Supplier"}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Lead time: {q.leadTimeDays || 15} days • {q.supplier?.city || "India"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xs font-bold text-primary block">
                      ₹{Number(q.totalAmount || 0).toLocaleString("en-IN")}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {q.status === "ACCEPTED" ? "✓ Accepted" : "Ready to Review"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-start gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(rfq.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Delete</span>
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto grid grid-cols-2 sm:flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenInvite?.();
              }}
              className="min-w-0 w-full sm:w-auto px-2.5 sm:px-3.5 py-2 rounded-xl border border-purple-200 text-primary hover:bg-purple-50 text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>Invite Suppliers</span>
            </button>

            <Link href={`/quotations?rfqId=${rfq.id}`} className="min-w-0 w-full sm:w-auto">
              <button
                type="button"
                className="w-full min-w-0 px-2.5 sm:px-4 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5 text-center"
              >
                <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                <span>Compare Quotes</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </Modal>
  );
}

