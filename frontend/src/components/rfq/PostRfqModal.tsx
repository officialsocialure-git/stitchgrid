"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { marketplaceService } from "@/services/marketplace.service";

interface PostRfqModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSupplierOrgId?: string;
  initialSupplierName?: string;
}

export function PostRfqModal({
  isOpen,
  onClose,
  onSuccess,
  initialSupplierOrgId,
  initialSupplierName,
}: PostRfqModalProps) {
  const { membership } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section 1: Product Details
  const [rfqTitle, setRfqTitle] = useState(
    initialSupplierName ? `Sourcing Order for ${initialSupplierName}` : "5,000 Oversized T-Shirts"
  );
  const [productCategory, setProductCategory] = useState("Garment (Apparel)");
  const [productType, setProductType] = useState("T-Shirt");
  const [fabricSpec, setFabricSpec] = useState("240 GSM, 100% Cotton Single Jersey");
  const [colorways, setColorways] = useState<string[]>(["Black", "White", "Navy", "Grey"]);
  const [newColorInput, setNewColorInput] = useState("");
  const [isAddingColor, setIsAddingColor] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);

  // Section 2: Quantity & Specifications
  const [totalQuantity, setTotalQuantity] = useState<number>(5000);
  const [unit, setUnit] = useState("Pieces");
  const [sizes, setSizes] = useState({
    S: 500,
    M: 1250,
    L: 1500,
    XL: 1000,
    XXL: 750,
  });
  const [requirementDetails, setRequirementDetails] = useState(
    "Sample: Yes (5 pcs) | Quality: AQL 2.5 | Packaging: Individual polybag, size sticker, 20 pcs per carton | Additional: Custom woven label, brand tag, and export quality stitching."
  );

  // Section 3: Delivery & Publish
  const [targetDeliveryDate, setTargetDeliveryDate] = useState("2026-05-12");
  const [deliveryLocation, setDeliveryLocation] = useState("Noida, Uttar Pradesh – 201301");
  const [quoteDeadline, setQuoteDeadline] = useState("2026-11-08");

  // Mobile Accordion state (default: Section 1 open, others collapsible on mobile)
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    product: true,
    quantity: true,
    delivery: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"PUBLISH" | "DRAFT">("PUBLISH");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync size sum if needed
  const sizeSum = useMemo(() => {
    return Object.values(sizes).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  }, [sizes]);

  const handleSizeChange = (key: keyof typeof sizes, val: string) => {
    const num = parseInt(val, 10) || 0;
    setSizes((prev) => ({ ...prev, [key]: num }));
  };

  const handleRemoveColor = (colorToRemove: string) => {
    setColorways((prev) => prev.filter((c) => c !== colorToRemove));
  };

  const handleAddColor = () => {
    if (newColorInput.trim() && !colorways.includes(newColorInput.trim())) {
      setColorways((prev) => [...prev, newColorInput.trim()]);
      setNewColorInput("");
      setIsAddingColor(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadedFile({ name: file.name, size: `${sizeMb} MB` });
    }
  };

  const handleSubmit = async (mode: "PUBLISH" | "DRAFT") => {
    if (!membership?.organizationId) {
      setErrorMessage("Please ensure you are signed in to post an RFQ.");
      return;
    }

    if (mode === "PUBLISH") {
      if (!rfqTitle.trim()) {
        setErrorMessage("Please enter an RFQ Title.");
        return;
      }
      if (!fabricSpec.trim()) {
        setErrorMessage("Please specify the Fabric / Material specification.");
        return;
      }
      if (totalQuantity <= 0) {
        setErrorMessage("Total quantity must be greater than 0.");
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setSubmitMode(mode);
      setErrorMessage(null);

      // Compile detailed specifications including sizes, colors, location, and requirement details
      const sizesStr = `S:${sizes.S}, M:${sizes.M}, L:${sizes.L}, XL:${sizes.XL}, XXL:${sizes.XXL}`;
      const colorwaysStr = colorways.join(", ");
      const combinedDescription = [
        requirementDetails.trim(),
        `Sizes: ${sizesStr}`,
        `Colorways: ${colorwaysStr}`,
        `Delivery Location: ${deliveryLocation}`,
        `Quote Deadline: ${quoteDeadline}`,
        uploadedFile ? `Tech Pack File: ${uploadedFile.name}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const targetDateIso = targetDeliveryDate
        ? new Date(targetDeliveryDate).toISOString()
        : undefined;

      await marketplaceService.createRfq({
        buyerOrgId: membership.organizationId,
        title: rfqTitle.trim(),
        garmentType: productType || productCategory,
        fabricSpec: fabricSpec.trim(),
        targetQuantity: totalQuantity,
        targetDate: targetDateIso,
        status: mode === "DRAFT" ? "DRAFT" : "OPEN",
        supplierOrgIds: initialSupplierOrgId ? [initialSupplierOrgId] : undefined,
        description: combinedDescription,
        items: [
          {
            name: `${productType} - ${rfqTitle.trim()}`,
            description: `Fabric: ${fabricSpec}. Colors: ${colorwaysStr}. Sizes: ${sizesStr}. Location: ${deliveryLocation}`,
            quantity: totalQuantity,
            unit: unit.toLowerCase(),
          },
        ],
      });

      setSuccessMessage(
        mode === "DRAFT"
          ? "RFQ saved as draft successfully!"
          : "RFQ published successfully! Verified suppliers can now submit quotations."
      );

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error("RFQ submission error:", err);
      setErrorMessage(err?.message || "Failed to submit RFQ. Please check your inputs.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Dialog Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-gray-100 p-4 sm:p-7 z-10 max-h-[95vh] overflow-y-auto no-scrollbar transition-all">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 sm:pb-5 border-b border-gray-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-purple-50 text-[#5B13EC] flex items-center justify-center shrink-0 border border-purple-100 shadow-xs">
              <span className="material-symbols-outlined text-[22px] sm:text-[24px]">assignment</span>
            </div>
            <div>
              <h2 className="font-sans font-extrabold text-lg sm:text-xl text-gray-900 tracking-tight">
                Post New RFQ
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Publish your sourcing requirement and receive quotes from verified suppliers.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {successMessage && (
          <div className="my-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="my-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="space-y-4 sm:space-y-5 pt-4">
          {/* ========================================================================= */}
          {/* 1. SECTION: PRODUCT DETAILS */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs transition-all">
            <div
              onClick={() => toggleSection("product")}
              className="flex items-center justify-between cursor-pointer select-none pb-2 sm:pb-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#5B13EC] text-[20px]">checkroom</span>
                <h3 className="font-bold text-sm sm:text-base text-gray-900">Product Details</h3>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-[20px] sm:hidden">
                {openSections.product ? "expand_less" : "expand_more"}
              </span>
            </div>

            <div className={`space-y-4 pt-1 ${openSections.product ? "block" : "hidden sm:block"}`}>
              {/* Row 1: RFQ Title & Product Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    RFQ Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={rfqTitle}
                    onChange={(e) => setRfqTitle(e.target.value)}
                    placeholder="e.g. 5,000 Oversized T-Shirts"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Product Category <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 pl-9 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all cursor-pointer"
                    >
                      <option value="Garment (Apparel)">Garment (Apparel)</option>
                      <option value="Fabric (Textiles & Knits)">Fabric (Textiles & Knits)</option>
                      <option value="Trims & Accessories">Trims & Accessories</option>
                      <option value="Job Work & Processing">Job Work & Processing</option>
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-[#5B13EC] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      checkroom
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 2: Product Type & Fabric / Material Specification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Product Type <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={productType}
                      onChange={(e) => setProductType(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all cursor-pointer"
                    >
                      <option value="T-Shirt">T-Shirt</option>
                      <option value="Hoodie / Sweatshirt">Hoodie / Sweatshirt</option>
                      <option value="Polo Shirt">Polo Shirt</option>
                      <option value="Shirts / Tops">Shirts / Tops</option>
                      <option value="Trousers / Joggers">Trousers / Joggers</option>
                      <option value="Activewear">Activewear</option>
                      <option value="Custom Garment">Custom Garment</option>
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Fabric / Material Specification <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fabricSpec}
                    onChange={(e) => setFabricSpec(e.target.value)}
                    placeholder="e.g. 240 GSM, 100% Cotton Single Jersey"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
                  />
                </div>
              </div>

              {/* Row 3: Colorways & Upload Design / Tech Pack */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 items-start">
                {/* Colorways Chips */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Colorways
                  </label>
                  <div className="p-2 sm:p-2.5 rounded-xl border border-gray-200 bg-white min-h-[46px] flex flex-wrap items-center gap-1.5 focus-within:ring-2 focus-within:ring-[#5B13EC]/20 focus-within:border-[#5B13EC]">
                    {colorways.map((color) => (
                      <span
                        key={color}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 text-xs font-medium hover:bg-gray-200 transition-colors"
                      >
                        <span>{color}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveColor(color)}
                          className="text-gray-400 hover:text-gray-700 ml-0.5"
                          title="Remove color"
                        >
                          ✕
                        </button>
                      </span>
                    ))}

                    {isAddingColor ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          autoFocus
                          value={newColorInput}
                          onChange={(e) => setNewColorInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddColor();
                            }
                          }}
                          placeholder="Color name"
                          className="w-24 px-2 py-0.5 text-xs rounded border border-purple-300 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddColor}
                          className="text-xs text-[#5B13EC] font-bold px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingColor(false)}
                          className="text-xs text-gray-400 hover:text-gray-600 px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsAddingColor(true)}
                        className="text-xs text-[#5B13EC] hover:text-[#4d0ecf] font-semibold px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                        <span>Add Color</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Upload Design / Tech Pack */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Upload Design / Tech Pack (Optional)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {uploadedFile ? (
                    <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-[#5B13EC] text-[20px]">
                          attach_file
                        </span>
                        <div className="truncate">
                          <p className="text-xs font-bold text-gray-900 truncate">{uploadedFile.name}</p>
                          <p className="text-[10px] text-gray-500">{uploadedFile.size}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="text-gray-400 hover:text-gray-700 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-3 rounded-xl border border-dashed border-gray-300 hover:border-[#5B13EC] bg-gray-50/60 hover:bg-purple-50/30 flex items-center gap-3 cursor-pointer transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-[#5B13EC] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          <span className="hidden sm:inline">Drag &amp; drop files or </span>
                          <span className="text-[#5B13EC] underline">click to upload</span>
                        </p>
                        <p className="text-[10px] text-gray-500">PDF, JPG, PNG (Max 10 MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. SECTION: QUANTITY & SPECIFICATIONS */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs transition-all">
            <div
              onClick={() => toggleSection("quantity")}
              className="flex items-center justify-between cursor-pointer select-none pb-2 sm:pb-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#5B13EC] text-[20px]">layers</span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-gray-900">
                    Quantity &amp; Specifications
                  </h3>
                  {/* Collapsed mobile summary */}
                  {!openSections.quantity && (
                    <p className="text-[11px] text-gray-500 sm:hidden">
                      Qty: {totalQuantity.toLocaleString()} {unit} | Sizes: S, M, L, XL, XXL
                    </p>
                  )}
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-[20px] sm:hidden">
                {openSections.quantity ? "expand_less" : "expand_more"}
              </span>
            </div>

            <div className={`space-y-4 pt-1 ${openSections.quantity ? "block" : "hidden sm:block"}`}>
              {/* Row 1: Total Quantity, Unit, & Size-wise Quantity */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-end">
                {/* Total Quantity (col-span-3) */}
                <div className="lg:col-span-3">
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Total Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={totalQuantity}
                    onChange={(e) => setTotalQuantity(parseInt(e.target.value, 10) || 0)}
                    placeholder="5,000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
                  />
                </div>

                {/* Unit (col-span-3) */}
                <div className="lg:col-span-3">
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Unit <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full appearance-none px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all cursor-pointer"
                    >
                      <option value="Pieces">Pieces</option>
                      <option value="Meters">Meters</option>
                      <option value="Kg">Kg</option>
                      <option value="Sets">Sets</option>
                    </select>
                    <span className="material-symbols-outlined text-[18px] text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      expand_more
                    </span>
                  </div>
                </div>

                {/* Size-wise Quantity (col-span-6) */}
                <div className="lg:col-span-6">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-gray-800">
                      Size-wise Quantity (Optional)
                    </label>
                    {sizeSum !== totalQuantity && (
                      <button
                        type="button"
                        onClick={() => setTotalQuantity(sizeSum)}
                        className="text-[10px] text-[#5B13EC] font-semibold hover:underline"
                        title="Sync total quantity to size breakdown sum"
                      >
                        Set Total to {sizeSum.toLocaleString()}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                    {(["S", "M", "L", "XL", "XXL"] as const).map((sz) => (
                      <div key={sz} className="flex flex-col items-center">
                        <span className="text-[11px] font-bold text-gray-500 mb-0.5">{sz}</span>
                        <input
                          type="number"
                          value={sizes[sz]}
                          onChange={(e) => handleSizeChange(sz, e.target.value)}
                          className="w-full px-1.5 sm:px-2 py-1.5 sm:py-2 text-center text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#5B13EC] focus:border-[#5B13EC]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Requirement Details Textarea with Character Counter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-800">
                    Requirement Details <span className="text-red-500">*</span>
                  </label>
                  <span
                    className={`text-[11px] font-mono ${
                      requirementDetails.length > 500 ? "text-red-600 font-bold" : "text-gray-400"
                    }`}
                  >
                    {requirementDetails.length} / 500
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  maxLength={500}
                  value={requirementDetails}
                  onChange={(e) => setRequirementDetails(e.target.value)}
                  placeholder="Sample: Yes (5 pcs) | Quality: AQL 2.5 | Packaging: Individual polybag, size sticker, 20 pcs per carton | Additional: Custom woven label, brand tag, and export quality stitching."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] leading-relaxed transition-all"
                />
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. SECTION: DELIVERY & PUBLISH */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-2xl border border-gray-200/80 p-4 sm:p-5 shadow-xs transition-all">
            <div
              onClick={() => toggleSection("delivery")}
              className="flex items-center justify-between cursor-pointer select-none pb-2 sm:pb-3"
            >
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#5B13EC] text-[20px]">local_shipping</span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-gray-900">
                    Delivery &amp; Publish
                  </h3>
                  {/* Collapsed mobile summary */}
                  {!openSections.delivery && (
                    <p className="text-[11px] text-gray-500 sm:hidden">
                      Delivery: {targetDeliveryDate} | Quote by: {quoteDeadline} | Location: {deliveryLocation}
                    </p>
                  )}
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-[20px] sm:hidden">
                {openSections.delivery ? "expand_less" : "expand_more"}
              </span>
            </div>

            <div className={`space-y-4 pt-1 ${openSections.delivery ? "block" : "hidden sm:block"}`}>
              {/* 3 Columns: Target Delivery Date, Delivery Location, Quote Submission Deadline */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                {/* Target Delivery Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Target Delivery Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={targetDeliveryDate}
                      onChange={(e) => setTargetDeliveryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 pl-9 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all cursor-pointer"
                    />
                    <span className="material-symbols-outlined text-[18px] text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      calendar_today
                    </span>
                  </div>
                </div>

                {/* Delivery Location */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Delivery Location <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="e.g. Noida, Uttar Pradesh – 201301"
                      className="w-full px-3.5 py-2.5 pl-9 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all"
                    />
                    <span className="material-symbols-outlined text-[18px] text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      location_on
                    </span>
                  </div>
                </div>

                {/* Quote Submission Deadline */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5">
                    Quote Submission Deadline <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={quoteDeadline}
                      onChange={(e) => setQuoteDeadline(e.target.value)}
                      className="w-full px-3.5 py-2.5 pl-9 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] transition-all cursor-pointer"
                    />
                    <span className="material-symbols-outlined text-[18px] text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      calendar_month
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* FOOTER ACTIONS: Responsive Full-width on mobile, side-by-side on desktop */}
        {/* ========================================================================= */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Save as Draft */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit("DRAFT")}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#f4effc] text-[#5B13EC] hover:bg-purple-100 font-bold text-xs sm:text-sm border border-purple-200/60 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">bookmark</span>
            <span>{isSubmitting && submitMode === "DRAFT" ? "Saving Draft..." : "Save as Draft"}</span>
          </button>

          {/* Publish RFQ */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handleSubmit("PUBLISH")}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
          >
            {isSubmitting && submitMode === "PUBLISH" ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                <span>Publishing RFQ...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>Publish RFQ</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

