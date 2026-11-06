"use client";

import React, { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { marketplaceService } from "@/services/marketplace.service";

interface UpdateCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpdateCatalogModal({
  isOpen,
  onClose,
  onSuccess,
}: UpdateCatalogModalProps) {
  const { membership } = useAuth();
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("Garment (Apparel)");
  const [unitPrice, setUnitPrice] = useState("");
  const [moq, setMoq] = useState("300");
  const [fabricSpec, setFabricSpec] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !membership?.organizationId) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const parsedPrice = parseFloat(unitPrice) || 180;
      const parsedMoq = parseInt(moq, 10) || 300;

      await marketplaceService.updateOrganizationProfile({
        organizationId: membership.organizationId,
        categories: [category, productName.trim()],
        description: `Featured Product: ${productName.trim()} | MOQ: ${parsedMoq} pcs | Est. ₹${parsedPrice}/pc | Fabric: ${fabricSpec || "Standard Garment Grade"}`,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("Failed to update catalogue:", err);
      setErrorMsg(err?.message || "Failed to update catalog.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Factory Catalogue"
      description="Add or modify products and manufacturing capabilities in your public B2B catalog."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Product added to your factory catalogue in MySQL database!</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Product / Item Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. 240 GSM Oversized Heavy Cotton T-Shirt"
            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            >
              <option value="Garment (Apparel)">Garment (Apparel)</option>
              <option value="Knits & Cut-Sew">Knits &amp; Cut-Sew</option>
              <option value="Woven & Formal">Woven &amp; Formal</option>
              <option value="Fabric Mill">Fabric Mill</option>
              <option value="Trims & Accessories">Trims &amp; Accessories</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Minimum Order Quantity (MOQ)
            </label>
            <input
              type="number"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
              placeholder="300"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Target Unit Price (₹)
            </label>
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="e.g. 180"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Fabric Specifications
            </label>
            <input
              type="text"
              value={fabricSpec}
              onChange={(e) => setFabricSpec(e.target.value)}
              placeholder="e.g. 100% Combed Cotton, Bio-Washed"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting && (
              <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            )}
            <span>{submitting ? "Updating..." : "Add to Catalogue"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
