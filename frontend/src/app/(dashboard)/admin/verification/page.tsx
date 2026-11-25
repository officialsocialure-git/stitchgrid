"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, RefreshCw, Download, Clock3, CheckCircle2, XCircle, Building2,
  ChevronLeft, ChevronRight, LoaderCircle, MapPin, Users, ArrowUp, X,
  Filter, FileSpreadsheet, FileText, ShieldCheck, Eye, Check
} from "lucide-react";
import * as XLSX from "xlsx";
import { marketplaceService } from "@/services/marketplace.service";

type VerificationItem = {
  id: string;
  name: string;
  city?: string | null;
  country?: string | null;
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
  const router = useRouter();
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileExportOpen, setMobileExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv" | "pdf">("xlsx");
  const [exportFields, setExportFields] = useState<string[]>(["name", "businessType", "taxId", "status", "submitted", "location"]);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportFileUrl, setExportFileUrl] = useState("");
  const [exportFileName, setExportFileName] = useState("");
  const [exportPrintHtml, setExportPrintHtml] = useState("");
  const [submittedFrom, setSubmittedFrom] = useState("");
  const [submittedTo, setSubmittedTo] = useState("");

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
        (submitted === "YEAR" && date.getFullYear() === now.getFullYear()) ||
        (submitted === "CUSTOM" &&
          (!submittedFrom || date >= new Date(`${submittedFrom}T00:00:00`)) &&
          (!submittedTo || date <= new Date(`${submittedTo}T23:59:59`)));
      const type = o.businessType || o.members?.map((m: any) => m.role).join(" / ") || "Other";
      return (
        (tab === "ALL" || o.verificationStatus === tab) &&
        (statusFilter === "ALL" || o.verificationStatus === statusFilter) &&
        (businessType === "ALL" || type === businessType) &&
        dateMatch &&
        (!q || text.includes(q.toLowerCase()))
      );
    });
  }, [eligible, tab, q, businessType, submitted, statusFilter, submittedFrom, submittedTo]);

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

  const runMobileExport = async () => {
    const columns = [
      { key: "name", label: "Business Name", value: (o: VerificationItem) => o.name || "" },
      { key: "businessType", label: "Business Type (Buyer/Supplier)", value: (o: VerificationItem) => o.businessType || o.members?.map((m: any) => m.role).join(" / ") || "" },
      { key: "taxId", label: "GST / Registration Number", value: (o: VerificationItem) => o.taxId || "" },
      { key: "status", label: "Verification Status", value: (o: VerificationItem) => labelStatus(o.verificationStatus) },
      { key: "submitted", label: "Submitted Date", value: (o: VerificationItem) => new Date(o.createdAt).toLocaleDateString() },
      { key: "location", label: "Location", value: (o: VerificationItem) => [o.city, o.country].filter(Boolean).join(", ") },
    ];
    const selected = columns.filter((column) => exportFields.includes(column.key));
    if (!selected.length || !filtered.length) return;
    setExportBusy(true);
    setExportDone(false);
    setExportError("");
    setExportFileName("");
    setExportPrintHtml("");
    if (exportFileUrl) URL.revokeObjectURL(exportFileUrl);
    setExportFileUrl("");
    try {
      // Yield once so the dedicated export-progress screen is painted before file preparation.
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const matrix = [selected.map((column) => column.label), ...filtered.map((item) => selected.map((column) => column.value(item)))];
      if (exportFormat === "xlsx") {
        const worksheet = XLSX.utils.aoa_to_sheet(matrix);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Verification");
        const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const fileName = "stitchgrid-verification-applications.xlsx";
        setExportFileUrl(URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })));
        setExportFileName(fileName);
      } else if (exportFormat === "csv") {
        const csv = matrix.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
        const fileName = "stitchgrid-verification-applications.csv";
        setExportFileUrl(URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })));
        setExportFileName(fileName);
      } else {
        const escapeHtml = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
        const printHtml = `<!doctype html><html><head><meta charset="utf-8"><title>STITCHGRID Verification Applications</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#182332}h1{font-size:20px}p{color:#64748b;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #e2e6ed;padding:9px;text-align:left;font-size:11px}th{background:#f6f2ff}@media print{body{padding:0}}</style></head><body><h1>STITCHGRID — Verification Applications</h1><p>Exported on ${escapeHtml(new Date().toLocaleString())} · ${filtered.length} applications</p><table><thead><tr>${selected.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${filtered.map((item) => `<tr>${selected.map((column) => `<td>${escapeHtml(column.value(item))}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
        setExportPrintHtml(printHtml);
        setExportFileName("stitchgrid-verification-applications.pdf");
      }
      setExportDone(true);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Could not export verification applications.");
    } finally {
      setExportBusy(false);
    }
  };

  const downloadMobileExport = () => {
    if (exportFormat === "pdf" && exportPrintHtml) {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setExportError("Please allow pop-ups to save the PDF.");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(exportPrintHtml);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => printWindow.print(), 250);
      return;
    }
    if (!exportFileUrl || !exportFileName) return;
    const anchor = document.createElement("a");
    anchor.href = exportFileUrl;
    anchor.download = exportFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const closeMobileExport = () => {
    if (exportBusy) return;
    setMobileExportOpen(false);
    if (exportFileUrl) URL.revokeObjectURL(exportFileUrl);
    setExportFileUrl("");
    setExportPrintHtml("");
  };

  const reset = () => {
    setQ("");
    setTab("ALL");
    setBusinessType("ALL");
    setSubmitted("ALL");
    setStatusFilter("ALL");
    setSubmittedFrom("");
    setSubmittedTo("");
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
      <div className="hidden md:block">
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
                            onClick={() => router.push(`/admin/verification/${o.id}`)}
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
      </div>

      {/* Mobile verification dashboard — desktop markup above intentionally remains unchanged. */}
      <div className="space-y-4 md:hidden">
        <div className="overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4C0CCB] via-[#6515E8] to-[#873BFA] p-5 text-white shadow-lg shadow-violet-200/60">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[21px] font-extrabold tracking-tight">Business Verification</h1>
              <p className="mt-1.5 max-w-[235px] text-xs leading-5 text-white/85">Review and verify buyer &amp; supplier businesses.</p>
            </div>
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-white"><ShieldCheck size={34}/></span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Total Applications", value: counts.ALL, icon: Users, tone: "bg-violet-50 text-[#5B13EC]" },
            { label: "Pending", value: counts.PENDING, icon: Clock3, tone: "bg-amber-50 text-amber-600" },
            { label: "Approved", value: counts.APPROVED, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
            { label: "Rejected", value: counts.REJECTED, icon: XCircle, tone: "bg-rose-50 text-rose-600" },
          ].map((stat) => (
            <div key={stat.label} className="flex min-h-[94px] items-center gap-3 rounded-2xl border border-[#E2E6ED] bg-white p-3 shadow-[0_2px_8px_rgba(24,35,50,0.03)]">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${stat.tone}`}><stat.icon size={21}/></span>
              <div className="min-w-0"><p className="text-[10px] font-semibold leading-4 text-[#64748B]">{stat.label}</p><p className="mt-0.5 text-2xl font-extrabold leading-none text-[#182332]">{loading ? "—" : stat.value}</p></div>
            </div>
          ))}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search business, GST or email..." className="h-11 w-full rounded-xl border border-[#D9DDEA] bg-white pl-9 pr-2 text-xs text-[#182332] outline-none placeholder:text-slate-400 focus:border-[#5B13EC]"/>
            </div>
            <button onClick={() => setMobileFiltersOpen(true)} className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#5B13EC] bg-white px-3 text-xs font-bold text-[#5B13EC]"><Filter size={15}/> Filters</button>
            <button onClick={() => { setExportDone(false); setExportError(""); setMobileExportOpen(true); }} disabled={!filtered.length} className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#5B13EC] px-3 text-xs font-bold text-white shadow-sm disabled:opacity-50"><Download size={15}/> Export</button>
          </div>
          {(businessType !== "ALL" || submitted !== "ALL" || statusFilter !== "ALL") && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {businessType !== "ALL" && <button onClick={() => setBusinessType("ALL")} className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-[#5B13EC]">{businessType} ×</button>}
              {submitted !== "ALL" && <button onClick={() => { setSubmitted("ALL"); setSubmittedFrom(""); setSubmittedTo(""); }} className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-[#5B13EC]">Date range ×</button>}
              {statusFilter !== "ALL" && <button onClick={() => setStatusFilter("ALL")} className="rounded-full bg-violet-50 px-2.5 py-1 font-semibold text-[#5B13EC]">{labelStatus(statusFilter)} ×</button>}
              <button onClick={reset} className="ml-auto font-bold text-[#5B13EC]">Clear all</button>
            </div>
          )}
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">{error}<button onClick={load} className="ml-2 font-bold underline">Try again</button></div>
        ) : loading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-[#E2E6ED] bg-white text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin text-[#5B13EC]"/>Loading applications…</div>
        ) : pageItems.length === 0 ? (
          <div className="rounded-2xl border border-[#E2E6ED] bg-white px-5 py-12 text-center"><Building2 size={30} className="mx-auto text-slate-300"/><p className="mt-3 text-sm font-bold text-[#182332]">No applications found</p><p className="mt-1 text-xs text-slate-500">Try changing your search or filters.</p><button onClick={reset} className="mt-4 text-xs font-bold text-[#5B13EC]">Clear filters</button></div>
        ) : (
          <div className="space-y-3">
            {pageItems.map((org) => {
              const roleNames = [...new Set(org.members?.filter((m: any) => m.role === "BUYER" || m.role === "SUPPLIER").map((m: any) => m.role) || [])];
              const typeName = org.businessType || roleNames.join(" / ") || "Business";
              const approved = org.verificationStatus === "APPROVED";
              const rejected = org.verificationStatus === "REJECTED";
              return (
                <article key={org.id} className="overflow-hidden rounded-2xl border border-[#E2E6ED] bg-white shadow-[0_2px_10px_rgba(24,35,50,0.035)]">
                  <button onClick={() => router.push(`/admin/verification/${org.id}`)} className="w-full p-4 text-left">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F0E7FF] text-sm font-extrabold text-[#5B13EC]">{(org.name || "B").slice(0,1).toUpperCase()}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="break-words text-sm font-extrabold text-[#182332]">{org.name}</p>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${approved ? "bg-emerald-50 text-emerald-700" : rejected ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{labelStatus(org.verificationStatus)}</span>
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[#64748B]"><MapPin size={12}/>{[org.city, org.country].filter(Boolean).join(", ") || "Location not provided"}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="rounded-full bg-[#F0E7FF] px-2.5 py-1 text-[10px] font-bold text-[#5B13EC]">{typeName}</span>{roleNames.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{role}</span>)}</div>
                      </div>
                      <span className="pt-1 text-slate-400"><Eye size={17}/></span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#EEF0F4] pt-3">
                      <div><p className="text-[10px] font-semibold text-slate-400">Submitted</p><p className="mt-1 text-xs font-bold text-[#334155]">{new Date(org.createdAt).toLocaleDateString()}</p></div>
                      <div><p className="text-[10px] font-semibold text-slate-400">GST / Tax ID</p><p className="mt-1 break-all font-mono text-xs font-bold text-[#334155]">{org.taxId || "Not provided"}</p></div>
                    </div>
                  </button>
                  <div className="border-t border-[#EEF0F4] bg-[#FCFCFE] px-4 py-2.5"><button onClick={() => router.push(`/admin/verification/${org.id}`)} className="inline-flex w-full items-center justify-center gap-2 text-xs font-bold text-[#5B13EC]">View Application Details <ChevronRight size={15}/></button></div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-[#E2E6ED] bg-white px-3 py-3 text-xs text-slate-500">
          <span>Showing {filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1.5">
            <button disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={15}/></button>
            <span className="grid h-8 min-w-8 place-items-center rounded-lg bg-[#5B13EC] px-2 font-bold text-white">{currentPage}</span>
            <button disabled={currentPage >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={15}/></button>
          </div>
        </div>
      </div>

      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[150] flex items-stretch justify-center bg-white md:hidden" onClick={() => setMobileFiltersOpen(false)}>
          <section role="dialog" aria-modal="true" aria-label="Verification filters" className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F8F8FC] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2"><Filter size={19} className="text-[#5B13EC]"/><h2 className="text-lg font-extrabold text-[#182332]">Filters</h2></div><button onClick={() => setMobileFiltersOpen(false)} aria-label="Close filters" className="grid h-9 w-9 place-items-center rounded-full bg-white"><X size={19}/></button></div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3">
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4"><p className="mb-3 text-xs font-extrabold text-[#182332]">Business Type</p><select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className="h-11 w-full rounded-xl border border-[#E2E6ED] bg-white px-3 text-sm outline-none focus:border-[#5B13EC]"><option value="ALL">All Business Types</option>{typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4"><p className="mb-3 text-xs font-extrabold text-[#182332]">Application Status</p><div className="grid grid-cols-2 gap-2">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`min-h-10 rounded-xl border px-2 text-xs font-bold ${tab === item.key ? "border-[#5B13EC] bg-[#5B13EC] text-white" : "border-[#E2E6ED] text-[#48586C]"}`}>{item.label} ({item.count})</button>)}</div></div>
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4"><p className="mb-3 text-xs font-extrabold text-[#182332]">Submitted Date</p><div className="grid grid-cols-2 gap-2">{[{v:"ALL",l:"All Time"},{v:"7D",l:"Last 7 Days"},{v:"30D",l:"Last 30 Days"},{v:"YEAR",l:"This Year"},{v:"CUSTOM",l:"Custom Range"}].map((option) => <button key={option.v} onClick={() => setSubmitted(option.v)} className={`min-h-10 rounded-xl border px-2 text-xs font-bold ${submitted === option.v ? "border-[#5B13EC] bg-[#F1EAFE] text-[#5B13EC]" : "border-[#E2E6ED] text-[#48586C]"}`}>{option.l}</button>)}</div>{submitted === "CUSTOM" && <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] font-semibold text-slate-500">From<input type="date" value={submittedFrom} onChange={(e) => setSubmittedFrom(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#E2E6ED] px-2 text-xs"/></label><label className="text-[11px] font-semibold text-slate-500">To<input type="date" value={submittedTo} min={submittedFrom || undefined} onChange={(e) => setSubmittedTo(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-[#E2E6ED] px-2 text-xs"/></label></div>}</div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#E2E6ED] pt-4"><button onClick={reset} className="h-12 rounded-xl border border-[#E2E6ED] bg-white text-sm font-bold text-[#334155]"><RefreshCw size={15} className="mr-2 inline"/>Reset</button><button onClick={() => { setPage(1); setMobileFiltersOpen(false); }} className="h-12 rounded-xl bg-[#5B13EC] text-sm font-bold text-white"><Check size={16} className="mr-2 inline"/>Apply Filters</button></div>
          </section>
        </div>
      )}

      {mobileExportOpen && (
        <div className="fixed inset-0 z-[160] bg-white md:hidden">
          {exportBusy ? (
            <section role="status" aria-live="polite" className="flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
              <span className="grid h-24 w-24 place-items-center rounded-full bg-[#F0E7FF] text-[#5B13EC]"><Download size={42}/></span>
              <h2 className="mt-6 text-xl font-extrabold text-[#182332]">Exporting Applications</h2>
              <p className="mt-2 text-sm text-[#48586C]">Preparing your file…</p>
              <div className="mt-8 h-2 w-full max-w-[280px] overflow-hidden rounded-full bg-[#EEE8FA]"><div className="h-full w-1/3 animate-pulse rounded-full bg-[#5B13EC]"/></div>
              <p className="mt-3 text-xs text-slate-400">{filtered.length} applications · {exportFormat.toUpperCase()}</p>
            </section>
          ) : exportDone ? (
            <section className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-10 text-center">
              <span className="grid h-24 w-24 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={48}/></span>
              <h2 className="mt-6 text-2xl font-extrabold text-[#182332]">Export Complete!</h2>
              <p className="mt-2 text-sm text-[#48586C]">Your file is ready.</p>
              <div className="mt-7 flex w-full max-w-sm items-center gap-3 rounded-2xl border border-[#E2E6ED] bg-white p-4 text-left">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#F0E7FF] text-[#5B13EC]">{exportFormat === "xlsx" ? <FileSpreadsheet size={25}/> : <FileText size={25}/>}</span>
                <div className="min-w-0 flex-1"><p className="break-all text-xs font-bold text-[#182332]">{exportFileName}</p><p className="mt-1 text-[11px] text-slate-500">{filtered.length} applications · {exportFormat.toUpperCase()}</p></div>
              </div>
              {exportError && <p className="mt-3 w-full max-w-sm rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{exportError}</p>}
              <div className="mt-7 w-full max-w-sm space-y-2">
                <button onClick={downloadMobileExport} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white"><Download size={17}/>{exportFormat === "pdf" ? "Open PDF / Print" : "Download File"}</button>
                <button onClick={closeMobileExport} className="h-12 w-full rounded-xl border border-[#E2E6ED] text-sm font-bold text-[#334155]">Close</button>
              </div>
            </section>
          ) : (
            <section className="flex h-[100dvh] flex-col bg-white">
              <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#EEF0F4] px-5">
                <div className="flex items-center gap-2"><Download size={20} className="text-[#5B13EC]"/><h2 className="text-lg font-extrabold text-[#182332]">Export Applications</h2></div>
                <button onClick={closeMobileExport} aria-label="Close export" className="grid h-10 w-10 place-items-center rounded-full text-[#334155]"><X size={21}/></button>
              </header>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#FAF9FD] px-5 py-5">
                <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4"><p className="mb-3 text-xs font-extrabold text-[#182332]">Export Format</p><div className="space-y-2">{[{v:"xlsx",l:"Excel (.xlsx)",icon:FileSpreadsheet},{v:"csv",l:"CSV (.csv)",icon:FileText},{v:"pdf",l:"PDF (.pdf)",icon:FileText}].map((format) => <button key={format.v} onClick={() => setExportFormat(format.v as "xlsx"|"csv"|"pdf")} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm font-semibold ${exportFormat === format.v ? "border-[#C8B4FF] bg-[#F6F1FF] text-[#5B13EC]" : "border-[#E2E6ED] text-[#334155]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${exportFormat === format.v ? "border-[#5B13EC]" : "border-slate-300"}`}>{exportFormat === format.v && <span className="h-2.5 w-2.5 rounded-full bg-[#5B13EC]"/>}</span><format.icon size={19}/>{format.l}</button>)}</div></div>
                <div className="rounded-2xl border border-[#E2E6ED] bg-white p-4"><p className="mb-3 text-xs font-extrabold text-[#182332]">Data to Export</p><div className="space-y-3">{[{v:"name",l:"Business Name"},{v:"businessType",l:"Business Type (Buyer/Supplier)"},{v:"taxId",l:"GST / Registration Number"},{v:"status",l:"Verification Status"},{v:"submitted",l:"Submitted Date"},{v:"location",l:"Location"}].map((field) => <label key={field.v} className="flex min-h-7 items-center gap-3 text-xs font-semibold text-[#334155]"><input type="checkbox" checked={exportFields.includes(field.v)} onChange={(e) => setExportFields((old) => e.target.checked ? [...old, field.v] : old.filter((value) => value !== field.v))} className="h-4 w-4 accent-[#5B13EC]"/>{field.l}</label>)}</div><p className="mt-4 border-t border-[#EEF0F4] pt-3 text-[11px] text-slate-400">Export includes all {filtered.length} applications matching the current filters.</p></div>
                {exportError && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{exportError}</p>}
              </div>
              <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#EEF0F4] bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]"><button onClick={closeMobileExport} className="h-12 rounded-xl border border-[#E2E6ED] text-sm font-bold text-[#334155]">Cancel</button><button disabled={!exportFields.length || !filtered.length} onClick={runMobileExport} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white disabled:opacity-50"><Download size={16}/>Export</button></footer>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
