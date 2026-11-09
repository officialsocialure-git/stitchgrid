"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { marketplaceService } from "@/services/marketplace.service";
import { SampleDetailsModal } from "@/components/samples/SampleDetailsModal";
import { RequestSampleModal } from "@/components/samples/RequestSampleModal";
import {
  SupplierSamplesView,
  SupplierSampleItem,
} from "@/components/samples/SupplierSamplesView";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type FilterTab = "All" | "New Samples" | "Checking" | "Approved" | "Changes Needed";

interface SampleRow {
  id: string;
  sampleName: string;
  supplierName: string;
  orderId: string;
  sampleType: string;
  quantity: string;
  sentDate: string;
  rawDate: Date;
  status: "REQUESTED" | "IN_PROGRESS" | "DISPATCHED" | "APPROVED" | "REJECTED" | "REVISION_REQUIRED";
  statusCategory: FilterTab;
  notes: string;
  rawSample: any;
}

export default function SamplesPage() {
  const { membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";
  const { notifications, markRead } = useNotifications();
  const [rawSamples, setRawSamples] = useState<any[]>([]);
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [draftActiveTab, setDraftActiveTab] = useState<FilterTab>("All");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  // Modals state
  const [selectedSample, setSelectedSample] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Quick Revision inline modal for "Ask for Changes" button on list row
  const [quickRevisionSampleId, setQuickRevisionSampleId] = useState<string | null>(null);
  const [quickRevisionFeedback, setQuickRevisionFeedback] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Load samples from real API / DB
  const loadSamples = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listSamples();
      setRawSamples(Array.isArray(data) ? data : []);

      if (Array.isArray(data) && data.length > 0) {
        const mapped: SampleRow[] = data.map((s: any) => {
          const po = s.purchaseOrder || {};
          const supplier = po.supplier || {};
          const item = po.items?.[0] || {};

          // Clean sample name
          let name = item.name || "Apparel Sample";
          if (name.includes("(Cut, Sew")) {
            name = name.split("(")[0].trim();
          }
          if (!name || name === "Apparel Sample") {
            if (s.notes?.includes("Hoodie")) name = "Heavyweight Hoodie";
            else if (s.notes?.includes("T-Shirt") || s.notes?.includes("Polo")) name = "Polo T-Shirt";
            else if (s.notes?.includes("Jogger")) name = "Cotton Joggers";
          }

          const orderNum = po.poNumber
            ? po.poNumber.replace("SG-", "")
            : `PO-${s.purchaseOrderId?.slice(-4) || "6479"}`;

          // Sample Type
          const rawNotes = s.notes || "";
          let sampleType = "Final Sample";
          if (rawNotes.toLowerCase().includes("first")) sampleType = "First Sample";
          else if (rawNotes.toLowerCase().includes("color") || rawNotes.toLowerCase().includes("swatch")) sampleType = "Color Sample";
          else if (rawNotes.toLowerCase().includes("lab dip")) sampleType = "Lab Dip";
          else if (rawNotes.toLowerCase().includes("size set")) sampleType = "Size Set";
          else if (rawNotes.toLowerCase().includes("pp") || rawNotes.toLowerCase().includes("pre-production")) sampleType = "Final Sample";

          // Status Category
          let category: FilterTab = "New Samples";
          if (s.status === "APPROVED") category = "Approved";
          else if (s.status === "REVISION_REQUIRED" || s.status === "REJECTED") category = "Changes Needed";
          else if (s.status === "IN_PROGRESS") category = "Checking";
          else category = "New Samples";

          const rawDate = new Date(s.createdAt || Date.now());
          const sentDate = rawDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return {
            id: s.id,
            sampleName: name,
            supplierName: supplier.name || "Northstar Apparel Works",
            orderId: orderNum,
            sampleType,
            quantity: "5 pcs",
            sentDate,
            rawDate,
            status: s.status || "REQUESTED",
            statusCategory: category,
            notes: s.notes || "",
            rawSample: s,
          };
        });

        setSamples(mapped);
      } else {
        setSamples([]);
      }
    } catch (err) {
      console.error("Failed to load samples:", err);
      setSamples([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  useRealtimeSync({
    topics: ["sample:created", "sample:updated", "order:updated"],
    onSync: loadSamples,
    pollIntervalMs: 25000,
  });

  // Opening the buyer Samples area acknowledges its sample-received alerts.
  useEffect(() => {
    if (isSupplier) return;
    notifications
      .filter((notification) => notification.title === "Sample received" && !notification.readAt)
      .forEach((notification) => {
        markRead(notification.id).catch((error) => console.error("Failed to mark sample alert as read:", error));
      });
  }, [isSupplier, notifications, markRead]);

  // Keep the status filter sheet keyboard-accessible and prevent background scrolling.
  useEffect(() => {
    if (!isStatusFilterOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsStatusFilterOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isStatusFilterOpen]);

  // Tab counts
  const counts = useMemo(() => {
    return {
      All: samples.length,
      "New Samples": samples.filter((s) => s.statusCategory === "New Samples").length,
      Checking: samples.filter((s) => s.statusCategory === "Checking").length,
      Approved: samples.filter((s) => s.statusCategory === "Approved").length,
      "Changes Needed": samples.filter((s) => s.statusCategory === "Changes Needed").length,
    };
  }, [samples]);

  // Filtered & Sorted Samples
  const filteredSamples = useMemo(() => {
    let result = [...samples];

    // 1. Tab filter
    if (activeTab !== "All") {
      result = result.filter((s) => s.statusCategory === activeTab);
    }

    // 2. Type filter
    if (typeFilter !== "All") {
      result = result.filter((s) => s.sampleType.toLowerCase().includes(typeFilter.toLowerCase()));
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.sampleName.toLowerCase().includes(q) ||
          s.supplierName.toLowerCase().includes(q) ||
          s.orderId.toLowerCase().includes(q) ||
          s.sampleType.toLowerCase().includes(q)
      );
    }

    // 4. Sort
    result.sort((a, b) => {
      const timeA = a.rawDate.getTime();
      const timeB = b.rawDate.getTime();
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [samples, activeTab, typeFilter, searchQuery, sortBy]);

  // Action: Approve
  const handleApprove = async (sampleId: string) => {
    try {
      await marketplaceService.updateSample(sampleId, "APPROVED", {
        feedback: "Sample prototype approved by buyer for bulk production line.",
      });
      setActionSuccessMsg("Sample approved successfully! Bulk production unlocked.");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadSamples();
    } catch (err: any) {
      console.error("Failed to approve sample:", err);
      alert(err?.message || "Failed to approve sample.");
    }
  };

  // Action: Ask for Changes
  const handleAskChanges = async (sampleId: string, feedback: string) => {
    try {
      await marketplaceService.updateSample(sampleId, "REVISION_REQUIRED", {
        feedback,
      });
      setActionSuccessMsg("Changes requested and feedback sent to manufacturer.");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadSamples();
    } catch (err: any) {
      console.error("Failed to request changes:", err);
      alert(err?.message || "Failed to submit revision request.");
    }
  };

  // Action: Dispatch Sample (Supplier)
  const handleDispatch = async (sampleId: string) => {
    try {
      await marketplaceService.updateSample(sampleId, "DISPATCHED");
      setActionSuccessMsg("Sample dispatched successfully! Buyer can now review and approve.");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadSamples();
    } catch (err: any) {
      console.error("Failed to dispatch sample:", err);
      alert(err?.message || "Failed to update sample status.");
    }
  };

  const handleOpenDetails = (sample: SampleRow) => {
    setSelectedSample(sample.rawSample);
    setIsDetailsOpen(true);
  };

  const handleOpenQuickRevision = (sampleId: string) => {
    setQuickRevisionSampleId(sampleId);
    setQuickRevisionFeedback("");
  };

  const submitQuickRevision = async () => {
    if (!quickRevisionSampleId || !quickRevisionFeedback.trim()) return;
    try {
      setSubmittingRevision(true);
      await handleAskChanges(quickRevisionSampleId, quickRevisionFeedback.trim());
      setQuickRevisionSampleId(null);
      setQuickRevisionFeedback("");
    } finally {
      setSubmittingRevision(false);
    }
  };

  // Map samples to SupplierSampleItem format (for Supplier login view)
  const supplierSamples: SupplierSampleItem[] = useMemo(() => {
    if (!rawSamples || rawSamples.length === 0) {
      return [];
    }

    return rawSamples.map((s: any) => {
      const po = s.purchaseOrder || {};
      const buyer = po.buyer || {};
      const item = po.items?.[0] || {};

      let name = item.name || "Apparel Sample";
      if (name.includes("(Cut, Sew")) name = name.split("(")[0].trim();
      if (!name || name === "Apparel Sample" || name === "Apparel Production Lot") {
        if (s.notes?.includes("Hoodie")) name = "Heavyweight Hoodie";
        else if (s.notes?.includes("T-Shirt") || s.notes?.includes("Polo")) name = "Polo T-Shirt";
        else if (s.notes?.includes("Jogger")) name = "Cotton Joggers";
        else name = "Custom Apparel Prototype";
      }

      const orderNum = po.poNumber
        ? po.poNumber.replace("SG-", "")
        : `PO-2026-${(po.id || "2483").slice(-4)}`;

      const rawNotes = s.notes || "";
      let sampleType = s.parsedMeta?.sampleType || "Final Sample";
      if (rawNotes.toLowerCase().includes("first")) sampleType = "First Sample";
      else if (rawNotes.toLowerCase().includes("color")) sampleType = "Color Sample";
      else if (rawNotes.toLowerCase().includes("lab dip")) sampleType = "Lab Dip";
      else if (rawNotes.toLowerCase().includes("size set")) sampleType = "Size Set";

      let status: "To Make" | "Sent" | "Waiting for Buyer" | "Approved" = "To Make";
      if (s.status === "APPROVED") status = "Approved";
      else if (s.status === "DISPATCHED") status = "Waiting for Buyer";
      else if (s.status === "IN_PROGRESS") status = "Sent";
      else status = "To Make";

      const rawDate = new Date(s.createdAt || Date.now());
      const dueDate = po.expectedDate
        ? new Date(po.expectedDate).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })
        : "12 Nov 2026";

      const fabric = name.includes("Hoodie")
        ? "French Terry (400 GSM)"
        : name.includes("T-shirt") || name.includes("Polo")
        ? "100% Cotton, 180 GSM"
        : name.includes("Jogger")
        ? "Cotton Fleece (300 GSM)"
        : "Cotton Linen";

      const color = name.includes("Hoodie")
        ? "Navy Blue"
        : name.includes("T-shirt")
        ? "Charcoal Grey"
        : name.includes("Jogger")
        ? "Olive Green"
        : "Beige";

      // Real photos parsed from the database
      const photos = Array.isArray(s.photos) && s.photos.length > 0
        ? s.photos
        : (s.parsedMeta?.photos && Array.isArray(s.parsedMeta.photos) && s.parsedMeta.photos.length > 0
            ? s.parsedMeta.photos
            : []);

      return {
        id: s.id,
        productName: name,
        buyerName: buyer.name || "Enterprise Buyer",
        orderId: orderNum,
        sampleType,
        quantity: "5 pcs",
        dueDate,
        rawDate,
        status,
        fabric,
        color,
        sizes: "S, M, L, XL",
        finish: "Bio-wash & Compacted",
        buyerNote: s.buyerFeedback || s.notes || "Please check garment dimensions, fabric GSM, and stitching finish.",
        rawSample: s,
        photos,
      };
    });
  }, [rawSamples]);

  // If logged in as Supplier, render dedicated Supplier Samples View (Matches Reference Image)
  if (isSupplier) {
    return (
      <SupplierSamplesView
        samples={supplierSamples}
        loading={loading}
        onRefresh={loadSamples}
      />
    );
  }

  const tabs: FilterTab[] = ["All", "New Samples", "Checking", "Approved", "Changes Needed"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Success Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 p-1"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Header Section: Matches Reference Image 1 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-extrabold text-3xl text-slate-900 tracking-tight leading-[1.2]">
            Samples
          </h1>
          <p className="text-sm text-slate-500 mt-1 leading-[1.5]">
            {isSupplier
              ? "Review prototype specifications, inspect buyer feedback, and dispatch physical samples."
              : "Check product samples and approve them before making bulk order."}
          </p>
        </div>

        {/* Top Right Action: + Request Sample */}
        <button
          type="button"
          onClick={() => setIsRequestModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-98"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>Request Sample</span>
        </button>
      </div>

      {/* Search, status filter trigger and existing type/sort controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by sample name, supplier or order ID..."
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Filter samples by status"
            aria-haspopup="dialog"
            aria-expanded={isStatusFilterOpen}
            onClick={() => {
              setDraftActiveTab(activeTab);
              setIsStatusFilterOpen(true);
            }}
            className={`relative h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center transition-colors ${
              activeTab !== "All"
                ? "bg-purple-100 border-purple-200 text-[#5B13EC]"
                : "bg-white border-slate-200 text-[#5B13EC] hover:bg-purple-50"
            }`}
          >
            <span className="material-symbols-outlined text-[22px]">tune</span>
            {activeTab !== "All" && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#5B13EC] border-2 border-white" />}
          </button>
        </div>

        {/* Existing sample type and sorting filters remain available */}
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-11 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all cursor-pointer"
            >
              <option value="All">Sample Type (All)</option>
              <option value="Final">Final Sample</option>
              <option value="First">First Sample</option>
              <option value="Color">Color Sample</option>
              <option value="Lab Dip">Lab Dip</option>
              <option value="Size Set">Size Set</option>
            </select>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">
              expand_more
            </span>
          </div>

          <div className="relative min-w-0 flex-1 sm:flex-none">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
              className="w-full h-11 pl-8 pr-8 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">
              swap_vert
            </span>
            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* Status filter bottom sheet / desktop dialog */}
      {isStatusFilterOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-0 sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsStatusFilterOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sample-status-filter-title"
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-5 animate-fade-in"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 id="sample-status-filter-title" className="text-lg font-extrabold text-slate-900">Filter Samples</h2>
              <button
                type="button"
                aria-label="Close filters"
                onClick={() => setIsStatusFilterOpen(false)}
                className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {tabs.map((tab) => (
                <label
                  key={tab}
                  className={`flex min-h-14 cursor-pointer items-center justify-between gap-3 px-3 py-3 rounded-xl transition-colors ${
                    draftActiveTab === tab ? "bg-purple-50 text-[#5B13EC]" : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {tab}
                    <span className={`ml-1.5 text-xs ${draftActiveTab === tab ? "text-[#5B13EC]" : "text-slate-500"}`}>
                      ({counts[tab]})
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="sample-status-filter"
                    value={tab}
                    checked={draftActiveTab === tab}
                    onChange={() => setDraftActiveTab(tab)}
                    className="h-4 w-4 accent-[#5B13EC]"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-5">
              <button
                type="button"
                onClick={() => setDraftActiveTab("All")}
                className="h-12 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab(draftActiveTab);
                  setIsStatusFilterOpen(false);
                }}
                className="h-12 rounded-xl bg-[#5B13EC] text-sm font-bold text-white shadow-sm hover:bg-[#4d0ecf]"
              >
                Apply
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Samples List Content */}
      {loading ? (
        <div className="p-16 text-center flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200">
          <div className="w-9 h-9 border-3 border-[#5B13EC]/20 border-t-[#5B13EC] rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Loading samples from database...</span>
        </div>
      ) : filteredSamples.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#5B13EC] flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[30px]">checkroom</span>
          </div>
          <h3 className="text-base font-bold text-slate-900">No samples found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            {searchQuery || typeFilter !== "All" || activeTab !== "All"
              ? "No samples match your current filter or search criteria."
              : "No physical samples have been requested yet for your purchase orders."}
          </p>
          <button
            type="button"
            onClick={() => setIsRequestModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Request Sample</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredSamples.map((s) => {
            const isApproved = s.status === "APPROVED";
            const isChangesNeeded = s.status === "REVISION_REQUIRED" || s.status === "REJECTED";
            const isChecking = s.status === "IN_PROGRESS";

            const statusBadge = isApproved ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="material-symbols-outlined text-[14px]">check</span>
                <span>Approved</span>
              </span>
            ) : isChangesNeeded ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="material-symbols-outlined text-[14px]">sync</span>
                <span>Changes Needed</span>
              </span>
            ) : isChecking ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <span>Checking</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <span>New Sample</span>
              </span>
            );

            return (
              <div
                key={s.id}
                className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-purple-200 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
              >
                {/* Column 1: Sample Name, Supplier, Order ID (Without Product Photo as requested) */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="font-sans font-extrabold text-base sm:text-lg text-slate-900 truncate">
                    {s.sampleName}
                  </h3>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-y-1 sm:gap-x-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">factory</span>
                      <span className="truncate">{s.supplierName}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">receipt_long</span>
                      <span>Order ID: {s.orderId}</span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Sample Type, Quantity, Sent Date */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-6 gap-y-1 text-xs sm:text-sm text-slate-600 sm:border-x sm:border-slate-100 sm:px-6">
                  <div>
                    <span className="text-slate-400">Sample Type: </span>
                    <strong className="font-semibold text-slate-800">{s.sampleType}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Quantity: </span>
                    <strong className="font-semibold text-slate-800">{s.quantity}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Sent on: </span>
                    <strong className="font-semibold text-slate-800">{s.sentDate}</strong>
                  </div>
                </div>

                {/* Column 3: Status Pill & Action Buttons */}
                <div className="flex flex-row flex-wrap items-center justify-start md:justify-end gap-2 shrink-0">
                  {/* Status Badge */}
                  <div>{statusBadge}</div>

                  {/* Buttons matching reference design 1 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => handleOpenDetails(s)}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:border-[#5B13EC] hover:text-[#5B13EC] text-slate-700 text-xs sm:text-sm font-semibold transition-all shadow-2xs"
                    >
                      View Details
                    </button>

                    {/* Supplier: Dispatch Button / Buyer: Approve & Ask Changes Buttons */}
                    {isSupplier ? (
                      !isApproved && s.status !== "DISPATCHED" && (
                        <button
                          type="button"
                          onClick={() => handleDispatch(s.id)}
                          className="px-5 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-98 flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                          <span>Dispatch Sample</span>
                        </button>
                      )
                    ) : (
                      <>
                        {/* Approve Button (shown if not approved) */}
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleApprove(s.id)}
                            className="px-5 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-98"
                          >
                            Approve
                          </button>
                        )}

                        {/* Ask for Changes Button */}
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => handleOpenQuickRevision(s.id)}
                            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs ${
                              isChangesNeeded
                                ? "bg-[#5B13EC] hover:bg-[#4d0ecf] text-white"
                                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            Ask for Changes
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Revision Modal for direct row action */}
      {quickRevisionSampleId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#5B13EC]">sync</span>
                <span>Ask for Changes</span>
              </h3>
              <button
                onClick={() => setQuickRevisionSampleId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Provide specific feedback or modification requests for the manufacturer regarding this physical sample.
            </p>

            <textarea
              rows={3}
              required
              value={quickRevisionFeedback}
              onChange={(e) => setQuickRevisionFeedback(e.target.value)}
              placeholder="e.g. Neck rib elasticity is loose, adjust fabric wash tone, check seam tolerance..."
              className="w-full p-3 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC]"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickRevisionSampleId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingRevision || !quickRevisionFeedback.trim()}
                onClick={submitQuickRevision}
                className="px-5 py-2 text-xs font-bold bg-[#5B13EC] hover:bg-[#4d0ecf] text-white rounded-xl shadow-sm disabled:opacity-50"
              >
                {submittingRevision ? "Submitting..." : "Send Feedback"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {selectedSample && (
        <SampleDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedSample(null);
          }}
          sample={selectedSample}
          onApprove={handleApprove}
          onAskChanges={handleAskChanges}
        />
      )}

      {/* Request Sample Modal */}
      <RequestSampleModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={loadSamples}
      />
    </div>
  );
}
