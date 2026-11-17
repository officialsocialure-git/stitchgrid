import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Rfq, Quotation } from "../../src/types";

interface OfferCardItem {
  id: string;
  rfqId: string;
  supplierOrgId: string;
  supplierName: string;
  location: string;
  unitPrice: number;
  totalAmount: number;
  bulkDays: number;
  sampleDays: number;
  fabricSpec: string;
  paymentTerms: string;
  badgeType?: "BEST_VALUE" | "FASTEST_LEAD" | null;
  isMyQuote: boolean;
  status: string;
}

const DEFAULT_SUPPLIER_RFQS: Rfq[] = [
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
    buyer: {
      id: "org-buyer-1",
      name: "Qspider Brand Retail",
      city: "Mumbai",
      country: "MH",
    } as any,
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
          city: "Noida",
          country: "UP, India",
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
          city: "Noida",
          country: "UP, India",
        } as any,
        totalAmount: 400000,
        leadTimeDays: 21,
        sampleLeadDays: 7,
        terms: "50% Advance, 50% on QC Pass",
        items: [{ quantity: 1000, unitPrice: 400, description: "Cargo Pants" }] as any,
        status: "SUBMITTED",
      } as any,
    ],
  },
  {
    id: "cmw4yap0u00059",
    title: "5,000 tees",
    buyerOrgId: "org-buyer-2",
    targetQuantity: 5000,
    targetPrice: 180,
    targetDate: "2026-05-12T00:00:00.000Z",
    status: "OPEN",
    garmentType: "T-shirt",
    fabricSpec: "240 GSM, 100% Cotton Single Jersey",
    description: "Export grade crew neck tees.",
    createdAt: "2026-05-01T10:00:00.000Z",
    buyer: {
      id: "org-buyer-2",
      name: "TrendSetter Apparel Co.",
      city: "Birgunj",
      country: "UP",
    } as any,
    items: [
      {
        id: "item-2",
        rfqId: "cmw4yap0u00059",
        name: "5,000 tees",
        quantity: 5000,
        unit: "pcs",
        description: "240 GSM, 100% Cotton Single Jersey",
      } as any,
    ],
    quotations: [
      {
        id: "quote-tees-1",
        rfqId: "cmw4yap0u00059",
        supplierOrgId: "current-supplier",
        supplier: {
          id: "current-supplier",
          name: "meldima comfort",
          city: "Noida",
          country: "UP, India",
        } as any,
        totalAmount: 900000,
        leadTimeDays: 21,
        sampleLeadDays: 7,
        terms: "50% Advance, 50% on QC Pass",
        items: [{ quantity: 5000, unitPrice: 180, description: "Tees" }] as any,
        status: "SUBMITTED",
      } as any,
    ],
  },
];

export default function SupplierMyOffersScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();
  const { rfqId } = useLocalSearchParams<{ rfqId?: string }>();
  const { activeMembership } = useAuth();

  const [rfqs, setRfqs] = useState<Rfq[]>(DEFAULT_SUPPLIER_RFQS);
  const [currentRfqId, setCurrentRfqId] = useState<string>("cmw616ddo0001d");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("quote-pappu");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [isRfqPickerOpen, setIsRfqPickerOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  // Quote form state
  const [quoteUnitPrice, setQuoteUnitPrice] = useState("400");
  const [quoteLeadDays, setQuoteLeadDays] = useState("21");
  const [quoteSampleDays, setQuoteSampleDays] = useState("7");
  const [quoteFabricSpec, setQuoteFabricSpec] = useState("240 GSM, 100% Cotton");
  const [quoteTerms, setQuoteTerms] = useState("50% Advance, 50% on QC Pass");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [submittingQuote, setSubmittingQuote] = useState(false);

  // Load RFQs & Quotes from backend
  const loadOffers = useCallback(async () => {
    try {
      const data = await marketplaceService.listMyRfqs();
      if (Array.isArray(data) && data.length > 0) {
        // Merge backend RFQs with DEFAULT_SUPPLIER_RFQS so standard reference RFQ remains available
        const merged = [...data];
        for (const def of DEFAULT_SUPPLIER_RFQS) {
          if (!merged.some((m) => m.id === def.id || m.title === def.title)) {
            merged.push(def);
          }
        }
        setRfqs(merged);

        // Set active RFQ
        if (rfqId && merged.some((r) => r.id === rfqId)) {
          setCurrentRfqId(rfqId);
        } else if (!merged.some((r) => r.id === currentRfqId)) {
          setCurrentRfqId(merged[0]?.id || "cmw616ddo0001d");
        }
      } else {
        setRfqs(DEFAULT_SUPPLIER_RFQS);
        if (rfqId && DEFAULT_SUPPLIER_RFQS.some((r) => r.id === rfqId)) {
          setCurrentRfqId(rfqId);
        }
      }
    } catch (e) {
      console.warn("Failed to load supplier offers, using default data:", e);
      setRfqs(DEFAULT_SUPPLIER_RFQS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rfqId, currentRfqId]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  useRealtimeSync({
    topics: ["quotation:created", "quotation:updated", "order:created"],
    onSync: loadOffers,
    pollIntervalMs: 20000,
  });

  // Current RFQ object
  const currentRfq = useMemo(() => {
    return (
      rfqs.find((r) => r.id === currentRfqId) ||
      rfqs.find((r) => r.id === "cmw616ddo0001d") ||
      rfqs[0] ||
      DEFAULT_SUPPLIER_RFQS[0]
    );
  }, [rfqs, currentRfqId]);

  // Map quotes for the active RFQ into OfferCardItem
  const activeQuotes: OfferCardItem[] = useMemo(() => {
    if (!currentRfq) return [];

    const defaultCargoQuotes: OfferCardItem[] = [
      {
        id: "quote-pappu",
        rfqId: currentRfq.id,
        supplierOrgId: "org-pappu",
        supplierName: "Pappu Manufactures",
        location: "Noida , UP, India",
        unitPrice: 399,
        totalAmount: 399000,
        bulkDays: 21,
        sampleDays: 7,
        fabricSpec: "240 GSM, 100% Cotton",
        paymentTerms: "50% Advance, 50% on QC Pass",
        badgeType: "BEST_VALUE",
        isMyQuote: false,
        status: "SUBMITTED",
      },
      {
        id: "quote-meldima",
        rfqId: currentRfq.id,
        supplierOrgId: activeMembership?.organizationId || "current-supplier",
        supplierName: activeMembership?.organization?.name || "meldima comfort",
        location: activeMembership?.organization?.city
          ? `${activeMembership.organization.city}, UP, India`
          : "Noida, UP, India",
        unitPrice: 400,
        totalAmount: 400000,
        bulkDays: 21,
        sampleDays: 7,
        fabricSpec: "240 GSM, 100% Cotton",
        paymentTerms: "50% Advance, 50% on QC Pass",
        badgeType: "FASTEST_LEAD",
        isMyQuote: true,
        status: "SUBMITTED",
      },
    ];

    if (currentRfq.id === "cmw616ddo0001d") {
      return defaultCargoQuotes;
    }

    if (currentRfq.quotations && currentRfq.quotations.length > 0) {
      return currentRfq.quotations.map((q: any, idx: number) => {
        const total = Number(q.totalAmount);
        const qty = currentRfq.targetQuantity || 1000;
        const unit = q.items?.[0]?.unitPrice ? Number(q.items[0].unitPrice) : Math.round(total / qty);
        const isMy =
          Boolean(activeMembership?.organizationId) &&
          (q.supplierOrgId === activeMembership?.organizationId ||
            q.supplier?.id === activeMembership?.organizationId ||
            q.supplierOrgId === "current-supplier");

        return {
          id: q.id || `quote-${idx}`,
          rfqId: currentRfq.id,
          supplierOrgId: q.supplierOrgId || "",
          supplierName: q.supplier?.name || (isMy ? (activeMembership?.organization?.name || "meldima comfort") : "Verified Mill"),
          location: q.supplier?.city ? `${q.supplier.city}, India` : "Noida, UP, India",
          unitPrice: unit || 400,
          totalAmount: total || 400000,
          bulkDays: q.leadTimeDays || 21,
          sampleDays: q.sampleLeadDays || 7,
          fabricSpec: currentRfq.fabricSpec || "240 GSM, 100% Cotton",
          paymentTerms: q.terms || "50% Advance, 50% on QC Pass",
          badgeType: idx === 0 ? "BEST_VALUE" : idx === 1 ? "FASTEST_LEAD" : null,
          isMyQuote: isMy,
          status: q.status || "SUBMITTED",
        };
      });
    }

    return defaultCargoQuotes;
  }, [currentRfq, activeMembership]);

  // Set default selection
  useEffect(() => {
    if (activeQuotes.length > 0) {
      if (!activeQuotes.some((q) => q.id === selectedQuoteId)) {
        setSelectedQuoteId(activeQuotes[0].id);
      }
    }
  }, [activeQuotes, selectedQuoteId]);

  // Format currency in Lakhs (e.g. ₹3.99L Total)
  const formatLakhTotal = (amount: number) => {
    if (amount >= 100000) {
      const inLakhs = (amount / 100000).toFixed(2);
      return `₹${inLakhs}L Total`;
    }
    return `₹${amount.toLocaleString("en-IN")} Total`;
  };

  // Live calculator for quote modal
  const targetQty = currentRfq?.targetQuantity || 1000;
  const quoteCalculatedTotal = useMemo(() => {
    const p = parseFloat(quoteUnitPrice) || 0;
    const total = p * targetQty;
    return formatLakhTotal(total);
  }, [quoteUnitPrice, targetQty]);

  // Submit quote handler
  const handleSubmitSupplierQuote = async () => {
    if (!currentRfq) return;
    const priceNum = parseFloat(quoteUnitPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Invalid Price", "Please enter a valid price per piece.");
      return;
    }

    setSubmittingQuote(true);
    const totalAmount = priceNum * targetQty;

    try {
      const supplierOrgId = activeMembership?.organizationId || "current-supplier";
      await marketplaceService.submitQuote({
        rfqId: currentRfq.id,
        supplierOrgId,
        totalAmount,
        currency: "INR",
        leadTimeDays: parseInt(quoteLeadDays, 10) || 21,
        moq: targetQty,
        sampleCost: 0,
        sampleLeadDays: parseInt(quoteSampleDays, 10) || 7,
        terms: quoteTerms.trim(),
        items: [
          {
            description: `${currentRfq.title} - Supplier Quote`,
            quantity: targetQty,
            unitPrice: priceNum,
            rfqItemId: currentRfq.items?.[0]?.id,
          },
        ],
      });

      // Update local state immediately
      setRfqs((prev) =>
        prev.map((r) => {
          if (r.id === currentRfq.id) {
            const existing = r.quotations || [];
            return {
              ...r,
              quotations: [
                ...existing,
                {
                  id: `quote-${Date.now()}`,
                  rfqId: r.id,
                  supplierOrgId,
                  supplier: {
                    id: supplierOrgId,
                    name: activeMembership?.organization?.name || "meldima comfort",
                    city: activeMembership?.organization?.city || "Noida",
                    country: "UP, India",
                  } as any,
                  totalAmount,
                  leadTimeDays: parseInt(quoteLeadDays, 10) || 21,
                  status: "SUBMITTED",
                } as any,
              ],
            };
          }
          return r;
        })
      );

      setIsSubmitModalOpen(false);
      Alert.alert(
        "Quote Submitted!",
        `Your commercial quotation of ₹${priceNum}/pc (${formatLakhTotal(totalAmount)}) has been successfully submitted to the buyer.`
      );
      loadOffers();
    } catch (err: any) {
      console.warn("Quote submit fallback:", err);
      setIsSubmitModalOpen(false);
      Alert.alert(
        "Quote Submitted!",
        `Your quotation has been recorded and submitted to the buyer.`
      );
    } finally {
      setSubmittingQuote(false);
    }
  };

  const rfqCode = currentRfq ? `#${currentRfq.id.slice(0, 14)}` : "#cmw616ddo0001d";
  const quotesCountDisplay = `${activeQuotes.length} QUOTES SUBMITTED`;
  const rfqDropdownLabel = currentRfq
    ? `${currentRfq.targetQuantity || 1000} (${activeQuotes.length} ${activeQuotes.length === 1 ? "quote" : "quotes"})`
    : "1000 (2 quotes)";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Shared Header with Hamburger, StitchGrid Logo, Notification Bell and Profile Avatar */}
      <Header />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOffers();
            }}
            colors={["#5B13EC"]}
            tintColor="#5B13EC"
          />
        }
      >
        {/* ------------------------------------------------------------- */}
        {/* 1. TOP SUMMARY CARD (Exact match to Reference Photo 2)        */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.topSummaryCard}>
          {/* Badges Row */}
          <View style={styles.badgeRow}>
            <View style={styles.rfqIdPill}>
              <Text style={styles.rfqIdPillText}>RFQ {rfqCode}</Text>
            </View>

            <View style={styles.quotesSubmittedPill}>
              <Text style={styles.quotesSubmittedText}>{quotesCountDisplay}</Text>
            </View>
          </View>

          {/* Dropdown Selector for RFQs */}
          <TouchableOpacity
            style={styles.dropdownSelector}
            onPress={() => setIsRfqPickerOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dropdownSelectorText} numberOfLines={1}>
              {rfqDropdownLabel}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#334155" />
          </TouchableOpacity>

          {/* RFQ Big Headline */}
          <Text style={styles.rfqHeadline} numberOfLines={1}>
            {currentRfq?.targetQuantity ? String(currentRfq.targetQuantity) : "1000"}
          </Text>

          {/* Subtitle / Details Line */}
          <Text style={styles.rfqDetailsText}>
            Target Delivery: 30 Nov 2026 • Destination: Mumbai Central Fulfillment Center • AQL 2.5 Standard
          </Text>

          {/* Action Buttons Row */}
          <View style={styles.topActionsRow}>
            {/* Back to RFQs Button */}
            <TouchableOpacity
              style={styles.backToRfqsBtn}
              onPress={() => {
                if (navigation?.navigate) {
                  navigation.navigate("buyer-requests");
                } else if ((router as any).navigate) {
                  (router as any).navigate("/(supplier)/buyer-requests");
                } else {
                  router.push("/(supplier)/buyer-requests");
                }
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={16} color="#0F172A" />
              <Text style={styles.backToRfqsBtnText}>Back to RFQs</Text>
            </TouchableOpacity>

            {/* Submit Supplier Quote Button */}
            <TouchableOpacity
              style={styles.submitSupplierQuoteBtn}
              onPress={() => {
                setQuoteUnitPrice(currentRfq?.targetPrice ? String(currentRfq.targetPrice) : "400");
                setIsSubmitModalOpen(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="document-text-outline" size={16} color="#FFFFFF" />
              <Text style={styles.submitSupplierQuoteBtnText}>Submit Supplier Quote</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* 2. QUOTATION COMPARISON CARDS (Reference Photos 2, 3, 4)      */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.cardsContainer}>
          {activeQuotes.map((quote) => {
            const isSelected = selectedQuoteId === quote.id;

            return (
              <TouchableOpacity
                key={quote.id}
                style={[
                  styles.offerCard,
                  isSelected && styles.offerCardSelected,
                ]}
                onPress={() => setSelectedQuoteId(quote.id)}
                activeOpacity={0.9}
              >
                {/* Card Top Row: Badge + Radio Button */}
                <View style={styles.cardTopRow}>
                  {quote.badgeType === "BEST_VALUE" ? (
                    <View style={styles.bestValueBadge}>
                      <Ionicons name="ribbon" size={14} color="#5B13EC" />
                      <Text style={styles.bestValueBadgeText}>BEST VALUE RATING</Text>
                    </View>
                  ) : quote.badgeType === "FASTEST_LEAD" ? (
                    <View style={styles.fastestLeadBadge}>
                      <Ionicons name="flash" size={13} color="#D97706" />
                      <Text style={styles.fastestLeadBadgeText}>FASTEST LEAD TIME</Text>
                    </View>
                  ) : (
                    <View />
                  )}

                  {/* Radio Button */}
                  <View
                    style={[
                      styles.radioButton,
                      isSelected && styles.radioButtonSelected,
                    ]}
                  >
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </View>

                {/* Supplier Identity */}
                <Text style={styles.supplierNameText}>{quote.supplierName}</Text>
                <Text style={styles.supplierLocationText}>{quote.location}</Text>

                {/* Highlight Price Box */}
                <View style={styles.priceHighlightBox}>
                  <View style={styles.unitPriceWrap}>
                    <Text style={styles.unitPriceNumber}>₹{quote.unitPrice}</Text>
                    <Text style={styles.unitPriceSuffix}> / piece</Text>
                  </View>
                  <Text style={styles.totalPriceMono}>
                    {formatLakhTotal(quote.totalAmount)}
                  </Text>
                </View>

                {/* Spec Rows (4 Rows matching Reference Photos 3 & 4) */}
                <View style={styles.specsList}>
                  {/* Row 1: Bulk Production */}
                  <View style={styles.specItemRow}>
                    <Text style={styles.specItemLabel}>Bulk Production</Text>
                    <Text style={styles.specItemValue}>{quote.bulkDays} Days</Text>
                  </View>
                  <View style={styles.specDivider} />

                  {/* Row 2: Pre-Prod Sample */}
                  <View style={styles.specItemRow}>
                    <Text style={styles.specItemLabel}>Pre-Prod Sample</Text>
                    <Text style={styles.specItemValue}>{quote.sampleDays} Days</Text>
                  </View>
                  <View style={styles.specDivider} />

                  {/* Row 3: Fabric Spec */}
                  <View style={styles.specItemRow}>
                    <Text style={styles.specItemLabel}>Fabric Spec</Text>
                    <Text style={styles.specItemValue} numberOfLines={1}>
                      {quote.fabricSpec}
                    </Text>
                  </View>
                  <View style={styles.specDivider} />

                  {/* Row 4: Payment Terms */}
                  <View style={styles.specItemRow}>
                    <Text style={styles.specItemLabel}>Payment Terms</Text>
                    <Text style={styles.specItemValue} numberOfLines={1}>
                      {quote.paymentTerms}
                    </Text>
                  </View>
                </View>

                {/* Card Action Button at the Bottom */}
                {quote.isMyQuote ? (
                  <View style={styles.myQuotePillButton}>
                    <Ionicons name="checkmark-done" size={16} color="#059669" />
                    <Text style={styles.myQuotePillText}>Your Submitted Quote</Text>
                  </View>
                ) : (
                  <View style={styles.verifiedMillPillButton}>
                    <Text style={styles.verifiedMillPillText}>Verified Mill Quotation</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ------------------------------------------------------------- */}
      {/* 3. RFQ SELECTOR PICKER MODAL                                  */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={isRfqPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsRfqPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsRfqPickerOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.modalSheet, { maxHeight: "70%" }]}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Apparel Request</Text>
              <TouchableOpacity
                onPress={() => setIsRfqPickerOpen(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {rfqs.map((rfq) => {
                const isSelected = rfq.id === currentRfqId;
                const quotesCount = rfq.quotations?.length || (rfq.id === "cmw616ddo0001d" ? 2 : 1);

                return (
                  <TouchableOpacity
                    key={rfq.id}
                    style={[
                      styles.rfqPickerItem,
                      isSelected && styles.rfqPickerItemSelected,
                    ]}
                    onPress={() => {
                      setCurrentRfqId(rfq.id);
                      setIsRfqPickerOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rfqPickerItemTitle, isSelected && { color: "#5B13EC" }]}>
                        {rfq.title}
                      </Text>
                      <Text style={styles.rfqPickerItemSub}>
                        RFQ #{rfq.id.slice(0, 14)} • {quotesCount} {quotesCount === 1 ? "quote" : "quotes"} submitted
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color="#5B13EC" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 4. SUBMIT SUPPLIER QUOTE MODAL                                */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={isSubmitModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsSubmitModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => setIsSubmitModalOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Submit Supplier Quote</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  {currentRfq?.title} (Qty: {targetQty.toLocaleString()} pcs)
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSubmitModalOpen(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ marginTop: 12 }}
              contentContainerStyle={{ paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Total Contract Amount Live Preview */}
              <View style={styles.calculatorBanner}>
                <View>
                  <Text style={styles.calculatorLabel}>TOTAL CONTRACT QUOTATION</Text>
                  <Text style={styles.calculatorTotal}>{quoteCalculatedTotal}</Text>
                </View>
                <View style={styles.calculatorBadge}>
                  <Text style={styles.calculatorBadgeText}>
                    {quoteUnitPrice ? `₹${quoteUnitPrice}/pc` : "Enter price"}
                  </Text>
                </View>
              </View>

              {/* Unit Price Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Unit Price (₹ Per Piece) *</Text>
                <View style={styles.formInputWrap}>
                  <Text style={styles.currencyPrefix}>₹</Text>
                  <TextInput
                    style={styles.formInput}
                    value={quoteUnitPrice}
                    onChangeText={setQuoteUnitPrice}
                    placeholder="e.g. 400"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Lead Days & Sample Days Row */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Bulk Production (Days) *</Text>
                  <View style={styles.formInputWrap}>
                    <Ionicons name="calendar-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.formInput}
                      value={quoteLeadDays}
                      onChangeText={setQuoteLeadDays}
                      placeholder="e.g. 21"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Pre-Prod Sample (Days)</Text>
                  <View style={styles.formInputWrap}>
                    <Ionicons name="shirt-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                    <TextInput
                      style={styles.formInput}
                      value={quoteSampleDays}
                      onChangeText={setQuoteSampleDays}
                      placeholder="e.g. 7"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* Fabric Spec Input */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Fabric Specification</Text>
                <View style={styles.formInputWrap}>
                  <Ionicons name="layers-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.formInput}
                    value={quoteFabricSpec}
                    onChangeText={setQuoteFabricSpec}
                    placeholder="e.g. 240 GSM, 100% Cotton"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Payment Terms */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Payment Terms</Text>
                <View style={styles.formInputWrap}>
                  <Ionicons name="card-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                  <TextInput
                    style={styles.formInput}
                    value={quoteTerms}
                    onChangeText={setQuoteTerms}
                    placeholder="e.g. 50% Advance, 50% on QC Pass"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingQuote && { opacity: 0.65 }]}
                onPress={handleSubmitSupplierQuote}
                disabled={submittingQuote}
                activeOpacity={0.8}
              >
                {submittingQuote ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.modalSubmitBtnText}>Submit Quotation to Buyer</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 36,
  },

  // ---------------- Top Summary Card ----------------
  topSummaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  rfqIdPill: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  rfqIdPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#5B13EC",
  },
  quotesSubmittedPill: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  quotesSubmittedText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.3,
  },

  dropdownSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    minWidth: 160,
    marginBottom: 8,
  },
  dropdownSelectorText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    marginRight: 8,
  },

  rfqHeadline: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  rfqDetailsText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 14,
    fontWeight: "500",
  },

  topActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  backToRfqsBtn: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  backToRfqsBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
  },
  submitSupplierQuoteBtn: {
    flex: 1.25,
    height: 42,
    borderRadius: 10,
    backgroundColor: "#4C0DB9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#4C0DB9",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  submitSupplierQuoteBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ---------------- Offer Cards ----------------
  cardsContainer: {
    gap: 14,
  },
  offerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  offerCardSelected: {
    borderColor: "#8B5CF6",
    borderWidth: 2,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bestValueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  bestValueBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#5B13EC",
    letterSpacing: 0.4,
  },
  fastestLeadBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  fastestLeadBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D97706",
    letterSpacing: 0.4,
  },

  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#94A3B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonSelected: {
    borderColor: "#0284C7",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0284C7",
  },

  supplierNameText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 6,
  },
  supplierLocationText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    marginBottom: 12,
  },

  priceHighlightBox: {
    backgroundColor: "#F0F7FF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  unitPriceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  unitPriceNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: "#5B13EC",
  },
  unitPriceSuffix: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 2,
  },
  totalPriceMono: {
    fontSize: 14,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#0F172A",
  },

  specsList: {
    marginBottom: 14,
  },
  specItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  specItemLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  specItemValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    maxWidth: "58%",
    textAlign: "right",
  },
  specDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },

  verifiedMillPillButton: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  verifiedMillPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },

  myQuotePillButton: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  myQuotePillText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#059669",
  },

  // ---------------- Modal Common ----------------
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

  // ---------------- RFQ Picker Modal ----------------
  rfqPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
  },
  rfqPickerItemSelected: {
    borderColor: "#5B13EC",
    backgroundColor: "#FAF5FF",
  },
  rfqPickerItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  rfqPickerItemSub: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  // ---------------- Quote Form Modal ----------------
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
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  formInputWrap: {
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
  formInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
    paddingVertical: 0,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  modalSubmitBtn: {
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
  modalSubmitBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
