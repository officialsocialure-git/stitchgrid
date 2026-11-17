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
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Quotation, Rfq } from "../../src/types";
import { QuoteDetailsModal } from "../../src/components/offers/QuoteDetailsModal";
import { ConfirmQuoteAcceptanceModal } from "../../src/components/offers/ConfirmQuoteAcceptanceModal";

export default function BuyerOffersScreen() {
  const router = useRouter();
  const { rfqId } = useLocalSearchParams<{ rfqId?: string }>();

  // State
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [currentRfq, setCurrentRfq] = useState<Rfq | null>(null);
  const [allRfqs, setAllRfqs] = useState<Rfq[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingQuote, setAcceptingQuote] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Search & Filter state matching Web
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"DEFAULT" | "PRICE" | "SPEED" | "RATING">("DEFAULT");

  // Modals
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [quoteForDetails, setQuoteForDetails] = useState<Quotation | null>(null);
  const [isRfqPickerOpen, setIsRfqPickerOpen] = useState(false);

  // Load Quotes & RFQs
  const loadOffers = useCallback(async () => {
    try {
      setLoading(true);
      const rfqs = await marketplaceService.listMyRfqs();
      const validRfqs = Array.isArray(rfqs) ? rfqs : [];
      setAllRfqs(validRfqs);

      let targetRfqId = rfqId;
      if (!targetRfqId) {
        const rfqWithQuotes = validRfqs.find((r) => r.quotations && r.quotations.length > 0);
        targetRfqId = rfqWithQuotes?.id || validRfqs[0]?.id;
      }

      if (targetRfqId) {
        const details = await marketplaceService.getRfqDetails(targetRfqId);
        setCurrentRfq(details || null);
        const nextQuotes = details?.quotations || [];
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
      console.warn("Failed to load quotations:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rfqId]);

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

    // Status filter
    if (statusFilter !== "ALL") {
      result = result.filter((q) => q.status === statusFilter);
    }

    // Search query
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

    // Sort criteria
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

  // Issue Purchase Order (Accept Quote)
  const handleIssuePo = async () => {
    if (!selectedQuote) return;
    try {
      setAcceptingQuote(true);
      const po = await marketplaceService.createPurchaseOrder(selectedQuote.id);
      setIsConfirmModalOpen(false);
      setQuoteForDetails(null);

      const supplierName =
        selectedQuote.supplierOrg?.name || selectedQuote.supplier?.name || "Manufacturer";

      Alert.alert(
        "🎉 Contract Awarded!",
        `Quotation accepted and Purchase Order #${po.poNumber || "SG-PO-..."} issued successfully to ${supplierName}. Supplier has been notified to accept the order.`,
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
      loadOffers();
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

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight || 0 } : null,
      ]}
    >
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
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* RFQ Context Header Card (Matching Web App) */}
            <View style={styles.rfqContextCard}>
              {/* Badges Row */}
              <View style={styles.rfqBadgesRow}>
                <View style={styles.rfqIdPill}>
                  <Text style={styles.rfqIdPillText}>
                    RFQ #{currentRfq?.id ? currentRfq.id.slice(0, 14) : "—"}
                  </Text>
                </View>

                <View style={styles.quotesCountPill}>
                  <Text style={styles.quotesCountText}>
                    {quotes.length} {quotes.length === 1 ? "QUOTE" : "QUOTES"} SUBMITTED
                  </Text>
                </View>

                {isRfqAwarded && (
                  <View style={styles.awardedPill}>
                    <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                    <Text style={styles.awardedPillText}>AWARDED</Text>
                  </View>
                )}
              </View>

              {/* Multi-RFQ Selector Dropdown / Pill */}
              {allRfqs.length > 1 && (
                <TouchableOpacity
                  style={styles.rfqPickerBtn}
                  activeOpacity={0.8}
                  onPress={() => setIsRfqPickerOpen(true)}
                >
                  <Ionicons name="swap-horizontal" size={16} color={Colors.primary} />
                  <Text style={styles.rfqPickerText} numberOfLines={1}>
                    {currentRfq?.title || "Select RFQ"} ({quotes.length} quotes)
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}

              {/* RFQ Title & Subtitle */}
              <Text style={styles.rfqMainTitle}>
                {currentRfq?.title || "Garment Manufacturing RFQ"}
              </Text>
              <Text style={styles.rfqSubtitle}>
                Target Qty: {Number(currentRfq?.targetQuantity || 0).toLocaleString()} pcs
                {currentRfq?.targetDate
                  ? ` • Delivery: ${new Date(currentRfq.targetDate).toLocaleDateString()}`
                  : ""}
                {currentRfq?.fabricSpec ? ` • ${currentRfq.fabricSpec}` : ""}
                {" • Standard AQL 2.5 Inspection"}
              </Text>

              {/* Action Buttons Row matching Web */}
              <View style={styles.rfqActionButtonsRow}>
                <TouchableOpacity
                  style={styles.backBtn}
                  activeOpacity={0.8}
                  onPress={() => router.push("/(buyer)/rfqs")}
                >
                  <Ionicons name="arrow-back" size={15} color={Colors.textHeading} />
                  <Text style={styles.backBtnText}>Back to My Requests</Text>
                </TouchableOpacity>

                {isRfqAwarded ? (
                  <TouchableOpacity
                    style={styles.viewPoBtn}
                    activeOpacity={0.85}
                    onPress={() => router.push("/(buyer)/orders")}
                  >
                    <Ionicons name="cube-outline" size={15} color="#FFF" />
                    <Text style={styles.viewPoBtnText}>View Purchase Order →</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.acceptPoBtn,
                      (!selectedQuoteId || quotes.length === 0) && styles.btnDisabled,
                    ]}
                    activeOpacity={0.85}
                    disabled={!selectedQuoteId || quotes.length === 0}
                    onPress={() => setIsConfirmModalOpen(true)}
                  >
                    <Ionicons name="checkmark-circle" size={15} color="#FFF" />
                    <Text style={styles.acceptPoBtnText}>Accept This Quote</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Live Search Bar */}
            <View style={styles.searchContainer}>
              <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search manufacturer, location, or terms..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterTabsRow}
            >
              {[
                { label: "All Quotes", value: "ALL" },
                { label: "Pending Bids", value: "SUBMITTED" },
                { label: "Accepted", value: "ACCEPTED" },
                { label: "Rejected", value: "REJECTED" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.value}
                  onPress={() => setStatusFilter(tab.value)}
                  style={[
                    styles.filterTab,
                    statusFilter === tab.value && styles.filterTabActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      statusFilter === tab.value && styles.filterTabTextActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Quick Benchmark Sorters */}
            <View style={styles.sorterRow}>
              <Text style={styles.sorterLabel}>COMPARE BY:</Text>
              {[
                { label: "Best Match", value: "DEFAULT" },
                { label: "Lowest Price", value: "PRICE" },
                { label: "Fastest SLA", value: "SPEED" },
              ].map((sortItem) => (
                <TouchableOpacity
                  key={sortItem.value}
                  onPress={() => setSortBy(sortItem.value as any)}
                  style={[
                    styles.sortPill,
                    sortBy === sortItem.value && styles.sortPillActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.sortPillText,
                      sortBy === sortItem.value && styles.sortPillTextActive,
                    ]}
                  >
                    {sortItem.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="swap-horizontal"
              title="No Quotations Found"
              description={
                searchQuery || statusFilter !== "ALL"
                  ? "No offers match your current filter criteria. Try clearing search or status filters."
                  : "No garment manufacturers have submitted quotations for this RFQ yet."
              }
              actionTitle={
                searchQuery || statusFilter !== "ALL" ? "Clear Filters" : "View My Requests"
              }
              onAction={() => {
                if (searchQuery || statusFilter !== "ALL") {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setSortBy("DEFAULT");
                } else {
                  router.push("/(buyer)/rfqs");
                }
              }}
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const isSelected = selectedQuoteId === item.id;
          const isAccepted = item.status === "ACCEPTED";
          const isRejected = item.status === "REJECTED";
          const targetQty = currentRfq?.targetQuantity || 1;
          const unitPrice =
            item.items?.[0]?.unitPrice ||
            Math.round(Number(item.totalAmount) / targetQty);
          const supplierName =
            item.supplierOrg?.name || item.supplier?.name || "Verified Factory Partner";
          const supplierCity =
            item.supplierOrg?.city || item.supplier?.city || "India";

          const isBestValue = index === 0;
          const isFastest = index === 1;

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => setSelectedQuoteId(item.id)}
              style={[
                styles.quoteCard,
                isSelected && styles.quoteCardSelected,
                isAccepted && styles.quoteCardAccepted,
              ]}
            >
              {/* Card Top Row: Recommendation Badges & Radio Indicator */}
              <View style={styles.cardTopRow}>
                <View style={styles.badgeGroup}>
                  {isBestValue && (
                    <View style={styles.bestValueBadge}>
                      <Ionicons name="ribbon" size={13} color={Colors.primary} />
                      <Text style={styles.bestValueBadgeText}>Best Value Rating</Text>
                    </View>
                  )}
                  {isFastest && !isBestValue && (
                    <View style={styles.fastestBadge}>
                      <Ionicons name="flash" size={13} color="#D97706" />
                      <Text style={styles.fastestBadgeText}>Fastest Turnaround</Text>
                    </View>
                  )}
                  {isAccepted && (
                    <View style={styles.acceptedTag}>
                      <Ionicons name="checkmark-circle" size={13} color="#15803D" />
                      <Text style={styles.acceptedTagText}>Awarded Quote</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedQuoteId(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isSelected ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={isSelected ? Colors.primary : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Manufacturer Information */}
              <View style={styles.supplierBlock}>
                <Text style={styles.supplierTitle}>{supplierName}</Text>
                <View style={styles.locationLine}>
                  <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.locationCity}>{supplierCity}, India</Text>
                  <Text style={styles.millRating}>★ 5.0 Verified Mill</Text>
                </View>
              </View>

              {/* Web-Style Light Price Band */}
              <View style={styles.priceBand}>
                <View style={styles.priceBandLeft}>
                  <Text style={styles.priceCurrency}>₹</Text>
                  <Text style={styles.priceUnitValue}>{unitPrice}</Text>
                  <Text style={styles.priceUnitLabel}> / piece</Text>
                </View>
                <View style={styles.priceBandRight}>
                  <Text style={styles.priceTotalLabel}>TOTAL CONTRACT</Text>
                  <Text style={styles.priceTotalValue}>
                    ₹{(Number(item.totalAmount) / 100000).toFixed(2)}L
                  </Text>
                </View>
              </View>

              {/* Specifications Rows matching Web App */}
              <View style={styles.specsList}>
                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Bulk Production</Text>
                  <Text style={styles.specValue}>{item.leadTimeDays} Days</Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Pre-Prod Sample</Text>
                  <Text style={styles.specValue}>{item.sampleLeadDays || 7} Days</Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Fabric Spec</Text>
                  <Text style={styles.specValue} numberOfLines={1}>
                    {currentRfq?.fabricSpec || currentRfq?.title || "Complying with Tech Pack"}
                  </Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Payment Terms</Text>
                  <Text style={styles.specValue} numberOfLines={1}>
                    {item.terms || "Secure Protected Escrow"}
                  </Text>
                </View>

                <View style={styles.specRow}>
                  <Text style={styles.specLabel}>Minimum MOQ</Text>
                  <Text style={styles.specValue}>
                    {item.moq ? `${item.moq} pcs` : `${targetQty} pcs`}
                  </Text>
                </View>
              </View>

              {/* Footer Actions Row */}
              <View style={styles.cardFooter}>
                {isAccepted ? (
                  <View style={styles.acceptedCardFooter}>
                    <View style={styles.acceptedPill}>
                      <Ionicons name="checkmark-done" size={16} color="#15803D" />
                      <Text style={styles.acceptedPillText}>Quote Accepted • PO Issued</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.detailsBtnOutline}
                      onPress={() => router.push("/(buyer)/orders")}
                    >
                      <Text style={styles.detailsBtnText}>View PO →</Text>
                    </TouchableOpacity>
                  </View>
                ) : isRfqAwarded ? (
                  <View style={styles.notAwardedBanner}>
                    <Text style={styles.notAwardedBannerText}>Not Awarded</Text>
                    <TouchableOpacity
                      style={styles.detailsBtnOutline}
                      onPress={() => setQuoteForDetails(item)}
                    >
                      <Text style={styles.detailsBtnText}>Inspect Details</Text>
                    </TouchableOpacity>
                  </View>
                ) : isRejected ? (
                  <View style={styles.rejectedBanner}>
                    <Text style={styles.rejectedBannerText}>Offer Rejected</Text>
                    <TouchableOpacity
                      style={styles.detailsBtnOutline}
                      onPress={() => setQuoteForDetails(item)}
                    >
                      <Text style={styles.detailsBtnText}>View Details</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.cardActionButtons}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      activeOpacity={0.8}
                      disabled={rejectingId === item.id}
                      onPress={() => handleRejectQuote(item)}
                    >
                      <Ionicons name="close" size={14} color="#DC2626" />
                      <Text style={styles.rejectBtnText}>
                        {rejectingId === item.id ? "Rejecting..." : "Reject"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.detailsBtn}
                      activeOpacity={0.8}
                      onPress={() => setQuoteForDetails(item)}
                    >
                      <Text style={styles.detailsBtnLabel}>Inspect</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.acceptBtn,
                        isSelected && styles.acceptBtnSelected,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedQuoteId(item.id);
                        setIsConfirmModalOpen(true);
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={15} color="#FFF" />
                      <Text style={styles.acceptBtnText}>Accept Quote</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
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
                        color={Colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </RNModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },
  headerSection: {
    marginBottom: 14,
  },
  rfqContextCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
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
    marginBottom: 10,
  },
  rfqIdPill: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  rfqIdPillText: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.primary,
  },
  quotesCountPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  quotesCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
  },
  awardedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  awardedPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  rfqPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  rfqPickerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
    marginHorizontal: 8,
  },
  rfqMainTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textHeading,
    lineHeight: 28,
    marginBottom: 6,
  },
  rfqSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  rfqActionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  acceptPoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptPoBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFF",
  },
  viewPoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#059669",
  },
  viewPoBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFF",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 7,
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textHeading,
    padding: 0,
  },
  filterTabsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    paddingVertical: 2,
  },
  filterTab: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: "#FFF",
  },
  sorterRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingVertical: 2,
  },
  sorterLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginRight: 4,
  },
  sortPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  sortPillActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  sortPillTextActive: {
    color: Colors.primary,
  },
  quoteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  quoteCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#FAFAFF",
    shadowColor: Colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  quoteCardAccepted: {
    borderColor: "#86EFAC",
    backgroundColor: "#F6FEF9",
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badgeGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  bestValueBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bestValueBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary,
  },
  fastestBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fastestBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B45309",
  },
  acceptedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  acceptedTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#15803D",
  },
  supplierBlock: {
    marginBottom: 12,
  },
  supplierTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  locationLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  locationCity: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  millRating: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    marginLeft: 6,
  },
  priceBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F2FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  priceBandLeft: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  priceCurrency: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  priceUnitValue: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  priceUnitLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  priceBandRight: {
    alignItems: "flex-end",
  },
  priceTotalLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  priceTotalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 1,
  },
  specsList: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 8,
    marginBottom: 12,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  specLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  specValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    textAlign: "right",
    maxWidth: "55%",
  },
  cardFooter: {
    paddingTop: 10,
  },
  acceptedCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  acceptedPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#DCFCE7",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  acceptedPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#15803D",
  },
  notAwardedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notAwardedBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  rejectedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rejectedBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
  },
  cardActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  rejectBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  detailsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  detailsBtnLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  detailsBtnOutline: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 2,
  },
  acceptBtnSelected: {
    backgroundColor: "#6D28D9",
  },
  acceptBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFF",
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
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.border,
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
    borderBottomColor: Colors.borderLight,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
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
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
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
    color: Colors.textHeading,
  },
  pickerOptionTitleActive: {
    color: Colors.primary,
  },
  pickerOptionSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
