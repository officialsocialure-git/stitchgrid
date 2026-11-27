"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/services/api";

type Reel = {
  id: string;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  moderationNote?: string | null;
  impressionCount: number;
  viewCount: number;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    verificationStatus: string;
    businessType?: string | null;
    businessMedia?: { url: string }[];
  };
  products?: { catalogItem: { id: string; name: string; itemType: string } }[];
};

type Result = { items: Reel[]; total: number; stats: { pending: number; approved: number; rejected: number } };

export default function AdminSupplierReelsPage() {
  const [status, setStatus] = useState("PENDING");
  const [data, setData] = useState<Result>({ items: [], total: 0, stats: { pending: 0, approved: 0, rejected: 0 } });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<Result>(`/admin/supplier-reels?status=${status}`);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load supplier Reels.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const moderate = async (reel: Reel, nextStatus: "APPROVED" | "REJECTED" | "HIDDEN") => {
    const note = nextStatus === "REJECTED" ? window.prompt("Reason for rejecting this Reel (optional):") : "";
    if (nextStatus === "REJECTED" && note === null) return;
    setSavingId(reel.id);
    try {
      await api.patch(`/admin/supplier-reels/${reel.id}`, { status: nextStatus, moderationNote: note || undefined });
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Unable to update Reel status.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#5B13EC]">Marketplace moderation</p>
          <h1 className="mt-1 text-2xl font-extrabold text-[#182332]">Supplier Reels</h1>
          <p className="mt-1 text-sm text-[#667085]">Review collection videos before they appear in buyer Viral Trends.</p>
        </div>
        <button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending Review", value: data.stats.pending, tone: "amber" },
          { label: "Approved & Active", value: data.stats.approved, tone: "emerald" },
          { label: "Rejected", value: data.stats.rejected, tone: "rose" },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-extrabold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {["PENDING", "APPROVED", "REJECTED", "HIDDEN", "ALL"].map(value => (
          <button key={value} onClick={() => setStatus(value)} className={`rounded-full px-4 py-2 text-xs font-bold transition ${status === value ? "bg-[#5B13EC] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{value === "ALL" ? "All Reels" : value}</button>
        ))}
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Loading supplier Reels…</div> :
        data.items.length ? <div className="grid gap-4 lg:grid-cols-2">
          {data.items.map(reel => (
            <article key={reel.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-4 p-4 sm:grid-cols-[160px_1fr]">
                <video src={reel.videoUrl} controls playsInline preload="metadata" className="aspect-[9/16] max-h-[290px] w-full rounded-xl bg-slate-950 object-contain" />
                <div className="min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-extrabold text-slate-900">{reel.title}</h2>
                      <p className="mt-1 text-xs text-slate-500">{reel.durationSeconds}s · Submitted {new Date(reel.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${reel.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : reel.status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{reel.status}</span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-bold text-slate-900">{reel.organization.name}</p>
                    <p className="text-xs text-slate-500">{reel.organization.businessType || "Supplier"} · {reel.organization.verificationStatus}</p>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-600">
                    <span>{reel.impressionCount.toLocaleString()} impressions</span>
                    <span>{reel.viewCount.toLocaleString()} views</span>
                  </div>
                  {!!reel.products?.length && <div><p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Linked products</p><div className="flex flex-wrap gap-1.5">{reel.products.map(link => <span key={link.catalogItem.id} className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold text-violet-700">{link.catalogItem.name}</span>)}</div></div>}
                  {!!reel.moderationNote && <p className="text-xs text-rose-600">Note: {reel.moderationNote}</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {reel.status !== "APPROVED" && <button disabled={!!savingId} onClick={() => void moderate(reel, "APPROVED")} className="rounded-xl bg-[#5B13EC] px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{savingId === reel.id ? "Saving…" : "Approve"}</button>}
                    {reel.status !== "REJECTED" && <button disabled={!!savingId} onClick={() => void moderate(reel, "REJECTED")} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">Reject</button>}
                    {reel.status === "APPROVED" && <button disabled={!!savingId} onClick={() => void moderate(reel, "HIDDEN")} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">Hide</button>}
                    {reel.status === "HIDDEN" && <button disabled={!!savingId} onClick={() => void moderate(reel, "APPROVED")} className="rounded-xl border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 disabled:opacity-50">Restore</button>}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><p className="font-bold text-slate-800">No Reels in this view</p><p className="mt-1 text-sm text-slate-500">Supplier-submitted collection videos will appear here for moderation.</p></div>}
    </div>
  );
}
