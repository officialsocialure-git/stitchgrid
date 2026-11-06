"use client";

import React, { useState } from "react";
import { Modal } from "@/components/common/Modal";

interface SampleDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sample: any;
  onApprove: (sampleId: string) => Promise<void>;
  onAskChanges: (sampleId: string, feedback: string) => Promise<void>;
}

export function SampleDetailsModal({
  isOpen,
  onClose,
  sample,
  onApprove,
  onAskChanges,
}: SampleDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "notes" | "files" | "history">("details");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!sample) return null;

  const po = sample.purchaseOrder || {};
  const supplier = po.supplier || {};
  const item = po.items?.[0] || {};

  // Extract clean name
  let sampleName = item.name || "Apparel Sample";
  if (sampleName.includes("(Cut, Sew")) {
    sampleName = sampleName.split("(")[0].trim();
  }
  if (!sampleName || sampleName === "Apparel Sample" || sampleName === "Apparel Production Lot") {
    if (sample.notes?.includes("Hoodie")) sampleName = "Heavyweight Hoodie";
    else if (sample.notes?.includes("T-Shirt") || sample.notes?.includes("Polo")) sampleName = "Polo T-Shirt";
    else if (sample.notes?.includes("Jogger")) sampleName = "Cotton Joggers";
    else sampleName = "Apparel Production Sample";
  }

  const orderId = po.poNumber ? po.poNumber.replace("SG-", "") : `PO-${sample.purchaseOrderId?.slice(-4) || "6479"}`;
  const supplierName = supplier.name || "Northstar Apparel Works";

  // Derive sample type
  const rawNotes = sample.notes || "";
  let sampleType = sample.parsedMeta?.sampleType || "Final Sample";
  if (rawNotes.toLowerCase().includes("first")) sampleType = "First Sample";
  else if (rawNotes.toLowerCase().includes("color") || rawNotes.toLowerCase().includes("swatch")) sampleType = "Color Sample";
  else if (rawNotes.toLowerCase().includes("lab dip")) sampleType = "Lab Dip";
  else if (rawNotes.toLowerCase().includes("size set")) sampleType = "Size Set";
  else if (rawNotes.toLowerCase().includes("pp") || rawNotes.toLowerCase().includes("pre-production")) sampleType = "Final Sample";

  const quantity = "5 pcs";
  const sentDate = sample.createdAt
    ? new Date(sample.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "5 Nov 2026";

  // Status mapping
  const status = sample.status;
  const isApproved = status === "APPROVED";
  const isChangesNeeded = status === "REVISION_REQUIRED" || status === "REJECTED";
  const isChecking = status === "IN_PROGRESS";

  const statusLabel = isApproved
    ? "Approved"
    : isChangesNeeded
    ? "Changes Needed"
    : isChecking
    ? "Checking"
    : "New Sample";

  const statusBadgeStyle = isApproved
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isChangesNeeded
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : isChecking
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-amber-50 text-amber-800 border-amber-200";

  // Real photos uploaded by supplier (normalized to relative URLs for deployment resilience)
  const rawPhotos: { url: string; label: string }[] =
    Array.isArray(sample.photos) && sample.photos.length > 0
      ? sample.photos
      : sample.parsedMeta?.photos && Array.isArray(sample.parsedMeta.photos) && sample.parsedMeta.photos.length > 0
      ? sample.parsedMeta.photos
      : [];

  const photosList = rawPhotos.map((p) => ({
    ...p,
    url: typeof p.url === "string" ? p.url.replace(/^https?:\/\/localhost:\d+/, "") : p.url,
  }));

  const currentPhoto = photosList[activeImageIndex] || photosList[0] || null;

  const handleNextImage = () => {
    if (photosList.length === 0) return;
    setActiveImageIndex((prev) => (prev + 1) % photosList.length);
  };

  const handlePrevImage = () => {
    if (photosList.length === 0) return;
    setActiveImageIndex((prev) => (prev - 1 + photosList.length) % photosList.length);
  };

  const handleApproveClick = async () => {
    try {
      setSubmitting(true);
      await onApprove(sample.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangesSubmit = async () => {
    if (!feedbackText.trim()) return;
    try {
      setSubmitting(true);
      await onAskChanges(sample.id, feedbackText.trim());
      setIsFeedbackOpen(false);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sample Details"
      className="max-w-3xl"
    >
      <div className="space-y-5 pt-1">
        {/* Top Section: Carousel Left + Info Right (Reference Design 2) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Left: Product Image Carousel & Thumbnails */}
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="relative w-full h-56 rounded-2xl bg-slate-900 border border-slate-200/80 flex items-center justify-center overflow-hidden shadow-xs group">
              {currentPhoto ? (
                <>
                  <img
                    src={currentPhoto.url}
                    alt={currentPhoto.label}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-bold backdrop-blur-xs flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                    <span>{currentPhoto.label}</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 text-center text-slate-300">
                  <span className="material-symbols-outlined text-[48px] text-slate-400">checkroom</span>
                  <span className="text-xs font-semibold mt-2 text-slate-200">Prototype Sample</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Photos pending from supplier</span>
                </div>
              )}

              {/* Prev / Next Carousel Controls */}
              {photosList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-sm flex items-center justify-center transition-transform hover:scale-105"
                    title="Previous photo"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-sm flex items-center justify-center transition-transform hover:scale-105"
                    title="Next photo"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails Below Image */}
            {photosList.length > 0 && (
              <div className="grid grid-cols-4 gap-2 w-full mt-2.5">
                {photosList.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-14 rounded-xl border overflow-hidden p-0.5 transition-all ${
                      activeImageIndex === idx
                        ? "border-[#5B13EC] ring-2 ring-[#5B13EC]/20 shadow-xs"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.label}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Sample Metadata */}
          <div className="md:col-span-7 flex flex-col justify-between h-full pt-1">
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-sans font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">
                  {sampleName}
                </h3>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${statusBadgeStyle}`}>
                  {isApproved && <span className="material-symbols-outlined text-[14px] mr-1">check</span>}
                  {isChangesNeeded && <span className="material-symbols-outlined text-[14px] mr-1">sync</span>}
                  {statusLabel}
                </span>
              </div>

              {/* Metadata rows with icons matching reference */}
              <div className="space-y-2.5 text-xs sm:text-sm text-slate-600">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">factory</span>
                  <span>
                    Supplier: <strong className="font-semibold text-slate-900">{supplierName}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">receipt_long</span>
                  <span>
                    Order ID: <strong className="font-semibold font-mono text-slate-900">{orderId}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">label</span>
                  <span>
                    Sample Type: <strong className="font-semibold text-slate-900">{sampleType}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">inventory_2</span>
                  <span>
                    Quantity: <strong className="font-semibold text-slate-900">{quantity}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">calendar_today</span>
                  <span>
                    Sent on: <strong className="font-semibold text-slate-900">{sentDate}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Pills matching reference design */}
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 pt-2">
          {(["details", "notes", "files", "history"] as const).map((tabKey) => {
            const labels = {
              details: "Details",
              notes: "Supplier Note",
              files: "Files",
              history: "History",
            };
            const isActive = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#5B13EC] text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80"
                }`}
              >
                {labels[tabKey]}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Details */}
        {activeTab === "details" && (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 animate-fade-in">
            {/* Fabric Specifications */}
            <div className="sm:col-span-6 space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Fabric:</span>
                <span className="font-bold text-slate-900">100% Combed Cotton Single Jersey</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Color:</span>
                <span className="font-bold text-slate-900">Beige</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Sizes:</span>
                <span className="font-bold text-slate-900">S, M, L, XL</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 font-medium">Finish:</span>
                <span className="font-bold text-slate-900">Bio-wash &amp; Pre-shrunk</span>
              </div>
            </div>

            {/* Tech Pack Box */}
            <div className="sm:col-span-6 p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
                  Tech Pack
                </span>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-[#5B13EC] text-[22px]">
                      description
                    </span>
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        {sampleName.replace(/\s+/g, "_")}_TechPack.pdf
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">2.4 MB</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => alert(`Downloading Tech Pack for ${sampleName}...`)}
                    className="p-1.5 rounded-lg text-slate-600 hover:text-[#5B13EC] hover:bg-purple-50 transition-colors"
                    title="Download Tech Pack"
                  >
                    <span className="material-symbols-outlined text-[20px]">download</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Supplier Note */}
        {activeTab === "notes" && (
          <div className="space-y-3 animate-fade-in text-xs sm:text-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Manufacturer &amp; Factory Notes
            </h4>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 leading-relaxed font-mono">
              {sample.description || sample.notes || "No additional notes provided by the manufacturer."}
            </div>

            {sample.buyerFeedback && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                <span className="font-bold block text-xs uppercase mb-1">Buyer Changes Requested:</span>
                <p>{sample.buyerFeedback}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Files */}
        {activeTab === "files" && (
          <div className="space-y-2 animate-fade-in text-xs sm:text-sm">
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#5B13EC]">picture_as_pdf</span>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">TechPack_Specification_v2.pdf</span>
                  <span className="text-[11px] text-slate-500">2.4 MB • Complete specs &amp; measurements</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => alert("Downloading Tech Pack...")}
                className="p-2 text-slate-600 hover:text-[#5B13EC] rounded-lg hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
            <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#5B13EC]">fact_check</span>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Factory_QC_Inspection_Sheet.pdf</span>
                  <span className="text-[11px] text-slate-500">1.1 MB • Factory signoff before dispatch</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => alert("Downloading QC Sheet...")}
                className="p-2 text-slate-600 hover:text-[#5B13EC] rounded-lg hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: History */}
        {activeTab === "history" && (
          <div className="space-y-3 animate-fade-in py-1">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[12px] font-bold">1</span>
              <div>
                <p className="text-xs font-bold text-slate-900">Sample Requested by Buyer</p>
                <p className="text-[11px] text-slate-500">{sentDate}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-[#5B13EC] flex items-center justify-center text-[12px] font-bold">2</span>
              <div>
                <p className="text-xs font-bold text-slate-900">Produced &amp; Dispatched by {supplierName}</p>
                <p className="text-[11px] text-slate-500">Photos uploaded and submitted for buyer signoff</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold ${isApproved ? "bg-emerald-100 text-emerald-700" : isChangesNeeded ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700"}`}>3</span>
              <div>
                <p className="text-xs font-bold text-slate-900">{isApproved ? "Approved by Buyer" : isChangesNeeded ? "Changes Requested by Buyer" : "Awaiting Buyer Review"}</p>
                <p className="text-[11px] text-slate-500">{isApproved ? "Bulk cutting unlocked" : isChangesNeeded ? "Revision in progress" : "Under inspection"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Ask for Changes Feedback Box */}
        {isFeedbackOpen && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2.5 animate-fade-in">
            <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">sync</span>
              <span>Specify Required Changes for Manufacturer</span>
            </h4>
            <textarea
              rows={2}
              required
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="e.g. Neck rib width should be adjusted by 0.5 cm, tone down beige shade slightly..."
              className="w-full p-3 text-xs sm:text-sm rounded-xl border border-rose-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-rose-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !feedbackText.trim()}
                onClick={handleChangesSubmit}
                className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Submit Revision Request"}
              </button>
            </div>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Your Action
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isApproved || submitting}
              onClick={handleApproveClick}
              className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                isApproved
                  ? "bg-emerald-600 text-white cursor-default"
                  : "bg-[#5B13EC] hover:bg-[#4d0ecf] text-white active:scale-98"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">check</span>
              <span>{isApproved ? "Approved" : submitting ? "Approving..." : "Approve Sample"}</span>
            </button>

            {!isApproved && (
              <button
                type="button"
                onClick={() => setIsFeedbackOpen(!isFeedbackOpen)}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <span className="material-symbols-outlined text-[16px]">sync</span>
                <span>Ask for Changes</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
