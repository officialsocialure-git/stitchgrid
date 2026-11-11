"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, RefreshCw, Download, ChevronLeft, ChevronRight, MoreHorizontal,
  Users, UserRound, Store, UserX, X, ShieldCheck, LoaderCircle, CheckCircle2,
  Clock3, Ban, ArrowUp
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type UserRow = {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  memberships?: any[];
};

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
  const [busyId, setBusyId] = useState<string | null>(null);

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
        });
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
  }, [page, role, active, query, refreshKey]);

  const visibleRows = useMemo(() => {
    return rows.filter((u) => {
      const verify = verificationOf(u);
      const verificationMatch = verification === "ALL" || verify.toUpperCase() === verification;
      const date = new Date(u.createdAt);
      const now = new Date();
      const joinedMatch =
        joined === "ALL" ||
        (joined === "7D" && date >= new Date(now.getTime() - 7 * 86400000)) ||
        (joined === "30D" && date >= new Date(now.getTime() - 30 * 86400000)) ||
        (joined === "YEAR" && date.getFullYear() === now.getFullYear());
      return verificationMatch && joinedMatch;
    });
  }, [rows, verification, joined]);

  const exportUsers = async () => {
    try {
      const all: UserRow[] = [];
      const first = await adminService.users(new URLSearchParams({ page: "1", limit: "100", q: query, role, active }));
      all.push(...(first.items || []));
      for (let p = 2; p <= (first.pages || 1); p++) {
        const batch = await adminService.users(new URLSearchParams({ page: String(p), limit: "100", q: query, role, active }));
        all.push(...(batch.items || []));
      }
      const csvRows = [
        ["Name", "Email", "Phone", "Organization", "Role", "Account Status", "Verification", "Joined"],
        ...all.map((u) => [
          u.fullName,
          u.email || "",
          u.phone || "",
          orgOf(u),
          roleOf(u),
          u.isActive ? "Active" : "Inactive",
          verificationOf(u),
          new Date(u.createdAt).toLocaleDateString(),
        ]),
      ];
      const csv = csvRows.map((row) => row.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "stitchgrid-users.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Unable to export users.");
    }
  };

  const toggleUser = async (u: UserRow) => {
    const next = !u.isActive;
    if (!window.confirm(`${next ? "Activate" : "Deactivate"} ${u.fullName}'s account?`)) return;
    setBusyId(u.id);
    setMenuFor(null);
    try {
      await adminService.updateUserStatus(u.id, next);
      refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Unable to update account.");
    } finally {
      setBusyId(null);
    }
  };

  const roleTabs = [
    { value: "ALL", label: "All Users", count: overview?.users ?? total, icon: Users },
    { value: "BUYER", label: "Buyers", count: overview?.buyers ?? "—", icon: UserRound },
    { value: "SUPPLIER", label: "Suppliers", count: overview?.suppliers ?? "—", icon: Store },
    { value: "ADMIN", label: "Admins", count: adminCount ?? "—", icon: ShieldCheck },
  ];

  return (
    <section className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage platform users, their roles, organizations and account access.
        </p>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      {/* Main Container Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        {/* Card Top: Title & Export Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
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
        <div className="flex flex-wrap gap-2.5 px-6 pt-4 pb-3">
          {roleTabs.map((tab) => {
            const activeTab = role === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setRole(tab.value);
                  setPage(1);
                }}
                className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition ${
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

        {/* Filter Inputs Bar */}
        <div className="grid grid-cols-1 gap-2.5 border-y border-slate-100 bg-[#FAF9FD] p-4 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto]">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="bg-[#FAF9FD] text-[11px] font-bold text-slate-600 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">User</th>
                  <th className="px-5 py-3.5">Organization</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Account Status</th>
                  <th className="px-5 py-3.5">Verification</th>
                  <th className="px-5 py-3.5">Joined</th>
                  <th className="px-5 py-3.5">Last Active</th>
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
                        {formatRelativeTime(u.updatedAt || u.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="relative px-5 py-3.5 text-right">
                        <button
                          disabled={busyId === u.id}
                          onClick={() => setMenuFor(menuFor === u.id ? null : u.id)}
                          aria-label={`Actions for ${u.fullName}`}
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-[#EBE4FF] hover:text-[#5B13EC] transition ml-auto"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menuFor === u.id && (
                          <div className="absolute right-6 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-xl">
                            <button
                              onClick={() => {
                                setSelected(u);
                                setMenuFor(null);
                              }}
                              className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              View details
                            </button>
                            <button
                              onClick={() => toggleUser(u)}
                              className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${
                                u.isActive
                                  ? "text-rose-600 hover:bg-rose-50"
                                  : "text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {u.isActive ? "Deactivate account" : "Activate account"}
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

      {/* User Details Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
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

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
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
                <p className="font-semibold text-slate-400 uppercase">Last Updated</p>
                <p className="mt-1 font-bold text-slate-800">
                  {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "—"}
                </p>
              </div>
            </div>

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
    </section>
  );
}
