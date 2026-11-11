"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText, Hourglass, CheckCircle2, XCircle, Search, RefreshCw, Download,
  ChevronLeft, ChevronRight, MoreHorizontal, Eye, LoaderCircle, ArrowUp,
  Plus, CheckSquare, Square, Clock3, X
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Rfq = {
  id: string;
  title: string;
  garmentType?: string | null;
  targetQuantity: number;
  targetDate?: string | null;
  createdAt: string;
  status: string;
  buyer?: { id: string; name: string; city?: string | null };
  items?: { id: string; name: string; quantity: number; unit: string }[];
  _count?: { quotations: number; invitations: number };
};

type Result = {
  items: Rfq[];
  total: number;
  pages: number;
  stats: { total: number; open: number; inProgress: number; awarded: number; closed: number };
  categories: string[];
};

const PAGE_SIZE = 10;

export default function AdminRfqsPage() {
  const [data, setData] = useState<Result>({
    items: [],
    total: 0,
    pages: 1,
    stats: { total: 0, open: 0, inProgress: 0, awarded: 0, closed: 0 },
    categories: [],
  });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeRfq, setActiveRfq] = useState<Rfq | null>(null);
  const [busyId, setBusyId] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), []);
  useRealtimeSync({
    topics: ["rfqs", "quotations", "admin:stats_updated"],
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
        status: tab === "ALL" ? status : tab,
        category,
        dateRange,
      });
      try {
        const result = (await adminService.rfqs(params)) as unknown as Result;
        if (!alive) return;
        setData({
          items: result?.items || [],
          total: result?.total || 0,
          pages: Math.max(1, result?.pages || 1),
          stats: result?.stats || { total: 0, open: 0, inProgress: 0, awarded: 0, closed: 0 },
          categories: result?.categories || [],
        });
        setSelectedIds([]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load RFQs.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, query, tab, category, status, dateRange, refreshKey]);

  const tabs = useMemo(
    () => [
      { value: "ALL", label: "All RFQs", count: data.stats.total, icon: FileText },
      { value: "OPEN", label: "Open", count: data.stats.open, icon: Hourglass },
      { value: "IN_PROGRESS", label: "In Progress", count: data.stats.inProgress, icon: RefreshCw },
      { value: "AWARDED", label: "Awarded", count: data.stats.awarded, icon: CheckCircle2 },
      { value: "CLOSED", label: "Closed", count: data.stats.closed, icon: XCircle },
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

  const closeRfq = async (rfq: Rfq) => {
    if (!window.confirm(`Close RFQ "${rfq.title}"? This will mark it as closed.`)) return;
    setBusyId(rfq.id);
    setMenuId(null);
    try {
      await adminService.updateRfqStatus(rfq.id, "CLOSED");
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to close RFQ.");
    } finally {
      setBusyId("");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["RFQ ID", "Title", "Buyer", "Category", "Quantity", "Quotations", "Status", "Created On"],
      ...data.items.map((i) => [
        `RFQ-2026-${i.id.slice(0, 5).toUpperCase()}`,
        i.title,
        i.buyer?.name || "Buyer",
        i.garmentType || "Apparel",
        i.targetQuantity,
        i._count?.quotations ?? 0,
        i.status,
        new Date(i.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stitchgrid-admin-rfqs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setQuery("");
    setTab("ALL");
    setCategory("ALL");
    setStatus("ALL");
    setDateRange("ALL");
    setPage(1);
  };

  return (
    <section className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            RFQs (Buyer Requests)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor buyer requirements, supplier responses and RFQ progress.
          </p>
        </div>

        <Link
          href="/rfqs"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#5B13EC] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#4C0EC9]"
        >
          <Plus size={16} /> Create RFQ
        </Link>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total RFQs */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F3EFFC] text-[#5B13EC]">
            <FileText size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total RFQs</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.total}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +18%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">All buyer requests</p>
          </div>
        </div>

        {/* Card 2: Open RFQs */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFFBEB] text-[#D97706]">
            <Hourglass size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open RFQs</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.open}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Awaiting supplier quotes</p>
          </div>
        </div>

        {/* Card 3: Awarded RFQs */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
            <CheckCircle2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Awarded RFQs</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.awarded}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Quotation accepted</p>
          </div>
        </div>

        {/* Card 4: Closed RFQs */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
            <XCircle size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Closed RFQs</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.closed}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Completed / Cancelled</p>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {/* Tabs Row with Export & Refresh Actions */}
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

          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={!data.items.length}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <Download size={15} /> Export
            </button>
            <button
              onClick={refresh}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
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
              placeholder="Search by RFQ ID, title, buyer or product..."
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
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Status: All</option>
            <option value="OPEN">Open</option>
            <option value="AWARDED">Awarded</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Date: All Time</option>
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
            <LoaderCircle size={20} className="animate-spin text-[#5B13EC]" /> Loading RFQs...
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No buyer requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-xs">
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
                  <th className="px-4 py-3.5">RFQ / Requirement</th>
                  <th className="px-4 py-3.5">Buyer</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Quantity</th>
                  <th className="px-4 py-3.5">Responses</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created On</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.items.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  const isAwarded = item.status === "AWARDED";
                  const isOpen = item.status === "OPEN";
                  const quotesCount = item._count?.quotations ?? 0;
                  const rfqCode = `RFQ-2026-${item.id.slice(0, 5).toUpperCase()}`;

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

                      {/* RFQ / Requirement */}
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900 block max-w-[220px] truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">{rfqCode}</p>
                      </td>

                      {/* Buyer */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-700">
                          {item.buyer?.name || "Corporate Buyer"}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-1 text-[11px] font-bold text-[#5B13EC]">
                          {item.garmentType || "Apparel"}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        {Number(item.targetQuantity || 0).toLocaleString("en-IN")} pcs
                      </td>

                      {/* Responses */}
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/admin/rfqs/${item.id}`}
                          className="font-bold text-[#5B13EC] underline hover:opacity-80"
                        >
                          {quotesCount} {quotesCount === 1 ? "Quote" : "Quotes"}
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {isAwarded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} /> Awarded
                          </span>
                        ) : isOpen ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                            <Clock3 size={11} /> Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            Closed
                          </span>
                        )}
                      </td>

                      {/* Created On */}
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString("en-US")}
                      </td>

                      {/* Actions */}
                      <td className="relative px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveRfq(item)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Eye size={13} /> View
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
                          <div className="absolute right-4 top-10 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                            <Link
                              href={`/admin/rfqs/${item.id}`}
                              className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Quotes & Details
                            </Link>
                            {item.status !== "CLOSED" && (
                              <button
                                onClick={() => closeRfq(item)}
                                className="w-full rounded-lg px-3 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                Close RFQ
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
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total} RFQs
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

      {/* RFQ Quick View Modal */}
      {activeRfq && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setActiveRfq(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">RFQ Overview</h2>
                <p className="mt-0.5 text-xs text-slate-500 font-mono">
                  RFQ-2026-{activeRfq.id.slice(0, 5).toUpperCase()}
                </p>
              </div>
              <button
                onClick={() => setActiveRfq(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-0.5 text-[11px] font-bold text-[#5B13EC]">
                  {activeRfq.garmentType || "Apparel"}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{activeRfq.title}</h3>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Buyer:</span>
                  <p className="font-bold text-slate-900">{activeRfq.buyer?.name || "Corporate Buyer"}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Target Quantity:</span>
                  <p className="font-bold text-slate-900">
                    {Number(activeRfq.targetQuantity || 0).toLocaleString("en-IN")} pcs
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Quotations Received:</span>
                  <p className="font-bold text-slate-900">{activeRfq._count?.quotations ?? 0}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status:</span>
                  <p className="font-bold text-slate-900">{activeRfq.status}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                onClick={() => setActiveRfq(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>

              <Link
                href={`/admin/rfqs/${activeRfq.id}`}
                className="rounded-xl bg-[#5B13EC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#4C0EC9]"
              >
                Full Quotation Breakdown →
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
