"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, Download, Clock3, CheckCircle2, XCircle, Building2,
  ChevronLeft, ChevronRight, LoaderCircle, MapPin, Users, ArrowUp, X
} from "lucide-react";
import { marketplaceService } from "@/services/marketplace.service";

type VerificationItem = {
  id: string;
  name: string;
  city?: string | null;
  businessType?: string | null;
  createdAt: string;
  taxId?: string | null;
  verificationStatus: string;
  members?: any[];
};

const PAGE_SIZE = 10;

const labelStatus = (s: string) =>
  s === "APPROVED" ? "Approved" : s === "REJECTED" ? "Rejected" : "Pending";

export default function VerificationPage() {
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [tab, setTab] = useState("ALL");
  const [q, setQ] = useState("");
  const [businessType, setBusinessType] = useState("ALL");
  const [submitted, setSubmitted] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedOrg, setSelectedOrg] = useState<VerificationItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await marketplaceService.listAdminOrganizations();
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load verification requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const eligible = useMemo(() => {
    return items.filter((o) =>
      o.members?.some((m: any) => m.role === "SUPPLIER" || m.role === "BUYER")
    );
  }, [items]);

  const counts = useMemo(
    () => ({
      ALL: eligible.length,
      PENDING: eligible.filter((o) => o.verificationStatus === "PENDING").length,
      APPROVED: eligible.filter((o) => o.verificationStatus === "APPROVED").length,
      REJECTED: eligible.filter((o) => o.verificationStatus === "REJECTED").length,
    }),
    [eligible]
  );

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          eligible.map(
            (o) => o.businessType || o.members?.map((m: any) => m.role).join(" / ") || "Other"
          )
        )
      ),
    [eligible]
  );

  const filtered = useMemo(() => {
    return eligible.filter((o) => {
      const text = `${o.name || ""} ${o.taxId || ""} ${o.members
        ?.map((m: any) => m.user?.email || m.email || "")
        .join(" ") || ""}`.toLowerCase();
      const date = new Date(o.createdAt);
      const now = new Date();
      const dateMatch =
        submitted === "ALL" ||
        (submitted === "7D" && date >= new Date(now.getTime() - 7 * 86400000)) ||
        (submitted === "30D" && date >= new Date(now.getTime() - 30 * 86400000)) ||
        (submitted === "YEAR" && date.getFullYear() === now.getFullYear());
      const type = o.businessType || o.members?.map((m: any) => m.role).join(" / ") || "Other";
      return (
        (tab === "ALL" || o.verificationStatus === tab) &&
        (statusFilter === "ALL" || o.verificationStatus === statusFilter) &&
        (businessType === "ALL" || type === businessType) &&
        dateMatch &&
        (!q || text.includes(q.toLowerCase()))
      );
    });
  }, [eligible, tab, q, businessType, submitted, statusFilter]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const review = async (id: string, status: "APPROVED" | "REJECTED") => {
    const note = status === "REJECTED" ? window.prompt("Enter a rejection reason:") : "";
    if (status === "REJECTED" && note === null) return;
    if (!window.confirm(`${status === "APPROVED" ? "Approve" : "Reject"} this business verification?`))
      return;
    setBusy(id);
    try {
      await marketplaceService.updateVerificationStatus(id, status, note || "");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Verification update failed.");
    } finally {
      setBusy("");
    }
  };

  const exportCsv = () => {
    const data = [
      ["Business", "Business Type", "Submitted", "GST / Tax ID", "Status", "Location"],
      ...filtered.map((o) => [
        o.name,
        o.businessType || o.members?.map((m: any) => m.role).join(" / ") || "",
        new Date(o.createdAt).toLocaleDateString(),
        o.taxId || "",
        labelStatus(o.verificationStatus),
        o.city || "",
      ]),
    ];
    const csv = data.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stitchgrid-verification.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setQ("");
    setTab("ALL");
    setBusinessType("ALL");
    setSubmitted("ALL");
    setStatusFilter("ALL");
    setPage(1);
  };

  const tabs = [
    { key: "ALL", label: "All Applications", count: counts.ALL, icon: Users },
    { key: "PENDING", label: "Pending", count: counts.PENDING, icon: Clock3 },
    { key: "APPROVED", label: "Approved", count: counts.APPROVED, icon: CheckCircle2 },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED, icon: XCircle },
  ];

  return (
    <section className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Verification</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review business profiles and update verification decisions.
        </p>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Applications */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F3EFFC] text-[#5B13EC]">
            <Users size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Applications</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : counts.ALL}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +12%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">All verification requests</p>
          </div>
        </div>

        {/* Card 2: Pending Verification */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFFBEB] text-[#D97706]">
            <Clock3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Verification</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : counts.PENDING}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">All under review</p>
          </div>
        </div>

        {/* Card 3: Approved */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
            <CheckCircle2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : counts.APPROVED}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +100%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Verified businesses</p>
          </div>
        </div>

        {/* Card 4: Rejected */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
            <XCircle size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : counts.REJECTED}
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
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key);
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
            disabled={!filtered.length}
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
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by business name, GST number or email..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none transition focus:border-[#5B13EC]"
            />
          </div>

          <select
            value={businessType}
            onChange={(e) => {
              setBusinessType(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Business Type: All</option>
            {typeOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>

          <select
            value={submitted}
            onChange={(e) => {
              setSubmitted(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Submitted: All Time</option>
            <option value="7D">Last 7 days</option>
            <option value="30D">Last 30 days</option>
            <option value="YEAR">This year</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Status: All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            onClick={() => {
              reset();
              load();
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
            <button onClick={load} className="ml-2 underline">
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle size={20} className="animate-spin text-[#5B13EC]" /> Loading verification requests...
          </div>
        ) : pageItems.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No verification applications match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-xs">
              <thead className="bg-[#FAF9FD] text-[11px] font-bold text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Business</th>
                  <th className="px-5 py-3.5">Business Type</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5">GST / Tax ID</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pageItems.map((o) => {
                  const bType =
                    o.businessType || o.members?.map((m: any) => m.role).join(" / ") || "Buyer";
                  const isPending = o.verificationStatus === "PENDING";
                  const isApproved = o.verificationStatus === "APPROVED";

                  return (
                    <tr key={o.id} className="transition hover:bg-[#FAF9FE]">
                      {/* Business */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-xs font-bold text-[#5B13EC]">
                            {(o.name || "B").slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{o.name}</p>
                            <p className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin size={11} className="text-slate-400" />
                              <span className="truncate">{o.city || "Location not provided"}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Business Type */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-1 text-[11px] font-bold text-[#5B13EC]">
                          {bType}
                        </span>
                      </td>

                      {/* Submitted */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(o.createdAt).toLocaleDateString("en-US")}
                      </td>

                      {/* GST / Tax ID */}
                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-700">
                        {o.taxId || "—"}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} /> Approved
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                            <Clock3 size={11} /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200/60">
                            <XCircle size={11} /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedOrg(o)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Review
                          </button>

                          {isPending && (
                            <>
                              <button
                                disabled={!!busy}
                                onClick={() => review(o.id, "APPROVED")}
                                className="rounded-xl bg-[#D9F66A] px-3 py-1.5 text-xs font-bold text-[#142536] shadow-xs hover:bg-[#cbe65f] transition disabled:opacity-50"
                              >
                                {busy === o.id ? "Saving…" : "Approve"}
                              </button>
                              <button
                                disabled={!!busy}
                                onClick={() => review(o.id, "REJECTED")}
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>
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
            Showing {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} applications
          </span>

          <div className="flex items-center justify-end gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from({ length: Math.min(5, pages) }, (_, i) => {
              const pNum = i + 1;
              return (
                <button
                  key={pNum}
                  onClick={() => setPage(pNum)}
                  className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold transition ${
                    currentPage === pNum
                      ? "bg-[#5B13EC] text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              disabled={currentPage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Review Profile Modal */}
      {selectedOrg && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setSelectedOrg(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Business Application Review</h2>
                <p className="mt-0.5 text-xs text-slate-500">Legal entity and verification credentials</p>
              </div>
              <button
                onClick={() => setSelectedOrg(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EBE4FF] text-base font-bold text-[#5B13EC]">
                {(selectedOrg.name || "B").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="font-bold text-slate-900">{selectedOrg.name}</p>
                <p className="text-xs text-slate-500">{selectedOrg.city || "Location not provided"}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <p className="font-semibold text-slate-400 uppercase">Business Type</p>
                <p className="mt-1 font-bold text-slate-800">{selectedOrg.businessType || "N/A"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">GST / Tax ID</p>
                <p className="mt-1 font-mono font-bold text-slate-800">{selectedOrg.taxId || "—"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">Verification Status</p>
                <p className="mt-1 font-bold text-slate-800">{selectedOrg.verificationStatus}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">Submission Date</p>
                <p className="mt-1 font-bold text-slate-800">
                  {new Date(selectedOrg.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                onClick={() => setSelectedOrg(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>

              {selectedOrg.verificationStatus === "PENDING" && (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const orgId = selectedOrg.id;
                      setSelectedOrg(null);
                      await review(orgId, "REJECTED");
                    }}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Reject
                  </button>
                  <button
                    onClick={async () => {
                      const orgId = selectedOrg.id;
                      setSelectedOrg(null);
                      await review(orgId, "APPROVED");
                    }}
                    className="rounded-xl bg-[#D9F66A] px-4 py-2 text-xs font-bold text-[#142536] shadow-xs hover:bg-[#cbe65f]"
                  >
                    Approve Business
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
