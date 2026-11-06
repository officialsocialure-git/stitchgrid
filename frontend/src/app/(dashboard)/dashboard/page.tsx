"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityList, ActivityItem } from "@/components/dashboard/ActivityList";
import { Badge } from "@/components/common/Badge";
import { Modal } from "@/components/common/Modal";
import { GARMENT_CLUSTERS } from "@/constants";
import { marketplaceService } from "@/services/marketplace.service";
import { PostRfqModal } from "@/components/rfq/PostRfqModal";
import { UpdateCatalogModal } from "@/components/dashboard/UpdateCatalogModal";
import { CompleteProfileModal } from "@/components/dashboard/CompleteProfileModal";
import { SubmitQuoteModal } from "@/components/dashboard/SubmitQuoteModal";
import { RfqDetailsModal } from "@/components/rfq/RfqDetailsModal";

interface LiveSupplier {
  id: string;
  organizationId: string;
  name: string;
  businessType: string;
  city: string;
  address?: string;
  verificationStatus: "APPROVED" | "PENDING" | string;
  moq: string;
  capacity: string;
  tags: string;
  description: string;
  yearsInBusiness?: number;
  catalog: { name: string; price: string; moq?: number }[];
  raw: any;
}

export default function DashboardPage() {
  const { user, membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";
  const orgName = membership?.organization?.name || "Your Organization";

  // Supplier Operational states
  const [supplierRfqs, setSupplierRfqs] = useState<any[]>([]);
  const [newRfqsCount, setNewRfqsCount] = useState(12);
  const [quotesPendingCount, setQuotesPendingCount] = useState(5);
  const [activeOrdersCount, setActiveOrdersCount] = useState(3);
  const [samplesPendingCount, setSamplesPendingCount] = useState(2);
  const [timeRange, setTimeRange] = useState("This Month");
  const [isUpdateCatalogModalOpen, setIsUpdateCatalogOpen] = useState(false);
  const [isCompleteProfileModalOpen, setIsCompleteProfileOpen] = useState(false);
  const [selectedRfqForDetails, setSelectedRfqForDetails] = useState<any | null>(null);
  const [selectedRfqForQuote, setSelectedRfqForQuote] = useState<any | null>(null);

  const [rfqCount, setRfqCount] = useState(0);
  const [quotationCount, setQuotationCount] = useState(0);
  const [orderCount, setOrderCount] = useState(0);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [escrowTotal, setEscrowTotal] = useState("₹0");
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Buyer Marketplace Discovery states
  const [suppliers, setSuppliers] = useState<LiveSupplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isCategoryFilterModalOpen, setIsCategoryFilterModalOpen] = useState(false);
  const [tempCategory, setTempCategory] = useState("All");

  const filterCategories = [
    { label: "All Categories", value: "All" },
    { label: "Garment", value: "Garment" },
    { label: "Fabric", value: "Fabric" },
    { label: "Trims", value: "Trims" },
    { label: "Job Work", value: "Job work" },
  ];

  // Modals
  const [selectedSupplierForModal, setSelectedSupplierForModal] = useState<LiveSupplier | null>(null);
  const [isRfqModalOpen, setIsRfqModalOpen] = useState(false);
  const [targetSupplierOrgId, setTargetSupplierOrgId] = useState<string | undefined>(undefined);
  const [targetSupplierName, setTargetSupplierName] = useState<string | undefined>(undefined);

  const categories = ["All", "Garment", "Fabric", "Trims", "Job work"];

  // Helper to parse seeded/raw supplier data into screenshot card fields
  const parseSupplier = useCallback((s: any): LiveSupplier => {
    const org = s.organization || {};
    const rawDesc = s.description || "";

    // Parse MOQ from description or catalog or capacity
    let moq = "300 pcs";
    const moqMatch = rawDesc.match(/MOQ:\s*([^|]+)/i);
    if (moqMatch && moqMatch[1]) {
      moq = moqMatch[1].trim();
    } else if (s.catalogItems && s.catalogItems[0]?.minOrderQty) {
      moq = `${s.catalogItems[0].minOrderQty} pcs`;
    }

    // Parse Capacity / range from description or productionCapacity
    let capacity = s.productionCapacity ? `${s.productionCapacity.toLocaleString()} pcs / month` : "Flexible";
    const capMatch = rawDesc.match(/Capacity:\s*([^|]+)/i);
    if (capMatch && capMatch[1]) {
      capacity = capMatch[1].trim();
    }

    // Parse Tags from description or categories
    let tags = "Cut & sew · Knits";
    const tagsMatch = rawDesc.match(/Tags:\s*([^|]+)/i);
    if (tagsMatch && tagsMatch[1]) {
      tags = tagsMatch[1].trim();
    } else if (s.categories && s.categories.length > 0) {
      tags = s.categories.map((c: any) => c.category).slice(0, 3).join(" · ");
    }

    // Business category / type
    const businessType = org.businessType || (s.categories?.[0]?.category || "Manufacturer");

    const catalog = Array.isArray(s.catalogItems)
      ? s.catalogItems.map((ci: any) => ({
          name: ci.name,
          price: ci.unitPrice ? `₹${Number(ci.unitPrice).toFixed(0)}` : "Quote required",
          moq: ci.minOrderQty,
        }))
      : [];

    return {
      id: s.id,
      organizationId: s.organizationId,
      name: org.name || "Textile Partner",
      businessType,
      city: org.city || "India",
      address: org.address,
      verificationStatus: s.verificationStatus || org.verificationStatus || "APPROVED",
      moq,
      capacity,
      tags,
      description: rawDesc.split("|")[0].trim() || rawDesc,
      yearsInBusiness: s.yearsInBusiness || 5,
      catalog,
      raw: s,
    };
  }, []);

  // Fetch Suppliers for Buyer Dashboard
  const loadSuppliers = useCallback(async () => {
    try {
      setLoadingSuppliers(true);
      const categoryParam = selectedCategory === "All" ? undefined : selectedCategory;
      const qParam = searchQuery.trim() ? searchQuery.trim() : undefined;

      const data = await marketplaceService.searchSuppliers({
        category: categoryParam,
        q: qParam,
      });

      if (Array.isArray(data)) {
        setSuppliers(data.map(parseSupplier));
      } else {
        setSuppliers([]);
      }
    } catch (err) {
      console.error("Failed to load suppliers:", err);
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [selectedCategory, searchQuery, parseSupplier]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadSuppliers]);

  // Load Supplier Workspace operational data
  const loadDashboardData = useCallback(async () => {
    if (!isSupplier) return;
    try {
      const [rfqs, orders, payments, samples] = await Promise.all([
        marketplaceService.listMyRfqs(membership?.organizationId).catch(() => []),
        marketplaceService.listOrders().catch(() => []),
        marketplaceService.listPayments().catch(() => []),
        marketplaceService.listSamples().catch(() => []),
      ]);

      const rfqList = Array.isArray(rfqs) ? rfqs : [];
      const orderList = Array.isArray(orders) ? orders : [];
      const paymentList = Array.isArray(payments) ? payments : [];
      const sampleList = Array.isArray(samples) ? samples : [];

      setSupplierRfqs(rfqList);

      // 1. New RFQs: open RFQs where supplier hasn't quoted or total open
      const unquoted = rfqList.filter((r: any) => !r.quotations || r.quotations.length === 0).length;
      setNewRfqsCount(unquoted);

      // 2. Quotes Pending: active submitted quotes
      const quotesPending = rfqList.filter((r: any) => r.quotations && r.quotations.length > 0).length;
      setQuotesPendingCount(quotesPending);

      // 3. Active Orders: orders accepted or in progress
      const activeOrders = orderList.filter((o: any) =>
        ["ACCEPTED", "IN_PRODUCTION", "QC", "DISPATCHED", "SAMPLE_PENDING", "SAMPLE_APPROVED", "PRODUCTION_STARTED"].includes(o.status)
      ).length;
      setActiveOrdersCount(activeOrders);

      // 4. Samples Pending: samples requested or in review
      const pendingSamples = sampleList.filter((s: any) =>
        ["REQUESTED", "IN_PROGRESS", "REVISION_REQUIRED", "DISPATCHED"].includes(s.status)
      ).length;
      setSamplesPendingCount(pendingSamples);

      setRfqCount(rfqList.length);
      const totalQuotes = rfqList.reduce((acc: number, r: any) => acc + (r.quotations?.length || 0), 0);
      setQuotationCount(totalQuotes);
      setOrderCount(orderList.length);
      const pendingCount = orderList.filter(
        (o: any) => o.status === "PO_CREATED" || o.status === "PENDING_ACCEPTANCE"
      ).length;
      setPendingOrdersCount(pendingCount);
      setRecentOrders(orderList.slice(0, 3));

      if (paymentList.length > 0) {
        const sum = paymentList.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
        setEscrowTotal(sum > 0 ? `₹${(sum / 100000).toFixed(1)}L` : "₹0");
      } else {
        setEscrowTotal("₹0");
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  }, [isSupplier, membership?.organizationId]);

  useEffect(() => {
    if (isSupplier) {
      loadDashboardData();
    }
  }, [isSupplier, loadDashboardData]);

  const openRfqModalWithSupplier = (supplier?: LiveSupplier) => {
    if (supplier) {
      setTargetSupplierOrgId(supplier.organizationId);
      setTargetSupplierName(supplier.name);
    } else {
      setTargetSupplierOrgId(undefined);
      setTargetSupplierName(undefined);
    }
    setSelectedSupplierForModal(null);
    setIsRfqModalOpen(true);
  };

  const getSupplierIcon = (businessType: string) => {
    if (businessType.toLowerCase().includes("fabric")) return "inventory_2";
    if (businessType.toLowerCase().includes("trim")) return "label";
    if (businessType.toLowerCase().includes("job") || businessType.toLowerCase().includes("print")) return "print";
    return "factory";
  };

  // -------------------------------------------------------------
  // SUPPLIER WORKSPACE VIEW (Matches Reference Image)
  // -------------------------------------------------------------
  if (isSupplier) {
    const fallbackRfqs = [
      {
        id: "rfq_demo_1042",
        rfqIdDisplay: "RFQ-2026-1042",
        buyerName: "Demo Fashion Brand",
        productName: "Oversized T-shirt",
        quantity: "1,000 pcs",
        deliveryDate: "25 Nov 2026",
        status: "New RFQ",
        statusStyle: "bg-purple-50 text-purple-700 border-purple-200",
        actionType: "view_rfq" as const,
        targetQuantity: 1000,
        title: "1,000 Oversized T-Shirts",
        raw: {
          id: "rfq_demo_1042",
          title: "1,000 Oversized T-Shirts",
          targetQuantity: 1000,
          garmentType: "T-Shirt",
          fabricSpec: "240 GSM 100% Combed Cotton Single Jersey",
          targetDate: "2026-11-25T00:00:00.000Z",
          status: "OPEN",
          buyer: { name: "Demo Fashion Brand", city: "Mumbai" },
        },
      },
      {
        id: "rfq_demo_1038",
        rfqIdDisplay: "RFQ-2026-1038",
        buyerName: "Studio 27",
        productName: "Women's Co-ord Set",
        quantity: "500 sets",
        deliveryDate: "20 Nov 2026",
        status: "Quote Due",
        statusStyle: "bg-amber-50 text-amber-700 border-amber-200",
        actionType: "send_quote" as const,
        targetQuantity: 500,
        title: "500 Women's Co-ord Sets",
        raw: {
          id: "rfq_demo_1038",
          title: "500 Women's Co-ord Sets",
          targetQuantity: 500,
          garmentType: "Co-ord Set",
          fabricSpec: "Cotton Linen Blend 210 GSM",
          targetDate: "2026-11-20T00:00:00.000Z",
          status: "OPEN",
          buyer: { name: "Studio 27", city: "Delhi" },
        },
      },
      {
        id: "rfq_demo_1035",
        rfqIdDisplay: "RFQ-2026-1035",
        buyerName: "Northstar Apparel",
        productName: "Hoodie",
        quantity: "800 pcs",
        deliveryDate: "28 Nov 2026",
        status: "In Review",
        statusStyle: "bg-blue-50 text-blue-700 border-blue-200",
        actionType: "view_details" as const,
        targetQuantity: 800,
        title: "800 Heavyweight Blank Hoodies",
        raw: {
          id: "rfq_demo_1035",
          title: "800 Heavyweight Blank Hoodies",
          targetQuantity: 800,
          garmentType: "Hoodie",
          fabricSpec: "French Terry 400 GSM",
          targetDate: "2026-11-28T00:00:00.000Z",
          status: "OPEN",
          buyer: { name: "Northstar Apparel", city: "Noida" },
        },
      },
    ];

    const dbMappedRfqs = supplierRfqs.map((r: any, idx: number) => {
      const rfqIdDisplay = `RFQ-2026-${(r.id || "1042").slice(-4).replace(/\D/g, "").padStart(4, "0") || (1040 + idx).toString()}`;
      const buyerName = r.buyer?.name || "Enterprise Buyer";
      const item = r.items?.[0] || {};
      let prod = item.name || r.garmentType || r.title || "Garment Order";
      if (prod.includes(" - ")) prod = prod.split(" - ")[0].trim();
      if (prod.length > 26) prod = prod.slice(0, 26) + "...";
      const qty = `${(r.targetQuantity || item.quantity || 1000).toLocaleString()} ${item.unit || "pcs"}`;
      const deliv = r.targetDate
        ? new Date(r.targetDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "25 Nov 2026";
      const hasQuoted = r.quotations && r.quotations.length > 0;
      const isAwarded = r.status === "AWARDED";

      let status = "New RFQ";
      let statusStyle = "bg-purple-50 text-purple-700 border-purple-200";
      let actionType: "view_rfq" | "send_quote" | "view_details" = "view_rfq";

      if (isAwarded) {
        status = "Awarded";
        statusStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
        actionType = "view_details";
      } else if (hasQuoted) {
        status = "In Review";
        statusStyle = "bg-blue-50 text-blue-700 border-blue-200";
        actionType = "view_details";
      } else if (idx % 2 === 1) {
        status = "Quote Due";
        statusStyle = "bg-amber-50 text-amber-700 border-amber-200";
        actionType = "send_quote";
      }

      return {
        id: r.id,
        rfqIdDisplay,
        buyerName,
        productName: prod,
        quantity: qty,
        deliveryDate: deliv,
        status,
        statusStyle,
        actionType,
        targetQuantity: r.targetQuantity || item.quantity || 1000,
        title: r.title,
        raw: r,
      };
    });

    const displayRecentRfqs = dbMappedRfqs.slice(0, 5);

    return (
      <div className="space-y-5 md:space-y-6 max-w-7xl mx-auto pb-28 md:pb-12">
        {/* Mobile supplier hero: visual refresh only; existing catalogue action is preserved. */}
        <section className="md:hidden relative isolate overflow-hidden rounded-[26px] border border-purple-100 bg-gradient-to-br from-[#f8f3ff] via-[#f0e7ff] to-[#e5d5ff] px-5 py-6 shadow-sm">
          <div className="absolute -right-10 -top-8 h-48 w-48 rounded-full bg-white/45 blur-2xl" />
          <div className="absolute right-0 top-0 bottom-0 w-[38%] overflow-hidden">
            <div className="absolute -right-12 top-8 h-36 w-36 rounded-full border-[18px] border-white/35" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 h-24 w-24 rounded-[28px] bg-gradient-to-br from-[#6d28ff] to-[#3f0cae] shadow-xl flex items-center justify-center rotate-6">
              <span className="material-symbols-outlined text-white text-[58px]">precision_manufacturing</span>
            </div>
            <div className="absolute right-8 bottom-5 h-3 w-24 rounded-full bg-white/55 blur-sm" />
          </div>
          <div className="relative z-10 max-w-[76%]">
            <span className="inline-block text-[10px] font-mono uppercase font-extrabold tracking-[0.2em] text-[#5B13EC] mb-2">
              Supplier Dashboard
            </span>
            <h1 className="font-sans font-extrabold text-[25px] leading-[1.12] tracking-tight text-slate-950">
              Your Factory,<br />More Opportunities.
            </h1>
            <p className="text-[12px] leading-relaxed text-slate-600 mt-2.5">
              Get RFQs, send quotes, manage orders and samples in one place.
            </p>
            <button
              type="button"
              onClick={() => setIsUpdateCatalogOpen(true)}
              className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Update Catalogue</span>
            </button>
          </div>
        </section>

        {/* Desktop hero retained exactly as before. */}
        <div className="hidden md:flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="inline-block text-[11px] font-mono uppercase font-bold text-[#5B13EC] tracking-wider mb-1">
              SUPPLIER DASHBOARD
            </span>
            <h1 className="font-sans font-extrabold text-2xl sm:text-3xl lg:text-4xl text-slate-900 tracking-tight">
              Your Factory, More Opportunities.
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Get RFQs, send quotes, manage orders and samples in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsUpdateCatalogOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-98 shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Update Catalogue</span>
          </button>
        </div>

        {/* Mobile profile completion: circular progress with the same profile action. */}
        <section className="md:hidden rounded-[24px] border border-purple-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div
              className="h-[72px] w-[72px] shrink-0 rounded-full p-[7px]"
              style={{ background: "conic-gradient(#5B13EC 0deg 270deg, #eadfff 270deg 360deg)" }}
              aria-label="Profile completion 75 percent"
            >
              <div className="h-full w-full rounded-full bg-white flex items-center justify-center">
                <span className="text-lg font-extrabold text-slate-950">75%</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-sans font-extrabold text-sm text-slate-950">Profile Completion</h3>
              <p className="text-[11px] leading-relaxed text-slate-500 mt-1">
                Complete your business profile to get more RFQs and orders.
              </p>
              <button
                type="button"
                onClick={() => setIsCompleteProfileOpen(true)}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#5B13EC]"
              >
                Complete Profile
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>

        {/* Desktop profile completion retained exactly as before. */}
        <div className="hidden md:flex p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-sans font-extrabold text-sm sm:text-base text-slate-900">Profile Completion</h3>
            <span className="font-mono font-bold text-sm sm:text-base text-slate-900">75%</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-[#5B13EC] rounded-full transition-all duration-500" style={{ width: "75%" }} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">Complete your business profile to get more RFQs and orders.</p>
            <button
              type="button"
              onClick={() => setIsCompleteProfileOpen(true)}
              className="px-5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all shadow-2xs shrink-0 self-start sm:self-auto"
            >
              Complete Profile
            </button>
          </div>
        </div>

        {/* 3. SECTION: Business Overview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-sans font-extrabold text-base sm:text-lg text-slate-900">
              Business Overview
            </h3>
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 appearance-none focus:outline-none focus:border-[#5B13EC] cursor-pointer"
              >
                <option value="This Month">This Month</option>
                <option value="This Week">This Week</option>
                <option value="All Time">All Time</option>
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* 4 Stat Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* Card 1: New RFQs */}
            <div className="p-3 sm:p-4 rounded-2xl bg-[#f8f5fe] border border-purple-100/80 flex items-center gap-2.5 sm:gap-3.5 shadow-2xs min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-purple-100 text-[#5B13EC] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">description</span>
              </div>
              <div>
                <span className="font-sans font-extrabold text-2xl text-slate-900 block leading-tight">
                  {newRfqsCount}
                </span>
                <span className="text-xs text-slate-600 font-medium">New RFQs</span>
              </div>
            </div>

            {/* Card 2: Quotes Pending */}
            <div className="p-3 sm:p-4 rounded-2xl bg-[#fffbf0] border border-amber-100/80 flex items-center gap-2.5 sm:gap-3.5 shadow-2xs min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">sell</span>
              </div>
              <div>
                <span className="font-sans font-extrabold text-2xl text-slate-900 block leading-tight">
                  {quotesPendingCount}
                </span>
                <span className="text-xs text-slate-600 font-medium">Quotes Pending</span>
              </div>
            </div>

            {/* Card 3: Active Orders */}
            <div className="p-3 sm:p-4 rounded-2xl bg-[#f0fbf4] border border-emerald-100/80 flex items-center gap-2.5 sm:gap-3.5 shadow-2xs min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
              </div>
              <div>
                <span className="font-sans font-extrabold text-2xl text-slate-900 block leading-tight">
                  {activeOrdersCount}
                </span>
                <span className="text-xs text-slate-600 font-medium">Active Orders</span>
              </div>
            </div>

            {/* Card 4: Samples Pending */}
            <div className="p-3 sm:p-4 rounded-2xl bg-[#f0f7ff] border border-blue-100/80 flex items-center gap-2.5 sm:gap-3.5 shadow-2xs min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px]">layers</span>
              </div>
              <div>
                <span className="font-sans font-extrabold text-2xl text-slate-900 block leading-tight">
                  {samplesPendingCount}
                </span>
                <span className="text-xs text-slate-600 font-medium">Samples Pending</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. SECTION: Recent RFQs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-sans font-extrabold text-base sm:text-lg text-slate-900">
              Recent RFQs
            </h3>
            <Link
              href="/rfqs"
              className="text-xs sm:text-sm font-bold text-[#5B13EC] hover:underline flex items-center gap-1"
            >
              <span>View All RFQs</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    RFQ ID
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Delivery Date
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="py-3.5 px-5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {displayRecentRfqs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-[36px] text-slate-300">inbox</span>
                        <p className="font-semibold text-sm text-slate-700">No Buyer Requests Found</p>
                        <p className="text-xs text-slate-400 max-w-sm">When buyers submit garment RFQs matching your profile, they will appear here live with instant quote submission.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayRecentRfqs.map((rfq) => (
                    <tr key={rfq.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* RFQ ID */}
                      <td className="py-4 px-5 font-bold font-mono text-[#5B13EC]">
                        {rfq.rfqIdDisplay}
                      </td>

                      {/* Buyer */}
                      <td className="py-4 px-5 font-semibold text-slate-900">
                        {rfq.buyerName}
                      </td>

                      {/* Product */}
                      <td className="py-4 px-5 text-slate-700">
                        {rfq.productName}
                      </td>

                      {/* Quantity */}
                      <td className="py-4 px-5 text-slate-700 font-medium">
                        {rfq.quantity}
                      </td>

                      {/* Delivery Date */}
                      <td className="py-4 px-5 text-slate-700">
                        {rfq.deliveryDate}
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${rfq.statusStyle}`}>
                          {rfq.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-right">
                        {rfq.actionType === "view_rfq" ? (
                          <button
                            type="button"
                            onClick={() => setSelectedRfqForDetails(rfq.raw)}
                            className="px-4 py-1.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold transition-all shadow-xs"
                          >
                            View RFQ
                          </button>
                        ) : rfq.actionType === "send_quote" ? (
                          <button
                            type="button"
                            onClick={() => setSelectedRfqForQuote(rfq.raw)}
                            className="px-4 py-1.5 rounded-xl border border-purple-300 text-[#5B13EC] hover:bg-purple-50 text-xs font-bold transition-all shadow-2xs"
                          >
                            Send Quote
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedRfqForDetails(rfq.raw)}
                            className="px-4 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs"
                          >
                            View Details
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Card View */}
          <div className="md:hidden space-y-3">
            {displayRecentRfqs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center gap-2">
                <span className="material-symbols-outlined text-[32px] text-slate-300">inbox</span>
                <p className="font-semibold text-xs text-slate-700">No buyer requests found</p>
                <p className="text-[11px] text-slate-400">New RFQs from buyers will appear here in real time.</p>
              </div>
            ) : (
              displayRecentRfqs.map((rfq) => (
                <div
                  key={rfq.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#5B13EC]">
                      {rfq.rfqIdDisplay}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${rfq.statusStyle}`}>
                      {rfq.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-900">{rfq.productName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Buyer: <strong className="text-slate-800">{rfq.buyerName}</strong></p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 py-1 border-y border-slate-100">
                    <span>Quantity: <strong className="text-slate-900">{rfq.quantity}</strong></span>
                    <span>Delivery: <strong className="text-slate-900">{rfq.deliveryDate}</strong></span>
                  </div>

                  <div className="pt-1">
                    {rfq.actionType === "view_rfq" ? (
                      <button
                        type="button"
                        onClick={() => setSelectedRfqForDetails(rfq.raw)}
                        className="w-full py-2.5 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold transition-all shadow-xs"
                      >
                        View RFQ
                      </button>
                    ) : rfq.actionType === "send_quote" ? (
                      <button
                        type="button"
                        onClick={() => setSelectedRfqForQuote(rfq.raw)}
                        className="w-full py-2.5 rounded-xl border border-purple-300 text-[#5B13EC] hover:bg-purple-50 text-xs font-bold transition-all shadow-2xs"
                      >
                        Send Quote
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedRfqForDetails(rfq.raw)}
                        className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-2xs"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modals for Supplier Actions */}
        <UpdateCatalogModal
          isOpen={isUpdateCatalogModalOpen}
          onClose={() => setIsUpdateCatalogOpen(false)}
          onSuccess={loadDashboardData}
        />

        <CompleteProfileModal
          isOpen={isCompleteProfileModalOpen}
          onClose={() => setIsCompleteProfileOpen(false)}
          onSuccess={loadDashboardData}
        />

        {selectedRfqForDetails && (
          <RfqDetailsModal
            isOpen={Boolean(selectedRfqForDetails)}
            onClose={() => setSelectedRfqForDetails(null)}
            rfq={selectedRfqForDetails}
          />
        )}

        {selectedRfqForQuote && (
          <SubmitQuoteModal
            isOpen={Boolean(selectedRfqForQuote)}
            onClose={() => setSelectedRfqForQuote(null)}
            rfq={selectedRfqForQuote}
            onSuccess={loadDashboardData}
          />
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // BUYER DASHBOARD: MARKETPLACE-STYLE DISCOVERY (Matches Screenshot)
  // -------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. HERO BANNER: Deep Purple, Matches Reference Screenshot */}
      <div className="relative overflow-hidden rounded-3xl bg-[#5B13EC] text-white p-7 sm:p-9 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-black/20 text-white text-[11px] font-bold tracking-wider uppercase backdrop-blur-xs">
              FIND SUPPLIERS
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Find the right production partner.
            </h1>
            <p className="text-purple-100 text-xs sm:text-sm font-normal max-w-xl">
              Explore verified businesses by category, location and capability.
            </p>
          </div>

          <button
            onClick={() => openRfqModalWithSupplier()}
            className="self-start sm:self-center px-5 py-3 rounded-xl bg-white text-[#5B13EC] font-bold text-xs sm:text-sm shadow-md hover:bg-purple-50 transition-all flex items-center gap-2 shrink-0 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Post RFQ</span>
          </button>
        </div>
      </div>

      {/* 2. SEARCH BAR & FILTER BUTTON: Matches Reference Image 1 on Mobile */}
      <div className="flex items-center gap-2.5 w-full">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, capability or location..."
            className="w-full pl-11 pr-10 py-3 bg-white text-xs sm:text-sm text-gray-900 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5B13EC]/20 focus:border-[#5B13EC] shadow-2xs transition-all placeholder:text-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Sliders Button (Matches Reference Image 1 - Mobile View) */}
        <button
          type="button"
          onClick={() => {
            setTempCategory(selectedCategory);
            setIsCategoryFilterModalOpen(true);
          }}
          className="w-11 h-11 rounded-2xl bg-[#f4effc] border border-purple-200/80 text-[#5B13EC] flex items-center justify-center shrink-0 shadow-2xs hover:bg-purple-100 active:scale-95 transition-all md:hidden cursor-pointer"
          title="Filter by Category"
        >
          <span className="material-symbols-outlined text-[20px]">tune</span>
        </button>
      </div>

      {/* 3. CATEGORY FILTER PILLS (Desktop View - hidden on mobile) */}
      <div className="hidden md:flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-[#5B13EC] text-white shadow-xs"
                  : "bg-white text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 4. SUPPLIER CARDS GRID (2x2 matching reference image) */}
      {loadingSuppliers ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-8">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-5 border border-gray-200 animate-pulse space-y-4">
              <div className="flex justify-between">
                <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
                <div className="h-5 w-32 bg-gray-200 rounded-full"></div>
              </div>
              <div className="flex gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-40 bg-gray-200 rounded"></div>
                  <div className="h-3 w-28 bg-gray-200 rounded"></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="h-8 bg-gray-100 rounded"></div>
                <div className="h-8 bg-gray-100 rounded"></div>
                <div className="h-8 bg-gray-100 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-primary flex items-center justify-center mb-3">
            <span className="material-symbols-outlined text-[28px]">search_off</span>
          </div>
          <h3 className="font-bold text-base text-gray-900">No production partners found</h3>
          <p className="text-xs text-gray-500 max-w-md mt-1 mb-4">
            Try adjusting your search terms or select &quot;All&quot; to see all verified garment manufacturers and mills.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedCategory("All");
            }}
            className="px-4 py-2 rounded-xl bg-purple-50 text-primary hover:bg-purple-100 text-xs font-bold transition-all"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map((supplier) => {
            const isApproved = supplier.verificationStatus === "APPROVED";
            const iconName = getSupplierIcon(supplier.businessType);

            return (
              <div
                key={supplier.id}
                className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header: Verification Pill & Category Pill */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    {/* Status Pill */}
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-100">
                        <span className="material-symbols-outlined text-[13px] font-bold">check</span>
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200">
                        <span className="material-symbols-outlined text-[13px]">info</span>
                        <span>Under review</span>
                      </span>
                    )}

                    {/* Category Pill */}
                    <span className="inline-flex items-center px-3 py-0.5 rounded-full bg-[#f4effc] text-[#5B13EC] text-[11px] font-semibold">
                      {supplier.businessType}
                    </span>
                  </div>

                  {/* Supplier Info Row: Icon + Name + Location */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-primary flex items-center justify-center shrink-0 border border-purple-100/80">
                      <span className="material-symbols-outlined text-[22px]">{iconName}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => setSelectedSupplierForModal(supplier)}
                        className="font-bold text-base text-gray-900 truncate hover:text-primary transition-colors cursor-pointer"
                      >
                        {supplier.name}
                      </h3>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <span className="material-symbols-outlined text-[14px] text-gray-400">location_on</span>
                        <span className="truncate">{supplier.city}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stats Row: Minimum order | Capacity/range | View supplier profile */}
                  <div className="flex items-center justify-between gap-2 py-3 border-t border-gray-100">
                    <div className="min-w-0">
                      <span className="text-[11px] text-gray-500 block">Minimum order</span>
                      <span className="text-xs sm:text-sm font-bold text-gray-900 block truncate">
                        {supplier.moq}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[11px] text-gray-500 block">Capacity / range</span>
                      <span className="text-xs sm:text-sm font-bold text-gray-900 block truncate">
                        {supplier.capacity}
                      </span>
                    </div>

                    <button
                      onClick={() => setSelectedSupplierForModal(supplier)}
                      className="px-3 py-1.5 rounded-xl border border-purple-200 text-[#5B13EC] hover:bg-purple-50 text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ml-auto whitespace-nowrap"
                    >
                      <span>View supplier profile</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </div>

                {/* Footer: Capabilities Tags */}
                <div className="pt-3 border-t border-gray-100 text-xs text-gray-500 truncate font-medium">
                  {supplier.tags}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. SUPPLIER PROFILE MODAL */}
      {selectedSupplierForModal && (
        <Modal
          isOpen={!!selectedSupplierForModal}
          onClose={() => setSelectedSupplierForModal(null)}
          title={selectedSupplierForModal.name}
          className="max-w-2xl"
        >
          <div className="space-y-5">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-purple-50/60 border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white text-primary flex items-center justify-center shadow-xs border border-purple-100">
                  <span className="material-symbols-outlined text-[24px]">
                    {getSupplierIcon(selectedSupplierForModal.businessType)}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-gray-900">{selectedSupplierForModal.name}</h3>
                    {selectedSupplierForModal.verificationStatus === "APPROVED" ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓ Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Under Review
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-[13px]">location_on</span>
                    <span>{selectedSupplierForModal.city}</span>
                    {selectedSupplierForModal.address && (
                      <span className="text-gray-400 font-normal">· {selectedSupplierForModal.address}</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="px-3 py-1 rounded-full bg-[#5B13EC] text-white text-xs font-semibold">
                {selectedSupplierForModal.businessType}
              </div>
            </div>

            {/* Description */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">About Supplier & Capabilities</h4>
              <p className="text-xs sm:text-sm text-gray-700 leading-relaxed bg-surface-container-low p-3.5 rounded-xl border border-gray-100">
                {selectedSupplierForModal.description || "Verified industrial manufacturer registered in STITCHGRID textile network."}
              </p>
            </div>

            {/* Key Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[11px] text-gray-500 block">Minimum Order (MOQ)</span>
                <span className="text-sm font-bold text-gray-900 mt-0.5 block">{selectedSupplierForModal.moq}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[11px] text-gray-500 block">Capacity / Range</span>
                <span className="text-sm font-bold text-gray-900 mt-0.5 block">{selectedSupplierForModal.capacity}</span>
              </div>
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 col-span-2 sm:col-span-1">
                <span className="text-[11px] text-gray-500 block">Specialization Tags</span>
                <span className="text-xs font-bold text-primary mt-0.5 block truncate">{selectedSupplierForModal.tags}</span>
              </div>
            </div>

            {/* Catalog Items */}
            {selectedSupplierForModal.catalog && selectedSupplierForModal.catalog.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Verified Production Catalog</h4>
                <div className="space-y-2">
                  {selectedSupplierForModal.catalog.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 hover:border-purple-200 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600 text-[18px]">check_circle</span>
                        <div>
                          <span className="text-xs font-bold text-gray-900 block">{item.name}</span>
                          {item.moq && (
                            <span className="text-[10px] text-gray-500">MOQ: {item.moq} units</span>
                          )}
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-primary">{item.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setSelectedSupplierForModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => openRfqModalWithSupplier(selectedSupplierForModal)}
                className="px-5 py-2 rounded-xl bg-[#5B13EC] hover:bg-[#4d0ecf] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Send Direct RFQ to this Supplier</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. POST RFQ MODAL */}
      <PostRfqModal
        isOpen={isRfqModalOpen}
        onClose={() => {
          setIsRfqModalOpen(false);
          setTargetSupplierOrgId(undefined);
          setTargetSupplierName(undefined);
        }}
        initialSupplierOrgId={targetSupplierOrgId}
        initialSupplierName={targetSupplierName}
        onSuccess={() => {
          loadSuppliers();
        }}
      />

      {/* 7. CATEGORY FILTER BOTTOM SHEET: Matches Reference Image 1 on Mobile View */}
      {isCategoryFilterModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center md:hidden animate-fadeIn"
          onClick={() => setIsCategoryFilterModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-[28px] p-6 pb-8 shadow-2xl flex flex-col border-t border-purple-100 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Drag Indicator Handle */}
            <div className="w-12 h-1 rounded-full bg-gray-300 mx-auto mb-4 shrink-0" />

            {/* Header: Title & Close Button */}
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-base font-bold text-gray-900">Select Category</h3>
              <button
                type="button"
                onClick={() => setIsCategoryFilterModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Category Options List with Checkboxes */}
            <div className="flex flex-col my-3">
              {filterCategories.map((cat, idx) => {
                const isSelected =
                  tempCategory === cat.value ||
                  (cat.value === "All" && (tempCategory === "All" || tempCategory === "All Categories"));

                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setTempCategory(cat.value)}
                    className={`w-full px-3.5 py-3 rounded-xl flex items-center justify-between transition-colors text-left cursor-pointer ${
                      isSelected
                        ? "bg-[#f4effc] text-[#5B13EC] font-semibold"
                        : "text-gray-800 hover:bg-gray-50 font-medium border-b border-gray-100 last:border-b-0"
                    }`}
                  >
                    <span className="text-sm">{cat.label}</span>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                        isSelected
                          ? "bg-[#5B13EC] text-white"
                          : "border-2 border-gray-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-[15px] font-bold">
                          check
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Actions: Clear & Apply */}
            <div className="flex items-center gap-3 pt-3 mt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTempCategory("All")}
                className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 active:scale-98 transition-all cursor-pointer"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory(tempCategory);
                  setIsCategoryFilterModalOpen(false);
                }}
                className="flex-1 py-3 rounded-xl bg-[#5B13EC] text-white font-bold text-sm hover:bg-[#4d0ecf] shadow-md active:scale-98 transition-all cursor-pointer text-center"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
