"use client";

import React, { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/hooks/useAuth";
import { marketplaceService } from "@/services/marketplace.service";

interface CompleteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  currentCity?: string;
  currentCapacity?: string;
}

export function CompleteProfileModal({
  isOpen,
  onClose,
  onSuccess,
  currentCity = "Tirupur",
  currentCapacity = "25,000 pcs / month",
}: CompleteProfileModalProps) {
  const { membership } = useAuth();
  const [city, setCity] = useState(currentCity);
  const [capacity, setCapacity] = useState(currentCapacity);
  const [years, setYears] = useState("8");
  const [certifications, setCertifications] = useState("OEKO-TEX, SEDEX, GOTS Certified");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!membership?.organizationId) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const parsedCapacity = parseInt(capacity.replace(/\D/g, ""), 10) || 50000;
      const parsedYears = parseInt(years, 10) || 8;

      await marketplaceService.updateOrganizationProfile({
        organizationId: membership.organizationId,
        city: city.trim(),
        productionCapacity: parsedCapacity,
        yearsInBusiness: parsedYears,
        description: `Certifications: ${certifications.trim()}`,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess?.();
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("Profile update error:", err);
      setErrorMsg(err?.message || "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Business Profile"
      description="Fill in your factory capacity and certifications to achieve 100% profile completion."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {success && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>Profile saved to database! Completion score updated.</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Operating City / Textile Hub
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Tirupur, Surat, Noida"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Monthly Capacity
            </label>
            <input
              type="text"
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="e.g. 50,000 pcs / month"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Years in Garment Export
            </label>
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="e.g. 10"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Audit & Compliance Badges
            </label>
            <input
              type="text"
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="e.g. OEKO-TEX, SEDEX, BSCI"
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
            <span>{submitting ? "Saving..." : "Save Profile Details"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
