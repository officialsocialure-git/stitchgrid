"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, Download, ChevronLeft, ChevronRight, MoreHorizontal,
  Users, UserRound, Store, X, ShieldCheck, LoaderCircle, CheckCircle2,
  Clock3, Ban, ArrowUp, Filter, Building2, Eye, Pencil, UserCog, Trash2,
  RotateCcw, Check, AlertTriangle
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import * as XLSX from "xlsx";

type UserRow = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  memberships?: any[];
  auditLogs?: { createdAt: string }[];
};

type ExportField = "name" | "email" | "phone" | "organization" | "role" | "active" | "verification" | "joined" | "lastActive";


const PAGE_SIZE = 10;

const roleOf = (u: UserRow) =>
  u.memberships?.find((m) => m.isActive)?.role || u.memberships?.[0]?.role || "—";

const orgOf = (u: UserRow) =>
  u.memberships?.map((m) => m.organization?.name).filter(Boolean).join(", ") || "—";

const verificationOf = (u: UserRow) => {
  const values = (u.memberships || []).map((m) => m.organization?.verificationStatus).filter(Boolean);
  if (!values.length) return "N/A";
  if (values.includes("REJECTED")) return "Rejected";
  if (values.includes("PENDING")) return "Pending";
  return "Verified";
};

const lastLoginAt = (events?: { action?: string; createdAt: string }[]) =>
  events?.find((event) => event.action === "AUTH_LOGIN" || event.action === "AUTH_LOGIN_GOOGLE")?.createdAt;

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return "Today";
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 3600) return "Just now";
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  const diffDays = Math.floor(diffSec / 86400);
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US");
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [inactiveCount, setInactiveCount] = useState<number | null>(null);
  const [adminCount, setAdminCount] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("ALL");
  const [active, setActive] = useState("ALL");
  const [verification, setVerification] = useState("ALL");
  const [joined, setJoined] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xls" | "csv" | "pdf">("xls");
  const [exporting, setExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [lastActive, setLastActive] = useState("ALL");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [exportFields, setExportFields] = useState<ExportField[]>(["name", "email", "phone", "organization", "role", "active", "verification", "joined", "lastActive"]);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [roleValue, setRoleValue] = useState<"BUYER" | "SUPPLIER" | "ADMIN">("BUYER");
  const [confirmTarget, setConfirmTarget] = useState<{ user: UserRow; action: "status" | "delete"; nextActive?: boolean } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [detailActivity, setDetailActivity] = useState<any[]>([]);
  const [detailTab, setDetailTab] = useState<"overview" | "activity">("overview");

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), []);
  useRealtimeSync({
    topics: ["admin:stats_updated", "admin:user_updated", "admin:verification_updated", "supplier:updated"],
    onSync: refresh,
    pollIntervalMs: 30000,
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
          q: query,
          role,
          active,
          verification,
          lastActive,
        });
        if (joinedFrom) params.set("joinedFrom", new Date(joinedFrom).toISOString());
        else if (joined === "7D") params.set("joinedFrom", new Date(Date.now() - 7 * 86400000).toISOString());
        else if (joined === "30D") params.set("joinedFrom", new Date(Date.now() - 30 * 86400000).toISOString());
        else if (joined === "YEAR") params.set("joinedFrom", new Date(new Date().getFullYear(), 0, 1).toISOString());
        if (joinedTo) {
          const end = new Date(joinedTo);
          end.setHours(23, 59, 59, 999);
          params.set("joinedTo", end.toISOString());
        }
        const [result, stats, inactiveResult, adminResult] = await Promise.all([
          adminService.users(params),
          adminService.overview(),
          adminService.users(new URLSearchParams({ page: "1", limit: "1", active: "INACTIVE", role: "ALL" })),
          adminService.users(new URLSearchParams({ page: "1", limit: "1", active: "ALL", role: "ADMIN" })),
        ]);
        if (!alive) return;
        setRows(result.items || []);
        setTotal(result.total || 0);
        setPages(Math.max(1, result.pages || 1));
        setOverview(stats);
        setInactiveCount(inactiveResult.total ?? null);
        setAdminCount(adminResult.total ?? null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load users.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [page, role, active, verification, joined, joinedFrom, joinedTo, lastActive, query, refreshKey]);

  const visibleRows = useMemo(() => rows, [rows]);
  const activeFilterCount = [
    role !== "ALL",
    active !== "ALL",
    verification !== "ALL",
    joined !== "ALL" || Boolean(joinedFrom || joinedTo),
    lastActive !== "ALL"
  ].filter(Boolean).length;

  const exportUsers = () => { setExportComplete(false); setActionError(""); setExportOpen(true); };

  const runExport = async () => {
    setExporting(true);
    let printWindow: Window | null = null;
    if (exportFormat === "pdf") printWindow = window.open("", "_blank");
    try {
      const all: UserRow[] = [];
      const baseParams = new URLSearchParams({ page: "1", limit: "100", q: query, role, active, verification, lastActive });
      const now = new Date();
      if (joinedFrom) baseParams.set("joinedFrom", new Date(joinedFrom).toISOString());
      else if (joined === "7D") baseParams.set("joinedFrom", new Date(now.getTime() - 7 * 86400000).toISOString());
      else if (joined === "30D") baseParams.set("joinedFrom", new Date(now.getTime() - 30 * 86400000).toISOString());
      else if (joined === "YEAR") baseParams.set("joinedFrom", new Date(now.getFullYear(), 0, 1).toISOString());
      if (joinedTo) {
        const end = new Date(joinedTo); end.setHours(23, 59, 59, 999);
        baseParams.set("joinedTo", end.toISOString());
      }
      const first = await adminService.users(baseParams);
      all.push(...(first.items || []));
      for (let p = 2; p <= (first.pages || 1); p++) {
        const params = new URLSearchParams(baseParams);
        params.set("page", String(p));
        const batch = await adminService.users(params);
        all.push(...(batch.items || []));
      }

      const fieldMap: Record<ExportField, { label: string; value: (u: UserRow) => string }> = {
        name: { label: "Name", value: (u) => u.fullName },
        email: { label: "Email", value: (u) => u.email || "" },
        phone: { label: "Phone", value: (u) => u.phone || "" },
        organization: { label: "Organization", value: orgOf },
        role: { label: "Role", value: roleOf },
        active: { label: "Account Status", value: (u) => u.isActive ? "Active" : "Inactive" },
        verification: { label: "Verification", value: verificationOf },
        joined: { label: "Joined", value: (u) => new Date(u.createdAt).toLocaleDateString() },
        lastActive: { label: "Last Login", value: (u) => u.auditLogs?.[0]?.createdAt ? new Date(u.auditLogs[0].createdAt).toLocaleString() : "No login recorded" }
      };
      const selectedFields = exportFields.length ? exportFields : ["name", "email", "role", "active"] as ExportField[];
      const headers = selectedFields.map((field) => fieldMap[field].label);
      const values = all.map((u) => selectedFields.map((field) => fieldMap[field].value(u)));

      if (exportFormat === "csv") {
        const csv = [headers, ...values].map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["\\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
        const a = document.createElement("a"); a.href = url; a.download = "stitchgrid-users.csv"; a.click();
        URL.revokeObjectURL(url);
      } else if (exportFormat === "xls") {
        const sheet = XLSX.utils.aoa_to_sheet([headers, ...values]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Users");
        XLSX.writeFile(workbook, "stitchgrid-users.xlsx");
      } else if (printWindow) {
        const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
        const table = `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${values.map((row) => `<tr>${row.map((v) => `<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        printWindow.document.write(`<!doctype html><html><head><title>STITCHGRID Users</title><style>body{font:12px Arial;padding:24px;color:#182332}h1{font-size:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #dfe3eb;padding:8px;text-align:left}th{background:#f0eafe}</style></head><body><h1>STITCHGRID User Export</h1><p>${all.length} users</p>${table}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      } else {
        throw new Error("Your browser blocked the PDF print window. Allow pop-ups and try again.");
      }
      setExportComplete(true);
    } catch (e) {
      if (printWindow && !printWindow.closed) printWindow.close();
      setActionError(e instanceof Error ? e.message : "Unable to export users.");
    } finally {
      setExporting(false);
    }
  };

  const toggleUser = async (u: UserRow) => {
    setConfirmTarget({ user: u, action: "status", nextActive: !u.isActive });
    setMenuFor(null);
    setActionError("");
  };

  const openUserDetails = async (u: UserRow) => {
    setSelected(u);
    setDetailTab("overview");
    setDetailActivity([]);
    setActionError("");
    setMenuFor(null);
    try {
      const details = await adminService.user(u.id);
      setSelected(details);
      setDetailActivity(details.activity || []);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Unable to load user details.");
    }
  };

  const saveUserEdit = async () => {
    if (!editTarget) return;
    setActionBusy(true); setActionError("");
    try {
      await adminService.updateUser(editTarget.id, { fullName: editName.trim(), email: editEmail.trim() || null });
      setEditTarget(null); refresh();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Unable to update user."); }
    finally { setActionBusy(false); }
  };

  const saveUserRole = async () => {
    if (!roleTarget) return;
    setActionBusy(true); setActionError("");
    try {
      await adminService.updateUserRole(roleTarget.id, roleValue);
      setRoleTarget(null); refresh();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Unable to change role."); }
    finally { setActionBusy(false); }
  };

  const executeUserAction = async () => {
    if (!confirmTarget) return;
    const { user, action } = confirmTarget;
    setActionBusy(true); setActionError("");
    try {
      if (action === "status") await adminService.updateUserStatus(user.id, Boolean(confirmTarget.nextActive));
      else await adminService.deleteUser(user.id);
      setConfirmTarget(null); refresh();
    } catch (e) { setActionError(e instanceof Error ? e.message : "Unable to complete this action."); }
    finally { setActionBusy(false); }
  };

  const roleTabs = [
    { value: "ALL", label: "All Users", count: overview?.users ?? total, icon: Users },
    { value: "BUYER", label: "Buyers", count: overview?.buyers ?? "—", icon: UserRound },
    { value: "SUPPLIER", label: "Suppliers", count: overview?.suppliers ?? "—", icon: Store },
    { value: "ADMIN", label: "Admins", count: adminCount ?? "—", icon: ShieldCheck },
  ];

  return (
    <section className="space-y-5 sm:space-y-6">
      {/* Mobile reference-style hero */}
      <div className="sm:hidden overflow-hidden rounded-2xl bg-gradient-to-r from-[#4B10C8] via-[#6818E8] to-[#8B42F4] px-5 py-5 text-white shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0"><h1 className="text-[25px] font-bold leading-tight tracking-tight text-white">User Management</h1><p className="mt-2 max-w-[260px] text-[13px] leading-5 text-white/90">Manage platform users, their roles, organizations and account access.</p></div>
          <Users size={54} strokeWidth={1.4} className="shrink-0 text-white/70" />
        </div>
      </div>

      {/* Page Title & Subtitle */}
      <div className="hidden sm:block">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage platform users, their roles, organizations and account access.
        </p>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Users */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F3EFFC] text-[#5B13EC]">
            <Users size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Users</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : overview?.users ?? total}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +12%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">All registered accounts</p>
          </div>
        </div>

        {/* Card 2: Buyers */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#2563EB]">
            <UserRound size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Buyers</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : overview?.buyers ?? "—"}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +8%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Registered buyers</p>
          </div>
        </div>

        {/* Card 3: Suppliers */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F6EEFD] text-[#9333EA]">
            <Store size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Suppliers</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : overview?.suppliers ?? "—"}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +16%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Registered suppliers</p>
          </div>
        </div>

        {/* Card 4: Inactive Users */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
            <Ban size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactive Users</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : inactiveCount ?? 0}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                <ArrowUp size={11} /> +2
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Deactivated accounts</p>
          </div>
        </div>
      </div>

      {/* Mobile compact statistics */}
      <div className="grid grid-cols-4 gap-2 sm:hidden">
        {[
          { label: "Total", value: overview?.users ?? total, icon: Users, tone: "text-[#5B13EC] bg-[#F0EAFE]" },
          { label: "Buyers", value: overview?.buyers ?? "—", icon: UserRound, tone: "text-blue-600 bg-blue-50" },
          { label: "Suppliers", value: overview?.suppliers ?? "—", icon: Store, tone: "text-violet-600 bg-violet-50" },
          { label: "Admins", value: adminCount ?? "—", icon: ShieldCheck, tone: "text-[#48586C] bg-slate-100" },
        ].map((item) => <div key={item.label} className="min-w-0 rounded-xl border border-[#E2E6ED] bg-white p-2.5 shadow-[0_2px_8px_rgba(24,35,50,0.03)]"><div className={`mb-2 grid h-8 w-8 place-items-center rounded-lg ${item.tone}`}><item.icon size={17}/></div><p className="truncate text-[10px] font-semibold text-[#48586C]">{item.label}</p><p className="mt-0.5 text-lg font-bold leading-none text-[#182332]">{loading ? "—" : item.value}</p></div>)}
      </div>

      {/* Main Container Card */}
      <div className="overflow-visible rounded-2xl border border-slate-200/90 bg-white shadow-xs sm:overflow-hidden">
        {/* Card Top: Title & Export Action */}
        <div className="hidden flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5 lg:flex">
          <div>
            <h2 className="text-lg font-bold text-slate-900">User Management</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              View, search, filter and manage all platform users.
            </p>
          </div>
          <button
            onClick={exportUsers}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#5B13EC] px-4 text-xs font-bold text-white shadow-xs transition hover:bg-[#4C0EC9]"
          >
            <Download size={15} /> Export
          </button>
        </div>

        {/* Filter Tabs Row */}
        <div className="flex flex-nowrap gap-2 overflow-x-auto px-3 pt-3 pb-3 sm:flex-wrap sm:px-6 sm:pt-4 no-scrollbar">
          {roleTabs.map((tab) => {
            const activeTab = role === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setRole(tab.value);
                  setPage(1);
                }}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-[11px] font-bold transition sm:h-9 sm:px-4 sm:text-xs ${
                  activeTab
                    ? "bg-[#5B13EC] text-white shadow-xs"
                    : "border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <tab.icon size={15} />
                <span>{tab.label}</span>
                <span className={activeTab ? "text-white/80" : "text-slate-400"}>
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile search, filters and export toolbar */}
        <div className="space-y-2 border-y border-slate-100 bg-[#FAF9FD] p-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search name, email or company..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none focus:border-[#5B13EC]" />
            </div>
            <button onClick={() => setFiltersOpen(true)} className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-[#5B13EC] bg-white px-3 text-xs font-bold text-[#5B13EC]"><Filter size={15}/> Filters{activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#5B13EC] px-1 text-[10px] text-white">{activeFilterCount}</span>}</button>
            <button onClick={exportUsers} className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-[#5B13EC] px-3 text-xs font-bold text-white"><Download size={15}/> Export</button>
          </div>
          {activeFilterCount > 0 && <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-[#48586C]">
            {role !== "ALL" && <button onClick={() => setRole("ALL")} className="rounded-full bg-[#F0EAFE] px-2.5 py-1 font-semibold text-[#5B13EC]">{role} ×</button>}
            {active !== "ALL" && <button onClick={() => setActive("ALL")} className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700"> {active === "ACTIVE" ? "Active" : "Inactive"} ×</button>}
            {verification !== "ALL" && <button onClick={() => setVerification("ALL")} className="rounded-full bg-[#F0EAFE] px-2.5 py-1 font-semibold text-[#5B13EC]">{verification === "APPROVED" ? "Verified" : verification} ×</button>}
            {joined !== "ALL" && <button onClick={() => setJoined("ALL")} className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Joined {joined} ×</button>}
            {lastActive !== "ALL" && <button onClick={() => setLastActive("ALL")} className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">Active {lastActive} ×</button>}
            <button onClick={() => { setRole("ALL"); setActive("ALL"); setVerification("ALL"); setJoined("ALL"); setJoinedFrom(""); setJoinedTo(""); setLastActive("ALL"); setPage(1); }} className="ml-auto font-bold text-[#5B13EC]">Clear all</button>
          </div>}
        </div>

        {/* Desktop filter controls */}
        <div className="hidden gap-2.5 border-y border-slate-100 bg-[#FAF9FD] p-4 lg:grid lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto]">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email or company..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none transition focus:border-[#5B13EC]"
            />
          </div>

          <select
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Account Status: All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Verification: All</option>
            <option value="APPROVED">Verified</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
            <option value="N/A">Not applicable</option>
          </select>

          <select
            value={joined}
            onChange={(e) => setJoined(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Joined: All Time</option>
            <option value="7D">Last 7 days</option>
            <option value="30D">Last 30 days</option>
            <option value="YEAR">This year</option>
          </select>

          <button
            onClick={() => {
              setQuery("");
              setRole("ALL");
              setActive("ALL");
              setVerification("ALL");
              setJoined("ALL");
              setJoinedFrom("");
              setJoinedTo("");
              setLastActive("ALL");
              setPage(1);
              refresh();
            }}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            <RefreshCw size={14} /> Reset
          </button>
        </div>

        {/* Data Table */}
        {error ? (
          <div className="p-10 text-center text-sm font-medium text-rose-700">
            {error}
            <button onClick={refresh} className="ml-3 underline">
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="animate-spin text-[#5B13EC]" size={20} />
            Loading users...
          </div>
        ) : visibleRows.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">No users match the selected filters.</div>
        ) : (
          <>
          {/* Mobile user cards — replaces the wide data table on small screens */}
          <div className="space-y-3 p-3 lg:hidden">
            {visibleRows.map((u) => {
              const roleName = roleOf(u);
              const verifyStatus = verificationOf(u);
              return (
                <article key={u.id} className="relative rounded-2xl border border-[#E3DDF4] bg-white p-3.5 shadow-[0_3px_12px_rgba(61,34,120,0.045)]">
                  <div className="flex items-start gap-3 pr-8">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#F0E2FF] text-lg font-bold text-[#5B13EC]">{(u.fullName || "U").slice(0,1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold leading-5 text-[#182332]">{u.fullName}</p>
                      <p className="mt-0.5 truncate text-xs text-[#64748B]">{u.email || u.phone || "No contact details"}</p>
                      <div className="mt-2 flex min-w-0 items-start gap-1.5 text-xs text-[#334155]">
                        <Building2 size={14} className="mt-0.5 shrink-0 text-[#475569]"/>
                        <span className="line-clamp-2 min-w-0">{orgOf(u)}</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#F0E2FF] px-3 py-1 text-[10px] font-bold text-[#6416D9]">{roleName}</span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{u.isActive ? "● Active" : "● Inactive"}</span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${verifyStatus === "Verified" ? "bg-emerald-50 text-emerald-700" : verifyStatus === "Pending" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{verifyStatus === "Verified" ? "✓ Verified" : verifyStatus === "Pending" ? "◷ Pending" : verifyStatus}</span>
                      </div>
                    </div>
                  </div>
                  <button disabled={actionBusy} onClick={() => setMenuFor(menuFor === u.id ? null : u.id)} aria-label={`Actions for ${u.fullName}`} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-[#334155] hover:bg-[#F0EAFE] hover:text-[#5B13EC]"><MoreHorizontal size={21}/></button>
                  {menuFor === u.id && <><button aria-label="Close user actions" className="fixed inset-0 z-30 cursor-default" onClick={() => setMenuFor(null)}/><div className="absolute right-3 top-12 z-50 w-52 rounded-xl border border-[#E2E6ED] bg-white p-1.5 shadow-xl">
                    <button onClick={() => openUserDetails(u)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#182332] hover:bg-[#F6F7FA]"><Eye size={15}/> View Details</button>
                    <button onClick={() => { setEditTarget(u); setEditName(u.fullName); setEditEmail(u.email || ""); setMenuFor(null); setActionError(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#182332] hover:bg-[#F6F7FA]"><Pencil size={15}/> Edit User</button>
                    <button onClick={() => { setRoleTarget(u); setRoleValue((roleOf(u) === "ADMIN" || roleOf(u) === "SUPPLIER" ? roleOf(u) : "BUYER") as "BUYER" | "SUPPLIER" | "ADMIN"); setMenuFor(null); setActionError(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-[#182332] hover:bg-[#F6F7FA]"><UserCog size={15}/> Change Role <ChevronRight size={14} className="ml-auto"/></button>
                    <button onClick={() => { toggleUser(u); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-rose-50 ${u.isActive ? "text-rose-600" : "text-emerald-700"}`}><Ban size={15}/>{u.isActive ? "Deactivate Account" : "Activate Account"}</button>
                    <button onClick={() => { setConfirmTarget({ user: u, action: "delete" }); setMenuFor(null); setActionError(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={15}/> Delete User</button>
                  </div></>}
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[10px] text-[#64748B]">
                    <span>Joined {new Date(u.createdAt).toLocaleDateString("en-US")}</span>
                    <span>Last login {u.auditLogs?.[0]?.createdAt ? formatRelativeTime(u.auditLogs[0].createdAt) : "Not recorded"}</span>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Desktop table remains unchanged */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="bg-[#FAF9FD] text-[11px] font-bold text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Organization</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5">Verification</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5">Last Login</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {visibleRows.map((u) => {
                  const roleName = roleOf(u);
                  const isUserActive = u.isActive;
                  const verifyStatus = verificationOf(u);

                  return (
                    <tr key={u.id} className="transition hover:bg-[#FAF9FE]">
                      {/* User Column */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-xs font-bold text-[#5B13EC]">
                            {(u.fullName || "U").slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{u.fullName}</p>
                            <p className="truncate text-[11px] text-slate-400">
                              {u.email || u.phone || "No contact details"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Organization */}
                      <td className="px-5 py-3.5 font-medium text-slate-700">{orgOf(u)}</td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-1 text-[11px] font-bold text-[#5B13EC]">
                          {roleName}
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="px-5 py-3.5">
                        {isUserActive ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200/60">
                            <span>⇡</span> Inactive
                          </span>
                        )}
                      </td>

                      {/* Verification */}
                      <td className="px-5 py-3.5">
                        {verifyStatus === "Verified" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} /> Verified
                          </span>
                        ) : verifyStatus === "Pending" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                            <Clock3 size={11} /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {verifyStatus}
                          </span>
                        )}
                      </td>

                      {/* Joined */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString("en-US")}
                      </td>

                      {/* Last Active */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-500 text-[11px]">
                        {u.auditLogs?.[0]?.createdAt ? formatRelativeTime(u.auditLogs[0].createdAt) : "Not recorded"}
                      </td>

                      {/* Actions */}
                      <td className="relative px-5 py-3.5 text-right">
                        <button
                          disabled={actionBusy}
                          onClick={() => setMenuFor(menuFor === u.id ? null : u.id)}
                          aria-label={`Actions for ${u.fullName}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-[#EBE4FF] hover:text-[#5B13EC] transition ml-auto"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menuFor === u.id && (
                          <div className="absolute right-6 top-10 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                            <button onClick={() => openUserDetails(u)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><Eye size={14}/> View Details</button>
                            <button onClick={() => { setEditTarget(u); setEditName(u.fullName); setEditEmail(u.email || ""); setMenuFor(null); setActionError(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><Pencil size={14}/> Edit User</button>
                            <button onClick={() => { setRoleTarget(u); setRoleValue((roleOf(u) === "ADMIN" || roleOf(u) === "SUPPLIER" ? roleOf(u) : "BUYER") as "BUYER" | "SUPPLIER" | "ADMIN"); setMenuFor(null); setActionError(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"><UserCog size={14}/> Change Role <ChevronRight size={13} className="ml-auto"/></button>
                            <button onClick={() => toggleUser(u)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold ${u.isActive ? "text-rose-600 hover:bg-rose-50" : "text-emerald-700 hover:bg-emerald-50"}`}><Ban size={14}/>{u.isActive ? "Deactivate Account" : "Activate Account"}</button>
                            <button onClick={() => { setConfirmTarget({ user: u, action: "delete" }); setMenuFor(null); setActionError(""); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"><Trash2 size={14}/> Delete User</button>
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
          <span className="px-3 sm:px-0">
            Showing {total ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, total)} of {total} users
          </span>

          <div className="flex items-center justify-end gap-1.5">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
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
                    page === pNum
                      ? "bg-[#5B13EC] text-white shadow-xs"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            {pages > 5 && (
              <>
                <span className="px-1 text-slate-400">…</span>
                <button
                  onClick={() => setPage(pages)}
                  className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                >
                  {pages}
                </button>
              </>
            )}

            <button
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile filter sheet */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => setFiltersOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="user-filter-title" className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-[#F8F7FC] p-4 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#F0EAFE] text-[#5B13EC]"><Filter size={19}/></span><h2 id="user-filter-title" className="text-lg font-bold text-[#182332]">Filters</h2></div>
              <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-white"><X size={20}/></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-3.5">
                <p className="mb-3 text-sm font-bold text-[#182332]">Account Status</p>
                <div className="grid grid-cols-3 gap-2">
                  {([{v:"ALL",l:"All"},{v:"ACTIVE",l:"Active"},{v:"INACTIVE",l:"Inactive"}] as const).map((x) => <button key={x.v} onClick={() => {setActive(x.v);setPage(1);}} className={`min-h-10 rounded-xl border px-2 text-xs font-semibold ${active===x.v?"border-[#5B13EC] bg-[#5B13EC] text-white":"border-[#E2E6ED] bg-white text-[#334155]"}`}>{x.l}</button>)}
                </div>
              </div>
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-3.5">
                <p className="mb-3 text-sm font-bold text-[#182332]">Verification Status</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([{v:"ALL",l:"All"},{v:"APPROVED",l:"Verified"},{v:"PENDING",l:"Pending"},{v:"REJECTED",l:"Rejected"}] as const).map((x) => <button key={x.v} onClick={() => {setVerification(x.v);setPage(1);}} className={`min-h-10 rounded-xl border px-2 text-xs font-semibold ${verification===x.v?"border-[#5B13EC] bg-[#5B13EC] text-white":"border-[#E2E6ED] bg-white text-[#334155]"}`}>{x.l}</button>)}
                </div>
              </div>
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-3.5">
                <p className="mb-3 text-sm font-bold text-[#182332]">Role</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([{v:"ALL",l:"All"},{v:"BUYER",l:"Buyer"},{v:"SUPPLIER",l:"Supplier"},{v:"ADMIN",l:"Admin"}] as const).map((x) => <button key={x.v} onClick={() => {setRole(x.v);setPage(1);}} className={`min-h-10 rounded-xl border px-2 text-xs font-semibold ${role===x.v?"border-[#5B13EC] bg-[#5B13EC] text-white":"border-[#E2E6ED] bg-white text-[#334155]"}`}>{x.l}</button>)}
                </div>
              </div>
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-3.5">
                <p className="mb-3 text-sm font-bold text-[#182332]">Joined Date</p>
                <div className="grid grid-cols-3 gap-2">
                  {([{v:"ALL",l:"All Time"},{v:"7D",l:"Last 7 Days"},{v:"30D",l:"Last 30 Days"}] as const).map((x) => <button key={x.v} onClick={() => {setJoined(x.v);setJoinedFrom("");setJoinedTo("");setPage(1);}} className={`min-h-10 rounded-xl border px-2 text-[11px] font-semibold ${joined===x.v&&!joinedFrom&&!joinedTo?"border-[#5B13EC] bg-[#5B13EC] text-white":"border-[#E2E6ED] bg-white text-[#334155]"}`}>{x.l}</button>)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-semibold text-[#64748B]">From<input type="date" value={joinedFrom} onChange={(e)=>{setJoined("CUSTOM");setJoinedFrom(e.target.value);setPage(1);}} className="mt-1 h-10 w-full rounded-xl border border-[#E2E6ED] px-2 text-xs text-[#182332]"/></label>
                  <label className="text-[11px] font-semibold text-[#64748B]">To<input type="date" value={joinedTo} onChange={(e)=>{setJoined("CUSTOM");setJoinedTo(e.target.value);setPage(1);}} className="mt-1 h-10 w-full rounded-xl border border-[#E2E6ED] px-2 text-xs text-[#182332]"/></label>
                </div>
              </div>
              <div className="rounded-2xl border border-[#E2E6ED] bg-white p-3.5">
                <p className="mb-3 text-sm font-bold text-[#182332]">Last Login</p>
                <div className="grid grid-cols-3 gap-2">
                  {([{v:"ALL",l:"All Time"},{v:"7D",l:"Last 7 Days"},{v:"30D",l:"Last 30 Days"}] as const).map((x) => <button key={x.v} onClick={() => {setLastActive(x.v);setPage(1);}} className={`min-h-10 rounded-xl border px-2 text-[11px] font-semibold ${lastActive===x.v?"border-[#5B13EC] bg-[#5B13EC] text-white":"border-[#E2E6ED] bg-white text-[#334155]"}`}>{x.l}</button>)}
                </div>
                <p className="mt-2 text-[10px] text-slate-400">Uses recorded sign-in activity; accounts without login history are not included in date filters.</p>
              </div>
            </div>
            <div className="sticky bottom-0 mt-4 grid grid-cols-[1fr_1.5fr] gap-2 bg-[#F8F7FC] pt-2">
              <button onClick={() => {setActive("ALL");setVerification("ALL");setRole("ALL");setJoined("ALL");setJoinedFrom("");setJoinedTo("");setLastActive("ALL");setPage(1);}} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E2E6ED] bg-white text-sm font-bold text-[#334155]"><RotateCcw size={16}/> Reset</button>
              <button onClick={() => {setPage(1);setFiltersOpen(false);}} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white"><Check size={17}/> Apply Filters</button>
            </div>
          </section>
        </div>
      )}

      {/* Export options sheet */}
      {exportOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => !exporting && setExportOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="export-users-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F0EAFE] text-[#5B13EC]"><Download size={20}/></span><div><h2 id="export-users-title" className="text-lg font-bold text-[#182332]">Export Users</h2><p className="text-xs text-[#64748B]">Export the users matching current filters</p></div></div><button disabled={exporting} onClick={()=>setExportOpen(false)} aria-label="Close export" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={19}/></button></div>
            {exportComplete && <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center"><span className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={25}/></span><p className="text-base font-bold text-emerald-800">Export Complete</p><p className="mt-1 text-xs text-emerald-700">Your user file has been prepared. Check your downloads or finish saving the PDF.</p></div>}
            <p className="mb-2 text-sm font-bold text-[#182332]">Export Format</p>
            <div className="space-y-2">
              {([{v:"xls",l:"Excel (.xlsx)",d:"Microsoft Excel workbook"},{v:"csv",l:"CSV (.csv)",d:"Compatible with Excel and spreadsheets"},{v:"pdf",l:"PDF (.pdf)",d:"Opens print dialog — choose Save as PDF"}] as const).map((x)=> <button key={x.v} onClick={()=>setExportFormat(x.v)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${exportFormat===x.v?"border-[#B99BFF] bg-[#F7F2FF]":"border-[#E2E6ED] bg-white"}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${exportFormat===x.v?"border-[#5B13EC] bg-[#5B13EC] text-white":"border-slate-300"}`}>{exportFormat===x.v&&<Check size={13}/>}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#182332]">{x.l}</span><span className="block text-[11px] text-[#64748B]">{x.d}</span></span></button>)}
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold text-[#182332]">Data to Export</p><button onClick={()=>setExportFields(["name","email","phone","organization","role","active","verification","joined","lastActive"])} className="text-xs font-bold text-[#5B13EC]">Select all</button></div>
              <div className="grid grid-cols-2 gap-2">
                {([{v:"name",l:"User Details (Name)"},{v:"email",l:"Email"},{v:"phone",l:"Phone"},{v:"organization",l:"Organization"},{v:"role",l:"Role"},{v:"active",l:"Account Status"},{v:"verification",l:"Verification Status"},{v:"joined",l:"Joined Date"},{v:"lastActive",l:"Last Active"}] as const).map((x)=> <label key={x.v} className="flex min-h-10 items-center gap-2 rounded-lg px-1 text-xs font-medium text-[#334155]"><input type="checkbox" checked={exportFields.includes(x.v)} onChange={(e)=>setExportFields((prev)=>e.target.checked?[...prev,x.v]:prev.filter((f)=>f!==x.v))} className="h-4 w-4 accent-[#5B13EC]"/>{x.l}</label>)}
              </div>
            </div>
            {actionError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{actionError}</p>}
            {exporting && <div className="mt-4 rounded-xl bg-[#F6F2FF] p-3"><p className="text-xs font-semibold text-[#5B13EC]">Preparing your filtered user file...</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E8DFFF]"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#5B13EC]"/></div></div>}
            <div className="mt-5 grid grid-cols-2 gap-2"><button disabled={exporting} onClick={()=>{setExportOpen(false);setExportComplete(false);}} className="h-12 rounded-xl border border-[#E2E6ED] text-sm font-bold text-[#334155]">{exportComplete?"Close":"Cancel"}</button><button disabled={exporting||exportFields.length===0} onClick={exportComplete?()=>{setExportOpen(false);setExportComplete(false);}:runExport} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white disabled:opacity-60">{exporting?<LoaderCircle size={17} className="animate-spin"/>:exportComplete?<Check size={17}/>:<Download size={17}/>} {exporting?"Exporting...":exportComplete?"Done":"Export"}</button></div>
          </section>
        </div>
      )}

      {/* User Details Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">User Details</h2>
                <p className="mt-0.5 text-xs text-slate-500">Account and organization information</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[#EBE4FF] text-base font-bold text-[#5B13EC]">
                {selected.fullName.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="font-bold text-slate-900">{selected.fullName}</p>
                <p className="text-xs text-slate-500">{selected.email || selected.phone || "No contact details"}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 border-b border-slate-100 text-sm font-semibold">
              <button onClick={() => setDetailTab("overview")} className={`border-b-2 py-3 ${detailTab==="overview"?"border-[#5B13EC] text-[#5B13EC]":"border-transparent text-slate-500"}`}>Overview</button>
              <button onClick={() => setDetailTab("activity")} className={`border-b-2 py-3 ${detailTab==="activity"?"border-[#5B13EC] text-[#5B13EC]":"border-transparent text-slate-500"}`}>Activity</button>
            </div>
            {detailTab === "overview" && <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <p className="font-semibold text-slate-400 uppercase">Organization</p>
                <p className="mt-1 font-bold text-slate-800">{orgOf(selected)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">Role</p>
                <p className="mt-1 font-bold text-slate-800">{roleOf(selected)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">Account Status</p>
                <p className="mt-1 font-bold text-slate-800">{selected.isActive ? "Active" : "Inactive"}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">Verification</p>
                <p className="mt-1 font-bold text-slate-800">{verificationOf(selected)}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">Joined</p>
                <p className="mt-1 font-bold text-slate-800">{new Date(selected.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-400 uppercase">Last Login</p>
                <p className="mt-1 font-bold text-slate-800">
                  {lastLoginAt(detailActivity) ? new Date(lastLoginAt(detailActivity)!).toLocaleString() : "Not recorded"}
                </p>
              </div>
            </div>}
            {detailTab === "activity" && <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto">
              {detailActivity.length ? detailActivity.map((event) => <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><p className="text-xs font-bold text-[#182332]">{String(event.action || "Activity").replaceAll("_"," ").toLowerCase().replace(/\b\w/g,(c:string)=>c.toUpperCase())}</p><p className="mt-1 text-[11px] text-slate-500">{new Date(event.createdAt).toLocaleString()}</p></div>) : <p className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-500">No recorded activity for this user yet.</p>}
            </div>}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl bg-[#5B13EC] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#4C0EC9]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit user sheet */}
      {editTarget && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={()=>!actionBusy&&setEditTarget(null)}>
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-[#182332]">Edit User</h2><p className="text-xs text-slate-500">Update basic account details</p></div><button onClick={()=>setEditTarget(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"><X size={19}/></button></div>
            <div className="space-y-4">
              <label className="block text-xs font-bold text-[#334155]">Full Name<input value={editName} onChange={(e)=>setEditName(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#E2E6ED] px-3 text-sm font-normal outline-none focus:border-[#5B13EC]"/></label>
              <label className="block text-xs font-bold text-[#334155]">Email Address<input type="email" value={editEmail} onChange={(e)=>setEditEmail(e.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-[#E2E6ED] px-3 text-sm font-normal outline-none focus:border-[#5B13EC]"/></label>
              <label className="block text-xs font-bold text-[#334155]">Organization<input disabled value={orgOf(editTarget)} className="mt-1.5 h-11 w-full rounded-xl border border-[#E2E6ED] bg-[#F6F7FA] px-3 text-sm font-normal text-slate-500"/></label>
              <label className="block text-xs font-bold text-[#334155]">Role<select disabled value={roleOf(editTarget)} className="mt-1.5 h-11 w-full rounded-xl border border-[#E2E6ED] bg-[#F6F7FA] px-3 text-sm font-normal text-slate-500"><option value={roleOf(editTarget)}>{roleOf(editTarget)}</option></select></label>
              <div className="rounded-xl bg-[#F6F7FA] p-3 text-xs text-slate-500">Organization and role are shown for context. Use Change Role from the three-dot menu to manage access separately.</div>
              {actionError && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{actionError}</p>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>setEditTarget(null)} disabled={actionBusy} className="h-11 rounded-xl border border-[#E2E6ED] text-sm font-bold text-slate-700">Cancel</button><button onClick={saveUserEdit} disabled={actionBusy||editName.trim().length<2} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white disabled:opacity-60">{actionBusy?<LoaderCircle size={16} className="animate-spin"/>:""}Save Changes</button></div>
          </section>
        </div>
      )}

      {/* Change role sheet */}
      {roleTarget && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={()=>!actionBusy&&setRoleTarget(null)}>
          <section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(e)=>e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-[#182332]">Change Role</h2><p className="mt-1 text-xs text-slate-500">Select a new role for {roleTarget.fullName}</p></div><button onClick={()=>setRoleTarget(null)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"><X size={19}/></button></div>
            <div className="space-y-2">
              {([{v:"ADMIN",l:"Admin",d:"Platform administration access"},{v:"BUYER",l:"Buyer",d:"Create RFQs and manage buyer orders"},{v:"SUPPLIER",l:"Supplier",d:"Receive RFQs and manage supplier orders"}] as const).map((x)=><button key={x.v} onClick={()=>setRoleValue(x.v)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${roleValue===x.v?"border-[#B99BFF] bg-[#F7F2FF]":"border-[#E2E6ED]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full border ${roleValue===x.v?"border-[#5B13EC] bg-[#5B13EC] text-white":"border-slate-300"}`}>{roleValue===x.v&&<Check size={13}/>}</span><span><span className="block text-sm font-bold text-[#182332]">{x.l}</span><span className="block text-[11px] text-slate-500">{x.d}</span></span></button>)}
            </div>
            {roleTarget.memberships?.filter((m:any)=>m.isActive).length!==1 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">This user has multiple or no active organization memberships. Role change is blocked until membership access is reviewed.</p>}
            {actionError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{actionError}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2"><button onClick={()=>setRoleTarget(null)} disabled={actionBusy} className="h-11 rounded-xl border border-[#E2E6ED] text-sm font-bold text-slate-700">Cancel</button><button onClick={saveUserRole} disabled={actionBusy||roleTarget.memberships?.filter((m:any)=>m.isActive).length!==1||roleValue===roleOf(roleTarget)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white disabled:opacity-50">{actionBusy?<LoaderCircle size={16} className="animate-spin"/>:""}Update Role</button></div>
          </section>
        </div>
      )}

      {/* Status / delete confirmation */}
      {confirmTarget && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={()=>!actionBusy&&setConfirmTarget(null)}>
          <section role="alertdialog" aria-modal="true" className="w-full max-w-md rounded-t-3xl bg-white p-6 text-center shadow-2xl sm:rounded-2xl" onClick={(e)=>e.stopPropagation()}>
            <span className={`mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full ${confirmTarget.action==="delete"?"bg-rose-50 text-rose-600":"bg-amber-50 text-amber-600"}`}>{confirmTarget.action==="delete"?<Trash2 size={29}/>:<AlertTriangle size={29}/>}</span>
            <h2 className="text-xl font-bold text-[#182332]">{confirmTarget.action==="delete"?"Delete User?":confirmTarget.nextActive?"Activate Account?":"Deactivate Account?"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{confirmTarget.action==="delete"?"Permanent deletion is allowed only when the account has no organization memberships or authored business records. Existing business data is protected.":confirmTarget.nextActive?"This will restore the user's access to STITCHGRID.":"This will disable the user's access to STITCHGRID. You can activate the account again later."}</p>
            <p className="mt-2 text-sm font-bold text-[#182332]">{confirmTarget.user.fullName}</p>
            {actionError && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-left text-xs text-rose-700">{actionError}</p>}
            <div className="mt-6 grid grid-cols-2 gap-2"><button onClick={()=>setConfirmTarget(null)} disabled={actionBusy} className="h-11 rounded-xl border border-[#E2E6ED] text-sm font-bold text-slate-700">Cancel</button><button onClick={executeUserAction} disabled={actionBusy} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 ${confirmTarget.action==="delete"||!confirmTarget.nextActive?"bg-rose-600":"bg-[#5B13EC]"}`}>{actionBusy?<LoaderCircle size={16} className="animate-spin"/>:""}{confirmTarget.action==="delete"?"Delete":confirmTarget.nextActive?"Activate":"Deactivate"}</button></div>
          </section>
        </div>
      )}

    </section>
  );
}
