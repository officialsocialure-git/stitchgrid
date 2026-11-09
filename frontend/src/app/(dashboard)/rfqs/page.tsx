"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { marketplaceService } from "@/services/marketplace.service";
import { PostRfqModal } from "@/components/rfq/PostRfqModal";
import { RfqDetailsModal } from "@/components/rfq/RfqDetailsModal";
import { InviteSuppliersModal } from "@/components/rfq/InviteSuppliersModal";
import { SubmitQuoteModal } from "@/components/dashboard/SubmitQuoteModal";
import { SupplierBuyerRequestsView } from "@/components/rfq/SupplierBuyerRequestsView";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Rfq } from "@/types";

export default function RfqsPage() {
  const { membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters, search & sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "QTY_DESC" | "QTY_ASC">("NEWEST");

  // Modals state
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedRfqForDetails, setSelectedRfqForDetails] = useState<any | null>(null);
  const [selectedRfqForInvite, setSelectedRfqForInvite] = useState<{ id: string; title: string } | null>(null);
  const [selectedRfqForQuote, setSelectedRfqForQuote] = useState<any | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Load RFQs from MySQL
  const loadRfqs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listMyRfqs(membership?.organizationId);
      setRfqs(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Failed to load RFQs:", err);
      setRfqs([]);
    } finally {
      setLoading(false);
    }
  }, [membership?.organizationId]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  useRealtimeSync({
    topics: ["rfq:created", "rfq:updated", "quotation:created"],
    onSync: loadRfqs,
    pollIntervalMs: 25000,
  });

  // Close three dots dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleDeleteRfq = async (rfqId: string, title?: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title || 'this request'}"? This cannot be undone.`)) {
      return;
    }
    try {
      await marketplaceService.deleteRfq(rfqId);
      setRfqs((prev) => prev.filter((r) => r.id !== rfqId));
      setActiveMenuId(null);
      if (selectedRfqForDetails?.id === rfqId) {
        setSelectedRfqForDetails(null);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to delete RFQ");
    }
  };

  // Filter & Sort Logic
  const filteredAndSortedRfqs = useMemo(() => {
    return rfqs
      .filter((rfq) => {
        const query = searchQuery.trim().toLowerCase();
        const idStr = (rfq.id || "").toLowerCase();
        const titleStr = (rfq.title || "").toLowerCase();
        const garmentStr = (rfq.garmentType || "").toLowerCase();
        const descStr = (rfq.description || "").toLowerCase();

        const matchesQuery =
          !query ||
          idStr.includes(query) ||
          titleStr.includes(query) ||
          garmentStr.includes(query) ||
          descStr.includes(query);

        if (!matchesQuery) return false;

        const quotesCount = rfq.quotations?.length || 0;
        const isAwarded = rfq.status === "AWARDED";
        const isDraft = rfq.status === "DRAFT";
        const isOpen = rfq.status === "OPEN";

        if (statusFilter === "ALL") return true;
        if (statusFilter === "QUOTES_RECEIVED") return isOpen && quotesCount > 0;
        if (statusFilter === "OPEN") return isOpen && quotesCount === 0;
        if (statusFilter === "AWARDED") return isAwarded;
        if (statusFilter === "DRAFT") return isDraft;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "NEWEST") {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortBy === "OLDEST") {
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }
        if (sortBy === "QTY_DESC") {
          return (b.targetQuantity || 0) - (a.targetQuantity || 0);
        }
        if (sortBy === "QTY_ASC") {
          return (a.targetQuantity || 0) - (b.targetQuantity || 0);
        }
        return 0;
      });
  }, [rfqs, searchQuery, statusFilter, sortBy]);

  // Format Helper: RFQ ID e.g. RFQ #RFQ-0124
  const formatRfqId = (id: string) => {
    const suffix = id.slice(-4).toUpperCase();
    return `RFQ #RFQ-${suffix}`;
  };

  // Format Date Helper
  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return "Flexible";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Flexible";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Supplier Dedicated View (Matches reference images for Buyer Requests)
  if (isSupplier) {
    return (
      <SupplierBuyerRequestsView
        rfqs={rfqs}
        loading={loading}
        onRefresh={loadRfqs}
        membership={membership}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header: Matches reference screenshot for buyer / adapted for supplier */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-[1.2]">
              {isSupplier ? "RFQs" : "My Requests"}
            </h1>
            <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-[#f4effc] text-[#5B13EC] text-xs font-semibold">
              {isSupplier ? "Supplier RFQ Feed" : "Buyer Sourcing Hub"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1 leading-[1.5]">
            {isSupplier
              ? "Browse active production tenders from verified buyers, review specs, and submit factory quotes."
              : "Create and manage your production requests (RFQs), compare supplier quotes, and move to order."}
          </p>
        </div>

        {isSupplier ? (
          <Link href="/quotations">
            <button
              type="button"
              className="self-start sm:self-center px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-semibold text-sm shadow-md transition-all flex items-center gap-1.5 active:scale-98 leading-[1.4]"
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <span>View My Quotes</span>
            </button>
          </Link>
        ) : (
          <button
            onClick={() => setIsPostModalOpen(true)}
            className="self-start sm:self-center px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-semibold text-sm shadow-md transition-all flex items-center gap-1.5 active:scale-98 leading-[1.4]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Post New Request</span>
          </button>
        )}
      </div>

      {/* 2. Search & Filter Bar: Responsive Desktop Row / Mobile Stack */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined text-[20px] text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by RFQ ID, title or product..."
            className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-white text-xs sm:text-sm text-gray-900 rounded-xl sm:rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] shadow-xs transition-all placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Dropdowns Row on Mobile / Inline on Desktop */}
        <div className="grid grid-cols-2 md:flex items-center gap-2.5">
          {/* Status Filter */}
          <div className="relative min-w-[145px] sm:min-w-[160px]">
            <span className="material-symbols-outlined text-[18px] text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              filter_alt
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full appearance-none pl-9 pr-8 py-2.5 sm:py-3 bg-white text-xs sm:text-sm font-semibold text-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] shadow-xs cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="QUOTES_RECEIVED">Quotes Received</option>
              <option value="OPEN">Open (0 Quotes)</option>
              <option value="AWARDED">Awarded</option>
              <option value="DRAFT">Draft</option>
            </select>
            <span className="material-symbols-outlined text-[18px] text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              expand_more
            </span>
          </div>

          {/* Sort By Dropdown */}
          <div className="relative min-w-[145px] sm:min-w-[160px]">
            <span className="material-symbols-outlined text-[18px] text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              swap_vert
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full appearance-none pl-9 pr-8 py-2.5 sm:py-3 bg-white text-xs sm:text-sm font-semibold text-gray-800 rounded-xl sm:rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] shadow-xs cursor-pointer"
            >
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="QTY_DESC">Quantity (High to Low)</option>
              <option value="QTY_ASC">Quantity (Low to High)</option>
            </select>
            <span className="material-symbols-outlined text-[18px] text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              expand_more
            </span>
          </div>
        </div>
      </div>

      {/* 3. RFQs List: Clean Responsive Cards */}
      {loading ? (
        <div className="space-y-3 py-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse space-y-3">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-5 w-64 bg-gray-200 rounded"></div>
              <div className="h-3 w-48 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredAndSortedRfqs.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-primary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[30px]">assignment</span>
          </div>
          <h3 className="font-bold text-base text-gray-900">No requests found</h3>
          <p className="text-xs text-gray-500 max-w-sm mt-1 mb-4">
            {searchQuery || statusFilter !== "ALL"
              ? "No RFQs match your current search and filters. Try clearing your search or filter."
              : "You haven't posted any requests yet. Broadcast your first tech pack to start receiving quotes."}
          </p>
          {searchQuery || statusFilter !== "ALL" ? (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className="px-4 py-2 rounded-xl bg-purple-50 text-[#5B13EC] hover:bg-purple-100 text-xs font-bold transition-all"
            >
              Clear Filters
            </button>
          ) : (
            <button
              onClick={() => setIsPostModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Post Your First Request</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredAndSortedRfqs.map((rfq) => {
            const quoteCount = rfq.quotations?.length || 0;
            const isAwarded = rfq.status === "AWARDED";
            const isDraft = rfq.status === "DRAFT";
            const isOpenStatus = rfq.status === "OPEN";

            // Status label & badge
            const statusLabel = isAwarded
              ? "Awarded"
              : isOpenStatus && quoteCount > 0
              ? "Quotes Received"
              : isOpenStatus
              ? "Open"
              : isDraft
              ? "Draft"
              : rfq.status;

            const badgeBg =
              isAwarded || statusLabel === "Quotes Received"
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : statusLabel === "Open"
                ? "bg-amber-50 text-amber-800 border-amber-200/70"
                : "bg-gray-100 text-gray-700 border-gray-200";

            // Winning supplier if awarded
            const winningSupplier = isAwarded
              ? rfq.quotations?.find((q: any) => q.status === "ACCEPTED" || q.status === "AWARDED")?.supplier?.name ||
                rfq.quotations?.[0]?.supplier?.name ||
                "Verified Supplier"
              : null;

            // Supplier quote check
            const myQuote = isSupplier
              ? rfq.quotations?.find(
                  (q: any) =>
                    q.supplierOrgId === membership?.organizationId ||
                    q.supplier?.id === membership?.organizationId
                )
              : null;

            const rfqIdPill = formatRfqId(rfq.id);
            const deliveryFormatted = formatDate(rfq.targetDate);
            const createdFormatted = formatDate(rfq.createdAt);
            const unit = rfq.items?.[0]?.unit || "pieces";

            return (
              <div
                key={rfq.id}
                className="bg-white rounded-2xl border border-gray-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-all relative group"
              >
                {/* ------------------------------------------------------------- */}
                {/* DESKTOP LAYOUT (Hidden on mobile, flex on md+) */}
                {/* ------------------------------------------------------------- */}
                <div className="hidden md:flex items-center justify-between gap-6">
                  {/* Left Block: ID, Status, Title, Qty & Delivery */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-[#5B13EC] bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-100">
                        {rfqIdPill}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeBg}`}>
                        <span>{statusLabel}</span>
                      </span>
                    </div>

                    <h3
                      onClick={() => setSelectedRfqForDetails(rfq)}
                      className="font-bold text-base text-gray-900 truncate hover:text-primary cursor-pointer transition-colors"
                      title={rfq.title}
                    >
                      {rfq.title}
                    </h3>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-gray-400">layers</span>
                        <span className="font-medium">
                          Qty: {rfq.targetQuantity?.toLocaleString()} {unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-gray-400">calendar_today</span>
                        <span className="font-medium">Delivery: {deliveryFormatted}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Quotes Received / Awarded To (Buyer) OR Buyer Info (Supplier) */}
                  <div className="w-36 shrink-0">
                    {isSupplier ? (
                      <div>
                        <span className="text-[11px] font-medium text-gray-500 block">Buyer</span>
                        <span
                          className="text-sm font-bold text-gray-900 truncate block mt-0.5"
                          title={rfq.buyer?.name || "Verified Brand"}
                        >
                          {rfq.buyer?.name || "Verified Brand"}
                        </span>
                        <span className="text-[11px] text-gray-500 block mt-0.5">
                          {rfq.buyer?.city ? `${rfq.buyer.city}, India` : "India"}
                        </span>
                      </div>
                    ) : isAwarded ? (
                      <div>
                        <span className="text-[11px] font-medium text-gray-500 block">Awarded To</span>
                        <span className="text-sm font-bold text-gray-900 truncate block mt-0.5">
                          {winningSupplier}
                        </span>
                      </div>
                    ) : (
                      <div>
                        <span className="text-[11px] font-medium text-gray-500 block">Quotes Received</span>
                        <span className="text-xl font-bold text-gray-900 block mt-0.5">{quoteCount}</span>
                        {quoteCount > 0 ? (
                          <Link
                            href={`/quotations?rfqId=${rfq.id}`}
                            className="text-xs font-bold text-[#5B13EC] hover:underline block mt-0.5"
                          >
                            View Quotes
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedRfqForInvite({ id: rfq.id, title: rfq.title })}
                            className="text-xs font-bold text-[#5B13EC] hover:underline block mt-0.5 text-left"
                          >
                            Invite Suppliers
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Created Date Column */}
                  <div className="w-28 shrink-0">
                    <span className="text-[11px] font-medium text-gray-500 block">Created On</span>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800 block mt-0.5">
                      {createdFormatted}
                    </span>
                  </div>

                  {/* Right Actions Column */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex flex-col gap-1.5">
                      {isSupplier ? (
                        <>
                          {myQuote ? (
                            <Link href={`/quotations?rfqId=${rfq.id}`}>
                              <button
                                type="button"
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                <span>Quote Submitted</span>
                              </button>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedRfqForQuote(rfq)}
                              className="px-4 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[16px]">send</span>
                              <span>Send Quote</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedRfqForDetails(rfq)}
                            className="px-4 py-2 rounded-xl border border-purple-200 text-[#5B13EC] hover:bg-purple-50 font-bold text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            <span>View Details</span>
                          </button>
                        </>
                      ) : (
                        <>
                          {quoteCount > 0 && !isAwarded && (
                            <Link href={`/quotations?rfqId=${rfq.id}`}>
                              <button
                                type="button"
                                className="px-4 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95"
                              >
                                <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                                <span>Compare Quotes</span>
                              </button>
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedRfqForDetails(rfq)}
                            className="px-4 py-2 rounded-xl border border-purple-200 text-[#5B13EC] hover:bg-purple-50 font-bold text-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            <span>View Details</span>
                          </button>
                        </>
                      )}
                    </div>

                    {/* Three Dots Menu Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === rfq.id ? null : rfq.id);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenuId === rfq.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20 text-xs font-semibold text-gray-700 animate-fade-in"
                        >
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              setSelectedRfqForDetails(rfq);
                            }}
                            className="w-full px-3.5 py-2 text-left hover:bg-purple-50 hover:text-[#5B13EC] flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            <span>View Details</span>
                          </button>

                          {isSupplier ? (
                            !myQuote && (
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setSelectedRfqForQuote(rfq);
                                }}
                                className="w-full px-3.5 py-2 text-left hover:bg-purple-50 hover:text-[#5B13EC] flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined text-[16px]">send</span>
                                <span>Send Quote</span>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setSelectedRfqForInvite({ id: rfq.id, title: rfq.title });
                              }}
                              className="w-full px-3.5 py-2 text-left hover:bg-purple-50 hover:text-[#5B13EC] flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[16px]">person_add</span>
                              <span>Invite Suppliers</span>
                            </button>
                          )}

                          {quoteCount > 0 && (
                            <Link
                              href={`/quotations?rfqId=${rfq.id}`}
                              className="w-full px-3.5 py-2 text-left hover:bg-purple-50 hover:text-[#5B13EC] flex items-center gap-2 block"
                            >
                              <span className="material-symbols-outlined text-[16px]">compare_arrows</span>
                              <span>{isSupplier ? "View Quotes" : "Compare Quotes"}</span>
                            </Link>
                          )}

                          {!isSupplier && (
                            <button
                              onClick={() => handleDeleteRfq(rfq.id, rfq.title)}
                              className="w-full px-3.5 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              <span>Delete Request</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* MOBILE LAYOUT: Stacked Card matching phone screenshot */}
                {/* ------------------------------------------------------------- */}
                <div className="flex md:hidden flex-col space-y-3">
                  {/* Top: ID Pill, Status, and Three Dots */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#5B13EC] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                        {rfqIdPill}
                      </span>
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeBg}`}>
                        <span>{statusLabel}</span>
                      </span>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === rfq.id ? null : rfq.id);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-700"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>

                      {activeMenuId === rfq.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-7 w-40 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-20 text-xs font-semibold text-gray-700"
                        >
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              setSelectedRfqForDetails(rfq);
                            }}
                            className="w-full px-3 py-1.5 text-left hover:bg-purple-50 flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            <span>View Details</span>
                          </button>
                          {isSupplier ? (
                            !myQuote && (
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setSelectedRfqForQuote(rfq);
                                }}
                                className="w-full px-3 py-1.5 text-left hover:bg-purple-50 flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined text-[16px]">send</span>
                                <span>Send Quote</span>
                              </button>
                            )
                          ) : (
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setSelectedRfqForInvite({ id: rfq.id, title: rfq.title });
                              }}
                              className="w-full px-3 py-1.5 text-left hover:bg-purple-50 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-[16px]">person_add</span>
                              <span>Invite</span>
                            </button>
                          )}

                          {!isSupplier && (
                            <button
                              onClick={() => handleDeleteRfq(rfq.id, rfq.title)}
                              className="w-full px-3 py-1.5 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 border-t border-gray-100"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <h3
                    onClick={() => setSelectedRfqForDetails(rfq)}
                    className="font-bold text-sm text-gray-900 leading-snug cursor-pointer line-clamp-2"
                  >
                    {rfq.title}
                  </h3>

                  {/* Meta: Qty & Delivery */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-gray-400">layers</span>
                      <span>Qty: {rfq.targetQuantity?.toLocaleString()} {unit}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px] text-gray-400">calendar_today</span>
                      <span>Delivery: {deliveryFormatted}</span>
                    </div>
                  </div>

                  {/* Stats Row: Quotes / Awarded on left (Buyer) OR Buyer Info (Supplier), Created Date on right */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                    <div>
                      {isSupplier ? (
                        <>
                          <span className="text-[10px] text-gray-500 block">Buyer</span>
                          <span className="font-bold text-xs text-gray-900 block truncate max-w-[140px]">
                            {rfq.buyer?.name || "Verified Brand"}
                          </span>
                        </>
                      ) : isAwarded ? (
                        <>
                          <span className="text-[10px] text-gray-500 block">Awarded To</span>
                          <span className="font-bold text-xs text-gray-900 block truncate max-w-[140px]">
                            {winningSupplier}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-gray-500 block">Quotes Received</span>
                          <span className="font-bold text-base text-gray-900 block">{quoteCount}</span>
                          {quoteCount > 0 ? (
                            <Link
                              href={`/quotations?rfqId=${rfq.id}`}
                              className="text-[11px] font-bold text-[#5B13EC] hover:underline"
                            >
                              View Quotes
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedRfqForInvite({ id: rfq.id, title: rfq.title })}
                              className="text-[11px] font-bold text-[#5B13EC] hover:underline"
                            >
                              Invite Suppliers
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-gray-500 block">Created On</span>
                      <span className="font-semibold text-xs text-gray-800 block">{createdFormatted}</span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 flex items-center gap-2">
                    {isSupplier ? (
                      <>
                        {myQuote ? (
                          <Link href={`/quotations?rfqId=${rfq.id}`} className="flex-1">
                            <button
                              type="button"
                              className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">check_circle</span>
                              <span>Quote Sent</span>
                            </button>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedRfqForQuote(rfq)}
                            className="flex-1 py-2 rounded-xl bg-[#5B13EC] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[15px]">send</span>
                            <span>Send Quote</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedRfqForDetails(rfq)}
                          className="flex-1 py-2 rounded-xl border border-purple-200 text-[#5B13EC] font-bold text-xs transition-all flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          <span>View Details</span>
                        </button>
                      </>
                    ) : quoteCount > 0 && !isAwarded ? (
                      <>
                        <Link href={`/quotations?rfqId=${rfq.id}`} className="flex-1">
                          <button
                            type="button"
                            className="w-full py-2 rounded-xl bg-[#5B13EC] text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[15px]">compare_arrows</span>
                            <span>Compare Quotes</span>
                          </button>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSelectedRfqForDetails(rfq)}
                          className="flex-1 py-2 rounded-xl border border-purple-200 text-[#5B13EC] font-bold text-xs transition-all flex items-center justify-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[15px]">visibility</span>
                          <span>View Details</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedRfqForDetails(rfq)}
                        className="w-full py-2 rounded-xl border border-purple-200 text-[#5B13EC] font-bold text-xs transition-all flex items-center justify-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[15px]">visibility</span>
                        <span>View Details</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Modals */}
      {/* Post New RFQ Modal */}
      <PostRfqModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={() => {
          loadRfqs();
        }}
      />

      {/* View RFQ Details Modal */}
      <RfqDetailsModal
        isOpen={!!selectedRfqForDetails}
        onClose={() => setSelectedRfqForDetails(null)}
        rfq={selectedRfqForDetails}
        onDelete={!isSupplier ? (id) => handleDeleteRfq(id, selectedRfqForDetails?.title) : undefined}
        onOpenInvite={() => {
          if (selectedRfqForDetails) {
            setSelectedRfqForInvite({
              id: selectedRfqForDetails.id,
              title: selectedRfqForDetails.title,
            });
          }
        }}
      />

      {/* Invite Suppliers Modal */}
      {selectedRfqForInvite && (
        <InviteSuppliersModal
          isOpen={!!selectedRfqForInvite}
          onClose={() => setSelectedRfqForInvite(null)}
          rfqId={selectedRfqForInvite.id}
          rfqTitle={selectedRfqForInvite.title}
        />
      )}

      {/* Submit Quote Modal for Suppliers */}
      {selectedRfqForQuote && (
        <SubmitQuoteModal
          isOpen={!!selectedRfqForQuote}
          onClose={() => setSelectedRfqForQuote(null)}
          rfq={selectedRfqForQuote}
          onSuccess={() => {
            setSelectedRfqForQuote(null);
            loadRfqs();
          }}
        />
      )}
    </div>
  );
}
