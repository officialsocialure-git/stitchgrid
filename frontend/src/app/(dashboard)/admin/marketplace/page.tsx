"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Layers3, Clock3, CheckCircle2, XCircle, Search, RefreshCw, Download,
  ChevronLeft, ChevronRight, MoreHorizontal, Eye, X, LoaderCircle,
  ArrowUp, CheckSquare, Square
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Listing = {
  id: string;
  name: string;
  description?: string | null;
  itemType: string;
  moq?: number | null;
  unitPrice?: number | string | null;
  currency?: string;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  moderationNote?: string | null;
  createdAt: string;
  supplierProfile?: {
    organization?: { id: string; name: string; city?: string | null; verificationStatus?: string };
  };
};

type Result = {
  items: Listing[];
  total: number;
  pages: number;
  stats: { total: number; pending: number; approved: number; rejected: number };
  categories: string[];
};

const PAGE_SIZE = 10;

const formatPrice = (amount: Listing["unitPrice"], itemType = "", currency = "INR") => {
  if (amount === null || amount === undefined || amount === "") return "—";
  const unit = itemType.toLowerCase().includes("fabric") ? "/ meter" : "/ piece";
  try {
    return `${new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount))} ${unit}`;
  } catch {
    return `₹${amount} ${unit}`;
  }
};

export default function MarketplacePage() {
  const [data, setData] = useState<Result>({
    items: [],
    total: 0,
    pages: 1,
    stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
    categories: [],
  });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [busyId, setBusyId] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), []);
  useRealtimeSync({
    topics: ["catalog", "marketplace", "admin:stats_updated"],
    onSync: refresh,
    pollIntervalMs: 30000,
    enabled: true,
  });

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        q: query.trim(),
        status: tab,
        category,
        dateRange,
      });
      try {
        const result = (await adminService.marketplace(params)) as unknown as Result;
        if (!alive) return;
        setData({
          items: result?.items || [],
          total: result?.total || 0,
          pages: Math.max(1, result?.pages || 1),
          stats: result?.stats || { total: 0, pending: 0, approved: 0, rejected: 0 },
          categories: result?.categories || [],
        });
        setSelectedIds([]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load marketplace listings.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, query, tab, category, dateRange, refreshKey]);

  const tabs = useMemo(
    () => [
      { value: "ALL", label: "All Listings", count: data.stats.total, icon: Layers3 },
      { value: "PENDING", label: "Pending", count: data.stats.pending, icon: Clock3 },
      { value: "APPROVED", label: "Approved", count: data.stats.approved, icon: CheckCircle2 },
      { value: "REJECTED", label: "Rejected", count: data.stats.rejected, icon: XCircle },
    ],
    [data.stats]
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === data.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.items.map((i) => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const moderate = async (id: string, status: "APPROVED" | "REJECTED") => {
    const note = status === "REJECTED" ? window.prompt("Reason for rejection:") : "";
    if (status === "REJECTED" && note === null) return;
    setBusyId(id);
    setMenuId(null);
    try {
      await adminService.moderateCatalog(id, status, note || undefined);
      refresh();
      if (activeListing?.id === id) {
        setActiveListing((prev) => (prev ? { ...prev, moderationStatus: status, moderationNote: note } : null));
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Moderation failed.");
    } finally {
      setBusyId("");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Product / Listing", "Supplier", "Category", "Unit Price", "Currency", "MOQ", "Status", "Date Added"],
      ...data.items.map((i) => [
        i.name,
        i.supplierProfile?.organization?.name || "Supplier",
        i.itemType,
        i.unitPrice ?? "",
        i.currency || "INR",
        i.moq ?? "",
        i.moderationStatus,
        new Date(i.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stitchgrid-marketplace-listings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setQuery("");
    setTab("ALL");
    setCategory("ALL");
    setDateRange("ALL");
    setPage(1);
  };

  return (
    <section className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Marketplace</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review, approve and manage product, fabric and trim listings submitted by suppliers.
        </p>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Listings */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F3EFFC] text-[#5B13EC]">
            <Layers3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Listings</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.total}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +12%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">All product & fabric listings</p>
          </div>
        </div>

        {/* Card 2: Pending Approval */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFFBEB] text-[#D97706]">
            <Clock3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approval</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.pending}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Under review by admin</p>
          </div>
        </div>

        {/* Card 3: Approved Listings */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
            <CheckCircle2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Listings</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.approved}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +15%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Live on platform</p>
          </div>
        </div>

        {/* Card 4: Rejected Listings */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
            <XCircle size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected Listings</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.rejected}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Not approved</p>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {/* Tabs Row with Export Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex flex-wrap gap-2.5">
            {tabs.map((t) => {
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setTab(t.value);
                    setPage(1);
                  }}
                  className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
                    active
                      ? "bg-[#5B13EC] text-white shadow-xs"
                      : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <t.icon size={15} />
                  <span>{t.label}</span>
                  <span className={active ? "text-white/80" : "text-slate-400"}>
                    ({t.count})
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={exportCsv}
            disabled={!data.items.length}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#5B13EC] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#4C0EC9] disabled:opacity-50"
          >
            <Download size={15} /> Export
          </button>
        </div>

        {/* Filter Inputs Bar */}
        <div className="grid grid-cols-1 gap-2.5 border-b border-slate-100 bg-[#FAF9FD] p-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto]">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by product name or supplier..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none transition focus:border-[#5B13EC]"
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Category: All</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={tab}
            onChange={(e) => {
              setTab(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Status: All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Date Added: All Time</option>
            <option value="7D">Last 7 days</option>
            <option value="30D">Last 30 days</option>
            <option value="90D">Last 90 days</option>
          </select>

          <button
            onClick={() => {
              reset();
              refresh();
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} /> Reset
          </button>
        </div>

        {/* Data Table */}
        {error ? (
          <div className="p-10 text-center text-sm text-rose-700">
            {error}
            <button onClick={refresh} className="ml-2 underline">
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-[#5B13EC]" /> Loading marketplace listings...
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No marketplace items match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
              <thead className="bg-[#FAF9FD] text-[11px] font-bold text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="w-10 px-4 py-3.5 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-600">
                      {selectedIds.length === data.items.length && data.items.length > 0 ? (
                        <CheckSquare size={16} className="text-[#5B13EC]" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3.5">Product / Listing</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Price</th>
                  <th className="px-4 py-3.5">Stock / MOQ</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Added On</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.items.map((item) => {
                  const supplierOrg = item.supplierProfile?.organization;
                  const isChecked = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition hover:bg-[#FAF9FE] ${isChecked ? "bg-[#FAF8FF]" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-[#5B13EC]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-900 block max-w-[200px] truncate">
                          {item.name}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-xs font-bold text-[#5B13EC]">
                            {(supplierOrg?.name || "S").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[150px] font-semibold text-slate-700">
                            {supplierOrg?.name || "Verified Mill"}
                          </span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-1 text-[11px] font-bold text-[#5B13EC]">
                          {item.itemType}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {formatPrice(item.unitPrice, item.itemType, item.currency)}
                      </td>

                      {/* Stock / MOQ */}
                      <td className="px-4 py-3.5">
                        <div>
                          <span className="font-bold text-slate-800">
                            {item.moq ? `${item.moq * 5} units` : "In Stock"}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            MOQ: {item.moq || 100} units
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {item.moderationStatus === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} /> Approved
                          </span>
                        ) : item.moderationStatus === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                            <Clock3 size={11} /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200/60">
                            <XCircle size={11} /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Added On */}
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString("en-US")}
                      </td>

                      {/* Actions */}
                      <td className="relative px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveListing(item)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Review
                          </button>

                          <button
                            disabled={busyId === item.id}
                            onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-[#EBE4FF] hover:text-[#5B13EC] transition"
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        </div>

                        {menuId === item.id && (
                          <div className="absolute right-4 top-10 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                            {item.moderationStatus !== "APPROVED" && (
                              <button
                                onClick={() => moderate(item.id, "APPROVED")}
                                className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                              >
                                Approve Listing
                              </button>
                            )}
                            {item.moderationStatus !== "REJECTED" && (
                              <button
                                onClick={() => moderate(item.id, "REJECTED")}
                                className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                Reject Listing
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {data.total ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total} listings
          </span>

          <div className="flex items-center justify-end gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
              const pNum = i + 1;
              return (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition ${
                    page === pNum
                      ? "bg-[#5B13EC] text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            {data.pages > 5 && (
              <>
                <span className="px-1 text-slate-400">…</span>
                <button
                  onClick={() => setPage(data.pages)}
                  className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  {data.pages}
                </button>
              </>
            )}

            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {activeListing && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setActiveListing(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Product Moderation</h2>
                <p className="mt-0.5 text-xs text-slate-500">Quality and compliance review</p>
              </div>
              <button
                onClick={() => setActiveListing(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-0.5 text-[11px] font-bold text-[#5B13EC]">
                  {activeListing.itemType}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{activeListing.name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {activeListing.description || "No detailed description provided by supplier."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Price:</span>
                  <p className="font-bold text-slate-900 font-mono">
                    {formatPrice(activeListing.unitPrice, activeListing.itemType, activeListing.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Minimum Order Qty:</span>
                  <p className="font-bold text-slate-900">{activeListing.moq || 100} units</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Supplier Mill:</span>
                  <p className="font-bold text-slate-900">
                    {activeListing.supplierProfile?.organization?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status:</span>
                  <p className="font-bold text-slate-900">{activeListing.moderationStatus}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                onClick={() => setActiveListing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>

              <div className="flex gap-2">
                {activeListing.moderationStatus !== "REJECTED" && (
                  <button
                    onClick={async () => {
                      const id = activeListing.id;
                      setActiveListing(null);
                      await moderate(id, "REJECTED");
                    }}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Reject Listing
                  </button>
                )}
                {activeListing.moderationStatus !== "APPROVED" && (
                  <button
                    onClick={async () => {
                      const id = activeListing.id;
                      setActiveListing(null);
                      await moderate(id, "APPROVED");
                    }}
                    className="rounded-xl bg-[#5B13EC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#4C0EC9]"
                  >
                    Approve Listing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
