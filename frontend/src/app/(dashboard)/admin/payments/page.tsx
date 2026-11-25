"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Coins, Clock3, Landmark, RotateCcw, Search, RefreshCw, Download,
  ChevronLeft, ChevronRight, Eye, MoreHorizontal, X, LoaderCircle,
  CheckSquare, Square, CheckCircle2, UserCheck, AlertTriangle,
  Flag, ArrowLeftRight, FileSpreadsheet, Wallet, Filter, Package,
  Activity, CircleDollarSign
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { SupplierPaymentSetups } from "@/features/admin/SupplierPaymentSetups";
import { AdminPaymentRefunds } from "@/features/admin/AdminPaymentRefunds";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Payment = {
  id: string;
  provider: string;
  providerRef?: string | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  transferId?: string | null;
  paymentMethod?: string | null;
  amount: number | string;
  currency: string;
  status: string;
  signatureVerified: boolean;
  createdAt: string;
  capturedAt?: string | null;
  settledAt?: string | null;
  paymentMilestone?: { title: string; sequence: number; status: string } | null;
  purchaseOrder?: {
    id: string;
    poNumber: string;
    currency: string;
    totalAmount: number | string;
    buyer?: { name: string };
    supplier?: { name: string };
  };
  refunds?: {
    id: string;
    providerRefundId?: string | null;
    amount: number | string;
    status: string;
    reason?: string | null;
    createdAt: string;
  }[];
};

type Stats = {
  verifiedCollections: number;
  verifiedCollectionCount: number;
  pendingAmount: number;
  pendingCount: number;
  failedAmount: number;
  failedCount: number;
  refundAmount: number;
  refundCount: number;
  supplierTransferRefs: number;
};

type Result = {
  items: Payment[];
  total: number;
  pages: number;
  stats: Stats;
};

const emptyStats: Stats = {
  verifiedCollections: 0,
  verifiedCollectionCount: 0,
  pendingAmount: 0,
  pendingCount: 0,
  failedAmount: 0,
  failedCount: 0,
  refundAmount: 0,
  refundCount: 0,
  supplierTransferRefs: 0,
};

const PAGE_SIZE = 10;

const formatMoney = (value: number | string | null | undefined, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      Number(value || 0)
    );
  } catch {
    return `₹${value ?? "—"}`;
  }
};

const shortTxId = (p: Payment) => {
  const raw = p.razorpayPaymentId || p.providerRef || p.id;
  if (raw.length > 18) {
    return `${raw.slice(0, 9)}...${raw.slice(-4)}`;
  }
  return raw;
};

export default function PaymentsPage() {
  const [data, setData] = useState<Result>({
    items: [],
    total: 0,
    pages: 1,
    stats: emptyStats,
  });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [detailTab, setDetailTab] = useState<"OVERVIEW" | "ORDER" | "MILESTONES" | "ACTIVITY">("OVERVIEW");

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), []);
  useRealtimeSync({
    topics: ["payment:created", "payment:updated", "payment:setup_updated", "payment:refund_updated", "admin:stats_updated"],
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
        status,
        type: tab === "RECONCILIATION" ? "ALL" : tab,
        dateRange,
      });
      try {
        const result = (await adminService.payments(params)) as Result;
        if (!alive) return;
        setData({
          items: result?.items || [],
          total: result?.total || 0,
          pages: Math.max(1, result?.pages || 1),
          stats: result?.stats || emptyStats,
        });
        setSelectedIds([]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load payment records.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, query, status, tab, dateRange, refreshKey]);

  const tabs = useMemo(
    () => [
      { value: "ALL", label: "All Transactions", count: data.total, icon: ArrowLeftRight },
      { value: "COLLECTIONS", label: "Collections", count: data.stats.verifiedCollectionCount, icon: Download },
      { value: "MILESTONES", label: "Milestone Payments", count: undefined, icon: Flag },
      { value: "PAYOUTS", label: "Recorded Transfers", count: data.stats.supplierTransferRefs, icon: Landmark },
      { value: "REFUNDS", label: "Refunds", count: data.stats.refundCount, icon: RotateCcw },
      { value: "FAILED", label: "Failed Payments", count: data.stats.failedCount, icon: AlertTriangle },
      { value: "RECONCILIATION", label: "Reconciliation", count: undefined, icon: FileSpreadsheet },
    ],
    [data.stats, data.total]
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
      ["Transaction ID", "Provider", "Order ID", "Buyer", "Supplier", "Milestone", "Amount", "Currency", "Status", "Date"],
      ...data.items.map((p) => [
        p.razorpayPaymentId || p.providerRef || p.id,
        p.provider,
        p.purchaseOrder?.poNumber || "PO Order",
        p.purchaseOrder?.buyer?.name || "Buyer",
        p.purchaseOrder?.supplier?.name || "Supplier",
        p.paymentMilestone?.title || "Milestone",
        p.amount,
        p.currency || "INR",
        p.status,
        new Date(p.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stitchgrid-admin-payments.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setQuery("");
    setTab("ALL");
    setStatus("ALL");
    setDateRange("ALL");
    setPage(1);
  };

  return (
    <section className="space-y-4 md:space-y-6">
      {/* Payments overview hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#321078] via-[#5B13EC] to-[#7C3AED] p-5 text-white shadow-lg shadow-violet-900/10 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full border-[24px] border-white/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/90"><Wallet size={13} /> Finance workspace</div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Payments & Payouts</h1>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-violet-100 sm:text-sm">Manage transactions, milestone payments, collections and supplier payouts.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={exportCsv} disabled={!data.items.length} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-xs font-bold text-[#5B13EC] shadow-sm transition hover:bg-violet-50 disabled:opacity-50"><Download size={15} /> Export</button>
            <button onClick={refresh} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3.5 text-xs font-bold text-white transition hover:bg-white/20"><RefreshCw size={15} /> <span className="hidden sm:inline">Refresh</span></button>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-amber-100">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/30 bg-amber-300/15 px-2.5 py-1.5"><AlertTriangle size={13} /> TEST PAYMENT MODE</span>
          <span className="text-white/80">Mock transactions are simulated. No real money is collected or transferred.</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900">
        <span><strong>Supplier payouts paused:</strong> Bank settlement is not active in test mode.</span>
        <button onClick={() => setShowOnboardingModal(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 font-bold text-amber-800 hover:bg-amber-100"><UserCheck size={14} /> Supplier setup</button>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        {/* Card 1: Total Collections */}
        <div className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition hover:shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F3EFFC] text-[#5B13EC] sm:h-12 sm:w-12 sm:rounded-2xl">
            <Coins size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Collections</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {loading ? "—" : formatMoney(data.stats.verifiedCollections)}
              </span>
              
            </div>
            <p className="mt-1 text-[10px] text-slate-400 sm:text-xs">Successful records · incl. test mode</p>
          </div>
        </div>

        {/* Card 2: Pending Payments */}
        <div className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition hover:shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFFBEB] text-[#D97706] sm:h-12 sm:w-12 sm:rounded-2xl">
            <Clock3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Payments</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {loading ? "—" : formatMoney(data.stats.pendingAmount)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {data.stats.pendingCount} Orders Awaiting confirmation
            </p>
          </div>
        </div>

        {/* Card 3: Supplier Payouts */}
        <div className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition hover:shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#ECFDF5] text-[#059669] sm:h-12 sm:w-12 sm:rounded-2xl">
            <Landmark size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recorded Transfers</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {loading ? "—" : data.stats.supplierTransferRefs}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Provider transfer references recorded</p>
          </div>
        </div>

        {/* Card 4: Refunds */}
        <div className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs transition hover:shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FEF2F2] text-[#DC2626] sm:h-12 sm:w-12 sm:rounded-2xl">
            <RotateCcw size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Refunds</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {loading ? "—" : formatMoney(data.stats.refundAmount)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {data.stats.refundCount} Requests Processed / Pending
            </p>
          </div>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {/* Tabs Row */}
        <div className="flex gap-2.5 overflow-x-auto border-b border-slate-100 px-3 py-3 sm:flex-wrap sm:px-6 sm:py-4">
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
                {t.count !== undefined && (
                  <span className={active ? "text-white/80" : "text-slate-400"}>
                    ({t.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile search and filters */}
        <div className="border-b border-slate-100 bg-[#FAF9FD] p-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search transaction or order ID..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none focus:border-[#5B13EC]" />
            </div>
            <button type="button" onClick={() => setShowMobileFilters(v => !v)} aria-expanded={showMobileFilters} className={`relative inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-xs font-bold ${showMobileFilters ? "border-[#5B13EC] bg-[#F3EDFF] text-[#5B13EC]" : "border-slate-200 bg-white text-slate-700"}`}><Filter size={15} /> Filters {(status !== "ALL" || dateRange !== "ALL") && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#5B13EC] px-1 text-[9px] text-white">{Number(status !== "ALL") + Number(dateRange !== "ALL")}</span>}</button>
          </div>
          {showMobileFilters && <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <label className="text-[11px] font-bold text-slate-600">Payment Status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"><option value="ALL">All Statuses</option><option value="PAID">Success / Paid</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option><option value="REFUND_REQUESTED">Refund Requested</option></select></label>
            <label className="text-[11px] font-bold text-slate-600">Date Range<select value={dateRange} onChange={e => { setDateRange(e.target.value); setPage(1); }} className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"><option value="ALL">All Time</option><option value="7D">Last 7 days</option><option value="30D">Last 30 days</option><option value="90D">Last 90 days</option></select></label>
            <div className="grid grid-cols-2 gap-2"><button type="button" onClick={reset} className="h-10 rounded-lg border border-slate-200 text-xs font-bold text-slate-600">Reset</button><button type="button" onClick={() => setShowMobileFilters(false)} className="h-10 rounded-lg bg-[#5B13EC] text-xs font-bold text-white">Apply Filters</button></div>
          </div>}
        </div>

        {/* Desktop filter inputs */}
        <div className="hidden md:grid grid-cols-1 gap-2.5 border-b border-slate-100 bg-[#FAF9FD] p-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto]">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by transaction ID, order ID, buyer or supplier..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none transition focus:border-[#5B13EC]"
            />
          </div>

          <select
            value={tab}
            onChange={(e) => {
              setTab(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Payment Type: All</option>
            <option value="COLLECTIONS">Collections</option>
            <option value="MILESTONES">Milestones</option>
            <option value="PAYOUTS">Payouts</option>
            <option value="REFUNDS">Refunds</option>
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
            <option value="PAID">Paid / Verified</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
            <option value="REFUND_REQUESTED">Refund Requested</option>
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
            <RefreshCw size={14} /> Refresh
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
            <LoaderCircle size={20} className="animate-spin text-[#5B13EC]" /> Loading transaction records...
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No payment records found.</div>
        ) : (
          <>
          {/* Mobile transaction cards */}
          <div className="space-y-3 p-3 md:hidden">
            {data.items.map((payment) => {
              const isRefunded = payment.status === "REFUNDED";
              const isPaid = !isRefunded && !["REFUND_REQUESTED", "PROCESSING"].includes(payment.status) && (["PAID", "CAPTURED", "SETTLED"].includes(payment.status) || payment.signatureVerified);
              const isPending = ["PENDING", "CREATED", "REFUND_REQUESTED", "PROCESSING"].includes(payment.status);
              const statusLabel = isRefunded ? "Refunded" : isPending ? (payment.status === "REFUND_REQUESTED" ? "Refund requested" : "Pending") : isPaid ? (payment.provider === "MOCK_TEST" ? "Test successful" : "Success") : payment.status === "FAILED" ? "Failed" : payment.status;
              const statusClass = isRefunded ? "bg-rose-50 text-rose-700" : isPending ? "bg-amber-50 text-amber-800" : isPaid ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
              const milestoneName = payment.paymentMilestone?.title || (payment.refunds?.length ? "Refund" : "Collection");
              return <article key={payment.id} className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${isRefunded ? "bg-rose-50 text-rose-600" : isPending ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}>{isRefunded ? <RotateCcw size={18} /> : isPending ? <Clock3 size={18} /> : <Download size={18} />}</span><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-900">{shortTxId(payment)}</p><p className="mt-0.5 text-[10px] text-slate-500">Order: {payment.purchaseOrder?.poNumber || "—"}</p></div></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
                </div>
                <div className="mt-3 flex items-end justify-between gap-2 border-t border-slate-100 pt-3"><div><p className="text-[10px] font-semibold text-slate-400">Amount</p><p className="mt-0.5 text-lg font-black text-slate-950">{formatMoney(payment.amount, payment.currency)}</p></div><div className="text-right"><p className="text-[10px] font-semibold text-slate-400">{milestoneName}</p><p className="mt-0.5 text-[11px] font-medium text-slate-600">{new Date(payment.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p></div></div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]"><div className="min-w-0"><p className="text-slate-400">Buyer</p><p className="truncate font-bold text-slate-700">{payment.purchaseOrder?.buyer?.name || "—"}</p></div><div className="min-w-0"><p className="text-slate-400">Supplier</p><p className="truncate font-bold text-slate-700">{payment.purchaseOrder?.supplier?.name || "—"}</p></div></div>
                {payment.provider === "MOCK_TEST" && <p className="mt-2 text-[9px] font-bold tracking-wide text-amber-700">TEST SIMULATOR · NO REAL MONEY</p>}
                <div className="mt-3 flex items-center justify-between gap-2"><button type="button" onClick={() => toggleSelect(payment.id)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">{selectedIds.includes(payment.id) ? <CheckSquare size={15} className="text-[#5B13EC]" /> : <Square size={15} />} Select</button><button type="button" onClick={() => { setDetailTab("OVERVIEW"); setActivePayment(payment); }} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5B13EC] px-4 text-xs font-bold text-white"><Eye size={14} /> View Details</button></div>
              </article>;
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
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
                  <th className="px-4 py-3.5">Transaction ID</th>
                  <th className="px-4 py-3.5">Order ID</th>
                  <th className="px-4 py-3.5">Buyer</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Milestone</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Payment Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.items.map((payment) => {
                  const isChecked = selectedIds.includes(payment.id);
                  const isRefunded = payment.status === "REFUNDED";
                  const isPaid = !isRefunded && ["PAID", "CAPTURED", "SETTLED"].includes(payment.status) && (payment.provider === "MOCK_TEST" || payment.signatureVerified);
                  const isPending = ["PENDING", "CREATED", "REFUND_REQUESTED", "PROCESSING"].includes(payment.status);
                  const milestoneName =
                    payment.paymentMilestone?.title || (payment.refunds?.length ? "Refund" : "Advance");
                  const isRefund = milestoneName === "Refund";

                  return (
                    <tr
                      key={payment.id}
                      className={`transition hover:bg-[#FAF9FE] ${isChecked ? "bg-[#FAF8FF]" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleSelect(payment.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-[#5B13EC]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Transaction ID */}
                      <td className="px-4 py-3.5">
                        <p className="font-bold font-mono text-slate-900">{shortTxId(payment)}</p>
                        <p className={payment.provider === "MOCK_TEST" ? "text-[11px] font-bold text-amber-700" : "text-[11px] text-slate-400"}>{payment.provider === "MOCK_TEST" ? "TEST SIMULATOR · NO REAL MONEY" : payment.provider || "Payment provider"}</p>
                      </td>

                      {/* Order ID */}
                      <td className="px-4 py-3.5 font-mono font-medium text-slate-700">
                        {payment.purchaseOrder?.poNumber || "PO-2026-ACTIVE"}
                      </td>

                      {/* Buyer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-[10px] font-bold text-[#5B13EC]">
                            {(payment.purchaseOrder?.buyer?.name || "C").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[120px] font-semibold text-slate-800">
                            {payment.purchaseOrder?.buyer?.name || "Cargo"}
                          </span>
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-[10px] font-bold text-[#5B13EC]">
                            {(payment.purchaseOrder?.supplier?.name || "Q").slice(0, 1).toUpperCase()}
                          </span>
                          <span className="truncate max-w-[120px] font-semibold text-slate-800">
                            {payment.purchaseOrder?.supplier?.name || "Qspiders"}
                          </span>
                        </div>
                      </td>

                      {/* Milestone */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            isRefund
                              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                              : "bg-[#EBE4FF] text-[#5B13EC]"
                          }`}
                        >
                          {milestoneName}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {formatMoney(payment.amount, payment.currency)}
                      </td>

                      {/* Payment Status */}
                      <td className="px-4 py-3.5">
                        {isRefunded ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200/60 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"><RotateCcw size={11} /> Refunded</span>
                        ) : isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} /> {payment.provider === "MOCK_TEST" ? "Test successful" : "Verified"}
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                            <Clock3 size={11} /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700 border border-purple-200/60">
                            Processed
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">
                        {new Date(payment.createdAt).toLocaleDateString("en-US")}
                      </td>

                      {/* Actions */}
                      <td className="relative px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setDetailTab("OVERVIEW"); setActivePayment(payment); }}
                            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            <Eye size={13} /> View
                          </button>

                          <button
                            onClick={() => setMenuId(menuId === payment.id ? null : payment.id)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-[#EBE4FF] hover:text-[#5B13EC] transition"
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        </div>

                        {menuId === payment.id && (
                          <div className="absolute right-4 top-10 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                            <button
                              onClick={() => {
                                setDetailTab("OVERVIEW");
                                setActivePayment(payment);
                                setMenuId(null);
                              }}
                              className="block w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Transaction Audit Trail
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
          </>
        )}

        {/* Footer Pagination */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {data.total ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total} transactions
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

      {/* Admin refund review queue */}
      <AdminPaymentRefunds />

      {/* Transaction Details Modal */}
      {activePayment && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setActivePayment(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Transaction Details</h2>
                <p className="mt-0.5 text-xs text-slate-500 font-mono">{activePayment.id}</p>
              </div>
              <button
                onClick={() => setActivePayment(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-100 text-xs">
              {([ ["OVERVIEW", "Overview"], ["ORDER", "Order"], ["MILESTONES", "Milestones"], ["ACTIVITY", "Activity"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setDetailTab(value)} className={`shrink-0 border-b-2 px-3 py-3 font-bold ${detailTab === value ? "border-[#5B13EC] text-[#5B13EC]" : "border-transparent text-slate-500"}`}>{label}</button>)}
            </div>
            <div className="mt-4 max-h-[55vh] space-y-3 overflow-y-auto text-xs">
              {detailTab === "OVERVIEW" && <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><CircleDollarSign size={17} className="text-[#5B13EC]" /> Transaction Information</h3>
                <div className="space-y-2.5">
                  {[["Transaction ID", activePayment.id], ["Provider Reference", activePayment.razorpayPaymentId || activePayment.providerRef || "—"], ["Type", activePayment.provider === "MOCK_TEST" ? "Test Simulator" : activePayment.provider], ["Amount", formatMoney(activePayment.amount, activePayment.currency)], ["Status", activePayment.status], ["Payment Method", activePayment.paymentMethod || "—"], ["Date & Time", new Date(activePayment.createdAt).toLocaleString("en-IN")], ["Verification", activePayment.provider === "MOCK_TEST" ? "Simulated · Not provider verified" : activePayment.signatureVerified ? "Verified" : "Pending / N/A"]].map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0"><span className="text-slate-500">{label}</span><span className="max-w-[62%] break-all text-right font-bold text-slate-900">{value}</span></div>)}
                </div>
                {activePayment.provider === "MOCK_TEST" && <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[10px] font-bold text-amber-800">TEST SIMULATOR · NO REAL MONEY IS COLLECTED OR TRANSFERRED.</p>}
              </div>}
              {detailTab === "ORDER" && <div className="rounded-xl border border-slate-200 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><Package size={17} className="text-[#5B13EC]" /> Related Order</h3><div className="space-y-3"><div><p className="text-slate-500">Purchase Order</p><p className="mt-0.5 font-bold text-slate-900">{activePayment.purchaseOrder?.poNumber || "—"}</p></div><div><p className="text-slate-500">Buyer</p><p className="mt-0.5 font-bold text-slate-900">{activePayment.purchaseOrder?.buyer?.name || "—"}</p></div><div><p className="text-slate-500">Supplier</p><p className="mt-0.5 font-bold text-slate-900">{activePayment.purchaseOrder?.supplier?.name || "—"}</p></div><div><p className="text-slate-500">Order Value</p><p className="mt-0.5 font-bold text-slate-900">{activePayment.purchaseOrder ? formatMoney(activePayment.purchaseOrder.totalAmount, activePayment.purchaseOrder.currency) : "—"}</p></div></div></div>}
              {detailTab === "MILESTONES" && <div className="rounded-xl border border-slate-200 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><Flag size={17} className="text-[#5B13EC]" /> Milestone Payment</h3>{activePayment.paymentMilestone ? <><p className="font-bold text-slate-900">{activePayment.paymentMilestone.title}</p><p className="mt-1 text-slate-500">Sequence {activePayment.paymentMilestone.sequence}</p><span className="mt-3 inline-flex rounded-full bg-violet-50 px-3 py-1 font-bold text-violet-700">{activePayment.paymentMilestone.status}</span></> : <p className="text-slate-500">This transaction is not linked to a payment milestone.</p>}</div>}
              {detailTab === "ACTIVITY" && <div className="rounded-xl border border-slate-200 p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900"><Activity size={17} className="text-[#5B13EC]" /> Transaction Activity</h3><div className="space-y-3"><div className="flex gap-3"><span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-violet-500" /><div><p className="font-bold text-slate-900">Transaction created</p><p className="text-slate-500">{new Date(activePayment.createdAt).toLocaleString("en-IN")}</p></div></div>{activePayment.capturedAt && <div className="flex gap-3"><span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500" /><div><p className="font-bold text-slate-900">Payment captured</p><p className="text-slate-500">{new Date(activePayment.capturedAt).toLocaleString("en-IN")}</p></div></div>}{activePayment.settledAt && <div className="flex gap-3"><span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-blue-500" /><div><p className="font-bold text-slate-900">Settlement recorded</p><p className="text-slate-500">{new Date(activePayment.settledAt).toLocaleString("en-IN")}</p></div></div>}{activePayment.refunds?.map(refund => <div key={refund.id} className="flex gap-3"><span className="mt-0.5 h-2.5 w-2.5 rounded-full bg-rose-500" /><div><p className="font-bold text-slate-900">Refund · {refund.status}</p><p className="text-slate-500">{new Date(refund.createdAt).toLocaleString("en-IN")} · {formatMoney(refund.amount, activePayment.currency)}</p>{refund.reason && <p className="mt-1 text-slate-500">{refund.reason}</p>}</div></div>)}</div></div>}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                onClick={() => setActivePayment(null)}
                className="rounded-xl bg-[#5B13EC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#4C0EC9]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Onboarding Modal */}
      {showOnboardingModal && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setShowOnboardingModal(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Supplier Settlement Setup Review</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Review supplier-submitted masked bank details and payment setup status
                </p>
              </div>
              <button
                onClick={() => setShowOnboardingModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5">
              <SupplierPaymentSetups />
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                onClick={() => setShowOnboardingModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
