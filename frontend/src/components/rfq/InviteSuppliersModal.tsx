"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/common/Modal";
import { marketplaceService } from "@/services/marketplace.service";

interface InviteSuppliersModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfqId: string;
  rfqTitle: string;
}

export function InviteSuppliersModal({
  isOpen,
  onClose,
  rfqId,
  rfqTitle,
}: InviteSuppliersModalProps) {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedIds, setInvitedIds] = useState<{ [key: string]: boolean }>({});
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    async function fetchSuppliers() {
      try {
        setLoading(true);
        const data = await marketplaceService.searchSuppliers();
        setSuppliers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch suppliers for invitation:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSuppliers();
  }, [isOpen]);

  const handleInvite = async (supplierOrgId: string) => {
    try {
      setInvitingId(supplierOrgId);
      await marketplaceService.inviteSupplier(rfqId, supplierOrgId);
      setInvitedIds((prev) => ({ ...prev, [supplierOrgId]: true }));
    } catch (err) {
      console.error("Failed to invite supplier:", err);
    } finally {
      setInvitingId(null);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const name = s.organization?.name?.toLowerCase() || "";
    const city = s.organization?.city?.toLowerCase() || "";
    const type = s.organization?.businessType?.toLowerCase() || "";
    const query = search.toLowerCase().trim();
    return !query || name.includes(query) || city.includes(query) || type.includes(query);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Verified Suppliers"
      description={`Invite suppliers to submit competitive quotations for: "${rfqTitle}"`}
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined text-[18px] text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search verified suppliers by name, category or city..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC]"
          />
        </div>

        {/* Suppliers List */}
        <div className="max-h-[350px] overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <span className="text-xs text-gray-500">Loading verified suppliers...</span>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
              No suppliers found matching your query.
            </div>
          ) : (
            filteredSuppliers.map((s) => {
              const org = s.organization || {};
              const orgId = s.organizationId;
              const isInvited = !!invitedIds[orgId];
              const isInviting = invitingId === orgId;

              return (
                <div
                  key={s.id}
                  className="p-3.5 rounded-xl border border-gray-200 hover:border-purple-200 bg-white flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-primary flex items-center justify-center shrink-0 border border-purple-100">
                      <span className="material-symbols-outlined text-[20px]">factory</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                          {org.name || "Textile Mill"}
                        </h4>
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100">
                          <span className="material-symbols-outlined text-[11px] font-bold">check</span>
                          <span>Verified</span>
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate mt-0.5">
                        {org.businessType || "Manufacturer"} • {org.city || "India"}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isInvited || isInviting}
                    onClick={() => handleInvite(orgId)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 ${
                      isInvited
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-[#5B13EC] hover:bg-[#4d0ecf] text-white shadow-xs active:scale-95"
                    }`}
                  >
                    {isInviting ? (
                      <>
                        <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                        <span>Inviting...</span>
                      </>
                    ) : isInvited ? (
                      <>
                        <span className="material-symbols-outlined text-[14px]">done</span>
                        <span>Invited</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[14px]">send</span>
                        <span>Invite to RFQ</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

