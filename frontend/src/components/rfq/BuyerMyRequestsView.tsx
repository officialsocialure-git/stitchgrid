"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Rfq } from "@/types";
import { marketplaceService } from "@/services/marketplace.service";
import { API_BASE_URL } from "@/constants";

type Props = {
  rfqs: Rfq[];
  loading: boolean;
  organizationId?: string;
  onPostRequest: () => void;
  onOpenDetails: (rfq: Rfq) => void;
  onInviteSuppliers: (rfq: Rfq) => void;
  onDelete: (rfq: Rfq) => void;
};

type StatusTab = "ALL" | "OPEN" | "QUOTED" | "CLOSED";
type SortOption = "NEWEST" | "OLDEST" | "QTY_DESC" | "QTY_ASC";

const isFinalRfq = (rfq: Rfq) =>
  ["CLOSED", "CANCELLED", "AWARDED"].includes(rfq.status);

const formatDate = (value?: string | Date) => {
  if (!value) return "Flexible";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Flexible"
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const formatRfqId = (id: string) => `RFQ #RFQ-${id.slice(-4).toUpperCase()}`;

export function BuyerMyRequestsView({
  rfqs,
  loading,
  organizationId,
  onPostRequest,
  onOpenDetails,
  onInviteSuppliers,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<StatusTab>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    marketplaceService.listBusinessMedia(organizationId)
      .then((items) => {
        if (cancelled) return;
        const cover = items.find((item: any) => item.mediaType === "COVER_PHOTO");
        if (cover?.url) setBannerUrl(cover.url);
      })
      .catch((error) => console.error("Failed to load RFQ banner:", error));
    return () => { cancelled = true; };
  }, [organizationId]);

  useEffect(() => {
    const closeMenu = () => setActiveMenuId(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const counts = useMemo(() => ({
    all: rfqs.length,
    open: rfqs.filter((rfq) => rfq.status === "OPEN" && !(rfq.quotations?.length)).length,
    quoted: rfqs.filter((rfq) => !isFinalRfq(rfq) && Boolean(rfq.quotations?.length)).length,
    closed: rfqs.filter(isFinalRfq).length,
  }), [rfqs]);

  const visibleRfqs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rfqs.filter((rfq) => {
      const quoteCount = rfq.quotations?.length || 0;
      const final = isFinalRfq(rfq);
      if (activeTab === "OPEN" && (rfq.status !== "OPEN" || quoteCount > 0)) return false;
      if (activeTab === "QUOTED" && (final || quoteCount === 0)) return false;
      if (activeTab === "CLOSED" && !final) return false;
      if (query) {
        const haystack = [rfq.id, rfq.title, rfq.description, rfq.garmentType]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === "OLDEST") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "QTY_DESC") return (b.targetQuantity || 0) - (a.targetQuantity || 0);
      if (sortBy === "QTY_ASC") return (a.targetQuantity || 0) - (b.targetQuantity || 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rfqs, search, activeTab, sortBy]);

  const handleBannerUpload = async (file?: File) => {
    if (!file || !organizationId) return;
    if (!file.type.startsWith("image/")) {
      setBannerError("Please choose an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setBannerError("Banner image must be 10 MB or less.");
      return;
    }

    setUploadingBanner(true);
    setBannerError("");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image."));
        reader.onerror = () => reject(new Error("Could not read image."));
        reader.readAsDataURL(file);
      });
      const uploaded = await marketplaceService.uploadFile(file.name, dataUrl, "COVER_PHOTO");
      const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
      const uploadedUrl = uploaded.url.startsWith("http") ? uploaded.url : `${apiOrigin}${uploaded.url}`;
      const saved = await marketplaceService.createBusinessMedia({
        organizationId,
        mediaType: "COVER_PHOTO",
        url: uploadedUrl,
        fileName: file.name,
      });
      setBannerUrl(saved.url || uploadedUrl);
    } catch (error: any) {
      setBannerError(error?.message || "Banner upload failed. Please try again.");
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-8">
      <section
        className="relative isolate flex min-h-[260px] flex-col justify-center overflow-hidden rounded-[28px] border border-violet-100 bg-[#f5efff] bg-cover bg-center px-5 py-6 shadow-sm sm:min-h-[280px] sm:px-8"
        style={bannerUrl ? {
          backgroundImage: `linear-gradient(90deg, rgba(250,247,255,.96) 0%, rgba(250,247,255,.86) 48%, rgba(250,247,255,.18) 100%), url("${bannerUrl}")`,
        } : {
          backgroundImage: "radial-gradient(circle at 82% 22%, rgba(190,145,255,.42), transparent 28%), linear-gradient(115deg, #fbf9ff 0%, #f1e8ff 100%)",
        }}
      >
        <div className="relative z-10 max-w-[610px]">
          <h1 className="text-[30px] font-extrabold leading-tight tracking-tight text-slate-950 sm:text-4xl">
            My Requests
          </h1>
          <p className="mt-2 max-w-[540px] text-[15px] leading-6 text-slate-700 sm:text-lg">
            Create RFQs, compare supplier quotes and place orders.
          </p>
          <button
            type="button"
            onClick={onPostRequest}
            className="mt-6 inline-flex min-h-14 w-full max-w-[440px] items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#6500ed] to-[#4f00ce] px-6 py-3 text-lg font-extrabold text-white shadow-lg shadow-violet-300/50 transition hover:brightness-105 active:scale-[.99] sm:text-xl"
          >
            <span className="material-symbols-outlined text-[28px]">add</span>
            Post New RFQ
          </button>
        </div>

        <div className="absolute right-3 top-3 z-20">
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(event) => handleBannerUpload(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploadingBanner || !organizationId}
            onClick={() => bannerInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/90 px-3 py-2 text-[11px] font-bold text-violet-800 shadow-sm backdrop-blur transition hover:bg-white disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">{uploadingBanner ? "progress_activity" : "add_photo_alternate"}</span>
            {uploadingBanner ? "Uploading..." : bannerUrl ? "Change Banner" : "Upload Banner"}
          </button>
        </div>
        {bannerError && (
          <p className="absolute bottom-2 right-3 z-20 rounded-lg bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-rose-600 shadow">
            {bannerError}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-stretch gap-2.5">
          <label className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[23px] text-slate-500">search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by RFQ ID, product or supplier..."
              className="h-[58px] w-full rounded-full border border-violet-100 bg-white pl-12 pr-4 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:text-base"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            aria-expanded={filtersOpen}
            className={`inline-flex h-[58px] shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold shadow-sm transition sm:px-6 sm:text-base ${filtersOpen ? "border-violet-500 bg-violet-50 text-violet-800" : "border-violet-200 bg-white text-slate-900"}`}
          >
            <span className="material-symbols-outlined text-[24px] text-violet-700">tune</span>
            <span className="hidden min-[390px]:inline">Filter</span>
          </button>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-1 gap-2 rounded-2xl border border-violet-100 bg-white p-3 shadow-sm sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-600">
              Status
              <select value={activeTab} onChange={(event) => setActiveTab(event.target.value as StatusTab)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-400">
                <option value="ALL">All Requests ({counts.all})</option>
                <option value="OPEN">Open ({counts.open})</option>
                <option value="QUOTED">Quotes Received ({counts.quoted})</option>
                <option value="CLOSED">Closed / Completed ({counts.closed})</option>
              </select>
            </label>
            <label className="text-xs font-bold text-slate-600">
              Sort By
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-violet-400">
                <option value="NEWEST">Newest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="QTY_DESC">Quantity: High to Low</option>
                <option value="QTY_ASC">Quantity: Low to High</option>
              </select>
            </label>
          </div>
        )}
      </section>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((item) => <div key={item} className="h-52 animate-pulse rounded-[26px] border border-violet-100 bg-white" />)}
        </div>
      ) : visibleRfqs.length === 0 ? (
        <div className="rounded-[26px] border border-dashed border-violet-200 bg-white px-5 py-12 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-violet-400">inventory_2</span>
          <h2 className="mt-2 text-lg font-extrabold text-slate-900">No requests found</h2>
          <p className="mt-1 text-sm text-slate-500">Try changing your search or post a new RFQ.</p>
          <button onClick={onPostRequest} className="mt-4 rounded-full bg-violet-700 px-6 py-2.5 text-sm font-bold text-white">Post New RFQ</button>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRfqs.map((rfq) => {
            const quoteCount = rfq.quotations?.length || 0;
            const final = isFinalRfq(rfq);
            const canCompare = quoteCount > 0 && !final;
            const unit = rfq.items?.[0]?.unit || "pieces";
            const productImage = rfq.sampleImageUrl;
            const statusLabel = final ? (rfq.status === "AWARDED" ? "Awarded" : "Closed") : quoteCount > 0 ? "Quotes Received" : rfq.status === "DRAFT" ? "Draft" : "Open";
            const statusClass = final ? "bg-slate-100 text-slate-600" : quoteCount > 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800";

            return (
              <article key={rfq.id} className="relative rounded-[26px] border border-violet-100 bg-white p-3.5 shadow-[0_4px_16px_rgba(39,20,80,0.08)] sm:p-5">
                <div className="flex gap-3.5 sm:gap-5">
                  <div className="h-[132px] w-[112px] shrink-0 overflow-hidden rounded-[20px] bg-[#f3f0f7] sm:h-[164px] sm:w-[150px]">
                    {productImage ? (
                      <img src={productImage} alt={rfq.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-violet-300">
                        <span className="material-symbols-outlined text-4xl">image</span>
                        <span className="px-2 text-center text-[10px] font-semibold text-slate-400">Product image</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <span className="inline-flex max-w-full truncate rounded-full bg-[#f1e7ff] px-3 py-1.5 text-[11px] font-extrabold text-violet-800 sm:text-sm">
                        {formatRfqId(rfq.id)}
                      </span>
                      <div className="relative flex shrink-0 items-center gap-1">
                        <span className={`rounded-full px-2.5 py-1.5 text-[10px] font-bold sm:text-xs ${statusClass}`}>{statusLabel}</span>
                        <button type="button" aria-label="Request options" onClick={(event) => { event.stopPropagation(); setActiveMenuId(activeMenuId === rfq.id ? null : rfq.id); }} className="rounded-full p-1 text-slate-500 hover:bg-slate-100">
                          <span className="material-symbols-outlined text-[19px]">more_vert</span>
                        </button>
                        {activeMenuId === rfq.id && (
                          <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-8 z-30 w-44 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 text-xs font-semibold text-slate-700 shadow-xl">
                            <button onClick={() => { setActiveMenuId(null); onOpenDetails(rfq); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-violet-50"><span className="material-symbols-outlined text-base">visibility</span>View Details</button>
                            {!final && <button onClick={() => { setActiveMenuId(null); onInviteSuppliers(rfq); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-violet-50"><span className="material-symbols-outlined text-base">person_add</span>Invite Suppliers</button>}
                            <button onClick={() => { setActiveMenuId(null); onDelete(rfq); }} className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-rose-600 hover:bg-rose-50"><span className="material-symbols-outlined text-base">delete</span>Delete Request</button>
                          </div>
                        )}
                      </div>
                    </div>

                    <h2 className="mt-2 line-clamp-2 text-[16px] font-extrabold leading-tight text-slate-950 sm:text-xl">{rfq.title}</h2>
                    <div className="mt-3 space-y-2 text-[12px] text-slate-600 sm:text-sm">
                      <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[19px] text-slate-500">layers</span><span>Qty: {rfq.targetQuantity?.toLocaleString("en-IN")} {unit}</span></div>
                      <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[19px] text-slate-500">calendar_month</span><span>Delivery: {formatDate(rfq.targetDate)}</span></div>
                    </div>
                    {quoteCount > 0 && <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600 sm:text-sm"><span className="material-symbols-outlined text-[18px] text-slate-500">description</span>Quotes: {quoteCount}</div>}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {canCompare ? (
                    <>
                      <Link href={`/quotations?rfqId=${rfq.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-violet-700 bg-white px-3 text-sm font-extrabold text-violet-800 transition hover:bg-violet-50">
                        <span className="material-symbols-outlined text-xl">compare_arrows</span>
                        Compare Quotes
                      </Link>
                      <Link href={`/quotations?rfqId=${rfq.id}`} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#6500ed] to-[#4f00ce] px-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-105">
                        <span className="material-symbols-outlined text-xl">visibility</span>
                        View Quotes ({quoteCount})
                      </Link>
                    </>
                  ) : (
                    <button type="button" onClick={() => onOpenDetails(rfq)} className="col-span-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-2 border-violet-700 bg-white px-3 text-sm font-extrabold text-violet-800 transition hover:bg-violet-50 sm:col-span-2">
                      <span className="material-symbols-outlined text-xl">visibility</span>
                      View Details
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
