"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package, Clock3, Truck, CheckCircle2, Search, RefreshCw, Download,
  ChevronLeft, ChevronRight, Eye, MoreHorizontal, X, LoaderCircle,
  ArrowUp, CheckSquare, Square, Layers3, Factory, ShieldCheck, XCircle
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Order = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: number | string;
  currency?: string;
  createdAt: string;
  expectedDate?: string | null;
  dispatchDate?: string | null;
  deliveryDate?: string | null;
  trackingNumber?: string | null;
  buyer?: { id: string; name: string };
  supplier?: { id: string; name: string };
  items?: { id: string; name: string; quantity: number; unitPrice: number | string }[];
  milestones?: { id: string; title: string; status: string; dueDate?: string | null; completedAt?: string | null }[];
  samples?: { id: string; status: string; createdAt: string; notes?: string | null }[];
  paymentTransactions?: { id: string; amount: number | string; currency: string; status: string; createdAt: string }[];
};

type Stats = {
  total: number;
  pending: number;
  sample: number;
  production: number;
  qc: number;
  dispatched: number;
  delivered: number;
  cancelled: number;
};

type Result = {
  items: Order[];
  total: number;
  pages: number;
  stats: Stats;
};

const emptyStats: Stats = {
  total: 0,
  pending: 0,
  sample: 0,
  production: 0,
  qc: 0,
  dispatched: 0,
  delivered: 0,
  cancelled: 0,
};

const PAGE_SIZE = 10;

const formatMoney = (value: number | string | null | undefined, currency = "INR") => {
  if (value === null || value === undefined || value === "") return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      Number(value)
    );
  } catch {
    return `₹${value}`;
  }
};

const getMilestoneProgress = (status: string) => {
  switch (status) {
    case "SAMPLE_PENDING":
      return { label: "Sample (2/5)", percent: 40 };
    case "SAMPLE_APPROVED":
      return { label: "Sample Approved (2/5)", percent: 45 };
    case "PRODUCTION_STARTED":
    case "IN_PRODUCTION":
      return { label: "Production (3/5)", percent: 60 };
    case "QC_PENDING":
    case "QC":
      return { label: "QC Inspection (3.5/5)", percent: 75 };
    case "READY_TO_DISPATCH":
    case "DISPATCHED":
      return { label: "Dispatched (4/5)", percent: 80 };
    case "DELIVERED":
    case "COMPLETED":
      return { label: "Completed (5/5)", percent: 100 };
    case "CANCELLED":
      return { label: "Cancelled", percent: 0 };
    default:
      return { label: "Deposit / Setup (1/5)", percent: 20 };
  }
};

const getPaymentBadge = (order: Order) => {
  const txs = order.paymentTransactions || [];
  if (txs.some((t) => ["PAID", "CAPTURED", "SETTLED", "SUCCESS"].includes(t.status))) {
    return { label: "Paid", color: "bg-emerald-50 text-emerald-700 border-emerald-200/60" };
  }
  if (txs.some((t) => ["PENDING", "PROCESSING"].includes(t.status))) {
    return { label: "Partially Paid", color: "bg-amber-50 text-amber-800 border-amber-200/60" };
  }
  return { label: "Pending", color: "bg-amber-50 text-amber-800 border-amber-200/60" };
};

export default function OrdersPage() {
  const [data, setData] = useState<Result>({
    items: [],
    total: 0,
    pages: 1,
    stats: emptyStats,
  });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("ALL");
  const [orderStatus, setOrderStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), []);
  useRealtimeSync({
    topics: ["orders", "payments", "production", "admin:stats_updated"],
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
        status: tab === "ALL" ? orderStatus : tab,
        paymentStatus,
        dateRange,
      });
      try {
        const result = (await adminService.orders(params)) as Result;
        if (!alive) return;
        setData({
          items: result?.items || [],
          total: result?.total || 0,
          pages: Math.max(1, result?.pages || 1),
          stats: result?.stats || emptyStats,
        });
        setSelectedIds([]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load purchase orders.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, query, tab, orderStatus, paymentStatus, dateRange, refreshKey]);

  const tabs = useMemo(
    () => [
      { value: "ALL", label: "All Orders", count: data.stats.total, icon: Layers3 },
      { value: "PENDING", label: "Pending", count: data.stats.pending, icon: Clock3 },
      { value: "SAMPLE", label: "Sample", count: data.stats.sample, icon: Package },
      { value: "PRODUCTION", label: "Production", count: data.stats.production, icon: Factory },
      { value: "QC", label: "QC", count: data.stats.qc, icon: ShieldCheck },
      { value: "DISPATCHED", label: "Dispatched", count: data.stats.dispatched, icon: Truck },
      { value: "DELIVERED", label: "Delivered", count: data.stats.delivered, icon: CheckCircle2 },
      { value: "CANCELLED", label: "Cancelled", count: data.stats.cancelled, icon: XCircle },
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

  const exportCsv = () => {
    const rows = [
      ["Order ID", "PO Number", "Buyer", "Supplier", "Total Amount", "Currency", "Status", "Date"],
      ...data.items.map((o) => [
        o.id,
        o.poNumber,
        o.buyer?.name || "Buyer",
        o.supplier?.name || "Supplier",
        o.totalAmount,
        o.currency || "INR",
        o.status,
        new Date(o.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stitchgrid-admin-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setQuery("");
    setTab("ALL");
    setOrderStatus("ALL");
    setPaymentStatus("ALL");
    setDateRange("ALL");
    setPage(1);
  };

  return (
    <section className="space-y-6">
      {/* Page Header with Export & Refresh Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track purchase orders, sampling requests and production progress.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCsv}
            disabled={!data.items.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#5B13EC] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#4C0EC9] disabled:opacity-50"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={refresh}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Orders */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F3EFFC] text-[#5B13EC]">
            <Package size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.total}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +12%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">All purchase orders</p>
          </div>
        </div>

        {/* Card 2: In Progress */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFFBEB] text-[#D97706]">
            <Clock3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Progress</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.production + data.stats.sample + data.stats.qc}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Active production orders</p>
          </div>
        </div>

        {/* Card 3: Dispatched */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
            <Truck size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dispatched</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.dispatched}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Orders shipped to buyer</p>
          </div>
        </div>

        {/* Card 4: Completed */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
            <CheckCircle2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.delivered}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Successfully delivered</p>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {/* Tabs Row */}
        <div className="flex flex-wrap gap-2.5 border-b border-slate-100 px-6 py-4">
          {tabs.map((t) => {
            const active = tab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => {
                  setTab(t.value);
                  setPage(1);
                }}
                className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-bold transition ${
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
              placeholder="Search by PO number, buyer or supplier..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none transition focus:border-[#5B13EC]"
            />
          </div>

          <select
            value={orderStatus}
            onChange={(e) => {
              setOrderStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Order Status: All</option>
            <option value="PO_CREATED">PO Created</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="SAMPLE_PENDING">Sample Pending</option>
            <option value="IN_PRODUCTION">In Production</option>
            <option value="QC">QC</option>
            <option value="DISPATCHED">Dispatched</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Payment Status: All</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
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
            <LoaderCircle size={20} className="animate-spin text-[#5B13EC]" /> Loading purchase orders...
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No purchase orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
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
                  <th className="px-4 py-3.5">Order ID ↕</th>
                  <th className="px-4 py-3.5">Buyer</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Order Value</th>
                  <th className="px-4 py-3.5">Payment</th>
                  <th className="px-4 py-3.5">Progress</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Created On</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.items.map((order) => {
                  const isChecked = selectedIds.includes(order.id);
                  const progress = getMilestoneProgress(order.status);
                  const pBadge = getPaymentBadge(order);

                  return (
                    <tr
                      key={order.id}
                      className={`transition hover:bg-[#FAF9FE] ${isChecked ? "bg-[#FAF8FF]" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleSelect(order.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-[#5B13EC]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Order ID */}
                      <td className="px-4 py-3.5">
                        <p className="font-bold text-slate-900 font-mono">{order.poNumber}</p>
                        <p className="text-[11px] font-mono text-slate-400 truncate max-w-[120px]">
                          {order.id}
                        </p>
                      </td>

                      {/* Buyer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-[10px] font-bold text-[#5B13EC]">
                            {(order.buyer?.name || "B").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[130px] font-semibold text-slate-800">
                            {order.buyer?.name || "Corporate Buyer"}
                          </span>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-[10px] font-bold text-[#5B13EC]">
                            {(order.supplier?.name || "S").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[130px] font-semibold text-slate-800">
                            {order.supplier?.name || "Manufacturing Mill"}
                          </span>
                        </div>
                      </td>

                      {/* Order Value */}
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {formatMoney(order.totalAmount, order.currency)}
                      </td>

                      {/* Payment Badge */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${pBadge.color}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {pBadge.label}
                        </span>
                      </td>

                      {/* Progress Bar */}
                      <td className="px-4 py-3.5 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-1">
                          <span>{progress.label}</span>
                          <span className="text-slate-400 font-mono">{progress.percent}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#5B13EC] rounded-full transition-all"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-1 text-[10px] font-bold text-[#5B13EC] uppercase tracking-wider">
                          {order.status.replaceAll("_", " ")}
                        </span>
                      </td>

                      {/* Created On */}
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">
                        {new Date(order.createdAt).toLocaleDateString("en-US")}
                      </td>

                      {/* Actions */}
                      <td className="relative px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveOrder(order)}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Eye size={13} /> View
                          </button>

                          <button
                            onClick={() => setMenuId(menuId === order.id ? null : order.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-[#EBE4FF] hover:text-[#5B13EC] transition"
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        </div>

                        {menuId === order.id && (
                          <div className="absolute right-4 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                            <button
                              onClick={() => {
                                setActiveOrder(order);
                                setMenuId(null);
                              }}
                              className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Milestones & Timeline
                            </button>
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
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total} orders
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

      {/* Order Details Modal */}
      {activeOrder && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setActiveOrder(null)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Purchase Order Details</h2>
                <p className="mt-0.5 text-xs text-slate-500 font-mono">{activeOrder.poNumber}</p>
              </div>
              <button
                onClick={() => setActiveOrder(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Buyer</span>
                  <p className="font-bold text-slate-900 mt-0.5">{activeOrder.buyer?.name || "Corporate Buyer"}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Supplier</span>
                  <p className="font-bold text-slate-900 mt-0.5">{activeOrder.supplier?.name || "Manufacturing Mill"}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Total Contract Value</span>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">
                    {formatMoney(activeOrder.totalAmount, activeOrder.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Status</span>
                  <p className="font-bold text-[#5B13EC] mt-0.5">{activeOrder.status}</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Production Milestones</h4>
                {activeOrder.milestones && activeOrder.milestones.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeOrder.milestones.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-[#FAF9FD]"
                      >
                        <span className="font-medium text-slate-800">{m.title}</span>
                        <span className="inline-flex rounded-full bg-[#EBE4FF] px-2 py-0.5 text-[10px] font-bold text-[#5B13EC]">
                          {m.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic">No specific milestone stages registered.</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                onClick={() => setActiveOrder(null)}
                className="rounded-xl bg-[#5B13EC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#4C0EC9]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
