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
  StatusBar,
  Modal as NativeModal,
  TextInput,
  ActionSheetIOS,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Rfq } from "../../src/types";
import { PostRfqModal } from "../../src/components/rfq/PostRfqModal";
import { RfqDetailsModal } from "../../src/components/rfq/RfqDetailsModal";
import { InviteSuppliersModal } from "../../src/components/rfq/InviteSuppliersModal";

export default function BuyerRfqsScreen() {
  const router = useRouter();
  const { activeMembership } = useAuth();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search, Status Filter & Sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "QUOTES_RECEIVED" | "OPEN" | "AWARDED" | "DRAFT">("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "QTY_DESC" | "QTY_ASC">("NEWEST");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Navigation Drawer
  const [navigationMenuOpen, setNavigationMenuOpen] = useState(false);

  // Active Modals State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedRfqForDetails, setSelectedRfqForDetails] = useState<Rfq | null>(null);
  const [selectedRfqForInvite, setSelectedRfqForInvite] = useState<{ id: string; title: string } | null>(null);
  const [activeMenuRfq, setActiveMenuRfq] = useState<Rfq | null>(null);

  // Load RFQs from backend API
  const loadRfqs = useCallback(async () => {
    try {
      const data = await marketplaceService.listMyRfqs(activeMembership?.organizationId);
      setRfqs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("Failed to load RFQs:", e);
      setRfqs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeMembership?.organizationId]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  // Real-time synchronization matching Web App topics
  useRealtimeSync({
    topics: ["rfq:created", "rfq:updated", "quotation:created", "quotation:updated"],
    onSync: loadRfqs,
    pollIntervalMs: 25000,
  });

  // Delete RFQ with confirmation dialog
  const handleDeleteRfq = (rfqId: string, title?: string) => {
    Alert.alert(
      "Delete Request",
      `Are you sure you want to delete "${title || "this request"}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await marketplaceService.deleteRfq(rfqId);
              setRfqs((prev) => prev.filter((r) => r.id !== rfqId));
              if (selectedRfqForDetails?.id === rfqId) {
                setSelectedRfqForDetails(null);
              }
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.message || "Failed to delete request");
            }
          },
        },
      ]
    );
  };

  // Open Context Menu for a Card
  const openContextMenu = (rfq: Rfq) => {
    const quoteCount = rfq.quotations?.length || 0;

    if (Platform.OS === "ios") {
      const options = ["Cancel", "View Details", "Invite Suppliers"];
      if (quoteCount > 0) options.push("Compare Quotes");
      options.push("Delete Request");

      const destructiveIndex = options.indexOf("Delete Request");
      const cancelIndex = 0;

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          destructiveButtonIndex: destructiveIndex,
          title: rfq.title,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            setSelectedRfqForDetails(rfq);
          } else if (buttonIndex === 2) {
            setSelectedRfqForInvite({ id: rfq.id, title: rfq.title });
          } else if (quoteCount > 0 && buttonIndex === 3) {
            router.push(`/(buyer)/offers?rfqId=${rfq.id}`);
          } else if (buttonIndex === destructiveIndex) {
            handleDeleteRfq(rfq.id, rfq.title);
          }
        }
      );
    } else {
      setActiveMenuRfq(rfq);
    }
  };

  // Formatting helpers matching Web App
  const formatRfqId = (id: string) => {
    const suffix = (id || "0000").slice(-4).toUpperCase();
    return `RFQ #RFQ-${suffix}`;
  };

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return "Flexible";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Flexible";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  // Filter & Sort Logic matching Web App
  const filteredAndSortedRfqs = useMemo(() => {
    return rfqs
      .filter((rfq) => {
        const query = searchQuery.trim().toLowerCase();
        const idStr = (rfq.id || "").toLowerCase();
        const titleStr = (rfq.title || "").toLowerCase();
        const garmentStr = (rfq.garmentType || "").toLowerCase();
        const descStr = (rfq.description || "").toLowerCase();

        const matchesQuery =
          !query ||
          idStr.includes(query) ||
          titleStr.includes(query) ||
          garmentStr.includes(query) ||
          descStr.includes(query);

        if (!matchesQuery) return false;

        const quotesCount = rfq.quotations?.length || 0;
        const isAwarded = rfq.status === "AWARDED";
        const isDraft = rfq.status === "DRAFT";
        const isOpen = rfq.status === "OPEN";

        if (statusFilter === "ALL") return true;
        if (statusFilter === "QUOTES_RECEIVED") return isOpen && quotesCount > 0;
        if (statusFilter === "OPEN") return isOpen && quotesCount === 0;
        if (statusFilter === "AWARDED") return isAwarded;
        if (statusFilter === "DRAFT") return isDraft;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "NEWEST") {
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }
        if (sortBy === "OLDEST") {
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        }
        if (sortBy === "QTY_DESC") {
          return (b.targetQuantity || 0) - (a.targetQuantity || 0);
        }
        if (sortBy === "QTY_ASC") {
          return (a.targetQuantity || 0) - (b.targetQuantity || 0);
        }
        return 0;
      });
  }, [rfqs, searchQuery, statusFilter, sortBy]);

  return (
    <View style={styles.safeArea}>
      {/* Top Header Bar */}
      <Header showMenuButton onMenuPress={() => setNavigationMenuOpen(true)} />

      {/* Navigation Drawer */}
      <NativeModal
        visible={navigationMenuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setNavigationMenuOpen(false)}
      >
        <View style={styles.navigationOverlay}>
          <TouchableOpacity
            style={styles.navigationBackdrop}
            activeOpacity={1}
            onPress={() => setNavigationMenuOpen(false)}
          />
          <View style={styles.navigationDrawer}>
            <View style={styles.navigationHeader}>
              <Text style={styles.navigationTitle}>STITCHGRID</Text>
              <TouchableOpacity
                onPress={() => setNavigationMenuOpen(false)}
                style={styles.navigationCloseButton}
              >
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.navigationSubtitle}>Buyer Workspace</Text>
            {[
              { label: "Dashboard", icon: "grid-outline", route: "/(buyer)/dashboard" },
              { label: "My Requests", icon: "document-text-outline", route: "/(buyer)/rfqs" },
              { label: "My Offers", icon: "pricetags-outline", route: "/(buyer)/offers" },
              { label: "Orders", icon: "cube-outline", route: "/(buyer)/orders" },
              { label: "Samples", icon: "layers-outline", route: "/(buyer)/samples" },
              { label: "Payments", icon: "card-outline", route: "/(buyer)/payments" },
              { label: "Messages", icon: "chatbubble-ellipses-outline", route: "/(buyer)/messages" },
              { label: "Suppliers", icon: "business-outline", route: "/(buyer)/suppliers" },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.navigationItem}
                onPress={() => {
                  setNavigationMenuOpen(false);
                  router.push(item.route as any);
                }}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.label === "My Requests" ? Colors.primary : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.navigationItemText,
                    item.label === "My Requests" && { color: Colors.primary, fontWeight: "800" },
                  ]}
                >
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </NativeModal>

      {/* Main List & Header */}
      <FlatList
        data={filteredAndSortedRfqs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRfqs();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.pageHeaderWrap}>
            {/* Title & Tag */}
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>My Requests</Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>Buyer Sourcing Hub</Text>
              </View>
            </View>

            {/* Description */}
            <Text style={styles.pageDescription}>
              Create and manage your production requests (RFQs), compare supplier quotes, and move to order.
            </Text>

            {/* Primary Action Button */}
            <TouchableOpacity
              onPress={() => setIsPostModalOpen(true)}
              style={styles.postRequestBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.postRequestBtnText}>Post New Request</Text>
            </TouchableOpacity>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={17} color={Colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by RFQ ID, title or product..."
                placeholderTextColor={Colors.textMuted}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClearBtn}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Filters Row: Status Pills & Sort Trigger */}
            <View style={styles.filterBarRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.statusPillsWrap}
              >
                {[
                  { key: "ALL", label: "All Status" },
                  { key: "QUOTES_RECEIVED", label: "Quotes Received" },
                  { key: "OPEN", label: "Open (0 Quotes)" },
                  { key: "AWARDED", label: "Awarded" },
                  { key: "DRAFT", label: "Draft" },
                ].map((st) => (
                  <TouchableOpacity
                    key={st.key}
                    onPress={() => setStatusFilter(st.key as any)}
                    style={[styles.statusPill, statusFilter === st.key && styles.statusPillActive]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        statusFilter === st.key && styles.statusPillTextActive,
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Sort By Trigger */}
              <TouchableOpacity
                onPress={() => setShowSortDropdown((prev) => !prev)}
                style={styles.sortTriggerBtn}
              >
                <Ionicons name="swap-vertical" size={15} color={Colors.textSecondary} />
                <Text style={styles.sortTriggerText}>
                  {sortBy === "NEWEST"
                    ? "Newest"
                    : sortBy === "OLDEST"
                    ? "Oldest"
                    : sortBy === "QTY_DESC"
                    ? "Qty High"
                    : "Qty Low"}
                </Text>
                <Ionicons name="chevron-down" size={13} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Sort Dropdown Options */}
            {showSortDropdown && (
              <View style={styles.sortMenu}>
                {[
                  { key: "NEWEST", label: "Newest First" },
                  { key: "OLDEST", label: "Oldest First" },
                  { key: "QTY_DESC", label: "Quantity (High to Low)" },
                  { key: "QTY_ASC", label: "Quantity (Low to High)" },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => {
                      setSortBy(opt.key as any);
                      setShowSortDropdown(false);
                    }}
                    style={[styles.sortMenuItem, sortBy === opt.key && styles.sortMenuItemActive]}
                  >
                    <Text
                      style={[
                        styles.sortMenuText,
                        sortBy === opt.key && { color: Colors.primary, fontWeight: "700" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                    {sortBy === opt.key && (
                      <Ionicons name="checkmark" size={14} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="document-text-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No requests found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== "ALL"
                  ? "No RFQs match your current search and filters. Try clearing your search or filter."
                  : "You haven't posted any requests yet. Broadcast your first tech pack to start receiving quotes."}
              </Text>
              {searchQuery || statusFilter !== "ALL" ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  style={styles.clearFilterBtn}
                >
                  <Text style={styles.clearFilterBtnText}>Clear Filters</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsPostModalOpen(true)}
                  style={styles.emptyPostBtn}
                >
                  <Ionicons name="add" size={16} color="#FFF" />
                  <Text style={styles.emptyPostBtnText}>Post Your First Request</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const quoteCount = item.quotations?.length || 0;
          const isAwarded = item.status === "AWARDED";
          const isDraft = item.status === "DRAFT";
          const isOpenStatus = item.status === "OPEN";

          const statusLabel = isAwarded
            ? "Awarded"
            : isOpenStatus && quoteCount > 0
            ? "Quotes Received"
            : isOpenStatus
            ? "Open"
            : isDraft
            ? "Draft"
            : item.status;

          const badgeTheme =
            isAwarded || statusLabel === "Quotes Received"
              ? { bg: Colors.successLight, text: Colors.successText, border: Colors.successBorder }
              : statusLabel === "Open"
              ? { bg: Colors.warningLight, text: Colors.warningText, border: Colors.warningBorder }
              : { bg: Colors.surfaceSubtle, text: Colors.textSecondary, border: Colors.border };

          const winningSupplier = isAwarded
            ? item.quotations?.find((q: any) => q.status === "ACCEPTED" || q.status === "AWARDED")
                ?.supplier?.name ||
              item.quotations?.[0]?.supplier?.name ||
              "Verified Supplier"
            : null;

          const rfqIdPill = formatRfqId(item.id);
          const deliveryFormatted = formatDate(item.targetDate);
          const createdFormatted = formatDate(item.createdAt);
          const unit = item.items?.[0]?.unit || "pieces";

          return (
            <View style={styles.rfqCard}>
              {/* Top Row: ID Pill, Status Badge & Menu */}
              <View style={styles.cardTopRow}>
                <View style={styles.cardPillsRow}>
                  <View style={styles.idBadgePill}>
                    <Text style={styles.idBadgeText}>{rfqIdPill}</Text>
                  </View>
                  <View
                    style={[
                      styles.cardStatusBadge,
                      { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border },
                    ]}
                  >
                    <Text style={[styles.cardStatusText, { color: badgeTheme.text }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Three Dots Button */}
                <TouchableOpacity
                  onPress={() => openContextMenu(item)}
                  style={styles.moreBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="ellipsis-vertical" size={17} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Title (Tappable to View Details) */}
              <TouchableOpacity
                onPress={() => setSelectedRfqForDetails(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
              </TouchableOpacity>

              {/* Meta Specs: Qty & Delivery */}
              <View style={styles.cardMetaRow}>
                <View style={styles.cardMetaItem}>
                  <Ionicons name="layers-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.cardMetaText}>
                    Qty: {item.targetQuantity?.toLocaleString()} {unit}
                  </Text>
                </View>
                <View style={styles.cardMetaItem}>
                  <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.cardMetaText}>Delivery: {deliveryFormatted}</Text>
                </View>
              </View>

              {/* Stats Row: Quotes / Awarded on Left, Created Date on Right */}
              <View style={styles.cardStatsDivider} />
              <View style={styles.cardStatsRow}>
                <View style={{ flex: 1 }}>
                  {isAwarded ? (
                    <>
                      <Text style={styles.statLabel}>Awarded To</Text>
                      <Text style={styles.statValueHighlight} numberOfLines={1}>
                        {winningSupplier}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.statLabel}>Quotes Received</Text>
                      <Text style={styles.quoteCountNumber}>{quoteCount}</Text>
                      {quoteCount > 0 ? (
                        <TouchableOpacity
                          onPress={() => router.push(`/(buyer)/offers?rfqId=${item.id}`)}
                        >
                          <Text style={styles.viewQuotesLink}>View Quotes</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() =>
                            setSelectedRfqForInvite({ id: item.id, title: item.title })
                          }
                        >
                          <Text style={styles.inviteLink}>Invite Suppliers</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>

                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.statLabel}>Created On</Text>
                  <Text style={styles.createdDateValue}>{createdFormatted}</Text>
                </View>
              </View>

              {/* Action Buttons Row */}
              <View style={styles.cardActionsRow}>
                {quoteCount > 0 && !isAwarded && (
                  <TouchableOpacity
                    onPress={() => router.push(`/(buyer)/offers?rfqId=${item.id}`)}
                    style={styles.compareQuotesBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="git-compare-outline" size={14} color="#FFF" />
                    <Text style={styles.compareQuotesBtnText}>Compare Quotes</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setSelectedRfqForDetails(item)}
                  style={styles.viewDetailsBtn}
                  activeOpacity={0.85}
                >
                  <Ionicons name="eye-outline" size={14} color={Colors.primary} />
                  <Text style={styles.viewDetailsBtnText}>View Details</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Android Context Menu Modal */}
      {Platform.OS === "android" && activeMenuRfq && (
        <NativeModal
          visible={Boolean(activeMenuRfq)}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveMenuRfq(null)}
        >
          <TouchableOpacity
            style={styles.androidMenuOverlay}
            activeOpacity={1}
            onPress={() => setActiveMenuRfq(null)}
          >
            <View style={styles.androidMenuCard}>
              <Text style={styles.androidMenuTitle} numberOfLines={1}>
                {activeMenuRfq.title}
              </Text>
              <View style={styles.androidMenuDivider} />

              <TouchableOpacity
                style={styles.androidMenuItem}
                onPress={() => {
                  const r = activeMenuRfq;
                  setActiveMenuRfq(null);
                  setSelectedRfqForDetails(r);
                }}
              >
                <Ionicons name="eye-outline" size={18} color={Colors.text} />
                <Text style={styles.androidMenuText}>View Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.androidMenuItem}
                onPress={() => {
                  const r = activeMenuRfq;
                  setActiveMenuRfq(null);
                  setSelectedRfqForInvite({ id: r.id, title: r.title });
                }}
              >
                <Ionicons name="person-add-outline" size={18} color={Colors.primary} />
                <Text style={[styles.androidMenuText, { color: Colors.primary }]}>Invite Suppliers</Text>
              </TouchableOpacity>

              {(activeMenuRfq.quotations?.length || 0) > 0 && (
                <TouchableOpacity
                  style={styles.androidMenuItem}
                  onPress={() => {
                    const r = activeMenuRfq;
                    setActiveMenuRfq(null);
                    router.push(`/(buyer)/offers?rfqId=${r.id}`);
                  }}
                >
                  <Ionicons name="git-compare-outline" size={18} color={Colors.primary} />
                  <Text style={[styles.androidMenuText, { color: Colors.primary }]}>Compare Quotes</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.androidMenuItem}
                onPress={() => {
                  const r = activeMenuRfq;
                  setActiveMenuRfq(null);
                  handleDeleteRfq(r.id, r.title);
                }}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                <Text style={[styles.androidMenuText, { color: Colors.danger }]}>Delete Request</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </NativeModal>
      )}

      {/* Post New Request Modal */}
      <PostRfqModal
        visible={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={loadRfqs}
        buyerOrgId={activeMembership?.organizationId || ""}
      />

      {/* RFQ Details Modal */}
      <RfqDetailsModal
        visible={Boolean(selectedRfqForDetails)}
        onClose={() => setSelectedRfqForDetails(null)}
        rfq={selectedRfqForDetails}
        onOpenInvite={(r) => setSelectedRfqForInvite({ id: r.id, title: r.title })}
        onDelete={handleDeleteRfq}
        onCompareQuotes={(id) => router.push(`/(buyer)/offers?rfqId=${id}`)}
      />

      {/* Invite Suppliers Modal */}
      {Boolean(selectedRfqForInvite) && (
        <InviteSuppliersModal
          visible={Boolean(selectedRfqForInvite)}
          onClose={() => setSelectedRfqForInvite(null)}
          rfqId={selectedRfqForInvite?.id || ""}
          rfqTitle={selectedRfqForInvite?.title || ""}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 110,
  },
  pageHeaderWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  pageTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  tagBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  tagBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  pageDescription: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  postRequestBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  postRequestBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    marginTop: 14,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  filterBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  statusPillsWrap: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  statusPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  sortTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortTriggerText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  sortMenu: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 6,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  sortMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  sortMenuItemActive: {
    backgroundColor: Colors.primaryLight,
  },
  sortMenuText: {
    fontSize: 12,
    color: Colors.textBody,
  },
  emptyContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    padding: 28,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 16,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
    maxWidth: 260,
  },
  clearFilterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  clearFilterBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  emptyPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  emptyPostBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  rfqCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  idBadgePill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  idBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: Colors.primary,
  },
  cardStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  moreBtn: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textHeading,
    marginTop: 8,
    lineHeight: 20,
  },
  cardMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  cardMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  cardStatsDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginTop: 12,
    marginBottom: 8,
  },
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textMuted,
    marginBottom: 1,
  },
  statValueHighlight: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  quoteCountNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  viewQuotesLink: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    marginTop: 1,
  },
  inviteLink: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    marginTop: 1,
  },
  createdDateValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textBody,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  compareQuotesBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    borderRadius: 12,
  },
  compareQuotesBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  viewDetailsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    paddingVertical: 9,
    borderRadius: 12,
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  androidMenuOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  androidMenuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  androidMenuTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textHeading,
    paddingBottom: 8,
  },
  androidMenuDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginBottom: 6,
  },
  androidMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
  },
  androidMenuText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textBody,
  },
  navigationOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  navigationBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  navigationDrawer: {
    width: "82%",
    maxWidth: 340,
    height: "100%",
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === "ios" ? 58 : (StatusBar.currentHeight || 0) + 18,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    elevation: 18,
  },
  navigationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  navigationTitle: {
    color: Colors.primary,
    fontSize: 19,
    fontWeight: "900",
  },
  navigationCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  navigationSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 14,
  },
  navigationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  navigationItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
});
