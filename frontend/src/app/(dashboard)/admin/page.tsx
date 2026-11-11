"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, FileText, Package, ShieldCheck, Users, ArrowUpRight, RefreshCw, Wallet, CreditCard } from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const metrics = [
  { key: "suppliers", label: "Suppliers", icon: Boxes, tone: "text-green-600", href: "/admin/users" },
  { key: "buyers", label: "Buyers", icon: Users, tone: "text-blue-600", href: "/admin/users" },
  { key: "openRfqs", label: "Open RFQs", icon: FileText, tone: "text-violet-600", href: "/admin/rfqs" },
  { key: "activeOrders", label: "Active Orders", icon: Package, tone: "text-orange-500", href: "/admin/orders" },
  { key: "paidTransactions", label: "Verified Payments", icon: Wallet, tone: "text-emerald-600", href: "/admin/payments" },
  { key: "pendingTransactions", label: "Pending Payments", icon: CreditCard, tone: "text-amber-600", href: "/admin/payments" },
];

export default function AdminOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setData(await adminService.overview()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load platform overview."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useRealtimeSync({
    topics: ["admin:verification_updated", "admin:stats_updated", "order:created", "rfq:created", "supplier:updated", "payment:updated", "payment:setup_updated", "payment:refund_updated"],
    onSync: load,
    pollIntervalMs: 30000,
  });

  const pending = [
    { label: "Supplier verification", count: data?.pendingVerifications ?? 0, href: "/admin/verification", icon: ShieldCheck },
    { label: "RFQs to review", count: data?.openRfqs ?? 0, href: "/admin/rfqs", icon: FileText },
    { label: "Support cases", count: data?.openDisputes ?? 0, href: "/admin/support", icon: Package },
    { label: "Supplier payment setups", count: data?.pendingPaymentSetups ?? 0, href: "/admin/payments", icon: Wallet },
    { label: "Refund requests", count: data?.openRefundRequests ?? 0, href: "/admin/payments", icon: CreditCard },
  ];

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-extrabold tracking-tight leading-[1.2]">Platform Overview</h1><p className="mt-1 text-sm text-slate-500 leading-[1.5]">Manage suppliers, buyers, RFQs and orders.</p></div>
      <button onClick={load} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({key,label,icon:Icon,tone,href}) => <Link href={href} key={key} className="flex min-h-[116px] items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm">
        <Icon className={tone} size={31} strokeWidth={1.8}/>
        <div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-3xl font-extrabold tracking-tight">{loading ? "—" : (data?.[key] ?? 0)}</p></div>
      </Link>)}
    </div>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-bold">Pending Actions</h2></div>
      <div className="divide-y divide-slate-100">
        {pending.map(({label,count,href,icon:Icon}) => <Link href={href} key={label} className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50">
          <Icon size={21} className="text-slate-700"/>
          <span className="flex-1 text-sm font-semibold">{label}</span>
          <span className="min-w-11 rounded-full bg-[#D9F66A] px-3 py-1 text-center text-xs font-extrabold text-[#182A32]">{loading ? "—" : count}</span>
          <ArrowUpRight size={17} className="text-slate-500"/>
        </Link>)}
      </div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4"><h2 className="text-lg font-bold">Recent Activity</h2></div>
      {loading ? <p className="p-5 text-sm text-slate-500">Loading activity…</p> : !data?.recentActivity?.length ? <p className="p-5 text-sm text-slate-500">No recent platform activity yet.</p> : <div className="divide-y divide-slate-100">
        {data.recentActivity.map((item:any) => <div key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><FileText size={17}/></span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.action.replaceAll("_"," ")}</p><p className="mt-0.5 text-xs text-slate-500">{item.user?.fullName || "Platform"} · {item.entityType}{item.entityId ? ` · ${item.entityId}` : ""}</p></div>
          <time className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time>
        </div>)}
      </div>}
    </section>
  </div>;
}
