"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Layers3, Clock3, CheckCircle2, XCircle, Search, RefreshCw, Download,
  ChevronLeft, ChevronRight, X, LoaderCircle,
  ArrowUp, CheckSquare, Square, SlidersHorizontal, Package, Store,
  MapPin, FileText, Image as ImageIcon, BadgeCheck,
  MoreHorizontal, Info, Check, ArrowLeft
} from "lucide-react";
import { adminService } from "@/features/admin/admin.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

type Listing = {
  id: string;
  name: string;
  description?: string | null;
  itemType: string;
  moq?: number | null;
  unitPrice?: number | string | null;
  currency?: string;
  moderationStatus: "PENDING" | "APPROVED" | "REJECTED";
  moderationNote?: string | null;
  createdAt: string;
  imageUrl?: string | null;
  images?: { id: string; imageUrl: string; sortOrder?: number }[];
  gender?: string | null;
  material?: string | null;
  gsm?: number | null;
  sizes?: string | null;
  colors?: string | null;
  manufacturingType?: string | null;
  customization?: boolean;
  priceTiers?: { minQuantity: number; maxQuantity?: number | null; unitPrice: number | string }[];
  supplierProfile?: {
    organization?: { id: string; name: string; city?: string | null; verificationStatus?: string };
  };
};

type Result = {
  items: Listing[];
  total: number;
  pages: number;
  stats: { total: number; pending: number; approved: number; rejected: number };
  categories: string[];
};

const PAGE_SIZE = 10;

const formatPrice = (amount: Listing["unitPrice"], itemType = "", currency = "INR") => {
  if (amount === null || amount === undefined || amount === "") return "—";
  const unit = itemType.toLowerCase().includes("fabric") ? "/ meter" : "/ piece";
  try {
    return `${new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount))} ${unit}`;
  } catch {
    return `₹${amount} ${unit}`;
  }
};

export default function MarketplacePage() {
  const [data, setData] = useState<Result>({
    items: [],
    total: 0,
    pages: 1,
    stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
    categories: [],
  });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [dateRange, setDateRange] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeListing, setActiveListing] = useState<Listing | null>(null);
  const [mobileDetailTab, setMobileDetailTab] = useState<"OVERVIEW" | "SPECIFICATIONS" | "MEDIA" | "ACTIVITY">("OVERVIEW");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [moderating, setModerating] = useState(false);
  const [moderationError, setModerationError] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectNote, setShowRejectNote] = useState(false);

  const refresh = useCallback(() => setRefreshKey((v) => v + 1), []);

  const moderateListing = async (status: "APPROVED" | "REJECTED", note = "") => {
    if (!activeListing) return;
    setModerating(true);
    setModerationError("");
    try {
      await adminService.moderateCatalog(activeListing.id, status, note.trim() || undefined);
      setActiveListing(null);
      setShowRejectNote(false);
      setRejectNote("");
      refresh();
    } catch (e) {
      setModerationError(e instanceof Error ? e.message : "Unable to update listing moderation.");
    } finally {
      setModerating(false);
    }
  };

  useEffect(() => {
    if (!activeListing || mobileDetailTab !== "ACTIVITY") return;
    let alive = true;
    adminService.auditLogs()
      .then((logs) => {
        if (alive) setActivityLogs((Array.isArray(logs) ? logs : []).filter((log: any) =>
          log.entityType === "CatalogItem" && log.entityId === activeListing.id
        ));
      })
      .catch(() => { if (alive) setActivityLogs([]); });
    return () => { alive = false; };
  }, [activeListing, mobileDetailTab]);
  useRealtimeSync({
    topics: ["catalog", "marketplace", "admin:stats_updated"],
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
        status: tab,
        category,
        dateRange,
      });
      try {
        const result = (await adminService.marketplace(params)) as unknown as Result;
        if (!alive) return;
        setData({
          items: result?.items || [],
          total: result?.total || 0,
          pages: Math.max(1, result?.pages || 1),
          stats: result?.stats || { total: 0, pending: 0, approved: 0, rejected: 0 },
          categories: result?.categories || [],
        });
        setSelectedIds([]);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load marketplace listings.");
      } finally {
        if (alive) setLoading(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [page, query, tab, category, dateRange, refreshKey]);

  const tabs = useMemo(
    () => [
      { value: "ALL", label: "All Listings", count: data.stats.total, icon: Layers3 },
      { value: "PENDING", label: "Pending", count: data.stats.pending, icon: Clock3 },
      { value: "APPROVED", label: "Approved", count: data.stats.approved, icon: CheckCircle2 },
      { value: "REJECTED", label: "Rejected", count: data.stats.rejected, icon: XCircle },
    ],
    [data.stats]
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
      ["Product / Listing", "Supplier", "Category", "Unit Price", "Currency", "MOQ", "Status", "Date Added"],
      ...data.items.map((i) => [
        i.name,
        i.supplierProfile?.organization?.name || "Supplier",
        i.itemType,
        i.unitPrice ?? "",
        i.currency || "INR",
        i.moq ?? "",
        i.moderationStatus,
        new Date(i.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stitchgrid-marketplace-listings.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setQuery("");
    setTab("ALL");
    setCategory("ALL");
    setDateRange("ALL");
    setPage(1);
  };

  return (
    <section className="space-y-6">

      <div className="space-y-4 md:hidden">
        {activeListing ? (
          <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-[#F6F7FA]">
            <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
              <button onClick={() => setActiveListing(null)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-700" aria-label="Back"><ArrowLeft size={22} /></button>
              <h2 className="text-base font-bold text-[#182332]">Listing Details</h2>
              <span className="w-10" />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4">
              <div className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {(activeListing.imageUrl || activeListing.images?.[0]?.imageUrl) ? <img src={activeListing.imageUrl || activeListing.images?.[0]?.imageUrl || ""} alt={activeListing.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><Package size={30} /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-bold text-slate-900">{activeListing.name}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><Store size={14} /> {activeListing.supplierProfile?.organization?.name || "Supplier"}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#F0E9FF] px-3 py-1 text-xs font-semibold text-[#5B13EC]">{activeListing.itemType}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{activeListing.moderationStatus}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-5 overflow-x-auto border-b border-slate-200 bg-white px-2">
                {(["OVERVIEW", "SPECIFICATIONS", "MEDIA", "ACTIVITY"] as const).map((value) => (
                  <button key={value} onClick={() => setMobileDetailTab(value)} className={"shrink-0 border-b-2 px-1 py-3 text-sm font-semibold " + (mobileDetailTab === value ? "border-[#5B13EC] text-[#5B13EC]" : "border-transparent text-slate-500")}>{value.charAt(0) + value.slice(1).toLowerCase()}</button>
                ))}
              </div>
              {mobileDetailTab === "OVERVIEW" && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900"><Info size={18} className="text-[#5B13EC]" /> Listing Information</h3>
                    <div className="divide-y divide-slate-100 text-sm">
                      <div className="flex justify-between gap-3 py-2"><span className="text-slate-500">Category</span><span className="font-medium text-slate-900">{activeListing.itemType}</span></div>
                      {activeListing.unitPrice !== null && activeListing.unitPrice !== undefined && activeListing.unitPrice !== "" && <div className="flex justify-between gap-3 py-2"><span className="text-slate-500">Price</span><span className="font-medium text-slate-900">{formatPrice(activeListing.unitPrice, activeListing.itemType, activeListing.currency)}</span></div>}
                      {activeListing.moq !== null && activeListing.moq !== undefined && <div className="flex justify-between gap-3 py-2"><span className="text-slate-500">MOQ</span><span className="font-medium text-slate-900">{activeListing.moq} {activeListing.itemType.toLowerCase().includes("fabric") ? "m" : "units"}</span></div>}
                      <div className="flex justify-between gap-3 py-2"><span className="text-slate-500">Listing ID</span><span className="max-w-[55%] break-all text-right font-medium text-slate-900">{activeListing.id}</span></div>
                      <div className="flex justify-between gap-3 py-2"><span className="text-slate-500">Added On</span><span className="font-medium text-slate-900">{new Date(activeListing.createdAt).toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-slate-900"><FileText size={18} className="text-[#5B13EC]" /> Description</h3>
                    <p className="text-sm leading-6 text-slate-600">{activeListing.description || "No description was provided by the supplier."}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-base font-bold text-slate-900">Supplier Information</h3>
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#F0E9FF] font-bold text-[#5B13EC]">{(activeListing.supplierProfile?.organization?.name || "S").slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0"><p className="font-semibold text-slate-900">{activeListing.supplierProfile?.organization?.name || "Supplier"}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {activeListing.supplierProfile?.organization?.city || "Location not provided"}</p></div>
                      {activeListing.supplierProfile?.organization?.verificationStatus === "APPROVED" && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700"><BadgeCheck size={13} /> Verified</span>}
                    </div>
                  </div>
                </div>
              )}
              {mobileDetailTab === "SPECIFICATIONS" && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-base font-bold text-slate-900">Listing Specifications</h3>
                  <div className="divide-y divide-slate-100 text-sm">
                    <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Listing type</span><span className="font-medium text-slate-900">{activeListing.itemType}</span></div>
                    {activeListing.unitPrice !== null && activeListing.unitPrice !== undefined && activeListing.unitPrice !== "" && <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Unit price</span><span className="font-medium text-slate-900">{formatPrice(activeListing.unitPrice, activeListing.itemType, activeListing.currency)}</span></div>}
                    {activeListing.moq !== null && activeListing.moq !== undefined && <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Minimum order quantity</span><span className="font-medium text-slate-900">{activeListing.moq} {activeListing.itemType.toLowerCase().includes("fabric") ? "m" : "units"}</span></div>}
                    <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Currency</span><span className="font-medium text-slate-900">{activeListing.currency || "INR"}</span></div>
                    {activeListing.material && <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Material</span><span className="font-medium text-slate-900">{activeListing.material}</span></div>}
                    {activeListing.gsm && <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">GSM</span><span className="font-medium text-slate-900">{activeListing.gsm}</span></div>}
                    {activeListing.gender && <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Gender</span><span className="font-medium text-slate-900">{activeListing.gender}</span></div>}
                    {activeListing.sizes && <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Sizes</span><span className="font-medium text-slate-900">{activeListing.sizes}</span></div>}
                    {activeListing.colors && <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Colours</span><span className="font-medium text-slate-900">{activeListing.colors}</span></div>}
                    {activeListing.priceTiers?.length ? <div className="py-3"><span className="text-slate-500">Bulk price tiers</span><div className="mt-2 space-y-1">{activeListing.priceTiers.map((tier, index) => <div key={index} className="flex justify-between gap-3 text-slate-900"><span>{tier.minQuantity}+ pcs</span><span className="font-semibold">{formatPrice(tier.unitPrice, activeListing.itemType, activeListing.currency)}</span></div>)}</div></div> : null}
                    <div className="flex justify-between gap-3 py-3"><span className="text-slate-500">Moderation status</span><span className="font-medium text-slate-900">{activeListing.moderationStatus}</span></div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Only specifications currently stored for this listing are shown.</p>
                </div>
              )}
              {mobileDetailTab === "MEDIA" && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-base font-bold text-slate-900">Uploaded Listing Images</h3>
                  {(activeListing.images?.length || activeListing.imageUrl) ? (
                    <div className="grid grid-cols-2 gap-3">
                      {(activeListing.imageUrl ? [{ imageUrl: activeListing.imageUrl }] : []).concat(activeListing.images || []).map((image, index) => <a key={image.imageUrl + index} href={image.imageUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={image.imageUrl} alt={activeListing.name + " image " + (index + 1)} className="aspect-square w-full object-cover" /><span className="block px-2 py-1.5 text-xs text-slate-600">Image {index + 1} · Open</span></a>)}
                    </div>
                  ) : <div className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500"><ImageIcon size={28} className="mx-auto mb-2 text-slate-400" />No images uploaded for this listing.</div>}
                </div>
              )}
              {mobileDetailTab === "ACTIVITY" && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-base font-bold text-slate-900">Activity History</h3>
                  {activityLogs.length ? <div className="space-y-4">{activityLogs.map((log) => <div key={log.id} className="flex gap-3"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#5B13EC]" /><div><p className="text-sm font-semibold text-slate-900">{String(log.action || "Listing updated").replaceAll("_", " ")}</p><p className="mt-1 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p></div></div>)}</div> : <p className="py-8 text-center text-sm text-slate-500">No recent activity is available for this listing.</p>}
                </div>
              )}
              {moderationError && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{moderationError}</div>}
              {showRejectNote && <div className="mt-4 rounded-2xl border border-rose-200 bg-white p-4"><label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="marketplace-reject-note">Reason for rejection</label><textarea id="marketplace-reject-note" value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} maxLength={2000} rows={3} placeholder="Explain what the supplier needs to correct..." className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#5B13EC]" /><div className="mt-3 flex gap-2"><button onClick={() => setShowRejectNote(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700">Cancel</button><button disabled={moderating || rejectNote.trim().length < 5} onClick={() => moderateListing("REJECTED", rejectNote)} className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white disabled:opacity-50">{moderating ? "Saving..." : "Confirm rejection"}</button></div></div>}
            </div>
            {!showRejectNote && <div className="absolute inset-x-0 bottom-0 flex gap-3 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><button disabled={moderating} onClick={() => setShowRejectNote(true)} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 text-sm font-bold text-rose-600 disabled:opacity-50"><XCircle size={18} /> Reject</button><button disabled={moderating || activeListing.moderationStatus === "APPROVED"} onClick={() => moderateListing("APPROVED")} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#5B13EC] text-sm font-bold text-white disabled:opacity-50"><Check size={18} /> {moderating ? "Saving..." : "Approve"}</button></div>}
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-gradient-to-r from-[#4C0EC9] to-[#741DF2] p-5 text-white">
              <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Marketplace</h1><p className="mt-1 max-w-[250px] text-sm leading-6 text-white/90">Review, approve and manage product, fabric and trim listings.</p></div><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15"><Package size={34} /></span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Listings", value: data.stats.total, icon: Layers3, tone: "bg-[#F0E9FF] text-[#5B13EC]" },
                { label: "Pending Approval", value: data.stats.pending, icon: Clock3, tone: "bg-amber-50 text-amber-600" },
                { label: "Approved", value: data.stats.approved, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
                { label: "Rejected", value: data.stats.rejected, icon: XCircle, tone: "bg-rose-50 text-rose-600" },
              ].map((stat) => <div key={stat.label} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5"><span className={"grid h-11 w-11 shrink-0 place-items-center rounded-xl " + stat.tone}><stat.icon size={21} /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{stat.label}</p><p className="mt-0.5 text-2xl font-bold text-slate-900">{loading ? "—" : stat.value}</p></div></div>)}
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search product, supplier..." className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#5B13EC]" /></div>
              <button onClick={() => setFilterOpen(true)} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[#5B13EC] bg-white text-[#5B13EC]" aria-label="Open filters"><SlidersHorizontal size={20} /></button>
              <button onClick={exportCsv} disabled={!data.items.length} className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#5B13EC] text-white disabled:opacity-50" aria-label="Export listings"><Download size={20} /></button>
            </div>
            <div className="flex items-center justify-between px-1"><p className="text-sm font-semibold text-slate-800">Listings <span className="font-normal text-slate-500">({data.total})</span></p><button onClick={() => { reset(); refresh(); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><RefreshCw size={13} /> Reset</button></div>
            {error ? <div className="rounded-2xl border border-rose-200 bg-white p-5 text-sm text-rose-700">{error}<button onClick={refresh} className="ml-2 underline">Try again</button></div> : loading ? <div className="flex min-h-40 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><LoaderCircle size={20} className="animate-spin text-[#5B13EC]" /> Loading listings...</div> : data.items.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">No marketplace listings match these filters.</div> : (
              <div className="space-y-3">
                {data.items.map((item) => {
                  const imageSrc = item.imageUrl || item.images?.[0]?.imageUrl;
                  const supplierName = item.supplierProfile?.organization?.name || "Supplier";
                  const statusLabel = item.moderationStatus === "APPROVED" ? "Approved" : item.moderationStatus === "PENDING" ? "Pending" : "Rejected";
                  const statusTone = item.moderationStatus === "APPROVED" ? "bg-emerald-100 text-emerald-700" : item.moderationStatus === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveListing(item); setMobileDetailTab("OVERVIEW"); setShowRejectNote(false); }}
                      className="w-full rounded-2xl border border-[#E5E7F3] bg-white p-2.5 text-left shadow-[0_1px_5px_rgba(30,35,90,0.05)] transition active:bg-slate-50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {imageSrc ? <img src={imageSrc} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400"><Package size={26} /></div>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <h3 className="min-w-0 flex-1 truncate text-[13px] font-extrabold leading-5 text-[#101936]">{item.name}</h3>
                            <span className={"inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold leading-none " + statusTone}>
                              <CheckCircle2 size={11} strokeWidth={2.8} /> {statusLabel}
                            </span>
                            <MoreHorizontal size={18} className="shrink-0 text-[#101936]" />
                          </div>
                          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-[#23345B]">
                            <Store size={12} className="shrink-0" />
                            <span className="truncate">{supplierName}</span>
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-[#F0E5FF] px-2.5 py-1 text-[10px] font-bold leading-none text-[#6415E8]">{item.itemType}</span>
                          </div>
                          {(item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice !== "" || item.moq !== null && item.moq !== undefined) && (
                            <p className="mt-1.5 flex min-w-0 items-center gap-2 text-[11px] font-semibold leading-4 text-[#17264A]">
                              {item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice !== "" && <span className="shrink-0">{formatPrice(item.unitPrice, item.itemType, item.currency)}</span>}
                              {item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice !== "" && item.moq !== null && item.moq !== undefined && <span className="h-3 w-px shrink-0 bg-slate-300" />}
                              {item.moq !== null && item.moq !== undefined && <span className="truncate font-medium">MOQ: {item.moq} {item.itemType.toLowerCase().includes("fabric") ? "m" : "units"}</span>}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-xs text-slate-500"><span>Showing {data.total ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total}</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button><span className="font-semibold text-slate-700">{page}/{data.pages}</span><button disabled={page >= data.pages} onClick={() => setPage((p) => Math.min(data.pages, p + 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button></div></div>
          </>
        )}
      </div>

      {filterOpen && !activeListing && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-[#F6F7FA] md:hidden">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4"><h2 className="text-lg font-bold text-slate-900">Filters</h2><button onClick={() => setFilterOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-600" aria-label="Close filters"><X size={21} /></button></header>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <label className="block rounded-2xl border border-slate-200 bg-white p-4"><span className="mb-2 block text-sm font-bold text-slate-900">Category</span><select value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="ALL">All Categories</option>{data.categories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="block rounded-2xl border border-slate-200 bg-white p-4"><span className="mb-2 block text-sm font-bold text-slate-900">Approval Status</span><select value={tab} onChange={(e) => setTab(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
            <label className="block rounded-2xl border border-slate-200 bg-white p-4"><span className="mb-2 block text-sm font-bold text-slate-900">Submitted Date</span><select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="ALL">All Time</option><option value="7D">Last 7 Days</option><option value="30D">Last 30 Days</option><option value="90D">Last 90 Days</option></select></label>
          </div>
          <div className="flex gap-3 border-t border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><button onClick={() => { setCategory("ALL"); setTab("ALL"); setDateRange("ALL"); setPage(1); }} className="h-12 flex-1 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">Reset</button><button onClick={() => { setPage(1); setFilterOpen(false); }} className="h-12 flex-1 rounded-xl bg-[#5B13EC] text-sm font-semibold text-white">Apply Filters</button></div>
        </div>
      )}

      <div className="hidden md:block">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Marketplace</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review, approve and manage product, fabric and trim listings submitted by suppliers.
        </p>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Card 1: Total Listings */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#F3EFFC] text-[#5B13EC]">
            <Layers3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Listings</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.total}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +12%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">All product & fabric listings</p>
          </div>
        </div>

        {/* Card 2: Pending Approval */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FFFBEB] text-[#D97706]">
            <Clock3 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approval</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.pending}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Under review by admin</p>
          </div>
        </div>

        {/* Card 3: Approved Listings */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#ECFDF5] text-[#059669]">
            <CheckCircle2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Listings</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.approved}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <ArrowUp size={11} /> +15%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Live on platform</p>
          </div>
        </div>

        {/* Card 4: Rejected Listings */}
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition hover:shadow-sm">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
            <XCircle size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejected Listings</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">
                {loading ? "—" : data.stats.rejected}
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
              const active = tab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setTab(t.value);
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
            disabled={!data.items.length}
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
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by product name or supplier..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs outline-none transition focus:border-[#5B13EC]"
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Category: All</option>
            {data.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={tab}
            onChange={(e) => {
              setTab(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Status: All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none"
          >
            <option value="ALL">Date Added: All Time</option>
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
            <RefreshCw size={14} /> Reset
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
            <LoaderCircle size={20} className="animate-spin text-[#5B13EC]" /> Loading marketplace listings...
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-500">
            No marketplace items match the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-xs">
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
                  <th className="px-4 py-3.5">Product / Listing</th>
                  <th className="px-4 py-3.5">Supplier</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Price</th>
                  <th className="px-4 py-3.5">Stock / MOQ</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Added On</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.items.map((item) => {
                  const supplierOrg = item.supplierProfile?.organization;
                  const isChecked = selectedIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`transition hover:bg-[#FAF9FE] ${isChecked ? "bg-[#FAF8FF]" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          {isChecked ? (
                            <CheckSquare size={16} className="text-[#5B13EC]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                      </td>

                      {/* Product Name */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-900 block max-w-[200px] truncate">
                          {item.name}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EBE4FF] text-xs font-bold text-[#5B13EC]">
                            {(supplierOrg?.name || "S").slice(0, 1).toUpperCase()}
                          </span>
                          {supplierOrg?.id ? (
                            <Link
                              href={`/admin/verification/${supplierOrg.id}`}
                              className="truncate max-w-[150px] font-semibold text-slate-700 hover:text-[#5B13EC] hover:underline"
                              title="View supplier business profile"
                            >
                              {supplierOrg.name || "Verified Mill"}
                            </Link>
                          ) : (
                            <span className="truncate max-w-[150px] font-semibold text-slate-700">
                              {supplierOrg?.name || "Verified Mill"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-1 text-[11px] font-bold text-[#5B13EC]">
                          {item.itemType}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3.5 font-bold font-mono text-slate-900">
                        {item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice !== "" ? formatPrice(item.unitPrice, item.itemType, item.currency) : null}
                      </td>

                      {/* Stock / MOQ */}
                      <td className="px-4 py-3.5">
                        {item.moq !== null && item.moq !== undefined ? (
                          <span className="font-bold text-slate-800">
                            MOQ: {item.moq} {item.itemType.toLowerCase().includes("fabric") ? "m" : "units"}
                          </span>
                        ) : null}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        {item.moderationStatus === "APPROVED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200/60">
                            <CheckCircle2 size={11} /> Approved
                          </span>
                        ) : item.moderationStatus === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 border border-amber-200/60">
                            <Clock3 size={11} /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-200/60">
                            <XCircle size={11} /> Rejected
                          </span>
                        )}
                      </td>

                      {/* Added On */}
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">
                        {new Date(item.createdAt).toLocaleDateString("en-US")}
                      </td>

                      {/* Actions */}
                      <td className="relative px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setActiveListing(item)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                          >
                            Review
                          </button>

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
            Showing {data.total ? (page - 1) * PAGE_SIZE + 1 : 0}–
            {Math.min(page * PAGE_SIZE, data.total)} of {data.total} listings
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
      </div>

      {/* Review Modal */}
      {activeListing && (
        <div
          className="fixed inset-0 z-[90] hidden items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 md:flex"
          onClick={() => setActiveListing(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Product Moderation</h2>
                <p className="mt-0.5 text-xs text-slate-500">Quality and compliance review</p>
              </div>
              <button
                onClick={() => setActiveListing(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <span className="inline-flex rounded-full bg-[#EBE4FF] px-2.5 py-0.5 text-[11px] font-bold text-[#5B13EC]">
                  {activeListing.itemType}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{activeListing.name}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {activeListing.description || "No detailed description provided by supplier."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Price:</span>
                  <p className="font-bold text-slate-900 font-mono">
                    {formatPrice(activeListing.unitPrice, activeListing.itemType, activeListing.currency)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Minimum Order Qty:</span>
                  <p className="font-bold text-slate-900">{activeListing.moq || 100} units</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Supplier Mill:</span>
                  <p className="font-bold text-slate-900">
                    {activeListing.supplierProfile?.organization?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Status:</span>
                  <p className="font-bold text-slate-900">{activeListing.moderationStatus}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setActiveListing(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  disabled={moderating}
                  onClick={() => {
                    const note = window.prompt("Reason for rejecting this listing (optional):");
                    if (note !== null) moderateListing("REJECTED", note);
                  }}
                  className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  disabled={moderating || activeListing.moderationStatus === "APPROVED"}
                  onClick={() => moderateListing("APPROVED")}
                  className="rounded-xl bg-[#5B13EC] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {moderating ? "Saving..." : "Approve"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
