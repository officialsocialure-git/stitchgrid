"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { marketplaceService } from "@/services/marketplace.service";

interface RequestSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RequestSampleModal({
  isOpen,
  onClose,
  onSuccess,
}: RequestSampleModalProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [sampleType, setSampleType] = useState("Final Sample");
  const [quantity, setQuantity] = useState("5 pcs");
  const [sampleName, setSampleName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOrders();
    }
  }, [isOpen]);

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      setError(null);
      const data = await marketplaceService.listOrders();
      if (Array.isArray(data) && data.length > 0) {
        setOrders(data);
        setSelectedOrderId(data[0].id);
        const firstItem = data[0].items?.[0]?.name || "Sample Garment";
        setSampleName(firstItem);
      }
    } catch (err: any) {
      console.error("Failed to load orders for sample request:", err);
      setError("Failed to fetch active purchase orders.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const orderId = e.target.value;
    setSelectedOrderId(orderId);
    const found = orders.find((o) => o.id === orderId);
    if (found && found.items?.[0]?.name) {
      setSampleName(found.items[0].name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      setError("Please select a purchase order.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Format notes with sample type and quantity
      const formattedNotes = `${sampleType} (${quantity}) - ${sampleName}. ${notes.trim()}`;
      await marketplaceService.createSample(selectedOrderId, formattedNotes);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to create sample request:", err);
      setError(err?.message || "Failed to create sample request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request Physical Sample"
      description="Notify the manufacturer to prepare and courier physical garment samples for verification."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {/* Purchase Order Selector */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Purchase Order <span className="text-rose-500">*</span>
          </label>
          {loadingOrders ? (
            <div className="h-10 px-3 flex items-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              Loading active orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="p-3 text-xs text-amber-800 bg-amber-50 rounded-xl border border-amber-200">
              No active purchase orders found. Samples must be linked to an approved purchase order.
            </div>
          ) : (
            <select
              value={selectedOrderId}
              onChange={handleOrderChange}
              required
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.poNumber || `PO-${o.id.slice(0, 8)}`} — {o.supplier?.name || "Supplier"} ({o.items?.[0]?.name || "Garment"})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Sample Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Sample Name / Garment Item <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={sampleName}
            onChange={(e) => setSampleName(e.target.value)}
            placeholder="e.g. Heavyweight Hoodie, Polo T-Shirt, Joggers"
            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
          />
        </div>

        {/* Sample Type & Quantity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Sample Type <span className="text-rose-500">*</span>
            </label>
            <select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            >
              <option value="Final Sample">Final Sample (PP / Pre-Production)</option>
              <option value="First Sample">First Sample (Proto)</option>
              <option value="Color Sample">Color Sample (Lab Dip / Swatch)</option>
              <option value="Size Set">Size Set (S to XXL)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Quantity Required <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 5 pcs, 3 sets"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
          </div>
        </div>

        {/* Technical Notes & Requirements */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Inspection Notes &amp; Specifications
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Verify 400 GSM French Terry fabric weight, color fastness, neck rib elasticity, and bio-wash feel..."
            className="w-full p-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
          />
        </div>

        {/* Footer Actions */}
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
            disabled={submitting || orders.length === 0}
            className="px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Send Sample Request</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

