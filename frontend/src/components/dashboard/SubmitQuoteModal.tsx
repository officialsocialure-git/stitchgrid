"use client";

import React, { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { marketplaceService } from "@/services/marketplace.service";
import { useAuth } from "@/hooks/useAuth";

interface SubmitQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfq: any;
  onSuccess?: () => void;
}

export function SubmitQuoteModal({
  isOpen,
  onClose,
  rfq,
  onSuccess,
}: SubmitQuoteModalProps) {
  const { membership } = useAuth();
  const [unitPrice, setUnitPrice] = useState("185");
  const [leadTimeDays, setLeadTimeDays] = useState("21");
  const [sampleDays, setSampleDays] = useState("7");
  const [terms, setTerms] = useState("50% payment on PO confirmation, 50% after final quality approval");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!rfq) return null;

  const targetQty = rfq.targetQuantity || rfq.items?.[0]?.quantity || 1000;
  const totalAmount = (parseFloat(unitPrice) || 0) * targetQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership?.organizationId) return;

    try {
      setSubmitting(true);
      setError(null);

      const price = parseFloat(unitPrice) || 0;
      const lead = parseInt(leadTimeDays, 10) || 21;

      await marketplaceService.submitQuote({
        rfqId: rfq.id,
        supplierOrgId: membership.organizationId,
        totalAmount,
        leadTimeDays: lead,
        sampleLeadDays: parseInt(sampleDays, 10) || 7,
        terms,
        items: [
          {
            description: `${rfq.title || "Garment Lot"} - Factory quote`,
            quantity: targetQty,
            unitPrice: price,
          },
        ],
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error("Failed to submit quotation:", err);
      setError(err?.message || "Failed to submit quote. Please verify details.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Quotation"
      description={`Send competitive quote for ${rfq.title || "RFQ tender"}`}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Quotation sent to buyer successfully!</span>
          </div>
        )}

        {/* Overview Box */}
        <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Target Quantity:</span>
            <span className="font-bold text-slate-900">{targetQty.toLocaleString()} pcs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Buyer Target Delivery:</span>
            <span className="font-bold text-slate-900">
              {rfq.targetDate ? new Date(rfq.targetDate).toLocaleDateString("en-IN") : "Flexible"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Unit Price (₹ INR / pc) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="e.g. 185"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Bulk Lead Time (Days) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
              placeholder="e.g. 21"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all font-mono"
            />
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-600 font-medium">Estimated Total Contract:</span>
          <span className="font-bold text-base text-[#5B13EC] font-mono">
            ₹{totalAmount.toLocaleString("en-IN")}
          </span>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Sample Lead Time (Days)
          </label>
          <input
            type="number"
            value={sampleDays}
            onChange={(e) => setSampleDays(e.target.value)}
            placeholder="7"
            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Commercial Terms &amp; Payment Milestones
          </label>
          <textarea
            rows={2}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full p-3 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !unitPrice}
            className="px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? "Sending..." : "Send Quotation"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

