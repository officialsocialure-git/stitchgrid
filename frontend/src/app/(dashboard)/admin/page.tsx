"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boxes, FileText, Package, ShieldCheck, Users, ChevronRight, RefreshCw, Wallet, CreditCard, Headset, Zap, RotateCcw, Image as ImageIcon } from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const metrics = [
  { key: "suppliers", label: "Suppliers", icon: Boxes, tone: "text-[#5B13EC]", href: "/admin/users" },
  { key: "buyers", label: "Buyers", icon: Users, tone: "text-[#5B13EC]", href: "/admin/users" },
  { key: "openRfqs", label: "Open RFQs", icon: FileText, tone: "text-[#5B13EC]", href: "/admin/rfqs" },
  { key: "activeOrders", label: "Active Orders", icon: Package, tone: "text-[#5B13EC]", href: "/admin/orders" },
  { key: "paidTransactions", label: "Verified Payments", icon: Wallet, tone: "text-[#5B13EC]", href: "/admin/payments" },
  { key: "pendingTransactions", label: "Pending Payments", icon: CreditCard, tone: "text-[#5B13EC]", href: "/admin/payments" },
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
    { label: "Supplier verification", description: "Organization verification requests", count: data?.pendingVerifications ?? 0, href: "/admin/verification", icon: ShieldCheck },
    { label: "Trendy Collections", description: "Review supplier collection images", href: "/admin/trendy-collections", icon: ImageIcon },
    { label: "RFQs to review", description: "Requests awaiting review", count: data?.openRfqs ?? 0, href: "/admin/rfqs", icon: FileText },
    { label: "Support cases", description: "Open support issues", count: data?.openDisputes ?? 0, href: "/admin/support", icon: Headset },
    { label: "Supplier payment setups", description: "Pending payment configurations", count: data?.pendingPaymentSetups ?? 0, href: "/admin/payments", icon: Wallet },
    { label: "Refund requests", description: "Refunds awaiting action", count: data?.openRefundRequests ?? 0, href: "/admin/payments", icon: RotateCcw },
  ];
  const totalPending = pending.reduce((total, item) => total + (Number(item.count) || 0), 0);

  return <div className="admin-page mx-auto max-w-[1500px] space-y-5 sm:space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-[22px] font-bold tracking-tight leading-[1.2] sm:text-2xl">Platform Overview</h1><p className="mt-1 text-sm text-slate-500 leading-[1.5]">Manage suppliers, buyers, RFQs and orders.</p></div>
      <button onClick={load} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={15}/> Refresh</button>
    </div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {metrics.map(({key,label,icon:Icon,tone,href}) => <Link href={href} key={key} className="flex min-h-[104px] min-w-0 items-center gap-3 rounded-xl border border-[#E2E6ED] bg-white p-3 transition hover:shadow-sm sm:min-h-[116px] sm:gap-5 sm:p-5">
        <Icon className={`shrink-0 ${tone}`} size={25} strokeWidth={1.8}/>
        <div className="min-w-0"><p className="text-xs leading-4 text-[#48586C] sm:text-sm">{label}</p><p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-[#182332] sm:text-3xl">{loading ? "—" : (data?.[key] ?? 0)}</p></div>
      </Link>)}
    </div>
    <section aria-labelledby="admin-action-center-title" className="overflow-hidden rounded-2xl border border-[#E2E6ED] bg-white shadow-[0_8px_28px_rgba(24,35,50,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-[#E2E6ED] px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#F0EAFE] text-[#5B13EC] sm:h-12 sm:w-12">
            <Zap size={25} strokeWidth={2.1}/>
          </span>
          <div className="min-w-0">
            <h2 id="admin-action-center-title" className="text-lg font-bold tracking-tight text-[#182332] sm:text-xl">Action Center</h2>
            <p className="mt-0.5 text-xs leading-5 text-[#48586C] sm:text-sm">Tasks that may need administrator attention</p>
          </div>
        </div>
        <span className="shrink-0 rounded-xl bg-[#F0EAFE] px-3 py-2 text-xs font-bold text-[#5B13EC] sm:px-4 sm:text-sm">
          {loading ? "— pending" : `${totalPending} pending`}
        </span>
      </div>
      <div className="divide-y divide-[#E8EBF1] px-3 sm:px-5">
        {pending.map(({label,description,count,href,icon:Icon}) => {
          const hasPending = Number(count) > 0;
          return (
            <Link href={href} key={label} className={`group -mx-1 my-1 flex min-h-[76px] items-center gap-3 rounded-xl px-2 py-3 transition-colors sm:min-h-[88px] sm:gap-4 sm:px-3 ${hasPending ? "bg-[#F7F2FF] hover:bg-[#F1E8FF]" : "hover:bg-[#F8F9FB]"}`}>
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl sm:h-[52px] sm:w-[52px] ${hasPending ? "bg-[#EEE2FF] text-[#5B13EC]" : "bg-[#F3F4F7] text-[#48586C]"}`}>
                <Icon size={23} strokeWidth={1.9}/>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold leading-5 text-[#182332] sm:text-[15px]">{label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#64748B] sm:text-[13px]">{description}</span>
              </span>
              <span className={`grid h-9 min-w-12 shrink-0 place-items-center rounded-full px-3 text-sm font-bold tabular-nums ${hasPending ? "bg-[#EAD9FF] text-[#5B13EC]" : "bg-[#F0F2F5] text-[#48586C]"}`}>
                {loading ? "—" : count}
              </span>
              <ChevronRight size={20} strokeWidth={2} className="shrink-0 text-[#64748B] transition-transform group-hover:translate-x-0.5"/>
            </Link>
          );
        })}
      </div>
    </section>
  </div>;
}
