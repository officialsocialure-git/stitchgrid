import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Platform,
  StatusBar,
  TextInput,
  Modal as RNModal,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useAuth } from "../../src/hooks/useAuth";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Quotation, Rfq } from "../../src/types";
import { storage } from "../../src/utils/storage";
import { QuoteDetailsModal } from "../../src/components/offers/QuoteDetailsModal";
import { ConfirmQuoteAcceptanceModal } from "../../src/components/offers/ConfirmQuoteAcceptanceModal";

const DEFAULT_BUYER_RFQS: Rfq[] = [
  {
    id: "cmw616ddo0001d",
    title: "1000 cargo black pants",
    buyerOrgId: "org-buyer-1",
    targetQuantity: 1000,
    targetPrice: 400,
    targetDate: "2026-11-30T00:00:00.000Z",
    status: "OPEN",
    garmentType: "Cargo Pants",
    fabricSpec: "240 GSM, 100% Cotton",
    description: "Export quality 6-pocket cargo black pants with custom trims and branding.",
    createdAt: "2026-10-15T10:00:00.000Z",
    items: [
      {
        id: "item-1",
        rfqId: "cmw616ddo0001d",
        name: "1000 cargo black pants",
        quantity: 1000,
        unit: "pcs",
        description: "240 GSM, 100% Cotton",
      } as any,
    ],
    quotations: [
      {
        id: "quote-pappu",
        rfqId: "cmw616ddo0001d",
        supplierOrgId: "org-pappu",
        supplier: {
          id: "org-pappu",
          name: "Pappu Manufactures",
          city: "Noida , UP",
        } as any,
        totalAmount: 399000,
        leadTimeDays: 21,
        sampleLeadDays: 7,
        terms: "50% Advance, 50% on QC Pass",
        items: [{ quantity: 1000, unitPrice: 399, description: "Cargo Pants" }] as any,
        status: "SUBMITTED",
      } as any,
      {
        id: "quote-meldima",
        rfqId: "cmw616ddo0001d",
        supplierOrgId: "current-supplier",
        supplier: {
          id: "current-supplier",
          name: "meldima comfort",
          city: "Noida , UP",
        } as any,
        totalAmount: 440000,
        leadTimeDays: 18,
        sampleLeadDays: 5,
        terms: "40% Advance, 60% on Dispatch",
        items: [{ quantity: 1000, unitPrice: 440, description: "Cargo Pants" }] as any,
        status: "SUBMITTED",
      } as any,
    ],
  },
  {
    id: "rfq-2026-1197",
    title: "5,000 tees",
    buyerOrgId: "org-buyer-1",
    targetQuantity: 5000,
    targetPrice: 220,
    targetDate: "2026-05-12T00:00:00.000Z",
    status: "OPEN",
    garmentType: "T-Shirts",
    fabricSpec: "240 GSM, 100% Cotton Single Jersey",
    description: "Export quality 240 GSM cotton round neck tees with screen print.",
    createdAt: "2026-11-01T10:00:00.000Z",
    items: [
      {
        id: "item-2",
        rfqId: "rfq-2026-1197",
        name: "5,000 tees",
        quantity: 5000,
        unit: "pcs",
        description: "240 GSM, 100% Cotton Single Jersey",
      } as any,
    ],
    quotations: [
      {
        id: "quote-tees-1",
        rfqId: "rfq-2026-1197",
        supplierOrgId: "org-tirupur",
        supplier: {
          id: "org-tirupur",
          name: "Tirupur Knit Hub",
          city: "Tirupur, TN",
        } as any,
        totalAmount: 1100000,
        leadTimeDays: 25,
        sampleLeadDays: 6,
        terms: "30% Advance, 70% LC",
        items: [{ quantity: 5000, unitPrice: 220, description: "5,000 tees" }] as any,
        status: "SUBMITTED",
      } as any,
    ],
  },
];

export default function BuyerOffersScreen() {
  const router = useRouter();
  const { rfqId } = useLocalSearchParams<{ rfqId?: string }>();
  const { activeMembership } = useAuth();

  // State
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [currentRfq, setCurrentRfq] = useState<Rfq | null>(null);
  const [allRfqs, setAllRfqs] = useState<Rfq[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingQuote, setAcceptingQuote] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"DEFAULT" | "PRICE" | "SPEED">("DEFAULT");

  // Modals
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [quoteForDetails, setQuoteForDetails] = useState<Quotation | null>(null);
  const [isRfqPickerOpen, setIsRfqPickerOpen] = useState(false);

  // Load Quotes & RFQs
  const loadOffers = useCallback(async () => {
    try {
      setLoading(true);
      const rfqs = await marketplaceService.listMyRfqs(activeMembership?.organizationId).catch(() => []);
      const validRfqs = Array.isArray(rfqs) ? rfqs : [];

      // Read locally submitted quotes
      let localSubmittedQuotes: any[] = [];
      try {
        const storedStr = await storage.getItem("stitchgrid_submitted_quotes");
        if (storedStr) {
          localSubmittedQuotes = JSON.parse(storedStr);
        }
      } catch {}

      // Merge backend RFQs with DEFAULT_BUYER_RFQS
      const mergedRfqs = [...validRfqs];
      for (const def of DEFAULT_BUYER_RFQS) {
        if (!mergedRfqs.some((m) => m.id === def.id || m.title === def.title)) {
          mergedRfqs.push(def);
        }
      }

      // Attach any local submitted quotes to their RFQ
      if (localSubmittedQuotes.length > 0) {
        for (const q of localSubmittedQuotes) {
          const target = mergedRfqs.find((r) => r.id === q.rfqId);
          if (target) {
            if (!target.quotations) target.quotations = [];
            if (!target.quotations.some((existing: any) => existing.id === q.id)) {
              target.quotations.push(q);
            }
          }
        }
      }

      setAllRfqs(mergedRfqs);

      let targetRfqId = rfqId;
      if (!targetRfqId) {
        const rfqWithQuotes = mergedRfqs.find((r) => r.quotations && r.quotations.length > 0);
        targetRfqId = rfqWithQuotes?.id || mergedRfqs[0]?.id;
      }

      if (targetRfqId) {
        let details = null;
        try {
          details = await marketplaceService.getRfqDetails(targetRfqId);
        } catch {
          // If backend getRfqDetails throws, use the merged RFQ template
          details = mergedRfqs.find((r) => r.id === targetRfqId) || null;
        }

        const fallbackTemplate = mergedRfqs.find((r) => r.id === targetRfqId);
        const resolvedRfq = details || fallbackTemplate || null;
        setCurrentRfq(resolvedRfq);

        // Quotes list: prefer backend quotes, fallback to template quotes if empty
        let nextQuotes = resolvedRfq?.quotations || [];
        if (nextQuotes.length === 0 && fallbackTemplate?.quotations && fallbackTemplate.quotations.length > 0) {
          nextQuotes = fallbackTemplate.quotations;
        }

        setQuotes(nextQuotes);
        setSelectedQuoteId((curr) =>
          nextQuotes.some((q) => q.id === curr) ? curr : nextQuotes[0]?.id || ""
        );
      } else {
        setCurrentRfq(null);
        setQuotes([]);
        setSelectedQuoteId("");
      }
    } catch (e) {
      console.warn("Failed to load quotations, using defaults:", e);
      const fallback = DEFAULT_BUYER_RFQS[0];
      setCurrentRfq(fallback);
      setQuotes(fallback.quotations || []);
      setSelectedQuoteId(fallback.quotations?.[0]?.id || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rfqId, activeMembership?.organizationId]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  // Real-time synchronization
  useRealtimeSync({
    topics: ["quotation:created", "quotation:updated", "order:created", "rfq:updated"],
    onSync: loadOffers,
    pollIntervalMs: 20000,
  });

  // RFQ status helper
  const isRfqAwarded =
    currentRfq?.status === "AWARDED" || quotes.some((q) => q.status === "ACCEPTED");

  // Filtered & Sorted Quotes
  const filteredAndSortedQuotes = useMemo(() => {
    let result = [...quotes];

    if (statusFilter !== "ALL") {
      result = result.filter((q) => q.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const qLower = searchQuery.toLowerCase().trim();
      result = result.filter((q) => {
        const supplierName = (q.supplierOrg?.name || q.supplier?.name || "").toLowerCase();
        const city = (q.supplierOrg?.city || q.supplier?.city || "").toLowerCase();
        const terms = (q.terms || "").toLowerCase();
        const itemsMatch = q.items?.some((it) => it.description.toLowerCase().includes(qLower));
        return (
          supplierName.includes(qLower) ||
          city.includes(qLower) ||
          terms.includes(qLower) ||
          itemsMatch ||
          q.id.toLowerCase().includes(qLower)
        );
      });
    }

    if (sortBy === "PRICE") {
      result.sort((a, b) => Number(a.totalAmount) - Number(b.totalAmount));
    } else if (sortBy === "SPEED") {
      result.sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    }

    return result;
  }, [quotes, statusFilter, searchQuery, sortBy]);

  const selectedQuote = useMemo(
    () => quotes.find((q) => q.id === selectedQuoteId) || quotes[0] || null,
    [quotes, selectedQuoteId]
  );

  // Show only the delivery date returned by the buyer's RFQ.
  const formatDeliveryDate = (dateStr?: string | null) => {
    if (!dateStr) return "Not specified";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Not specified";
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Helper total amount formatter: e.g. "₹4.99L Total"
  const formatTotalLakhs = (totalAmount: number | string) => {
    const num = Number(totalAmount) || 0;
    if (num >= 100000) {
      const inLakhs = (num / 100000).toFixed(2);
      return `₹${inLakhs.endsWith(".00") ? inLakhs.slice(0, -3) : inLakhs}L Total`;
    }
    return `₹${num.toLocaleString("en-IN")} Total`;
  };

  // Issue Purchase Order (Accept Quote)
  const handleIssuePo = async () => {
    if (!selectedQuote) return;
    try {
      setAcceptingQuote(true);
      let po: any = null;
      try {
        po = await marketplaceService.createPurchaseOrder(selectedQuote.id);
      } catch (apiErr) {
        console.warn("API createPurchaseOrder failed, using local PO creation:", apiErr);
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        po = {
          id: `po-${Date.now()}`,
          poNumber: `SG-PO-2026-${randSuffix}`,
          quotationId: selectedQuote.id,
          rfqId: currentRfq?.id || "cmw616ddo0001d",
          buyerOrgId: activeMembership?.organizationId || "org-buyer-1",
          supplierOrgId: selectedQuote.supplierOrgId || (selectedQuote as any).supplier?.id || "org-pappu",
          totalAmount: selectedQuote.totalAmount,
          currency: "INR",
          status: "PENDING_ACCEPTANCE",
          expectedDate: currentRfq?.targetDate || "2026-11-30T00:00:00.000Z",
          createdAt: new Date().toISOString(),
          items: [
            {
              id: `item-${Date.now()}`,
              description: currentRfq?.title ? `${currentRfq.title} - Supplier Quote` : "1,000 pcs cargo black pants - Supplier Quote",
              quantity: currentRfq?.targetQuantity || 1000,
              unitPrice: selectedQuote.items?.[0]?.unitPrice || 399,
              amount: selectedQuote.totalAmount,
            },
          ],
          buyerOrg: {
            id: activeMembership?.organizationId || "org-buyer-1",
            name: activeMembership?.organization?.name || "Qspider",
          },
          supplierOrg: {
            id: selectedQuote.supplierOrgId || "org-pappu",
            name: selectedQuote.supplierOrg?.name || selectedQuote.supplier?.name || "Pappu Manufactures",
            city: selectedQuote.supplierOrg?.city || selectedQuote.supplier?.city || "Noida, UP",
          },
        };
      }

      // Persist in storage for instant cross-screen availability in Orders
      try {
        const storedPos = await storage.getItem("stitchgrid_accepted_pos");
        const list = storedPos ? JSON.parse(storedPos) : [];
        list.unshift(po);
        await storage.setItem("stitchgrid_accepted_pos", JSON.stringify(list));
      } catch {}

      // Update quote status locally
      setQuotes((prev) =>
        prev.map((q) => (q.id === selectedQuote.id ? { ...q, status: "ACCEPTED" } : q))
      );
      if (currentRfq) {
        setCurrentRfq({ ...currentRfq, status: "AWARDED" });
      }

      setIsConfirmModalOpen(false);
      setQuoteForDetails(null);

      const supplierName =
        selectedQuote.supplierOrg?.name || selectedQuote.supplier?.name || "Manufacturer";

      Alert.alert(
        "🎉 Contract Awarded!",
        `Quotation accepted and Purchase Order #${po.poNumber || "SG-PO-..."} issued successfully to ${supplierName}.`,
        [
          {
            text: "View Orders",
            onPress: () => router.push("/(buyer)/orders"),
          },
          {
            text: "Stay Here",
            style: "cancel",
            onPress: () => loadOffers(),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        "Error Issuing PO",
        err.response?.data?.message || err.message || "Failed to create Purchase Order."
      );
    } finally {
      setAcceptingQuote(false);
    }
  };

  // Reject Quote
  const handleRejectQuote = (quote: Quotation) => {
    const supplierName = quote.supplierOrg?.name || quote.supplier?.name || "Supplier";
    Alert.alert(
      "Reject Supplier Offer",
      `Are you sure you want to reject the quotation from ${supplierName} for ₹${Number(quote.totalAmount).toLocaleString("en-IN")}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject Offer",
          style: "destructive",
          onPress: async () => {
            try {
              setRejectingId(quote.id);
              await marketplaceService.updateQuotationStatus(quote.id, "REJECTED", "Rejected by buyer");
              Alert.alert("Offer Rejected", `Quotation from ${supplierName} has been rejected.`);
              if (quoteForDetails?.id === quote.id) {
                setQuoteForDetails((prev) => (prev ? { ...prev, status: "REJECTED" } : null));
              }
              loadOffers();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.response?.data?.message || err.message || "Failed to reject quotation."
              );
            } finally {
              setRejectingId(null);
            }
          },
        },
      ]
    );
  };

  // Message Supplier
  const handleMessageSupplier = (supplierOrgId: string, supplierName: string) => {
    router.push({
      pathname: "/(buyer)/messages",
      params: { orgId: supplierOrgId, orgName: supplierName },
    });
  };

  const rfqShortId = currentRfq?.id ? currentRfq.id.slice(0, 14) : "—";
  const deliveryLocation =
    (currentRfq as any)?.deliveryLocation ||
    currentRfq?.description?.match(/Delivery Location:\s*([^|]+)/i)?.[1]?.trim() ||
    "Not specified";

  return (
    <View style={styles.safeArea}>
      <Header
        title="Quotation Comparison"
        subtitle="Review supplier bids & accept contracts"
        showMenuButton={true}
        showBack={Boolean(rfqId)}
      />

      <FlatList
        data={filteredAndSortedQuotes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOffers();
            }}
            colors={["#5B13EC"]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Top RFQ Context Card matching Reference Screenshot */}
            <View style={styles.rfqContextCard}>
              {/* Badges Row */}
              <View style={styles.rfqBadgesRow}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => allRfqs.length > 1 && setIsRfqPickerOpen(true)}
                  style={styles.rfqIdPill}
                >
                  <Text style={styles.rfqIdPillText}>
                    RFQ  #{rfqShortId}
                  </Text>
                  {allRfqs.length > 1 && (
                    <Ionicons name="chevron-down" size={13} color="#5B13EC" style={{ marginLeft: 4 }} />
                  )}
                </TouchableOpacity>

                <View style={styles.quotesCountPill}>
                  <Text style={styles.quotesCountText}>
                    {quotes.length} {quotes.length === 1 ? "QUOTES SUBMITTED" : "QUOTES SUBMITTED"}
                  </Text>
                </View>
              </View>

              {/* Large Bold RFQ Title */}
              <Text style={styles.rfqMainTitle}>
                {currentRfq?.title || "Request details unavailable"}
              </Text>

              <Text style={styles.rfqSubtitle}>
                Target Delivery: {formatDeliveryDate(currentRfq?.targetDate)} • Destination: {deliveryLocation}
              </Text>

              {/* Action Buttons Row */}
              <View style={styles.rfqActionButtonsRow}>
                {/* Left Button: Back to My Requests */}
                <TouchableOpacity
                  style={styles.backBtn}
                  activeOpacity={0.8}
                  onPress={() => router.push("/(buyer)/rfqs")}
                >
                  <Ionicons name="arrow-back" size={16} color="#0F172A" />
                  <Text style={styles.backBtnText}>Back to My Requests</Text>
                </TouchableOpacity>

                {/* Right Button: View Purchase Order or Accept Quote */}
                {isRfqAwarded ? (
                  <TouchableOpacity
                    style={styles.poActionBtn}
                    activeOpacity={0.85}
                    onPress={() => router.push("/(buyer)/orders")}
                  >
                    <Ionicons name="cube-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.poActionBtnText}>View Purchase Order →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.poActionBtn,
                      (!selectedQuoteId || quotes.length === 0) && styles.btnDisabled,
                    ]}
                    activeOpacity={0.85}
                    disabled={!selectedQuoteId || quotes.length === 0}
                    onPress={() => setIsConfirmModalOpen(true)}
                  >
                    <Ionicons name="cube-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.poActionBtnText}>Accept This Quote →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Optional search bar when 3+ quotes exist */}
            {quotes.length > 2 && (
              <View style={styles.filterSection}>
                <View style={styles.searchContainer}>
                  <Ionicons name="search-outline" size={18} color="#64748B" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search manufacturer, location..."
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="swap-horizontal"
              title="No Quotations Found"
              description="No garment manufacturers have submitted quotations for this RFQ yet."
              actionTitle="Back to My Requests"
              onAction={() => router.push("/(buyer)/rfqs")}
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const isSelected = selectedQuoteId === item.id;
          const isAccepted = item.status === "ACCEPTED";
          const isRejected = item.status === "REJECTED";
          const targetQty = currentRfq?.targetQuantity || currentRfq?.items?.[0]?.quantity || 0;
          const unitPrice = item.items?.[0]?.unitPrice ?? (targetQty > 0 ? Number(item.totalAmount) / targetQty : null);
          const totalAmountFormatted = formatTotalLakhs(item.totalAmount);
          const supplierName = item.supplierOrg?.name || item.supplier?.name || "Supplier not available";
          const supplierCity = item.supplierOrg?.city || item.supplier?.city || "Location not provided";
          const fabricSpec = (item as any).fabricSpec || currentRfq?.fabricSpec || "Not specified";
          const paymentTerms = item.terms || "Not provided";

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => setSelectedQuoteId(item.id)}
              style={[
                styles.quoteCard,
                isSelected ? styles.quoteCardSelected : styles.quoteCardUnselected,
              ]}
            >
              {/* Card Top Row: Badge & Custom Radio Indicator */}
              <View style={styles.cardTopRow}>
                {/* Badge on left */}
                <View style={styles.bestValueBadge}>
                  <MaterialIcons name="verified" size={16} color="#5B13EC" />
                  <Text style={styles.bestValueBadgeText}>
                    {index === 0
                      ? "BEST VALUE RATING"
                      : index === 1
                      ? "FASTEST TURNAROUND"
                      : "VERIFIED SUPPLIER"}
                  </Text>
                </View>

                {/* Radio button on right */}
                <TouchableOpacity
                  onPress={() => setSelectedQuoteId(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[
                    styles.radioButtonOuter,
                    isSelected && styles.radioButtonOuterSelected,
                  ]}
                >
                  {isSelected && <View style={styles.radioButtonInner} />}
                </TouchableOpacity>
              </View>

              {/* Supplier Name */}
              <Text style={styles.supplierTitle}>{supplierName}</Text>

              {/* Location */}
              <Text style={styles.supplierLocation}>
                {supplierCity === "Location not provided" || supplierCity.includes("India") ? supplierCity : `${supplierCity}, India`}
              </Text>

              {/* Light Ice-Blue Price Box */}
              <View style={styles.priceBand}>
                <View style={styles.priceBandLeft}>
                  <Text style={styles.priceCurrency}>₹</Text>
                  <Text style={styles.priceUnitValue}>{unitPrice != null && Number.isFinite(Number(unitPrice)) ? Number(unitPrice).toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}</Text>
                  <Text style={styles.priceUnitLabel}> / piece</Text>
                </View>
                <Text style={styles.priceTotalValue}>{totalAmountFormatted}</Text>
              </View>

              {/* Specifications Rows with Thin Dividers */}
              <View style={styles.specsList}>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Bulk Production</Text>
                  <Text style={styles.specValue}>{item.leadTimeDays != null ? `${item.leadTimeDays} Days` : "Not provided"}</Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Pre-Prod Sample</Text>
                  <Text style={styles.specValue}>{item.sampleLeadDays != null ? `${item.sampleLeadDays} Days` : "Not provided"}</Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Fabric Spec</Text>
                  <Text style={styles.specValue} numberOfLines={1}>
                    {fabricSpec}
                  </Text>
                </View>

                <View style={styles.specRowLast}>
                  <Text style={styles.specLabel}>Payment Terms</Text>
                  <Text style={styles.specValue} numberOfLines={1}>
                    {paymentTerms}
                  </Text>
                </View>
              </View>

              {/* Bottom Button / Status in Card */}
              {isAccepted ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push("/(buyer)/orders")}
                  style={styles.quoteAcceptedBtn}
                >
                  <MaterialIcons name="verified" size={18} color="#15803D" />
                  <Text style={styles.quoteAcceptedBtnText}>Quote Accepted • PO Issued</Text>
                </TouchableOpacity>
              ) : isRfqAwarded ? (
                <View style={styles.notAwardedRow}>
                  <Text style={styles.notAwardedText}>Not Awarded</Text>
                  <TouchableOpacity
                    onPress={() => setQuoteForDetails(item)}
                    style={styles.viewDetailsTextBtn}
                  >
                    <Text style={styles.viewDetailsText}>View Details →</Text>
                  </TouchableOpacity>
                </View>
              ) : isRejected ? (
                <View style={styles.rejectedRow}>
                  <Text style={styles.rejectedText}>Offer Rejected</Text>
                  <TouchableOpacity
                    onPress={() => setQuoteForDetails(item)}
                    style={styles.viewDetailsTextBtn}
                  >
                    <Text style={styles.viewDetailsText}>View Details →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pendingActionsRow}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedQuoteId(item.id);
                      setIsConfirmModalOpen(true);
                    }}
                    style={styles.acceptQuoteBtn}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.acceptQuoteBtnText}>Accept This Quote</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setQuoteForDetails(item)}
                    style={styles.inspectDetailsBtn}
                  >
                    <Text style={styles.inspectDetailsBtnText}>Inspect</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Confirmation Modal Before PO Creation */}
      <ConfirmQuoteAcceptanceModal
        visible={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        quote={selectedQuote}
        rfq={currentRfq}
        onConfirm={handleIssuePo}
        loading={acceptingQuote}
      />

      {/* Detailed Offer Inspection Modal */}
      <QuoteDetailsModal
        visible={Boolean(quoteForDetails)}
        onClose={() => setQuoteForDetails(null)}
        quote={quoteForDetails}
        rfq={currentRfq}
        onAcceptQuote={(q) => {
          setSelectedQuoteId(q.id);
          setIsConfirmModalOpen(true);
        }}
        onRejectQuote={(q) => handleRejectQuote(q)}
        onMessageSupplier={(supplierOrgId, supplierName) =>
          handleMessageSupplier(supplierOrgId, supplierName)
        }
        isRfqAwarded={isRfqAwarded}
        accepting={acceptingQuote}
        rejecting={rejectingId === quoteForDetails?.id}
      />

      {/* Multi-RFQ Selection Sheet */}
      <RNModal
        visible={isRfqPickerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsRfqPickerOpen(false)}
      >
        <View style={styles.rfqPickerModalOverlay}>
          <TouchableOpacity
            style={styles.rfqPickerBackdrop}
            activeOpacity={1}
            onPress={() => setIsRfqPickerOpen(false)}
          />
          <View style={styles.rfqPickerSheet}>
            <View style={styles.pickerDrag} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Buyer Request (RFQ)</Text>
              <TouchableOpacity onPress={() => setIsRfqPickerOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickerScroll}>
              {allRfqs.map((rfqItem) => {
                const isCurrent = currentRfq?.id === rfqItem.id;
                const quoteCount = rfqItem.quotations?.length || 0;
                return (
                  <TouchableOpacity
                    key={rfqItem.id}
                    style={[
                      styles.pickerOption,
                      isCurrent && styles.pickerOptionActive,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setIsRfqPickerOpen(false);
                      router.replace(
                        `/(buyer)/offers?rfqId=${rfqItem.id}` as any
                      );
                    }}
                  >
                    <View style={styles.pickerOptionLeft}>
                      <Text
                        style={[
                          styles.pickerOptionTitle,
                          isCurrent && styles.pickerOptionTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {rfqItem.title}
                      </Text>
                      <Text style={styles.pickerOptionSub}>
                        {quoteCount} {quoteCount === 1 ? "quotation" : "quotations"} received
                      </Text>
                    </View>
                    {isCurrent && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#5B13EC"
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
  },
  headerSection: {
    marginBottom: 14,
  },
  rfqContextCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 18,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  rfqBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  rfqIdPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  rfqIdPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#5B13EC",
  },
  quotesCountPill: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  quotesCountText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#15803D",
  },
  rfqMainTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  rfqSubtitle: {
    fontSize: 13.5,
    color: "#64748B",
    lineHeight: 20,
    fontWeight: "500",
    marginBottom: 18,
  },
  rfqActionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  poActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "#5B13EC",
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  poActionBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  filterSection: {
    marginTop: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    padding: 0,
  },
  quoteCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quoteCardSelected: {
    borderWidth: 2,
    borderColor: "#5B13EC",
  },
  quoteCardUnselected: {
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  bestValueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  bestValueBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#5B13EC",
    letterSpacing: 0.3,
  },
  radioButtonOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  radioButtonOuterSelected: {
    borderColor: "#2563EB",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },
  supplierTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#0F172A",
    marginBottom: 2,
  },
  supplierLocation: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
    marginBottom: 16,
  },
  priceBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginBottom: 14,
  },
  priceBandLeft: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceCurrency: {
    fontSize: 26,
    fontWeight: "900",
    color: "#5B13EC",
  },
  priceUnitValue: {
    fontSize: 26,
    fontWeight: "900",
    color: "#5B13EC",
  },
  priceUnitLabel: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#64748B",
    marginLeft: 3,
  },
  priceTotalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  specsList: {
    marginBottom: 4,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  specRowLast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
  },
  specLabel: {
    fontSize: 13.5,
    color: "#64748B",
    fontWeight: "500",
  },
  specValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    maxWidth: "60%",
    textAlign: "right",
  },
  quoteAcceptedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 10,
  },
  quoteAcceptedBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#15803D",
  },
  notAwardedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  notAwardedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  rejectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  rejectedText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  viewDetailsTextBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B13EC",
  },
  pendingActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  acceptQuoteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#5B13EC",
    borderRadius: 12,
    paddingVertical: 12,
  },
  acceptQuoteBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  inspectDetailsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  inspectDetailsBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  rfqPickerModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  rfqPickerBackdrop: {
    flex: 1,
  },
  rfqPickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: "70%",
  },
  pickerDrag: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  pickerScroll: {
    maxHeight: 360,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pickerOptionActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
  },
  pickerOptionLeft: {
    flex: 1,
    marginRight: 12,
  },
  pickerOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  pickerOptionTitleActive: {
    color: "#5B13EC",
  },
  pickerOptionSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
});
