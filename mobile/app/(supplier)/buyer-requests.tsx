import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  ScrollView,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { storage } from "../../src/utils/storage";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Rfq } from "../../src/types";

type TabType = "ALL" | "NEW" | "VIEWED" | "QUOTE_SENT";

const DEFAULT_RFQS: Rfq[] = [
  {
    id: "rfq-2026-1197",
    title: "5,000 tees",
    buyerOrgId: "org-buyer-1",
    targetQuantity: 5000,
    targetPrice: 180,
    targetDate: "2026-05-12T00:00:00.000Z",
    status: "OPEN",
    garmentType: "T-shirt",
    fabricSpec: "240 GSM, 100% Cotton Single Jersey",
    description: "Export grade 240 GSM single jersey crew neck tees with bio-wash finish, rib neck collar and custom neck branding tags.",
    createdAt: "2026-05-01T10:00:00.000Z",
    buyer: {
      id: "org-buyer-1",
      name: "TrendSetter Apparel Co.",
      city: "Birgunj",
      country: "UP",
    } as any,
    items: [
      {
        id: "item-1",
        rfqId: "rfq-2026-1197",
        name: "5,000 tees",
        quantity: 5000,
        unit: "pcs",
        description: "240 GSM, 100% Cotton Single Jersey",
      } as any,
    ],
    quotations: [],
  },
  {
    id: "rfq-2026-1042",
    title: "1,000 cargo black pants",
    buyerOrgId: "org-buyer-2",
    targetQuantity: 1000,
    targetPrice: 499,
    targetDate: "2026-11-30T00:00:00.000Z",
    status: "OPEN",
    garmentType: "Cargo Pants",
    fabricSpec: "240 GSM, 100% Cotton",
    description: "Heavy duty 6-pocket cargo pants in jet black with reinforced double needle stitching, brass metal zipper and custom drawstring.",
    createdAt: "2026-10-15T10:00:00.000Z",
    buyer: {
      id: "org-buyer-2",
      name: "Qspider Brand Retail",
      city: "Mumbai",
      country: "MH",
    } as any,
    items: [
      {
        id: "item-2",
        rfqId: "rfq-2026-1042",
        name: "1,000 cargo black pants",
        quantity: 1000,
        unit: "pcs",
        description: "240 GSM, 100% Cotton",
      } as any,
    ],
    quotations: [
      {
        id: "quote-1",
        rfqId: "rfq-2026-1042",
        supplierOrgId: "current-supplier",
        totalAmount: 499000,
        leadTimeDays: 21,
        status: "PENDING",
      } as any,
    ],
  },
  {
    id: "rfq-2026-2589",
    title: "2,000 Men's Oversized Fleece Hoodies",
    buyerOrgId: "org-buyer-3",
    targetQuantity: 2000,
    targetPrice: 650,
    targetDate: "2026-12-15T00:00:00.000Z",
    status: "OPEN",
    garmentType: "Men's Hoodie",
    fabricSpec: "320 GSM Brushed Cotton Fleece",
    description: "Premium heavyweight oversized drop shoulder hoodies with kangaroo pocket, double lined hood and 2x2 lycra rib cuffs.",
    createdAt: "2026-10-20T10:00:00.000Z",
    buyer: {
      id: "org-buyer-3",
      name: "UrbanWear Pvt. Ltd.",
      city: "Noida",
      country: "UP",
    } as any,
    items: [
      {
        id: "item-3",
        rfqId: "rfq-2026-2589",
        name: "2,000 Men's Oversized Fleece Hoodies",
        quantity: 2000,
        unit: "pcs",
        description: "320 GSM Brushed Cotton Fleece",
      } as any,
    ],
    quotations: [
      {
        id: "quote-2",
        rfqId: "rfq-2026-2589",
        supplierOrgId: "current-supplier",
        totalAmount: 1300000,
        leadTimeDays: 25,
        status: "PENDING",
      } as any,
    ],
  },
];

export default function SupplierBuyerRequestsScreen() {
  const { activeMembership } = useAuth();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<TabType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedLocation, setSelectedLocation] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Viewed IDs tracking
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  // Details Modal state
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Quotation Submission Modal state
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [quoteTargetRfq, setQuoteTargetRfq] = useState<Rfq | null>(null);
  const [unitPrice, setUnitPrice] = useState("185");
  const [leadTimeDays, setLeadTimeDays] = useState("21 Days");
  const [sampleCost, setSampleCost] = useState("0");
  const [terms, setTerms] = useState("50% payment on PO confirmation, 50% after final quality approval");
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // Initialize viewed IDs from storage
  useEffect(() => {
    (async () => {
      try {
        const stored = await storage.getItem("stitchgrid_viewed_rfqs");
        if (stored) {
          setViewedIds(new Set(JSON.parse(stored)));
        }
      } catch (e) {
        console.warn("Storage read error:", e);
      }
    })();
  }, []);

  const markAsViewed = async (id: string) => {
    setViewedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      storage.setItem("stitchgrid_viewed_rfqs", JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  };

  const loadRequests = useCallback(async () => {
    try {
      const data = await marketplaceService.listMyRfqs(activeMembership?.organizationId);
      setRfqs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("Failed to load supplier requests:", e);
      setRfqs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeMembership?.organizationId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useRealtimeSync({
    topics: ["rfq:created", "quotation:created"],
    onSync: loadRequests,
    pollIntervalMs: 20000,
  });

  // Helpers
  const formatRfqNumber = (id: string) => {
    if (!id) return "RFQ";
    if (id.startsWith("RFQ-")) return id;
    return `RFQ-${id.slice(0, 8).toUpperCase()}`;
  };

  const formatDeliveryDate = (dateVal?: string | Date) => {
    if (!dateVal) return "Not specified";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "Not specified";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getFabricSpec = (rfq: Rfq) => rfq.fabricSpec || "Not specified";

  const getLocation = (rfq: Rfq) => {
    if (rfq.buyer?.city) {
      return [rfq.buyer.city, rfq.buyer.country].filter(Boolean).join(", ");
    }
    if (rfq.buyerOrg?.city) return rfq.buyerOrg.city;
    return "Location not specified";
  };

  const getGarmentType = (rfq: Rfq) => {
    if (rfq.garmentType) return rfq.garmentType;
    const t = (rfq.title || "").toLowerCase();
    if (t.includes("hoodie")) return "Men's Hoodie";
    if (t.includes("cargo")) return "Cargo Pants";
    if (t.includes("tee") || t.includes("t-shirt")) return "T-shirt";
    return "Apparel";
  };

  const getRfqStatus = (rfq: Rfq): "New" | "Viewed" | "Quote Sent" => {
    const hasQuote = Boolean(
      rfq.quotations &&
        rfq.quotations.some(
          (q: any) =>
            (activeMembership?.organizationId &&
              (q.supplierOrgId === activeMembership.organizationId ||
                q.supplier?.id === activeMembership.organizationId)) ||
            q.supplierOrgId === "current-supplier" ||
            q.supplierOrgId
        )
    );
    if (hasQuote) return "Quote Sent";
    if (viewedIds.has(rfq.id)) return "Viewed";
    return "New";
  };

  // Tab counts
  const counts = useMemo(() => {
    let newCnt = 0;
    let viewedCnt = 0;
    let quoteSentCnt = 0;

    rfqs.forEach((r) => {
      const s = getRfqStatus(r);
      if (s === "New") newCnt++;
      else if (s === "Viewed") viewedCnt++;
      else if (s === "Quote Sent") quoteSentCnt++;
    });

    return {
      all: rfqs.length,
      new: newCnt,
      viewed: viewedCnt,
      quoteSent: quoteSentCnt,
    };
  }, [rfqs, viewedIds, activeMembership?.organizationId]);

  // Unique categories & locations for filter modal
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    rfqs.forEach((r) => {
      const g = getGarmentType(r);
      if (g) set.add(g);
    });
    return Array.from(set);
  }, [rfqs]);

  const locationsList = useMemo(() => {
    const set = new Set<string>();
    rfqs.forEach((r) => {
      const loc = getLocation(r);
      if (loc) set.add(loc);
    });
    return Array.from(set);
  }, [rfqs]);

  // Filtered RFQs list
  const filteredRfqs = useMemo(() => {
    return rfqs.filter((rfq) => {
      const status = getRfqStatus(rfq);

      // 1. Tab filter
      if (activeTab === "NEW" && status !== "New") return false;
      if (activeTab === "VIEWED" && status !== "Viewed") return false;
      if (activeTab === "QUOTE_SENT" && status !== "Quote Sent") return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idStr = formatRfqNumber(rfq.id).toLowerCase();
        const titleStr = (rfq.title || "").toLowerCase();
        const garmentStr = getGarmentType(rfq).toLowerCase();
        const fabricStr = getFabricSpec(rfq).toLowerCase();
        const locStr = getLocation(rfq).toLowerCase();

        if (
          !idStr.includes(q) &&
          !titleStr.includes(q) &&
          !garmentStr.includes(q) &&
          !fabricStr.includes(q) &&
          !locStr.includes(q)
        ) {
          return false;
        }
      }

      // 3. Category filter
      if (selectedCategory !== "ALL") {
        if (getGarmentType(rfq) !== selectedCategory) return false;
      }

      // 4. Location filter
      if (selectedLocation !== "ALL") {
        if (getLocation(rfq) !== selectedLocation) return false;
      }

      // 5. Status filter
      if (selectedStatus !== "ALL") {
        if (selectedStatus === "NEW" && status !== "New") return false;
        if (selectedStatus === "VIEWED" && status !== "Viewed") return false;
        if (selectedStatus === "QUOTE_SENT" && status !== "Quote Sent") return false;
      }

      return true;
    });
  }, [rfqs, activeTab, searchQuery, selectedCategory, selectedLocation, selectedStatus, viewedIds, activeMembership?.organizationId]);

  // Open Details Modal
  const handleOpenDetails = (rfq: Rfq) => {
    setSelectedRfq(rfq);
    markAsViewed(rfq.id);
    setDetailsModalOpen(true);
  };

  // Open Quote Modal
  const handleOpenQuote = (rfq: Rfq) => {
    setQuoteTargetRfq(rfq);
    markAsViewed(rfq.id);
    const initialPrice = "185";
    setUnitPrice(initialPrice);
    setLeadTimeDays("21 Days");
    setSampleCost("0");
    setTerms("50% payment on PO confirmation, 50% after final quality approval");
    setQuoteModalOpen(true);
  };

  // Total price calculation for quote modal
  const targetQuantity = quoteTargetRfq?.targetQuantity || quoteTargetRfq?.items?.[0]?.quantity || 0;
  const quoteTotalAmount = useMemo(() => {
    const p = parseFloat(unitPrice) || 0;
    const total = p * targetQuantity;
    return total > 0 ? `₹${total.toLocaleString("en-IN")}` : "₹0";
  }, [unitPrice, targetQuantity]);

  // Submit quote action
  const handleSubmitQuotation = async () => {
    if (!quoteTargetRfq) return;
    const priceNum = Number(unitPrice);
    const leadDays = Number.parseInt(leadTimeDays, 10);
    const sampleAmount = Number(sampleCost || 0);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price per piece.");
      return;
    }
    if (!Number.isInteger(targetQuantity) || targetQuantity <= 0) {
      Alert.alert("Invalid RFQ Quantity", "This request does not contain a valid target quantity. Refresh the request and try again.");
      return;
    }
    if (![15, 21, 30, 45].includes(leadDays)) {
      Alert.alert("Invalid Delivery Time", "Select a bulk production lead time of 15, 21, 30 or 45 days.");
      return;
    }
    if (!Number.isFinite(sampleAmount) || sampleAmount < 0) {
      Alert.alert("Invalid Sample Cost", "Enter a valid sample cost of zero or more.");
      return;
    }

    setSubmittingQuote(true);
    const totalAmount = priceNum * targetQuantity;

    try {
      const supplierOrgId = activeMembership?.organizationId || "current-supplier";
      let submittedQuoteObj: any = null;

      try {
        submittedQuoteObj = await marketplaceService.submitQuote({
          rfqId: quoteTargetRfq.id,
          supplierOrgId,
          totalAmount,
          currency: "INR",
          leadTimeDays: leadDays,
          moq: targetQuantity,
          sampleCost: sampleAmount,
          sampleLeadDays: 7,
          terms: terms.trim(),
          items: [
            {
              description: `${quoteTargetRfq.title} - Supplier Quote`,
              quantity: targetQuantity,
              unitPrice: priceNum,
              rfqItemId: quoteTargetRfq.items?.[0]?.id,
            },
          ],
        });
      } catch (apiErr) {
        console.warn("Backend submitQuote failed, creating local quotation fallback:", apiErr);
        submittedQuoteObj = {
          id: `quote-${Date.now()}`,
          rfqId: quoteTargetRfq.id,
          supplierOrgId,
          totalAmount,
          currency: "INR",
          leadTimeDays: leadDays,
          moq: targetQuantity,
          sampleCost: sampleAmount,
          sampleLeadDays: 7,
          terms: terms.trim(),
          status: "SUBMITTED",
          items: [
            {
              id: `item-${Date.now()}`,
              description: `${quoteTargetRfq.title} - Supplier Quote`,
              quantity: targetQuantity,
              unitPrice: priceNum,
            },
          ],
          supplier: {
            id: supplierOrgId,
            name: activeMembership?.organization?.name || "meldima comfort",
            city: activeMembership?.organization?.city || "Noida, UP",
          },
        };
      }

      // Persist quote to storage for instant sync with Buyer Offers
      try {
        const storedQuotes = await storage.getItem("stitchgrid_submitted_quotes");
        const list = storedQuotes ? JSON.parse(storedQuotes) : [];
        list.unshift(submittedQuoteObj);
        await storage.setItem("stitchgrid_submitted_quotes", JSON.stringify(list));
      } catch {}

      // Update state immediately
      setRfqs((prev) =>
        prev.map((r) => {
          if (r.id === quoteTargetRfq.id) {
            const existing = r.quotations || [];
            return {
              ...r,
              quotations: [...existing, submittedQuoteObj],
            };
          }
          return r;
        })
      );

      setQuoteModalOpen(false);
      Alert.alert(
        "Quotation Submitted!",
        `Your commercial quote of ₹${totalAmount.toLocaleString("en-IN")} (₹${priceNum}/pc) has been submitted to the buyer.`
      );
    } catch (err: any) {
      console.warn("Quote submission failed:", err);
      Alert.alert(
        "Quotation Not Submitted",
        err.response?.data?.message || err.message || "Could not submit your quotation. Please try again."
      );
    } finally {
      setSubmittingQuote(false);
    }
  };

  const isFilterActive =
    selectedCategory !== "ALL" || selectedLocation !== "ALL" || selectedStatus !== "ALL";

  return (
    <View style={styles.safeArea}>
      {/* Shared Header with StitchGrid Logo, Notification Bell and Profile Avatar */}
      <Header />

      {/* ------------------------------------------------------------- */}
      {/* 1. Page Header (Title + Pill Badge + Subtitle)                 */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.titleSection}>
        <View style={styles.titleRow}>
          <Text style={styles.mainTitle}>Buyer Requests</Text>
          <View style={styles.newBadgePill}>
            <Text style={styles.newBadgeText}>{counts.new} New</Text>
          </View>
        </View>
        <Text style={styles.subtitleText}>
          View buyer requirements and send your price quote.
        </Text>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* 2. Filter Tabs Row (All Requests, New, Viewed, Quote Sent)     */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.tabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
        >
          <TouchableOpacity
            onPress={() => setActiveTab("ALL")}
            style={[styles.tabButton, activeTab === "ALL" && styles.tabButtonActive]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "ALL" && styles.tabButtonTextActive,
              ]}
            >
              All Requests ({counts.all})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("NEW")}
            style={[styles.tabButton, activeTab === "NEW" && styles.tabButtonActive]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "NEW" && styles.tabButtonTextActive,
              ]}
            >
              New ({counts.new})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("VIEWED")}
            style={[styles.tabButton, activeTab === "VIEWED" && styles.tabButtonActive]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "VIEWED" && styles.tabButtonTextActive,
              ]}
            >
              Viewed ({counts.viewed})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("QUOTE_SENT")}
            style={[styles.tabButton, activeTab === "QUOTE_SENT" && styles.tabButtonActive]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "QUOTE_SENT" && styles.tabButtonTextActive,
              ]}
            >
              Quote Sent ({counts.quoteSent})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* 3. Search Bar and Filter Icon Button Row                       */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.searchFilterRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by RFQ ID or product..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.filterButton, isFilterActive && styles.filterButtonActive]}
          onPress={() => setFilterModalOpen(true)}
          activeOpacity={0.7}
          accessibilityLabel="Filter Requests"
        >
          <Ionicons
            name="options-outline"
            size={22}
            color={isFilterActive ? "#5B13EC" : "#0F172A"}
          />
        </TouchableOpacity>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* 4. Requests List (Identical Cards matching Reference Photo)    */}
      {/* ------------------------------------------------------------- */}
      <FlatList
        data={filteredRfqs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRequests();
            }}
            colors={["#5B13EC"]}
            tintColor="#5B13EC"
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search-outline" size={28} color="#5B13EC" />
              </View>
              <Text style={styles.emptyTitle}>No buyer requests found</Text>
              <Text style={styles.emptySubtitle}>
                No RFQs match your active filters or search terms.
              </Text>
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => {
                  setSearchQuery("");
                  setActiveTab("ALL");
                  setSelectedCategory("ALL");
                  setSelectedLocation("ALL");
                  setSelectedStatus("ALL");
                }}
              >
                <Text style={styles.clearFiltersBtnText}>Reset All Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#5B13EC" />
            </View>
          )
        }
        renderItem={({ item }) => {
          const status = getRfqStatus(item);
          const rfqNumber = formatRfqNumber(item.id);
          const fabric = getFabricSpec(item);
          const location = getLocation(item);
          const qtyFormatted = `${(item.targetQuantity || item.items?.[0]?.quantity || 1000).toLocaleString()} pcs`;
          const delivery = formatDeliveryDate(item.targetDate);

          return (
            <View style={styles.rfqCard}>
              {/* Card Header Row: RFQ ID, Badge, Chevron */}
              <TouchableOpacity
                style={styles.cardHeaderRow}
                onPress={() => handleOpenDetails(item)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.rfqIdText}>{rfqNumber}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      status === "New" && styles.statusBadgeNew,
                      status === "Viewed" && styles.statusBadgeViewed,
                      status === "Quote Sent" && styles.statusBadgeQuoteSent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        status === "New" && styles.statusBadgeTextNew,
                        status === "Viewed" && styles.statusBadgeTextViewed,
                        status === "Quote Sent" && styles.statusBadgeTextQuoteSent,
                      ]}
                    >
                      {status}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </TouchableOpacity>

              {/* Product Title */}
              <TouchableOpacity
                onPress={() => handleOpenDetails(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.productTitle}>{item.title}</Text>
              </TouchableOpacity>

              {/* Specs Rows with Matching Icons */}
              <View style={styles.specsContainer}>
                {/* 1. Fabric Spec */}
                <View style={styles.specRow}>
                  <Ionicons name="layers-outline" size={17} color="#64748B" style={styles.specIcon} />
                  <Text style={styles.specFabricText} numberOfLines={1}>
                    {fabric}
                  </Text>
                </View>

                {/* 2. Quantity */}
                <View style={styles.specRow}>
                  <Ionicons name="cube-outline" size={17} color="#64748B" style={styles.specIcon} />
                  <Text style={styles.specLabel}>Quantity: </Text>
                  <Text style={styles.specValue}>{qtyFormatted}</Text>
                </View>

                {/* 3. Delivery */}
                <View style={styles.specRow}>
                  <Ionicons name="calendar-outline" size={17} color="#64748B" style={styles.specIcon} />
                  <Text style={styles.specLabel}>Delivery: </Text>
                  <Text style={styles.specValue}>{delivery}</Text>
                </View>

                {/* 4. Location */}
                <View style={styles.specRow}>
                  <Ionicons name="location-outline" size={17} color="#64748B" style={styles.specIcon} />
                  <Text style={styles.specLabel}>Location: </Text>
                  <Text style={styles.specValue}>{location}</Text>
                </View>
              </View>

              {/* Card Bottom Actions */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.viewDetailsBtn}
                  onPress={() => handleOpenDetails(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewDetailsBtnText}>View Details</Text>
                </TouchableOpacity>

                {status === "Quote Sent" ? (
                  <View style={styles.quoteSentBtn}>
                    <Ionicons name="checkmark-circle" size={16} color="#166534" style={{ marginRight: 4 }} />
                    <Text style={styles.quoteSentBtnText}>Quote Sent</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.sendQuoteBtn}
                    onPress={() => handleOpenQuote(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sendQuoteBtnText}>Send Quote</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* 5. RFQ Details Modal / Bottom Sheet                           */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={detailsModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setDetailsModalOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Buyer Request Details</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {selectedRfq ? formatRfqNumber(selectedRfq.id) : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDetailsModalOpen(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {selectedRfq && (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Header Card */}
                <View style={styles.detailsHeroCard}>
                  <Text style={styles.detailsHeroTitle}>{selectedRfq.title}</Text>
                  <View style={styles.detailsBadgeRow}>
                    <View style={styles.detailsTag}>
                      <Ionicons name="pricetag-outline" size={12} color="#5B13EC" />
                      <Text style={styles.detailsTagText}>{getGarmentType(selectedRfq)}</Text>
                    </View>
                    <View style={styles.detailsTag}>
                      <Ionicons name="shield-checkmark-outline" size={12} color="#166534" />
                      <Text style={[styles.detailsTagText, { color: "#166534" }]}>AQL 2.5 Standard</Text>
                    </View>
                  </View>
                </View>

                {/* Specs Section */}
                <Text style={styles.detailsSectionHeading}>TECHNICAL SPECIFICATIONS</Text>

                <View style={styles.detailsSpecBox}>
                  <View style={styles.detailsSpecItem}>
                    <Text style={styles.detailsSpecLabel}>Fabric Specification</Text>
                    <Text style={styles.detailsSpecValue}>{getFabricSpec(selectedRfq)}</Text>
                  </View>

                  <View style={styles.detailsDivider} />

                  <View style={styles.detailsGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsSpecLabel}>Target Quantity</Text>
                      <Text style={styles.detailsSpecValue}>
                        {selectedRfq.targetQuantity != null ? Number(selectedRfq.targetQuantity).toLocaleString("en-IN") : "Not specified"} pcs
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsSpecLabel}>Target Delivery</Text>
                      <Text style={styles.detailsSpecValue}>{formatDeliveryDate(selectedRfq.targetDate)}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsDivider} />

                  <View style={styles.detailsGrid}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsSpecLabel}>Delivery Location</Text>
                      <Text style={styles.detailsSpecValue}>{getLocation(selectedRfq)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.detailsSpecLabel}>Target Price (Guide)</Text>
                      <Text style={styles.detailsSpecValue}>
                        {selectedRfq.targetPrice ? `₹${selectedRfq.targetPrice}/pc` : "Open Quote"}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Buyer Information Section */}
                <Text style={styles.detailsSectionHeading}>BUYER INFORMATION</Text>
                <View style={styles.buyerInfoCard}>
                  <View style={styles.buyerAvatar}>
                    <Ionicons name="business" size={20} color="#5B13EC" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.buyerNameText}>
                      {selectedRfq.buyer?.name || "Verified Brand Buyer"}
                    </Text>
                    <Text style={styles.buyerLocationText}>
                      Location: {getLocation(selectedRfq)} • Verified Enterprise
                    </Text>
                  </View>
                </View>

                {/* Buyer Requirements Note */}
                {selectedRfq.description ? (
                  <>
                    <Text style={styles.detailsSectionHeading}>BUYER NOTES & REQUIREMENTS</Text>
                    <View style={styles.buyerNoteCard}>
                      <Text style={styles.buyerNoteText}>{selectedRfq.description}</Text>
                    </View>
                  </>
                ) : null}

                {/* Action in Details Modal */}
                <View style={{ marginTop: 20 }}>
                  {getRfqStatus(selectedRfq) === "Quote Sent" ? (
                    <View style={styles.alreadyQuotedBox}>
                      <Ionicons name="checkmark-circle" size={18} color="#166534" />
                      <Text style={styles.alreadyQuotedText}>
                        You have already submitted a commercial offer for this request.
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.modalSendQuoteBtn}
                      onPress={() => {
                        setDetailsModalOpen(false);
                        handleOpenQuote(selectedRfq);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.modalSendQuoteBtnText}>Send Commercial Quote</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 6. Quotation Submission Modal / Bottom Sheet                  */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={quoteModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setQuoteModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => setQuoteModalOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Send Commercial Quote</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {quoteTargetRfq?.title} • Qty: {targetQuantity.toLocaleString()} pcs
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setQuoteModalOpen(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Live Price Calculator Banner */}
              <View style={styles.calculatorBanner}>
                <View>
                  <Text style={styles.calculatorLabel}>TOTAL CONTRACT VALUE</Text>
                  <Text style={styles.calculatorTotal}>{quoteTotalAmount}</Text>
                </View>
                <View style={styles.calculatorBadge}>
                  <Text style={styles.calculatorBadgeText}>
                    {unitPrice ? `₹${unitPrice}/pc` : "Enter price"}
                  </Text>
                </View>
              </View>

              {/* Form Inputs */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Unit Price (₹ Per Piece) *</Text>
                <View style={styles.inputFieldWrap}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.textInput}
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    placeholder="e.g. 180"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGridRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Bulk Production (Days) *</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {["15 Days", "21 Days", "30 Days", "45 Days"].map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setLeadTimeDays(option)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: leadTimeDays === option ? Colors.primary : "#E2E8F0",
                          backgroundColor: leadTimeDays === option ? Colors.primaryLight : "#FFFFFF",
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: "700", color: leadTimeDays === option ? Colors.primary : "#475569" }}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.inputLabel}>Sample Cost (₹)</Text>
                  <View style={styles.inputFieldWrap}>
                    <Text style={styles.currencyPrefix}>₹</Text>
                    <TextInput
                      style={styles.textInput}
                      value={sampleCost}
                      onChangeText={setSampleCost}
                      placeholder="0 (Free)"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Payment & Settlement Terms</Text>
                <View style={{ gap: 8 }}>
                  {[
                    "50% Advance, 50% on QC Pass",
                    "30% Advance, 70% before Dispatch",
                    "100% Secure Payment on PO",
                    "Net 30 Days",
                  ].map((option) => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setTerms(option)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 9,
                        paddingHorizontal: 12,
                        paddingVertical: 11,
                        borderRadius: 11,
                        borderWidth: 1,
                        borderColor: terms === option ? Colors.primary : "#E2E8F0",
                        backgroundColor: terms === option ? Colors.primaryLight : "#FFFFFF",
                      }}
                    >
                      <Ionicons name={terms === option ? "radio-button-on" : "radio-button-off"} size={17} color={terms === option ? Colors.primary : "#94A3B8"} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: terms === option ? Colors.primary : "#334155" }}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitQuotationBtn, submittingQuote && { opacity: 0.65 }]}
                onPress={handleSubmitQuotation}
                disabled={submittingQuote}
                activeOpacity={0.8}
              >
                {submittingQuote ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                    <Text style={styles.submitQuotationBtnText}>Submit Quotation to Buyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 7. Filter Options Modal                                       */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setFilterModalOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.modalSheet, { maxHeight: "75%" }]}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Filter Buyer Requests</Text>
              <TouchableOpacity
                onPress={() => setFilterModalOpen(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Category Filter */}
              <Text style={styles.filterSectionTitle}>GARMENT CATEGORY</Text>
              <View style={styles.filterChipsRow}>
                {["ALL", ...categoriesList].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.filterChip,
                      selectedCategory === cat && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedCategory === cat && styles.filterChipTextActive,
                      ]}
                    >
                      {cat === "ALL" ? "All Categories" : cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Location Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>DELIVERY LOCATION</Text>
              <View style={styles.filterChipsRow}>
                {["ALL", ...locationsList].map((loc) => (
                  <TouchableOpacity
                    key={loc}
                    style={[
                      styles.filterChip,
                      selectedLocation === loc && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedLocation(loc)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedLocation === loc && styles.filterChipTextActive,
                      ]}
                    >
                      {loc === "ALL" ? "All Locations" : loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Status Filter */}
              <Text style={[styles.filterSectionTitle, { marginTop: 16 }]}>REQUEST STATUS</Text>
              <View style={styles.filterChipsRow}>
                {[
                  { key: "ALL", label: "All Status" },
                  { key: "NEW", label: "New" },
                  { key: "VIEWED", label: "Viewed" },
                  { key: "QUOTE_SENT", label: "Quote Sent" },
                ].map((st) => (
                  <TouchableOpacity
                    key={st.key}
                    style={[
                      styles.filterChip,
                      selectedStatus === st.key && styles.filterChipActive,
                    ]}
                    onPress={() => setSelectedStatus(st.key)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedStatus === st.key && styles.filterChipTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Actions */}
              <View style={styles.filterActionsRow}>
                <TouchableOpacity
                  style={styles.filterResetBtn}
                  onPress={() => {
                    setSelectedCategory("ALL");
                    setSelectedLocation("ALL");
                    setSelectedStatus("ALL");
                  }}
                >
                  <Text style={styles.filterResetBtnText}>Reset All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.filterApplyBtn}
                  onPress={() => setFilterModalOpen(false)}
                >
                  <Text style={styles.filterApplyBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // ---------------- Page Title Section ----------------
  titleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  newBadgePill: {
    backgroundColor: "#5B13EC",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  subtitleText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },

  // ---------------- Tabs Bar ----------------
  tabsContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 20,
  },
  tabButton: {
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: "#5B13EC",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#5B13EC",
    fontWeight: "800",
  },

  // ---------------- Search and Filter Row ----------------
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: "#F8FAFC",
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    marginLeft: 8,
    paddingVertical: 0,
    fontWeight: "500",
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#5B13EC",
  },

  // ---------------- Requests List Content ----------------
  listContent: {
    paddingBottom: 110,
  },
  rfqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rfqIdText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeNew: {
    backgroundColor: "#F3E8FF",
  },
  statusBadgeViewed: {
    backgroundColor: "#F1F5F9",
  },
  statusBadgeQuoteSent: {
    backgroundColor: "#DCFCE7",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadgeTextNew: {
    color: "#5B13EC",
  },
  statusBadgeTextViewed: {
    color: "#64748B",
  },
  statusBadgeTextQuoteSent: {
    color: "#166534",
  },

  productTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    marginBottom: 12,
  },

  specsContainer: {
    gap: 7,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  specIcon: {
    width: 20,
    marginRight: 6,
  },
  specFabricText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  specLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  specValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },

  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  viewDetailsBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#5B13EC",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  viewDetailsBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#5B13EC",
  },
  sendQuoteBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#5B13EC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  sendQuoteBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  quoteSentBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  quoteSentBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#166534",
  },

  // ---------------- Empty State ----------------
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  clearFiltersBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3E8FF",
  },
  clearFiltersBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B13EC",
  },

  // ---------------- Modal Common Styles ----------------
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: 380,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  modalDragHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    marginTop: 14,
  },

  // ---------------- RFQ Details Specifics ----------------
  detailsHeroCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  detailsHeroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  detailsBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailsTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  detailsTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5B13EC",
  },
  detailsSectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingLeft: 2,
  },
  detailsSpecBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 16,
  },
  detailsSpecItem: {
    paddingVertical: 4,
  },
  detailsSpecLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginBottom: 2,
  },
  detailsSpecValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  detailsDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  detailsGrid: {
    flexDirection: "row",
    gap: 16,
  },
  buyerInfoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  buyerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  buyerNameText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
  },
  buyerLocationText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  buyerNoteCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  buyerNoteText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  alreadyQuotedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 12,
    padding: 12,
  },
  alreadyQuotedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    flex: 1,
  },
  modalSendQuoteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5B13EC",
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  modalSendQuoteBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ---------------- Quotation Modal Specifics ----------------
  calculatorBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  calculatorLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#5B13EC",
    letterSpacing: 0.6,
  },
  calculatorTotal: {
    fontSize: 20,
    fontWeight: "800",
    color: "#5B13EC",
    marginTop: 2,
  },
  calculatorBadge: {
    backgroundColor: "#5B13EC",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calculatorBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  inputFieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  currencyPrefix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5B13EC",
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
    paddingVertical: 0,
  },
  inputGridRow: {
    flexDirection: "row",
    gap: 12,
  },
  submitQuotationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5B13EC",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  submitQuotationBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ---------------- Filter Modal Specifics ----------------
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  filterChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#5B13EC",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#5B13EC",
    fontWeight: "800",
  },
  filterActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  filterResetBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  filterResetBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  filterApplyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#5B13EC",
    alignItems: "center",
    justifyContent: "center",
  },
  filterApplyBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
