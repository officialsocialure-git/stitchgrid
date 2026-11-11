"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Coins, Clock3, Landmark, RotateCcw, Search, RefreshCw, Download,
  ChevronLeft, ChevronRight, Eye, MoreHorizontal, X, LoaderCircle,
  ArrowUp, CheckSquare, Square, CheckCircle2, UserCheck, AlertTriangle,
  Flag, ArrowLeftRight, FileSpreadsheet
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
      { value: "PAYOUTS", label: "Supplier Payouts", count: data.stats.supplierTransferRefs, icon: Landmark },
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
    <section className="space-y-6">
      {/* Page Header with Supplier Onboarding & Export Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Payments & Payouts
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage collections, milestone payments, supplier payouts and refunds.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowOnboardingModal(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
          >
            <UserCheck size={16} /> Supplier Onboarding
          </button>
          <button
            onClick={exportCsv}
            disabled={!data.items.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#5B13EC] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#4C0EC9] disabled:opacity-50"
          >
            <Download size={15} /> Export
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Collections */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F3EFFC] text-[#5B13EC]">
            <Coins size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Collections</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {loading ? "—" : formatMoney(data.stats.verifiedCollections)}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +18%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Verified payments</p>
          </div>
        </div>

        {/* Card 2: Pending Payments */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFFBEB] text-[#D97706]">
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
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
            <Landmark size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier Payouts</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-slate-900">
                {loading ? "—" : formatMoney(data.stats.verifiedCollections * 0.85)}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +12%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Released to suppliers</p>
          </div>
        </div>

        {/* Card 4: Refunds */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
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
                {t.count !== undefined && (
                  <span className={active ? "text-white/80" : "text-slate-400"}>
                    ({t.count})
                  </span>
                )}
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
                  const isPaid =
                    payment.status === "PAID" ||
                    payment.status === "CAPTURED" ||
                    payment.status === "SETTLED" ||
                    payment.signatureVerified;
                  const isPending = payment.status === "PENDING" || payment.status === "CREATED";
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
                        <p className="text-[11px] text-slate-400">{payment.provider || "Razorpay"}</p>
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
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} /> Verified
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
                            onClick={() => setActivePayment(payment)}
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

      {/* Transaction Details Modal */}
      {activePayment && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setActivePayment(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
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

            <div className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Provider</span>
                  <p className="font-bold text-slate-900 mt-0.5">{activePayment.provider}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Razorpay Payment ID</span>
                  <p className="font-bold font-mono text-slate-900 mt-0.5">
                    {activePayment.razorpayPaymentId || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Amount</span>
                  <p className="font-bold font-mono text-slate-900 mt-0.5">
                    {formatMoney(activePayment.amount, activePayment.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Status</span>
                  <p className="font-bold text-[#5B13EC] mt-0.5">{activePayment.status}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Order PO</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {activePayment.purchaseOrder?.poNumber || "PO-ACTIVE"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold uppercase">Signature Verified</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {activePayment.signatureVerified ? "Yes" : "Pending / N/A"}
                  </p>
                </div>
              </div>
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
                <h2 className="text-lg font-bold text-slate-950">Supplier Payout & Bank Onboarding</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Verify linked commercial bank accounts for milestone escrow disbursements
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
