"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Eye, EyeOff, Image as ImageIcon, LoaderCircle, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { adminService } from "@/features/admin/admin.service";

type Collection = {
  id: string;
  name?: string;
  imageUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  isActive: boolean;
  moderationNote?: string | null;
  createdAt: string;
  updatedAt: string;
  organization: { id: string; name: string; verificationStatus: string };
};

const tabs = ["ALL", "PENDING", "APPROVED", "REJECTED", "HIDDEN"] as const;

export default function AdminTrendyCollectionsPage() {
  const [items, setItems] = useState<Collection[]>([]);
  const [tab, setTab] = useState<(typeof tabs)[number]>("PENDING");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await adminService.trendyCollections("ALL");
      setItems(Array.isArray(result) ? result : result?.items || []);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load Trendy Collections."); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    ALL: items.length,
    PENDING: items.filter(x => x.status === "PENDING").length,
    APPROVED: items.filter(x => x.status === "APPROVED").length,
    REJECTED: items.filter(x => x.status === "REJECTED").length,
    HIDDEN: items.filter(x => x.status === "HIDDEN").length,
  }), [items]);

  const visible = items.filter(item => {
    const matchesTab = tab === "ALL" || item.status === tab;
    const text = `${item.organization?.name || ""} ${item.name || ""}`.toLowerCase();
    return matchesTab && text.includes(query.toLowerCase());
  });

  const moderate = async (item: Collection, status: "APPROVED" | "REJECTED" | "HIDDEN") => {
    let moderationNote: string | undefined;
    if (status === "REJECTED") {
      moderationNote = window.prompt("Reason for rejecting this collection (optional):") || undefined;
    } else if (status === "HIDDEN") {
      moderationNote = window.prompt("Reason for hiding this collection (optional):") || undefined;
    }
    if (!window.confirm(`${status === "APPROVED" ? "Approve" : status === "REJECTED" ? "Reject" : "Hide"} the Trendy Collection from ${item.organization.name}?`)) return;
    setBusyId(item.id); setError(""); setNotice("");
    try {
      await adminService.moderateTrendyCollection(item.id, status, moderationNote);
      setNotice(`Collection ${status.toLowerCase()} successfully.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update collection status."); }
    finally { setBusyId(""); }
  };

  const badge = (status: Collection["status"]) => {
    const styles: Record<Collection["status"], string> = {
      PENDING: "bg-amber-50 text-amber-700",
      APPROVED: "bg-emerald-50 text-emerald-700",
      REJECTED: "bg-rose-50 text-rose-700",
      HIDDEN: "bg-slate-100 text-slate-600",
    };
    return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${styles[status]}`}>{status}</span>;
  };

  return <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><ShieldCheck className="text-[#5B13EC]" size={22}/><h1 className="text-2xl font-extrabold text-[#182332]">Trendy Collection Moderation</h1></div><p className="mt-1 text-sm text-slate-500">Review supplier collection images before they appear to buyers.</p></div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><RefreshCw size={15}/> Refresh</button>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {([{label:"Loaded",value:items.length,icon:ImageIcon},{label:"Pending",value:counts.PENDING,icon:Clock3},{label:"Approved",value:counts.APPROVED,icon:CheckCircle2},{label:"Rejected / Hidden",value:counts.REJECTED+counts.HIDDEN,icon:XCircle}] as const).map(x => <div key={x.label} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between text-xs font-semibold text-slate-500">{x.label}<x.icon size={17}/></div><p className="mt-2 text-2xl font-extrabold text-slate-900">{x.value}</p></div>)}
    </div>

    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">{tabs.map(value => <button key={value} onClick={() => setTab(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${tab === value ? "bg-[#5B13EC] text-white" : "bg-slate-100 text-slate-600"}`}>{value}</button>)}</div>
      <div className="relative min-w-[220px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search supplier..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#5B13EC]"/></div>
    </div>

    {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</div>}
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

    {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><LoaderCircle className="animate-spin"/> Loading collections...</div> : visible.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><ImageIcon className="mx-auto text-slate-300" size={32}/><p className="mt-3 text-sm font-semibold text-slate-600">No collections found</p><p className="mt-1 text-xs text-slate-400">Supplier submissions will appear here for review.</p></div> :
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visible.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative aspect-[4/3] bg-slate-100"><img src={item.imageUrl} alt={`${item.organization.name} Trendy Collection`} className="h-full w-full object-cover"/><div className="absolute left-3 top-3">{badge(item.status)}</div></div>
        <div className="space-y-3 p-4">
          <div><h2 className="font-bold text-slate-900">{item.organization.name}</h2><p className="mt-1 text-[11px] text-slate-500">Supplier verification: {item.organization.verificationStatus} · Submitted {new Date(item.createdAt).toLocaleDateString()}</p></div>
          {item.moderationNote && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Note: {item.moderationNote}</p>}
          <div className="flex flex-wrap gap-2">
            {item.status !== "APPROVED" && <button disabled={!!busyId} onClick={() => void moderate(item,"APPROVED")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busyId===item.id?<LoaderCircle className="animate-spin" size={14}/>:<CheckCircle2 size={14}/>} Approve</button>}
            {item.status !== "REJECTED" && <button disabled={!!busyId} onClick={() => void moderate(item,"REJECTED")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle size={14}/> Reject</button>}
            {item.status === "APPROVED" && <button disabled={!!busyId} onClick={() => void moderate(item,"HIDDEN")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-600 disabled:opacity-50"><EyeOff size={14}/> Hide</button>}
            {item.status === "HIDDEN" && <button disabled={!!busyId} onClick={() => void moderate(item,"APPROVED")} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Eye size={14}/> Restore</button>}
          </div>
        </div>
      </article>)}</div>}
  </div>;
}
