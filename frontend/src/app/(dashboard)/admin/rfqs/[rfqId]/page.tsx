"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, FileText, PackageCheck, Building2, MapPin,
  XCircle, Boxes, Activity, Info, LoaderCircle
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { Status } from "@/features/admin/AdminResourcePage";

type Tab = "OVERVIEW" | "REQUIREMENTS" | "RESPONSES" | "ACTIVITY";

export default function RfqDetailsPage() {
  const params = useParams<{ rfqId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rfq, setRfq] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<Tab>(
    requestedTab === "RESPONSES" ? "RESPONSES" : "OVERVIEW"
  );

  useEffect(() => {
    let active = true;
    adminService.rfq(params.rfqId)
      .then((result) => { if (active) setRfq(result); })
      .catch((error) => window.alert(error instanceof Error ? error.message : "Unable to load RFQ."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.rfqId]);

  const close = async () => {
    if (!window.confirm("Close this RFQ?")) return;
    setBusy(true);
    try {
      await adminService.updateRfqStatus(params.rfqId, "CLOSED");
      const updated = await adminService.rfq(params.rfqId);
      setRfq(updated);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to close RFQ.");
    } finally {
      setBusy(false);
    }
  };

  const rfqCode = useMemo(
    () => rfq?.id ? `RFQ-2026-${String(rfq.id).slice(0, 5).toUpperCase()}` : "",
    [rfq?.id]
  );

  if (loading) {
    return <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin text-[#5B13EC]" size={20} /> Loading RFQ details…</div>;
  }
  if (!rfq) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">RFQ not found. <Link href="/admin/rfqs" className="ml-1 font-semibold text-[#5B13EC]">Back to RFQs</Link></div>;
  }

  const tabs: { id: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "OVERVIEW", label: "Overview", icon: Info },
    { id: "REQUIREMENTS", label: "Requirements", icon: Boxes, count: rfq.items?.length || 0 },
    { id: "RESPONSES", label: "Responses", icon: PackageCheck, count: rfq.quotations?.length || 0 },
    { id: "ACTIVITY", label: "Activity", icon: Activity },
  ];

  const createdAt = rfq.createdAt ? new Date(rfq.createdAt) : null;
  return (
    <section className="mx-auto min-w-0 max-w-6xl space-y-4 md:space-y-5">
      <Link href="/admin/rfqs" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900">
        <ArrowLeft size={17} /> <span className="hidden sm:inline">Back to RFQs</span><span className="sm:hidden">All RFQs</span>
      </Link>

      {/* Mobile-first RFQ summary; deliberately no product image. */}
      <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_3px_12px_rgba(24,35,50,0.04)]">
        <div className="bg-gradient-to-br from-[#4B0BCB] via-[#6415E8] to-[#7B2CF5] p-4 text-white md:rounded-t-[22px] md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">RFQ Details</p>
              <h1 className="mt-1 break-words text-xl font-extrabold leading-6 sm:text-2xl">{rfq.title}</h1>
              <p className="mt-1.5 font-mono text-[11px] text-white/75">{rfqCode}</p>
            </div>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15"><FileText size={23} /></span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">{rfq.garmentType || "Apparel"}</span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${rfq.status === "AWARDED" ? "bg-emerald-100 text-emerald-800" : rfq.status === "OPEN" ? "bg-amber-100 text-amber-800" : "bg-white/90 text-slate-700"}`}>{String(rfq.status || "UNKNOWN").replaceAll("_", " ")}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 md:p-5">
          <div className="min-w-0"><p className="text-[10px] font-semibold text-slate-400">Buyer</p><p className="mt-1 truncate text-sm font-bold text-slate-800">{rfq.buyer?.name || "—"}</p></div>
          <div><p className="text-[10px] font-semibold text-slate-400">Quantity</p><p className="mt-1 text-sm font-bold text-slate-800">{Number(rfq.targetQuantity || 0).toLocaleString("en-IN")} pcs</p></div>
          <div><p className="text-[10px] font-semibold text-slate-400">Responses</p><p className="mt-1 text-sm font-bold text-[#5B13EC]">{rfq.quotations?.length || 0} Quotes</p></div>
          <div><p className="text-[10px] font-semibold text-slate-400">Created</p><p className="mt-1 text-sm font-bold text-slate-800">{createdAt ? createdAt.toLocaleDateString("en-IN") : "—"}</p></div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(24,35,50,0.035)]">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-4">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setActiveTab(id)} className={`relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-bold transition sm:px-4 sm:text-sm ${activeTab === id ? "text-[#5B13EC]" : "text-slate-500 hover:text-slate-800"}`}>
              <Icon size={15} /> {label}{typeof count === "number" && <span className={activeTab === id ? "text-[#5B13EC]/70" : "text-slate-400"}>({count})</span>}
              {activeTab === id && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-[#5B13EC]" />}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-5">
          {activeTab === "OVERVIEW" && (
            <div className="space-y-4">
              <section className="rounded-xl border border-slate-100 p-4">
                <div className="mb-3 flex items-center gap-2"><Info size={18} className="text-[#5B13EC]" /><h2 className="text-sm font-extrabold text-slate-900">RFQ Information</h2></div>
                <div className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {[
                    ["RFQ ID", rfqCode],
                    ["Requirement", rfq.title || "—"],
                    ["Status", String(rfq.status || "—").replaceAll("_", " ")],
                    ["Category", rfq.garmentType || "—"],
                    ["Target Quantity", `${Number(rfq.targetQuantity || 0).toLocaleString("en-IN")} pcs`],
                    ["Target Date", rfq.targetDate ? new Date(rfq.targetDate).toLocaleDateString("en-IN") : "—"],
                    ["Created On", createdAt ? createdAt.toLocaleString("en-IN") : "—"],
                  ].map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(105px,0.8fr)_1.2fr] gap-3 py-2.5"><span className="text-slate-500">{label}</span><span className="break-words font-semibold text-slate-800">{value}</span></div>)}
                </div>
              </section>
              <section className="rounded-xl border border-slate-100 p-4">
                <div className="mb-3 flex items-center gap-2"><Building2 size={18} className="text-[#5B13EC]" /><h2 className="text-sm font-extrabold text-slate-900">Buyer Information</h2></div>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F0EAFE] text-sm font-extrabold text-[#5B13EC]">{(rfq.buyer?.name || "B").slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0"><p className="text-sm font-bold text-slate-900">{rfq.buyer?.name || "Buyer information unavailable"}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} />{rfq.buyer?.city || "Location not provided"}</p></div>
                </div>
              </section>
              <section className="rounded-xl border border-slate-100 p-4">
                <div className="mb-2 flex items-center gap-2"><FileText size={18} className="text-[#5B13EC]" /><h2 className="text-sm font-extrabold text-slate-900">Description</h2></div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{rfq.description || "No additional description provided."}</p>
              </section>
            </div>
          )}

          {activeTab === "REQUIREMENTS" && (
            <section className="rounded-xl border border-slate-100 p-4">
              <div className="mb-3 flex items-center gap-2"><Boxes size={18} className="text-[#5B13EC]" /><h2 className="text-sm font-extrabold text-slate-900">Requirement Items ({rfq.items?.length || 0})</h2></div>
              {rfq.items?.length ? <div className="space-y-2">{rfq.items.map((item: any) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAF9FD] p-3"><div className="min-w-0"><p className="break-words text-sm font-bold text-slate-800">{item.name}</p></div><span className="shrink-0 text-xs font-semibold text-slate-600">{Number(item.quantity || 0).toLocaleString("en-IN")} {item.unit || "units"}</span></div>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No separate requirement items were added.</p>}
            </section>
          )}

          {activeTab === "RESPONSES" && (
            <section className="rounded-xl border border-slate-100 p-4">
              <div className="mb-3 flex items-center gap-2"><PackageCheck size={18} className="text-[#5B13EC]" /><h2 className="text-sm font-extrabold text-slate-900">Supplier Responses ({rfq.quotations?.length || 0})</h2></div>
              {rfq.quotations?.length ? <div className="space-y-3">{rfq.quotations.map((quote: any) => <article key={quote.id} className="rounded-xl border border-slate-200 p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-bold text-slate-900">{quote.supplier?.name || "Supplier"}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} />{quote.supplier?.city || "Location not provided"}</p></div><Status value={quote.status} /></div><p className="mt-3 text-lg font-extrabold text-slate-900">{new Intl.NumberFormat("en-IN", { style: "currency", currency: quote.currency || "INR", maximumFractionDigits: 0 }).format(Number(quote.totalAmount || 0))}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Lead time: {quote.leadTimeDays ?? "—"} days</span><span>MOQ: {quote.moq ?? "—"}</span></div></article>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No supplier quotations received yet.</p>}
            </section>
          )}

          {activeTab === "ACTIVITY" && (
            <section className="rounded-xl border border-slate-100 p-4">
              <div className="mb-4 flex items-center gap-2"><Activity size={18} className="text-[#5B13EC]" /><h2 className="text-sm font-extrabold text-slate-900">RFQ Activity</h2></div>
              <div className="relative ml-2 border-l-2 border-[#E8DFFF] pl-5">
                <span className="absolute -left-[7px] top-1 grid h-3 w-3 place-items-center rounded-full bg-[#5B13EC] ring-4 ring-[#F3EEFF]" />
                <p className="text-sm font-bold text-slate-900">RFQ created</p>
                <p className="mt-1 text-xs text-slate-500">{createdAt ? createdAt.toLocaleString("en-IN") : "Creation date unavailable"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Buyer requirement was submitted to the platform.</p>
              </div>
              <p className="mt-5 text-[11px] leading-5 text-slate-400">Only the creation event is shown here because a complete status-change history is not currently provided by the RFQ details response.</p>
            </section>
          )}
        </div>
      </div>

      {rfq.status === "OPEN" && (
        <div className="sticky bottom-[76px] z-20 flex justify-end rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <button disabled={busy} onClick={close} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-5 text-sm font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50 sm:w-auto">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <XCircle size={16} />}{busy ? "Updating…" : "Close RFQ"}
          </button>
        </div>
      )}
    </section>
  );
}
