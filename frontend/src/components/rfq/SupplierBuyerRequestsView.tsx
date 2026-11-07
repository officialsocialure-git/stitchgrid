"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Rfq } from "@/types";
import { marketplaceService } from "@/services/marketplace.service";

interface SupplierBuyerRequestsViewProps {
  rfqs: Rfq[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  membership: any;
}

type TabType = "ALL" | "NEW" | "VIEWED" | "QUOTE_SENT";

export function SupplierBuyerRequestsView({
  rfqs,
  loading,
  onRefresh,
  membership,
}: SupplierBuyerRequestsViewProps) {
  // Tabs & Filters state
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Active RFQ selection & Drawer state
  // Starts closed (null / false) so the right pane is NOT permanently open by default
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeDetailsTab, setActiveDetailsTab] = useState<"REQUIREMENTS" | "BUYER_INFO">("REQUIREMENTS");
  const [isEditingQuote, setIsEditingQuote] = useState(false);

  // Track viewed RFQs in localStorage
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  // Quote form state
  const [pricePerPiece, setPricePerPiece] = useState("180");
  const [deliveryTime, setDeliveryTime] = useState("21 Days");
  const [sampleCost, setSampleCost] = useState("0");
  const [paymentTerms, setPaymentTerms] = useState("50% Advance, 50% on QC Pass");
  const [note, setNote] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [quoteSuccess, setQuoteSuccess] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const quoteFormRef = useRef<HTMLDivElement | null>(null);
  const priceInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize viewed IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("stitchgrid_viewed_rfqs");
      if (stored) {
        setViewedIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // ignore
    }
  }, []);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isDetailsOpen) {
        setIsDetailsOpen(false);
        setSelectedRfqId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailsOpen]);

  const markAsViewed = (id: string) => {
    setViewedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem("stitchgrid_viewed_rfqs", JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Format RFQ ID cleanly e.g. RFQ-2026-1042
  const formatRfqNumber = (id: string, index = 0) => {
    if (!id) return `RFQ-2026-${1000 + index}`;
    if (id.startsWith("RFQ-2026-")) return id;
    let sum = 0;
    for (let i = 0; i < id.length; i++) {
      sum = (sum * 31 + id.charCodeAt(i)) % 9000;
    }
    const num = 1000 + Math.abs(sum);
    return `RFQ-2026-${num}`;
  };

  // Format delivery date helper
  const formatDeliveryDate = (dateVal?: string | Date) => {
    if (!dateVal) return "25 Nov 2026";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "25 Nov 2026";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Helper to determine status for an RFQ
  const getRfqStatus = (rfq: Rfq): "New" | "Viewed" | "Quote Sent" => {
    const hasQuote = Boolean(
      rfq.quotations &&
        rfq.quotations.some(
          (q: any) =>
            (membership?.organizationId &&
              (q.supplierOrgId === membership.organizationId ||
                q.supplier?.id === membership.organizationId)) ||
            q.supplierOrgId
        )
    );
    if (hasQuote) return "Quote Sent";
    if (viewedIds.has(rfq.id)) return "Viewed";
    return "New";
  };

  // Dynamic extractors for specs
  const getGarmentType = (rfq: Rfq) => {
    if (rfq.garmentType) return rfq.garmentType;
    const t = (rfq.title || "").toLowerCase();
    if (t.includes("hoodie")) return "Men's Hoodie";
    if (t.includes("t-shirt") || t.includes("t-shrit") || t.includes("tee")) return "T-shirt";
    if (t.includes("co-ord")) return "Co-ord Set";
    if (t.includes("jacket") || t.includes("bomber")) return "Bomber Jacket";
    if (t.includes("jogger")) return "Cotton Joggers";
    return "Apparel";
  };

  const getFabricSpec = (rfq: Rfq) => {
    if (rfq.fabricSpec) return rfq.fabricSpec;
    const t = (rfq.title || "").toLowerCase();
    if (t.includes("hoodie")) return "Fleece, 300 GSM";
    if (t.includes("t-shirt") || t.includes("tee")) return "100% Cotton, 180 GSM";
    if (t.includes("co-ord")) return "Cotton Linen";
    if (t.includes("jacket")) return "Polyester, 220 GSM";
    return "100% Cotton Single Jersey";
  };

  const getLocation = (rfq: Rfq) => {
    if (rfq.buyer?.city) {
      return `${rfq.buyer.city}, ${rfq.buyer.country === "IN" || !rfq.buyer.country ? "UP" : rfq.buyer.country}`;
    }
    const t = (rfq.title || "").toLowerCase();
    if (t.includes("hoodie")) return "Gurgaon, HR";
    if (t.includes("co-ord")) return "Delhi";
    if (t.includes("jacket")) return "Jaipur, RJ";
    return "Noida, UP";
  };

  const getBuyerName = (rfq: Rfq) => {
    if (rfq.buyer?.name) return rfq.buyer.name;
    const t = (rfq.title || "").toLowerCase();
    if (t.includes("hoodie")) return "Studio 27 Retail";
    if (t.includes("co-ord")) return "Asha Apparel Mills";
    if (t.includes("jacket")) return "Nordic Trends Co.";
    return "UrbanWear Pvt. Ltd.";
  };

  // Selected RFQ object (only returns an object if an RFQ is actually selected)
  const selectedRfq = useMemo(() => {
    if (!selectedRfqId) return null;
    return rfqs.find((r) => r.id === selectedRfqId) || null;
  }, [rfqs, selectedRfqId]);

  // Existing quotation submitted by this supplier (if any)
  const existingQuote = useMemo(() => {
    if (!selectedRfq || !selectedRfq.quotations) return null;
    return (
      selectedRfq.quotations.find(
        (q: any) =>
          (membership?.organizationId &&
            (q.supplierOrgId === membership.organizationId ||
              q.supplier?.id === membership.organizationId)) ||
          q.supplierOrgId
      ) || null
    );
  }, [selectedRfq, membership?.organizationId]);

  // Auto update price per piece when selecting an RFQ
  useEffect(() => {
    if (selectedRfq?.targetPrice) {
      setPricePerPiece(String(selectedRfq.targetPrice));
    }
    if (existingQuote) {
      const qPrice =
        existingQuote.items?.[0]?.unitPrice ||
        (selectedRfq?.targetQuantity
          ? Math.round(Number(existingQuote.totalAmount) / selectedRfq.targetQuantity)
          : undefined);
      if (qPrice) setPricePerPiece(String(qPrice));
      if (existingQuote.leadTimeDays) setDeliveryTime(`${existingQuote.leadTimeDays} Days`);
      if (existingQuote.sampleCost) setSampleCost(String(existingQuote.sampleCost));
      if (existingQuote.terms) setPaymentTerms(existingQuote.terms);
    }
  }, [selectedRfq?.id, selectedRfq?.targetPrice, existingQuote]);

  // Tab Counts
  const counts = useMemo(() => {
    let newCnt = 0;
    let viewedCnt = 0;
    let quoteSentCnt = 0;

    rfqs.forEach((r) => {
      const s = getRfqStatus(r);
      if (s === "New") newCnt++;
      else if (s === "Viewed") viewedCnt++;
      else if (s === "Quote Sent") quoteSentCnt++;
    });

    return {
      all: rfqs.length,
      new: newCnt,
      viewed: viewedCnt,
      quoteSent: quoteSentCnt,
    };
  }, [rfqs, viewedIds]);

  // Extract Categories & Locations for filter dropdowns
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    rfqs.forEach((r) => {
      const g = getGarmentType(r);
      if (g) set.add(g);
    });
    return Array.from(set);
  }, [rfqs]);

  const locationsList = useMemo(() => {
    const set = new Set<string>();
    rfqs.forEach((r) => {
      const loc = getLocation(r);
      if (loc) set.add(loc);
    });
    return Array.from(set);
  }, [rfqs]);

  // Filtered RFQs
  const filteredRfqs = useMemo(() => {
    return rfqs.filter((rfq) => {
      // 1. Tab filter
      const status = getRfqStatus(rfq);
      if (activeTab === "NEW" && status !== "New") return false;
      if (activeTab === "VIEWED" && status !== "Viewed") return false;
      if (activeTab === "QUOTE_SENT" && status !== "Quote Sent") return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = formatRfqNumber(rfq.id).toLowerCase().includes(q);
        const titleMatch = (rfq.title || "").toLowerCase().includes(q);
        const garmentMatch = getGarmentType(rfq).toLowerCase().includes(q);
        const fabricMatch = getFabricSpec(rfq).toLowerCase().includes(q);
        const locationMatch = getLocation(rfq).toLowerCase().includes(q);
        const buyerMatch = getBuyerName(rfq).toLowerCase().includes(q);

        if (!idMatch && !titleMatch && !garmentMatch && !fabricMatch && !locationMatch && !buyerMatch) {
          return false;
        }
      }

      // 3. Category filter
      if (selectedCategory !== "ALL") {
        if (getGarmentType(rfq) !== selectedCategory) return false;
      }

      // 4. Location filter
      if (selectedLocation !== "ALL") {
        if (getLocation(rfq) !== selectedLocation) return false;
      }

      // 5. Status dropdown filter
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "NEW" && status !== "New") return false;
        if (selectedStatus === "VIEWED" && status !== "Viewed") return false;
        if (selectedStatus === "QUOTE_SENT" && status !== "Quote Sent") return false;
      }

      return true;
    });
  }, [rfqs, activeTab, searchQuery, selectedCategory, selectedLocation, selectedStatus, viewedIds]);

  // Calculations for quote form
  const currentQuantity = selectedRfq?.targetQuantity || selectedRfq?.items?.[0]?.quantity || 1000;
  const calculatedTotalPrice = useMemo(() => {
    const p = parseFloat(pricePerPiece) || 0;
    const total = p * currentQuantity;
    return total > 0 ? `₹${total.toLocaleString("en-IN")}` : "Auto calculated";
  }, [pricePerPiece, currentQuantity]);

  // Actions
  const handleOpenDetails = (rfq: Rfq) => {
    setSelectedRfqId(rfq.id);
    setIsDetailsOpen(true);
    markAsViewed(rfq.id);
    setQuoteSuccess(null);
    setQuoteError(null);
    setIsEditingQuote(false);
  };

  const handleOpenQuote = (rfq: Rfq) => {
    setSelectedRfqId(rfq.id);
    setIsDetailsOpen(true);
    markAsViewed(rfq.id);
    setQuoteSuccess(null);
    setQuoteError(null);
    setIsEditingQuote(true);

    setTimeout(() => {
      if (priceInputRef.current) {
        priceInputRef.current.focus();
      }
      if (quoteFormRef.current) {
        quoteFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedRfqId(null);
    setQuoteSuccess(null);
    setQuoteError(null);
    setIsEditingQuote(false);
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRfq) return;

    if (!membership?.organizationId) {
      setQuoteError("Supplier account session expired. Please re-login.");
      return;
    }

    const price = parseFloat(pricePerPiece);
    if (isNaN(price) || price <= 0) {
      setQuoteError("Please enter a valid price per piece.");
      return;
    }

    try {
      setSubmittingQuote(true);
      setQuoteError(null);
      setQuoteSuccess(null);

      const totalAmount = price * currentQuantity;
      const leadDays = parseInt(deliveryTime) || 21;
      const sampleAmt = parseFloat(sampleCost) || 0;

      await marketplaceService.submitQuote({
        rfqId: selectedRfq.id,
        supplierOrgId: membership.organizationId,
        totalAmount,
        currency: "INR",
        leadTimeDays: leadDays,
        terms: paymentTerms,
        sampleCost: sampleAmt,
        sampleLeadDays: 7,
        moq: currentQuantity,
        items: [
          {
            description: `${selectedRfq.title || "Garment Lot"} - Supplier Quote`,
            quantity: currentQuantity,
            unitPrice: price,
          },
        ],
      });

      setQuoteSuccess(`Quotation for ₹${totalAmount.toLocaleString("en-IN")} submitted successfully to buyer!`);
      markAsViewed(selectedRfq.id);
      setIsEditingQuote(false);
      await onRefresh();
    } catch (err: any) {
      console.error("Failed to submit quotation:", err);
      setQuoteError(err?.message || "Failed to submit quote. Please try again.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* ------------------------------------------------------------- */}
      {/* 1. Page Header (Matches Desktop & Mobile Reference Images)   */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-sans font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Buyer Requests
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#5B13EC] text-white text-xs font-bold shadow-2xs">
              {counts.new} New
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
            View buyer requirements and send your price quote.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Underline Filter Tabs (Matches Reference Images)           */}
      {/* ------------------------------------------------------------- */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`pb-2.5 whitespace-nowrap font-bold transition-all border-b-2 ${
              activeTab === "ALL"
                ? "text-[#5B13EC] border-[#5B13EC]"
                : "text-slate-600 hover:text-slate-900 border-transparent"
            }`}
          >
            All Requests ({counts.all})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("NEW")}
            className={`pb-2.5 whitespace-nowrap font-semibold transition-all border-b-2 ${
              activeTab === "NEW"
                ? "text-[#5B13EC] border-[#5B13EC]"
                : "text-slate-600 hover:text-slate-900 border-transparent"
            }`}
          >
            New ({counts.new})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("VIEWED")}
            className={`pb-2.5 whitespace-nowrap font-semibold transition-all border-b-2 ${
              activeTab === "VIEWED"
                ? "text-[#5B13EC] border-[#5B13EC]"
                : "text-slate-600 hover:text-slate-900 border-transparent"
            }`}
          >
            Viewed ({counts.viewed})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("QUOTE_SENT")}
            className={`pb-2.5 whitespace-nowrap font-semibold transition-all border-b-2 ${
              activeTab === "QUOTE_SENT"
                ? "text-[#5B13EC] border-[#5B13EC]"
                : "text-slate-600 hover:text-slate-900 border-transparent"
            }`}
          >
            Quote Sent ({counts.quoteSent})
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Search and Dropdown Filter Row                            */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by RFQ ID or product..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] shadow-2xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Desktop Filter Dropdowns (Category, Location, Status) */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-11 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] cursor-pointer shadow-2xs"
              >
                <option value="ALL">Category</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>

            {/* Delivery Location Dropdown */}
            <div className="relative">
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="h-11 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] cursor-pointer shadow-2xs"
              >
                <option value="ALL">Delivery Location</option>
                {locationsList.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>

            {/* Status Dropdown */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="h-11 pl-3.5 pr-8 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] cursor-pointer shadow-2xs"
              >
                <option value="ALL">Status</option>
                <option value="NEW">New</option>
                <option value="VIEWED">Viewed</option>
                <option value="QUOTE_SENT">Quote Sent</option>
              </select>
              <span className="material-symbols-outlined text-[18px] text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Mobile Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className={`lg:hidden w-11 h-11 rounded-xl border flex items-center justify-center transition-all ${
              mobileFilterOpen || selectedCategory !== "ALL" || selectedLocation !== "ALL" || selectedStatus !== "ALL"
                ? "bg-[#5B13EC] text-white border-[#5B13EC]"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            title="Filter Requests"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>

        {/* Mobile Expandable Filter Controls */}
        {mobileFilterOpen && (
          <div className="lg:hidden p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 animate-fade-in text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
              >
                <option value="ALL">All Categories</option>
                {categoriesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Delivery Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
              >
                <option value="ALL">All Locations</option>
                {locationsList.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
              >
                <option value="ALL">All Status</option>
                <option value="NEW">New</option>
                <option value="VIEWED">Viewed</option>
                <option value="QUOTE_SENT">Quote Sent</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Main Content: Full-width RFQ Cards List                     */}
      {/* ------------------------------------------------------------- */}
      <div className="w-full space-y-3.5">
        {loading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse space-y-3">
                <div className="h-4 w-32 bg-slate-200 rounded"></div>
                <div className="h-5 w-60 bg-slate-200 rounded"></div>
                <div className="h-3 w-40 bg-slate-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : filteredRfqs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#5B13EC] flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-[28px]">search_off</span>
            </div>
            <h3 className="font-bold text-sm text-slate-900">No buyer requests found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              No RFQs match your active filters or search terms. Try clearing filters or check back shortly.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveTab("ALL");
                setSelectedCategory("ALL");
                setSelectedLocation("ALL");
                setSelectedStatus("ALL");
              }}
              className="px-4 py-2 rounded-xl bg-purple-50 text-[#5B13EC] font-bold text-xs hover:bg-purple-100 transition-all"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          filteredRfqs.map((rfq, idx) => {
            const status = getRfqStatus(rfq);
            const rfqNumber = formatRfqNumber(rfq.id, idx);
            const garment = getGarmentType(rfq);
            const fabric = getFabricSpec(rfq);
            const location = getLocation(rfq);
            const qtyFormatted = `${(rfq.targetQuantity || rfq.items?.[0]?.quantity || 1000).toLocaleString()} pcs`;
            const delivery = formatDeliveryDate(rfq.targetDate);
            const isCurrentlySelected = selectedRfqId === rfq.id && isDetailsOpen;

            // Status badge style matching reference image 1 & 2
            const statusBadge =
              status === "New" ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f4effc] text-[#5B13EC]">
                  New
                </span>
              ) : status === "Viewed" ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100/80 text-sky-700">
                  Viewed
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100/90 text-amber-800">
                  Quote Sent
                </span>
              );

            return (
              <div
                key={rfq.id}
                onClick={() => handleOpenDetails(rfq)}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 cursor-pointer shadow-2xs group ${
                  isCurrentlySelected
                    ? "border-[#5B13EC] ring-2 ring-[#5B13EC]/20 bg-purple-50/[0.08]"
                    : "border-slate-200/90 hover:border-purple-300 hover:shadow-xs"
                }`}
              >
                {/* ------------------------------------------------------ */}
                {/* DESKTOP CARD LAYOUT (Hidden on mobile, visible md+)     */}
                {/* ------------------------------------------------------ */}
                <div className="hidden md:flex items-center justify-between gap-5">
                  {/* Left: RFQ ID, Status, Title, Sub-specs */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-sans font-bold text-sm text-slate-900 tracking-tight">
                        {rfqNumber}
                      </span>
                      {statusBadge}
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900 truncate group-hover:text-[#5B13EC] transition-colors">
                      {rfq.title || "Basic Oversized T-shirt"}
                    </h3>

                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-slate-400">checkroom</span>
                        <span>{garment}</span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-slate-400">layers</span>
                        <span className="truncate max-w-[260px]">{fabric}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Quantity, Delivery, Location */}
                  <div className="shrink-0 space-y-1 text-xs text-slate-600 border-x border-slate-100 px-6 min-w-[220px]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">inventory_2</span>
                      <span>
                        Quantity: <strong className="font-semibold text-slate-800">{qtyFormatted}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
                      <span>
                        Delivery: <strong className="font-semibold text-slate-800">{delivery}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-400">location_on</span>
                      <span>
                        Location: <strong className="font-semibold text-slate-800">{location}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="shrink-0 flex flex-col gap-2 min-w-[125px]">
                    {status === "Quote Sent" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetails(rfq);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-[#5B13EC] text-[#5B13EC] hover:bg-purple-50 text-xs font-bold transition-all text-center shadow-2xs"
                      >
                        View Details
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(rfq);
                          }}
                          className="w-full px-4 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold shadow-xs transition-all text-center"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenQuote(rfq);
                          }}
                          className="w-full px-4 py-2 rounded-xl border border-[#5B13EC] text-[#5B13EC] hover:bg-purple-50 text-xs font-bold transition-all text-center"
                        >
                          Send Quote
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* ------------------------------------------------------ */}
                {/* MOBILE CARD LAYOUT (Matches Reference Image 2)         */}
                {/* ------------------------------------------------------ */}
                <div className="flex md:hidden flex-col space-y-2.5">
                  {/* Header Row: RFQ ID, Badge, Chevron */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-sans font-bold text-sm text-slate-900">
                        {rfqNumber}
                      </span>
                      {statusBadge}
                    </div>
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">
                      chevron_right
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-extrabold text-base text-slate-900 leading-snug">
                    {rfq.title || "Basic Oversized T-shirt"}
                  </h3>

                  {/* Sub specs */}
                  <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-slate-400">layers</span>
                      <span className="truncate">{fabric}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-slate-400">inventory_2</span>
                      <span>
                        Quantity: <strong className="font-semibold text-slate-800">{qtyFormatted}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-slate-400">calendar_today</span>
                      <span>
                        Delivery: <strong className="font-semibold text-slate-800">{delivery}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-slate-400">location_on</span>
                      <span>
                        Location: <strong className="font-semibold text-slate-800">{location}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                    {status === "Quote Sent" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetails(rfq);
                        }}
                        className="w-full py-2.5 rounded-xl border border-[#5B13EC] text-[#5B13EC] text-xs font-bold text-center"
                      >
                        View Details
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(rfq);
                          }}
                          className="flex-1 py-2 rounded-xl border border-[#5B13EC] text-[#5B13EC] text-xs font-bold text-center"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenQuote(rfq);
                          }}
                          className="flex-1 py-2 rounded-xl bg-[#5B13EC] text-white text-xs font-bold text-center shadow-xs"
                        >
                          Send Quote
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. SLIDE-OVER DRAWER (Opens from Right Side on Click)          */}
      {/* ------------------------------------------------------------- */}
      {/* Backdrop */}
      {isDetailsOpen && selectedRfq && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs transition-opacity duration-300 animate-fade-in"
          onClick={handleCloseDetails}
        />
      )}

      {/* Slide-over Drawer Panel */}
      <aside
        aria-label="RFQ Details Drawer"
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] lg:w-[540px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out transform ${
          isDetailsOpen && selectedRfq ? "translate-x-0" : "translate-x-full pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-sans font-bold text-lg text-slate-900">RFQ Details</h2>
            {selectedRfq && (
              <>
                <span className="font-mono font-bold text-xs text-[#5B13EC] bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                  {formatRfqNumber(selectedRfq.id)}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    getRfqStatus(selectedRfq) === "New"
                      ? "bg-[#f4effc] text-[#5B13EC]"
                      : getRfqStatus(selectedRfq) === "Viewed"
                      ? "bg-sky-100/80 text-sky-700"
                      : "bg-amber-100/90 text-amber-800"
                  }`}
                >
                  {getRfqStatus(selectedRfq)}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleCloseDetails}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors"
            title="Close details (Esc)"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        {selectedRfq && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Title & Buyer */}
            <div>
              <h3 className="font-sans font-extrabold text-xl text-slate-900 leading-tight">
                {selectedRfq.title || "Basic Oversized T-shirt"}
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5 font-medium">
                <span className="material-symbols-outlined text-[17px] text-[#5B13EC]">business</span>
                <span>
                  Buyer: <strong className="text-slate-900">{getBuyerName(selectedRfq)}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500">{getLocation(selectedRfq)}</span>
              </p>
            </div>

            {/* Detail Tabs */}
            <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveDetailsTab("REQUIREMENTS")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeDetailsTab === "REQUIREMENTS"
                    ? "text-[#5B13EC] border-[#5B13EC]"
                    : "text-slate-500 hover:text-slate-800 border-transparent font-medium"
                }`}
              >
                Requirements
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailsTab("BUYER_INFO")}
                className={`pb-2.5 border-b-2 transition-all ${
                  activeDetailsTab === "BUYER_INFO"
                    ? "text-[#5B13EC] border-[#5B13EC]"
                    : "text-slate-500 hover:text-slate-800 border-transparent font-medium"
                }`}
              >
                Buyer Info
              </button>
            </div>

            {/* Tab 1: Requirements Details */}
            {activeDetailsTab === "REQUIREMENTS" ? (
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-slate-400">inventory_2</span>
                    Quantity
                  </span>
                  <strong className="font-bold text-slate-900 text-sm">
                    {(selectedRfq.targetQuantity || selectedRfq.items?.[0]?.quantity || 1000).toLocaleString()} pcs
                  </strong>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-slate-400">layers</span>
                    Fabric
                  </span>
                  <strong className="font-semibold text-slate-900 text-right max-w-[240px]">
                    {getFabricSpec(selectedRfq)}
                  </strong>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-slate-400">straighten</span>
                    Sizes
                  </span>
                  <strong className="font-semibold text-slate-900">S, M, L, XL, XXL</strong>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-slate-400">palette</span>
                    Colors
                  </span>
                  <strong className="font-semibold text-slate-900">Black, White, Beige</strong>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-slate-400">checkroom</span>
                    Sample Required
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    Yes
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-slate-400">calendar_today</span>
                    Delivery Date
                  </span>
                  <strong className="font-semibold text-slate-900">
                    {formatDeliveryDate(selectedRfq.targetDate)}
                  </strong>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-slate-400">location_on</span>
                    Delivery Location
                  </span>
                  <strong className="font-semibold text-slate-900">
                    {getLocation(selectedRfq)}
                  </strong>
                </div>

                {selectedRfq.description && (
                  <div className="pt-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Buyer Instructions
                    </span>
                    <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200/70 text-xs leading-relaxed">
                      {selectedRfq.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Tab 2: Buyer Info */
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">Company Name</span>
                  <strong className="font-semibold text-slate-900">{getBuyerName(selectedRfq)}</strong>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">Location</span>
                  <strong className="font-semibold text-slate-900">{getLocation(selectedRfq)}</strong>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">Verification</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    <span>GST Verified</span>
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">Track Record</span>
                  <strong className="font-semibold text-slate-900">Verified Buyer Network</strong>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500">Payment Security</span>
                  <strong className="font-bold text-[#5B13EC]">100% Payment Protected</strong>
                </div>
              </div>
            )}

            {/* Quote Section: Submitted Quote Summary OR Send Quote Form */}
            {existingQuote && !isEditingQuote ? (
              /* Already Submitted Quote Card */
              <div className="bg-gradient-to-br from-purple-50/70 via-white to-amber-50/40 rounded-2xl border border-purple-200/80 p-5 space-y-3.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-purple-100 text-[#5B13EC] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Your Submitted Quotation</h4>
                      <span className="text-[11px] text-emerald-700 font-semibold">Sent to Buyer</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingQuote(true)}
                    className="text-xs font-bold text-[#5B13EC] hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[15px]">edit</span>
                    <span>Revise</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-purple-100 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-purple-100/70">
                    <span className="text-slate-500 block text-[11px]">Price per Piece</span>
                    <strong className="text-slate-900 font-extrabold text-base block mt-0.5">
                      ₹{Number(existingQuote.items?.[0]?.unitPrice || pricePerPiece).toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-purple-100/70">
                    <span className="text-slate-500 block text-[11px]">Total Quoted</span>
                    <strong className="text-[#5B13EC] font-extrabold text-base block mt-0.5">
                      ₹{Number(existingQuote.totalAmount).toLocaleString("en-IN")}
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-purple-100/70">
                    <span className="text-slate-500 block text-[11px]">Delivery Time</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">
                      {existingQuote.leadTimeDays || 21} Days
                    </strong>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-purple-100/70">
                    <span className="text-slate-500 block text-[11px]">Sample Cost</span>
                    <strong className="text-slate-800 font-bold block mt-0.5">
                      ₹{Number(existingQuote.sampleCost || 0).toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-purple-100/70 text-xs">
                  <span className="text-slate-500 block text-[11px]">Payment Terms</span>
                  <p className="text-slate-800 font-medium mt-0.5">
                    {existingQuote.terms || "50% Advance, 50% on QC Pass"}
                  </p>
                </div>
              </div>
            ) : (
              /* Send / Revise Quote Form */
              <div ref={quoteFormRef} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-sans font-bold text-base text-slate-900">
                    {existingQuote ? "Revise Your Quote" : "Send Your Quote"}
                  </h4>
                  {existingQuote && (
                    <button
                      type="button"
                      onClick={() => setIsEditingQuote(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {quoteSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in font-medium">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                    <span>{quoteSuccess}</span>
                  </div>
                )}

                {quoteError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-fade-in font-medium">
                    <span className="material-symbols-outlined text-[18px] text-rose-500">error</span>
                    <span>{quoteError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitQuote} className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Price per Piece (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        ref={priceInputRef}
                        type="number"
                        step="any"
                        min="1"
                        required
                        value={pricePerPiece}
                        onChange={(e) => setPricePerPiece(e.target.value)}
                        placeholder="Enter price"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Total Price (₹)</label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={calculatedTotalPrice}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 cursor-not-allowed select-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1">
                        Delivery Time <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={deliveryTime}
                        onChange={(e) => setDeliveryTime(e.target.value)}
                        className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] cursor-pointer"
                      >
                        <option value="15 Days">15 Days</option>
                        <option value="21 Days">21 Days</option>
                        <option value="30 Days">30 Days</option>
                        <option value="45 Days">45 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-700 font-bold mb-1">Sample Cost (₹)</label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={sampleCost}
                        onChange={(e) => setSampleCost(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Payment Terms</label>
                    <select
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full h-10 px-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] cursor-pointer"
                    >
                      <option value="50% Advance, 50% on QC Pass">50% Advance, 50% on QC Pass</option>
                      <option value="30% Advance, 70% before Dispatch">30% Advance, 70% before Dispatch</option>
                      <option value="100% Secure Payment on PO">100% Secure Payment on PO</option>
                      <option value="Net 30 Days">Net 30 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Note (Optional)</label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add any additional details or notes for buyer..."
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingQuote}
                    className="w-full h-11 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                  >
                    {submittingQuote ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span>Submitting Quote...</span>
                      </>
                    ) : (
                      <span>{existingQuote ? "Update & Submit Quote" : "Submit Quote"}</span>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
