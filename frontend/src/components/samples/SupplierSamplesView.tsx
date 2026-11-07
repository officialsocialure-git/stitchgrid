"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { marketplaceService } from "@/services/marketplace.service";

export type SupplierSampleTab = "All" | "To Make" | "Sent" | "Waiting for Buyer" | "Approved";

export interface SupplierSampleItem {
  id: string;
  productName: string;
  buyerName: string;
  orderId: string;
  sampleType: string;
  quantity: string;
  dueDate: string;
  rawDate: Date;
  status: "To Make" | "Sent" | "Waiting for Buyer" | "Approved";
  fabric: string;
  color: string;
  sizes: string;
  finish: string;
  buyerNote: string;
  rawSample: any;
  photos: { url: string; label: string }[];
}

interface SupplierSamplesViewProps {
  samples: SupplierSampleItem[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

export function SupplierSamplesView({
  samples,
  loading,
  onRefresh,
}: SupplierSamplesViewProps) {
  // Navigation: LIST view vs DETAILS view
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);

  // Tabs & Filters in LIST view
  const [activeTab, setActiveTab] = useState<SupplierSampleTab>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sampleTypeFilter, setSampleTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "dueDate">("newest");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [draftActiveTab, setDraftActiveTab] = useState<SupplierSampleTab>("All");
  const [draftSampleType, setDraftSampleType] = useState("All");
  const [draftSortBy, setDraftSortBy] = useState<"newest" | "oldest" | "dueDate">("newest");

  // State in DETAILS view
  const [activeDetailsTab, setActiveDetailsTab] = useState<
    "PHOTOS" | "DETAILS" | "BUYER_NOTE" | "FILES" | "HISTORY"
  >("PHOTOS");
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [localPhotos, setLocalPhotos] = useState<{ url: string; label: string }[]>([]);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tab Counts
  const counts = useMemo(() => {
    return {
      All: samples.length,
      "To Make": samples.filter((s) => s.status === "To Make").length,
      Sent: samples.filter((s) => s.status === "Sent").length,
      "Waiting for Buyer": samples.filter((s) => s.status === "Waiting for Buyer").length,
      Approved: samples.filter((s) => s.status === "Approved").length,
    };
  }, [samples]);

  // Filtered & Sorted Samples
  const filteredSamples = useMemo(() => {
    return samples
      .filter((s) => {
        // Tab filter
        if (activeTab !== "All" && s.status !== activeTab) return false;

        // Sample Type dropdown filter
        if (
          sampleTypeFilter !== "All" &&
          !s.sampleType.toLowerCase().includes(sampleTypeFilter.toLowerCase())
        ) {
          return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            s.productName.toLowerCase().includes(q) ||
            s.buyerName.toLowerCase().includes(q) ||
            s.orderId.toLowerCase().includes(q) ||
            s.sampleType.toLowerCase().includes(q) ||
            s.fabric.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          return a.rawDate.getTime() - b.rawDate.getTime();
        }
        if (sortBy === "dueDate") {
          return a.dueDate.localeCompare(b.dueDate);
        }
        return b.rawDate.getTime() - a.rawDate.getTime();
      });
  }, [samples, activeTab, sampleTypeFilter, searchQuery, sortBy]);

  // Selected Sample object for Details view
  const selectedSample = useMemo(() => {
    return samples.find((s) => s.id === selectedSampleId) || null;
  }, [samples, selectedSampleId]);

  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  useEffect(() => {
    if (!isFilterOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFilterOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen]);

  const openFilters = () => {
    setDraftActiveTab(activeTab);
    setDraftSampleType(sampleTypeFilter);
    setDraftSortBy(sortBy);
    setIsFilterOpen(true);
  };

  const applyFilters = () => {
    setActiveTab(draftActiveTab);
    setSampleTypeFilter(draftSampleType);
    setSortBy(draftSortBy);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftActiveTab("All");
    setDraftSampleType("All");
    setDraftSortBy("newest");
  };

  // Synchronize local photos when entering Details view
  const handleOpenDetails = (sample: SupplierSampleItem) => {
    setSelectedSampleId(sample.id);
    setActiveDetailsTab("PHOTOS");
    setActivePhotoIndex(0);
    setLocalPhotos(
      sample.photos && sample.photos.length > 0
        ? [...sample.photos]
        : []
    );
  };

  // Quick Action: Mark Ready on List row
  const handleMarkReady = async (sampleId: string) => {
    try {
      setSubmittingAction(true);
      await marketplaceService.updateSample(sampleId, "DISPATCHED", {
        notes: "Sample marked as ready and dispatched to buyer."
      });
      setActionSuccessMsg("Sample marked as ready and dispatched to buyer!");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await onRefresh();
    } catch (err: any) {
      console.error("Failed to mark sample as ready:", err);
      alert(err?.message || "Failed to update sample.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Action: Save as Draft
  const handleSaveDraft = async () => {
    if (!selectedSample) return;
    try {
      setSubmittingAction(true);
      await marketplaceService.updateSample(selectedSample.id, undefined, {
        photos: localPhotos,
        notes: `Sample draft photos (${localPhotos.length} views) saved.`,
      });
      setActionSuccessMsg("Draft saved successfully with updated sample photos!");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await onRefresh();
    } catch (err: any) {
      console.error("Failed to save draft:", err);
      alert(err?.message || "Failed to save draft.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Action: Submit to Buyer in Details view
  const handleSubmitToBuyer = async () => {
    if (!selectedSample) return;
    try {
      setSubmittingAction(true);
      await marketplaceService.updateSample(selectedSample.id, "DISPATCHED", {
        photos: localPhotos,
        notes: `Sample prototype (${localPhotos.length} photos) submitted to buyer for approval.`,
      });
      setActionSuccessMsg("Sample prototype and photos submitted to buyer for approval!");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await onRefresh();
    } catch (err: any) {
      console.error("Failed to submit sample:", err);
      alert(err?.message || "Failed to submit sample.");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Delete a photo from the local list
  const handleDeletePhoto = (idxToDelete: number) => {
    setLocalPhotos((prev) => {
      const next = prev.filter((_, i) => i !== idxToDelete);
      if (activePhotoIndex >= next.length) {
        setActivePhotoIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
    setActionSuccessMsg("Photo removed. Click 'Save as Draft' or 'Submit to Buyer' to persist changes.");
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  // Upload handler for photos (real persistent upload to backend)
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const labels = ["Front View", "Back View", "Fabric Texture", "Close-up", "Stitching Detail", "Neckline", "Label / Wash Care"];
    setUploadingPhotos(true);

    try {
      const fileArr = Array.from(files);
      const uploaded: { url: string; label: string }[] = [];

      for (let idx = 0; idx < fileArr.length; idx++) {
        const file = fileArr[idx];
        const label = labels[(localPhotos.length + idx) % labels.length];

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await marketplaceService.uploadFile(file.name, dataUrl, label);
        if (res?.url) {
          uploaded.push({ url: res.url, label: res.label || label });
        }
      }

      setLocalPhotos((prev) => [...prev, ...uploaded]);
      setActionSuccessMsg(`${fileArr.length} photo(s) uploaded! Click 'Save as Draft' or 'Submit to Buyer' to save.`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Photo upload error:", err);
      alert(err?.message || "Failed to upload photo(s).");
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: SupplierSampleItem["status"]) => {
    switch (status) {
      case "To Make":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-800 border border-amber-200 shadow-2xs">
            To Make
          </span>
        );
      case "Sent":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
            Sent
          </span>
        );
      case "Waiting for Buyer":
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#f4effc] text-[#5B13EC] border border-purple-200 shadow-2xs">
            Waiting for Buyer
          </span>
        );
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
            <span className="material-symbols-outlined text-[13px]">check</span>
            <span>Approved</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // =========================================================================
  // VIEW MODE 2: SAMPLE DETAILS PAGE (Opened on "View Details")
  // =========================================================================
  if (selectedSample) {
    const activePhoto = localPhotos[activePhotoIndex] || localPhotos[0] || {
      url: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80",
      label: "Sample View",
    };

    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
        {/* Success Alert */}
        {actionSuccessMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Top Header: ← Sample Details and Status Badge */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setSelectedSampleId(null)}
            className="inline-flex items-center gap-2 font-sans font-extrabold text-xl sm:text-2xl text-slate-900 hover:text-[#5B13EC] transition-colors group"
          >
            <span className="material-symbols-outlined text-[24px] text-slate-600 group-hover:text-[#5B13EC] transition-transform group-hover:-translate-x-1">
              arrow_back
            </span>
            <span>Sample Details</span>
          </button>

          <div>{renderStatusBadge(selectedSample.status)}</div>
        </div>

        {/* Split Columns Layout (Matches Reference Image Bottom Half) */}
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* ------------------------------------------------------------- */}
          {/* Main / Left Column (Hero Card + Tabs + Upload Zone + Actions)  */}
          {/* ------------------------------------------------------------- */}
          <div className="flex-1 min-w-0 w-full space-y-5">
            {/* Top Card: Image Carousel & Product Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Image Carousel / Viewer */}
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 group">
                <img
                  src={activePhoto.url}
                  alt={selectedSample.productName}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Prev Arrow */}
                {localPhotos.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : localPhotos.length - 1));
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 shadow-md flex items-center justify-center hover:bg-white transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                )}

                {/* Next Arrow */}
                {localPhotos.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePhotoIndex((prev) => (prev < localPhotos.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 text-slate-700 shadow-md flex items-center justify-center hover:bg-white transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                )}

                {/* Photo Angle Tag */}
                <div className="absolute bottom-2 left-2 right-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold text-center truncate">
                  {activePhoto.label} ({activePhotoIndex + 1}/{localPhotos.length})
                </div>
              </div>

              {/* Product Info & Specs */}
              <div className="flex-1 min-w-0 space-y-3">
                <h2 className="font-sans font-extrabold text-xl sm:text-2xl text-slate-900 leading-tight">
                  {selectedSample.productName}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">business</span>
                    <span>
                      Buyer: <strong className="font-semibold text-slate-800">{selectedSample.buyerName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">inventory_2</span>
                    <span>
                      Quantity: <strong className="font-semibold text-slate-800">{selectedSample.quantity}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">receipt_long</span>
                    <span>
                      Order ID: <strong className="font-bold text-slate-800">{selectedSample.orderId}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">calendar_today</span>
                    <span>
                      Due Date: <strong className="font-semibold text-slate-800">{selectedSample.dueDate}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">label</span>
                    <span>
                      Sample Type: <strong className="font-semibold text-slate-800">{selectedSample.sampleType}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs Row under Hero Card */}
            <div className="border-b border-slate-200">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm">
                <button
                  type="button"
                  onClick={() => setActiveDetailsTab("PHOTOS")}
                  className={`pb-2.5 font-bold transition-all border-b-2 whitespace-nowrap ${
                    activeDetailsTab === "PHOTOS"
                      ? "text-[#5B13EC] border-[#5B13EC]"
                      : "text-slate-500 hover:text-slate-800 border-transparent"
                  }`}
                >
                  Sample Photos
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailsTab("DETAILS")}
                  className={`pb-2.5 font-semibold transition-all border-b-2 whitespace-nowrap ${
                    activeDetailsTab === "DETAILS"
                      ? "text-[#5B13EC] border-[#5B13EC]"
                      : "text-slate-500 hover:text-slate-800 border-transparent"
                  }`}
                >
                  Details
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailsTab("BUYER_NOTE")}
                  className={`pb-2.5 font-semibold transition-all border-b-2 whitespace-nowrap ${
                    activeDetailsTab === "BUYER_NOTE"
                      ? "text-[#5B13EC] border-[#5B13EC]"
                      : "text-slate-500 hover:text-slate-800 border-transparent"
                  }`}
                >
                  Buyer Note
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailsTab("FILES")}
                  className={`pb-2.5 font-semibold transition-all border-b-2 whitespace-nowrap ${
                    activeDetailsTab === "FILES"
                      ? "text-[#5B13EC] border-[#5B13EC]"
                      : "text-slate-500 hover:text-slate-800 border-transparent"
                  }`}
                >
                  Files (1)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDetailsTab("HISTORY")}
                  className={`pb-2.5 font-semibold transition-all border-b-2 whitespace-nowrap ${
                    activeDetailsTab === "HISTORY"
                      ? "text-[#5B13EC] border-[#5B13EC]"
                      : "text-slate-500 hover:text-slate-800 border-transparent"
                  }`}
                >
                  History
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: Sample Photos & Upload Box */}
            {activeDetailsTab === "PHOTOS" && (
              <div className="space-y-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
                <div>
                  <h3 className="font-sans font-extrabold text-base text-slate-900">Upload Sample Photos</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Add clear photos of the sample (front, back, fabric, close-up, etc.).
                  </p>
                </div>

                {/* Drag & Drop Upload Zone (Matches Reference Image) */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-purple-200 hover:border-[#5B13EC] rounded-2xl p-6 sm:p-8 text-center bg-purple-50/20 hover:bg-purple-50/40 transition-all cursor-pointer flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-[#5B13EC] flex items-center justify-center shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">cloud_upload</span>
                  </div>

                  <p className="font-bold text-xs sm:text-sm text-slate-800">
                    Drag &amp; drop photos here or click to upload
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    JPG, PNG • Max 10 MB per photo • Up to 10 photos
                  </p>

                  <button
                    type="button"
                    disabled={uploadingPhotos}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-2 px-5 py-2 rounded-xl border border-purple-300 bg-white text-[#5B13EC] hover:bg-purple-50 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {uploadingPhotos ? (
                      <span className="w-4 h-4 border-2 border-[#5B13EC]/30 border-t-[#5B13EC] rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px]">file_upload</span>
                    )}
                    <span>{uploadingPhotos ? "Uploading to Server..." : "Choose Photos"}</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </div>

                {/* Uploaded Photos Thumbnails Grid */}
                {localPhotos.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-center text-xs text-slate-500">
                    No photos uploaded yet. Select files above to preview front, back, fabric and close-up angles.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {localPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        onClick={() => setActivePhotoIndex(idx)}
                        className={`group relative rounded-xl overflow-hidden border cursor-pointer p-1 transition-all ${
                          activePhotoIndex === idx
                            ? "border-[#5B13EC] ring-2 ring-[#5B13EC]/20 bg-purple-50/40"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <img src={photo.url} alt={photo.label} className="w-full h-24 object-cover rounded-lg" />
                        <span className="block text-[10px] font-bold text-slate-700 mt-1 truncate text-center">
                          {photo.label}
                        </span>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(idx);
                          }}
                          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="Delete photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons: Save as Draft & Submit to Buyer (Matches Reference Image) */}
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs sm:text-sm transition-all"
                  >
                    Save as Draft
                  </button>

                  <button
                    type="button"
                    disabled={submittingAction}
                    onClick={handleSubmitToBuyer}
                    className="w-full sm:w-auto px-7 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    <span>{submittingAction ? "Submitting..." : "Submit to Buyer"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: Details */}
            {activeDetailsTab === "DETAILS" && (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4 text-xs">
                <h3 className="font-sans font-extrabold text-base text-slate-900">Technical Specifications</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Yarn Composition</span>
                    <p className="font-bold text-slate-800">100% Combed Compact Cotton (32s count)</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Fabric Weight (GSM)</span>
                    <p className="font-bold text-slate-800">{selectedSample.fabric}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Dyeing &amp; Fastness</span>
                    <p className="font-bold text-slate-800">Reactive Soft Flow Dyeing • Grade 4+ Wash Fastness</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Stitching Specs</span>
                    <p className="font-bold text-slate-800">4-thread overlock seam with neck binding</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: Buyer Note */}
            {activeDetailsTab === "BUYER_NOTE" && (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                <h3 className="font-sans font-extrabold text-base text-slate-900">Buyer Instructions &amp; Notes</h3>
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 text-xs sm:text-sm text-slate-800 space-y-2">
                  <p className="leading-relaxed font-medium">
                    &ldquo;{selectedSample.buyerNote}&rdquo;
                  </p>
                  <span className="text-[11px] text-slate-500 block">Received: 5 Nov 2026</span>
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: Files */}
            {activeDetailsTab === "FILES" && (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                <h3 className="font-sans font-extrabold text-base text-slate-900">Attached Tech Pack &amp; Files</h3>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">
                      PDF
                    </div>
                    <div>
                      <span className="font-bold text-xs sm:text-sm text-slate-900 block">Hoodie_TechPack_v2.pdf</span>
                      <span className="text-[11px] text-slate-500">2.4 MB • Updated 5 Nov 2026</span>
                    </div>
                  </div>
                  <a
                    href="#download"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Tech Pack file ready for download.");
                    }}
                    className="p-2 text-slate-500 hover:text-[#5B13EC] hover:bg-white rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">download</span>
                  </a>
                </div>
              </div>
            )}

            {/* TAB CONTENT 5: History */}
            {activeDetailsTab === "HISTORY" && (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                <h3 className="font-sans font-extrabold text-base text-slate-900">Sample Activity History</h3>
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 text-xs">
                  <div className="relative">
                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-[#5B13EC] ring-4 ring-purple-100"></div>
                    <span className="font-bold text-slate-900 block">Sample Requested by Buyer</span>
                    <span className="text-slate-500 text-[11px]">5 Nov 2026</span>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-slate-300"></div>
                    <span className="font-bold text-slate-800 block">Factory Fabric Allocated &amp; Knitted</span>
                    <span className="text-slate-500 text-[11px]">7 Nov 2026</span>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-6 top-0.5 w-4 h-4 rounded-full bg-slate-300"></div>
                    <span className="font-bold text-slate-800 block">Pre-Production Cut &amp; Sew Initiated</span>
                    <span className="text-slate-500 text-[11px]">10 Nov 2026</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* Right Column: Sample Information Card (Matches Reference Image) */}
          {/* ------------------------------------------------------------- */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs">
            <h3 className="font-sans font-extrabold text-base text-slate-900 pb-3 border-b border-slate-100">
              Sample Information
            </h3>

            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Product</span>
                <strong className="font-semibold text-slate-800 text-right truncate max-w-[180px]">
                  {selectedSample.productName}
                </strong>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Fabric</span>
                <strong className="font-semibold text-slate-800 text-right truncate max-w-[180px]">
                  {selectedSample.fabric}
                </strong>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Color</span>
                <strong className="font-semibold text-slate-800">{selectedSample.color}</strong>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Sizes</span>
                <strong className="font-semibold text-slate-800">{selectedSample.sizes}</strong>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Finish</span>
                <strong className="font-semibold text-slate-800">{selectedSample.finish}</strong>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Quantity</span>
                <strong className="font-semibold text-slate-800">{selectedSample.quantity}</strong>
              </div>

              <div className="py-2.5 flex items-center justify-between font-mono">
                <span className="text-slate-500 font-medium">Order ID</span>
                <strong className="font-bold text-slate-800">{selectedSample.orderId}</strong>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Sample Type</span>
                <strong className="font-semibold text-slate-800">{selectedSample.sampleType}</strong>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Due Date</span>
                <strong className="font-semibold text-slate-800">{selectedSample.dueDate}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE 1: SAMPLES LIST VIEW (Matches Reference Image Top Half)
  // =========================================================================
  const tabsList: SupplierSampleTab[] = ["All", "To Make", "Sent", "Waiting for Buyer", "Approved"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Success Notification Banner */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-sans font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
          Samples
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage all sample requests from buyers.
        </p>
      </div>

      {/* Desktop keeps its existing quick filters; mobile uses the consolidated filter sheet */}
      <div className="hidden sm:flex flex-wrap items-center gap-2 pb-1">
        {tabsList.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-[#5B13EC] text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {tab} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Search with one filter entry point on mobile */}
      <div className="flex items-center gap-2.5">
        <div className="relative min-w-0 flex-1">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
            search
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by product name, buyer or order ID..."
            aria-label="Search samples"
            className="w-full h-12 pl-10 pr-10 rounded-2xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={openFilters}
          aria-label="Open sample filters"
          aria-haspopup="dialog"
          aria-expanded={isFilterOpen}
          className={`sm:hidden relative h-12 shrink-0 rounded-2xl border px-3.5 flex items-center justify-center gap-2 transition-colors ${
            activeTab !== "All" || sampleTypeFilter !== "All" || sortBy !== "newest"
              ? "border-purple-300 bg-purple-50 text-[#5B13EC]"
              : "border-slate-200 bg-white text-[#5B13EC] hover:bg-purple-50"
          }`}
        >
          <span className="material-symbols-outlined text-[22px]">tune</span>
          <span className="text-sm font-semibold text-slate-800">Filter</span>
          <span className="material-symbols-outlined text-[18px] text-slate-500">expand_more</span>
          {(activeTab !== "All" || sampleTypeFilter !== "All" || sortBy !== "newest") && (
            <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#5B13EC] border-2 border-white" />
          )}
        </button>
        <div className="hidden sm:flex items-center gap-2.5">
          <select
            value={sampleTypeFilter}
            onChange={(e) => setSampleTypeFilter(e.target.value)}
            aria-label="Filter by sample type"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700"
          >
            <option value="All">Sample Type (All)</option>
            <option value="Final Sample">Final Sample</option>
            <option value="First Sample">First Sample</option>
            <option value="Color Sample">Color Sample</option>
            <option value="Lab Dip">Lab Dip</option>
            <option value="Size Set">Size Set</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "dueDate")}
            aria-label="Sort samples"
            className="h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="dueDate">Sort: Due Date</option>
          </select>
        </div>
      </div>

      {/* Filter sheet: mobile bottom sheet */}
      {isFilterOpen && (
        <div
          className="sm:hidden fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/40 backdrop-blur-[2px] p-0"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsFilterOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="supplier-samples-filter-title"
            className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-[28px] sm:rounded-3xl bg-white shadow-2xl border border-slate-200/80 p-5 sm:p-6 animate-fade-in"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300 sm:hidden" />
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 id="supplier-samples-filter-title" className="text-lg font-extrabold text-slate-900">Filter Samples</h2>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                aria-label="Close filters"
                className="h-9 w-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="py-4 space-y-5">
              <fieldset>
                <legend className="mb-2.5 text-sm font-bold text-slate-800">Sample Status</legend>
                <div className="space-y-1">
                  {tabsList.map((tab) => (
                    <label
                      key={tab}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 cursor-pointer transition-colors ${
                        draftActiveTab === tab ? "bg-purple-50 text-[#5B13EC]" : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="supplier-sample-status"
                        value={tab}
                        checked={draftActiveTab === tab}
                        onChange={() => setDraftActiveTab(tab)}
                        className="h-4 w-4 accent-[#5B13EC]"
                      />
                      <span className="flex-1 text-sm font-semibold">{tab}</span>
                      <span className="text-xs text-slate-500">({counts[tab]})</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="supplier-sample-type" className="mb-2 block text-sm font-bold text-slate-800">Sample Type</label>
                <select
                  id="supplier-sample-type"
                  value={draftSampleType}
                  onChange={(e) => setDraftSampleType(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none focus:border-[#5B13EC] focus:ring-2 focus:ring-[#5B13EC]/15"
                >
                  <option value="All">All Sample Types</option>
                  <option value="Final Sample">Final Sample</option>
                  <option value="First Sample">First Sample</option>
                  <option value="Color Sample">Color Sample</option>
                  <option value="Lab Dip">Lab Dip</option>
                  <option value="Size Set">Size Set</option>
                </select>
              </div>

              <div>
                <label htmlFor="supplier-sample-sort" className="mb-2 block text-sm font-bold text-slate-800">Sort By</label>
                <select
                  id="supplier-sample-sort"
                  value={draftSortBy}
                  onChange={(e) => setDraftSortBy(e.target.value as "newest" | "oldest" | "dueDate")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 outline-none focus:border-[#5B13EC] focus:ring-2 focus:ring-[#5B13EC]/15"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="dueDate">Due Date</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={clearFilters}
                className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="h-11 rounded-xl bg-[#5B13EC] text-sm font-bold text-white shadow-sm hover:bg-[#4d0ecf]"
              >
                Apply Filters
              </button>
            </div>
          </section>
        </div>
      )}

      {/* Samples Cards List */}
      {loading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse space-y-3">
              <div className="h-4 w-32 bg-slate-200 rounded"></div>
              <div className="h-5 w-64 bg-slate-200 rounded"></div>
              <div className="h-3 w-48 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      ) : filteredSamples.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#5B13EC] flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[28px]">checkroom</span>
          </div>
          <h3 className="font-bold text-sm text-slate-900">No samples found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            No sample requests match your search or selected status.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveTab("All");
              setSearchQuery("");
              setSampleTypeFilter("All");
            }}
            className="px-4 py-2 rounded-xl bg-purple-50 text-[#5B13EC] font-bold text-xs hover:bg-purple-100 transition-all"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredSamples.map((sample) => (
            <div
              key={sample.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:border-purple-200 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              {/* Left Column: Garment Icon, Product Name, Buyer */}
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-[#f4effc] text-[#5B13EC] flex items-center justify-center shrink-0 border border-purple-100">
                  <span className="material-symbols-outlined text-[26px]">checkroom</span>
                </div>

                <div className="min-w-0 flex-1">
                  <h3
                    onClick={() => handleOpenDetails(sample)}
                    className="font-sans font-extrabold text-base sm:text-lg text-slate-900 truncate hover:text-[#5B13EC] cursor-pointer transition-colors"
                  >
                    {sample.productName}
                  </h3>
                  <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-1">
                    <span className="material-symbols-outlined text-[15px] text-slate-400">business</span>
                    <span>
                      Buyer: <strong className="font-semibold text-slate-800">{sample.buyerName}</strong>
                    </span>
                  </p>
                </div>
              </div>

              {/* Middle Column: Order ID, Sample Type, Quantity, Due Date */}
              <div className="grid w-full min-w-0 grid-cols-2 gap-x-3 sm:gap-x-6 gap-y-1.5 text-xs text-slate-600 md:w-auto md:min-w-[260px] md:shrink-0 md:border-x md:border-slate-100 md:px-6">
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">receipt_long</span>
                  <span>
                    Order ID: <strong className="font-bold text-slate-800">{sample.orderId}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">inventory_2</span>
                  <span>
                    Quantity: <strong className="font-semibold text-slate-800">{sample.quantity}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">label</span>
                  <span>
                    Sample Type: <strong className="font-semibold text-slate-800">{sample.sampleType}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-slate-400">calendar_today</span>
                  <span>
                    Due Date: <strong className="font-semibold text-slate-800">{sample.dueDate}</strong>
                  </span>
                </div>
              </div>

              {/* Right Column: Status Badge & Action Buttons */}
              <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end justify-between gap-3 shrink-0">
                <div>{renderStatusBadge(sample.status)}</div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleOpenDetails(sample)}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-slate-300 text-slate-800 hover:border-[#5B13EC] hover:text-[#5B13EC] font-bold text-xs transition-all shadow-2xs text-center"
                  >
                    View Details
                  </button>

                  {sample.status !== "Approved" && (
                    <button
                      type="button"
                      disabled={submittingAction}
                      onClick={() => handleMarkReady(sample.id)}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-bold text-xs shadow-xs transition-all active:scale-98 text-center disabled:opacity-50"
                    >
                      Mark Ready
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

