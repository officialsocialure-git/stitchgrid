import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  StatusBar,
  Modal as NativeModal,
  TextInput,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Button } from "../../src/components/common/Button";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { PurchaseOrder } from "../../src/types";
import { OrderDetailsModal } from "../../src/components/orders/OrderDetailsModal";

export default function BuyerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Search & Status Filters matching Web App
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Navigation Drawer & Modals
  const [navigationMenuOpen, setNavigationMenuOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<PurchaseOrder | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("Failed to load orders:", e);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useRealtimeSync({
    topics: ["order:created", "order:updated", "milestone:updated"],
    onSync: loadOrders,
    pollIntervalMs: 25000,
  });

  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    try {
      setUpdatingId(orderId);
      await marketplaceService.updateOrderStatus(orderId, nextStatus, {
        note: `Buyer transitioned status to ${nextStatus}`,
      });
      Alert.alert(
        "Status Updated",
        nextStatus === "SAMPLE_APPROVED"
          ? "Pre-Production Sample approved! Factory has been authorized to start bulk production."
          : nextStatus === "DELIVERED"
          ? "Delivery confirmed! Final inspection and settlement ready."
          : nextStatus === "COMPLETED"
          ? "Order completed and final payment released to factory!"
          : `Order updated to ${nextStatus}.`
      );
      loadOrders();
      if (selectedOrderForDetails?.id === orderId) {
        setSelectedOrderForDetails((prev) => (prev ? { ...prev, status: nextStatus } : null));
      }
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || err.message || "Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "PO_CREATED":
      case "PENDING_ACCEPTANCE":
      case "ISSUED":
        return 10;
      case "ACCEPTED":
        return 20;
      case "SAMPLE_PENDING":
        return 30;
      case "SAMPLE_APPROVED":
        return 45;
      case "PRODUCTION_STARTED":
      case "IN_PRODUCTION":
        return 65;
      case "QC_PENDING":
      case "QC":
        return 80;
      case "READY_TO_DISPATCH":
        return 90;
      case "DISPATCHED":
        return 95;
      case "DELIVERED":
      case "COMPLETED":
        return 100;
      default:
        return 15;
    }
  };

  const getMilestoneLabel = (po: PurchaseOrder) => {
    const isCompleted = po.status === "COMPLETED";
    const isDelivered = po.status === "DELIVERED";
    const isDispatched = po.status === "DISPATCHED";
    const isQc = po.status === "QC" || po.status === "QC_PENDING";

    const activeMilestone = po.milestones?.find((m) => m.status === "IN_PROGRESS")?.title;
    if (activeMilestone) return activeMilestone;

    if (isCompleted) return "Order Fulfilled & Payment Released";
    if (isDelivered) return "Delivered at Buyer Warehouse";
    if (isDispatched) return "In Transit (Tracking Active)";
    if (po.status === "READY_TO_DISPATCH") return "Packed & Ready for Carrier";
    if (isQc) return "Quality Inspection (AQL 2.5 Standard)";
    if (po.status === "PRODUCTION_STARTED" || po.status === "IN_PRODUCTION") return "Bulk Production Lines Active";
    if (po.status === "SAMPLE_APPROVED") return "Pre-Production Sample Approved";
    if (po.status === "SAMPLE_PENDING") return "PP Sample in Review";
    if (po.status === "ACCEPTED") return "Order Accepted by Factory";
    return "Purchase Order Generated";
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((po) => {
      const q = searchQuery.trim().toLowerCase();
      const poNum = (po.poNumber || "").toLowerCase();
      const buyer = (po.buyerOrg?.name || po.buyer?.name || "").toLowerCase();
      const supplier = (po.supplierOrg?.name || po.supplier?.name || "").toLowerCase();
      const items = (po.items || []).map((i) => i.description || "").join(" ").toLowerCase();

      const matchesSearch = !q || poNum.includes(q) || buyer.includes(q) || supplier.includes(q) || items.includes(q);
      const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight || 0 } : null,
      ]}
    >
      {/* Header with Menu Drawer Trigger */}
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
              { label: "Production", icon: "construct-outline", route: "/(buyer)/production" },
              { label: "Payments", icon: "card-outline", route: "/(buyer)/payments" },
              { label: "Messages", icon: "chatbubble-ellipses-outline", route: "/(buyer)/messages" },
              { label: "Suppliers", icon: "business-outline", route: "/(buyer)/suppliers" },
              { label: "Profile", icon: "person-outline", route: "/(buyer)/profile" },
              { label: "Settings", icon: "settings-outline", route: "/(shared)/settings" },
              { label: "Notifications", icon: "notifications-outline", route: "/(shared)/notifications" },
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
                  color={item.label === "Orders" ? Colors.primary : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.navigationItemText,
                    item.label === "Orders" && { color: Colors.primary, fontWeight: "800" },
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

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOrders();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.pageHeaderWrap}>
            {/* Title & Badge */}
            <View style={styles.titleRow}>
              <Text style={styles.pageTitle}>My Orders</Text>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>Milestone Contracts</Text>
              </View>
            </View>

            {/* Subtitle */}
            <Text style={styles.pageDescription}>
              Active and fulfilled B2B garment manufacturing contracts secured by payment milestones.
            </Text>

            {/* Primary Action Button */}
            <TouchableOpacity
              onPress={() => router.push("/(buyer)/rfqs")}
              style={styles.newOrderBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#FFF" />
              <Text style={styles.newOrderBtnText}>Issue New Purchase Order</Text>
            </TouchableOpacity>

            {/* Search Input */}
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={17} color={Colors.textMuted} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by PO ID, product or supplier..."
                placeholderTextColor={Colors.textMuted}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClearBtn}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filter Tabs (Horizontal Scroll) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusPillsWrap}
            >
              {[
                { key: "ALL", label: "All Orders" },
                { key: "PO_CREATED", label: "PO Created" },
                { key: "ACCEPTED", label: "Accepted" },
                { key: "SAMPLE_PENDING", label: "Sample Pending" },
                { key: "SAMPLE_APPROVED", label: "Sample Approved" },
                { key: "PRODUCTION_STARTED", label: "Production" },
                { key: "QC_PENDING", label: "QC Pending" },
                { key: "READY_TO_DISPATCH", label: "Ready to Dispatch" },
                { key: "DISPATCHED", label: "Dispatched" },
                { key: "DELIVERED", label: "Delivered" },
                { key: "COMPLETED", label: "Completed" },
              ].map((st) => (
                <TouchableOpacity
                  key={st.key}
                  onPress={() => setStatusFilter(st.key)}
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
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="cube-outline" size={32} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {orders.length === 0 ? "No purchase orders found" : "No matching orders"}
              </Text>
              <Text style={styles.emptySubtitle}>
                {orders.length === 0
                  ? "Accept an incoming quotation from your RFQs page to issue a binding purchase order."
                  : "Try clearing your search query or status filter to see other orders."}
              </Text>
              {orders.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                  style={styles.clearFilterBtn}
                >
                  <Text style={styles.clearFilterBtnText}>Clear Search & Filters</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push("/(buyer)/rfqs")}
                  style={styles.emptyPostBtn}
                >
                  <Ionicons name="swap-horizontal" size={16} color="#FFF" />
                  <Text style={styles.emptyPostBtnText}>View RFQs & Quotations</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : undefined
        }
        renderItem={({ item }) => {
          const progress = getProgressPercentage(item.status);
          const isCompleted = item.status === "COMPLETED";
          const isDelivered = item.status === "DELIVERED";
          const isQc = item.status === "QC" || item.status === "QC_PENDING";
          const isDispatched = item.status === "DISPATCHED";

          const badgeTheme =
            isCompleted || isDelivered
              ? { bg: Colors.successLight, text: Colors.successText, border: Colors.successBorder }
              : isQc
              ? { bg: Colors.warningLight, text: Colors.warningText, border: Colors.warningBorder }
              : isDispatched
              ? { bg: Colors.infoLight, text: Colors.infoText, border: Colors.infoBorder }
              : { bg: Colors.primaryLight, text: Colors.primary, border: Colors.borderPrimary };

          const itemTitle = item.items?.length
            ? item.items.map((part) => `${Number(part.quantity || 0).toLocaleString()} pcs ${part.description || "Apparel"}`).join(", ")
            : "Apparel Production Lot";

          const buyerName = item.buyerOrg?.name || item.buyer?.name || "Buyer";
          const supplierName = item.supplierOrg?.name || item.supplier?.name || "Verified Mill";
          const supplierCity = item.supplierOrg?.city || item.supplier?.city || "India";

          const deliveryFormatted = item.expectedDate
            ? new Date(item.expectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "18 Nov 2026";

          const amountFormatted = `₹${(Number(item.totalAmount || 0) / 100000).toFixed(2)}L`;
          const currentMilestoneTitle = getMilestoneLabel(item);

          return (
            <View style={styles.orderCard}>
              {/* Top Row: PO ID, Status Badge & Supplier info */}
              <View style={styles.cardTopRow}>
                <View style={styles.cardPillsRow}>
                  <Text style={styles.poNumberText}>{item.poNumber || `SG-PO-${item.id.slice(0, 6)}`}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: badgeTheme.text }]}>
                      {item.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedOrderForDetails(item)}
                  style={styles.moreBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.supplierText}>
                Supplier: <Text style={{ color: Colors.textHeading, fontWeight: "700" }}>{supplierName}</Text> ({supplierCity})
              </Text>

              {/* Title & Buyer */}
              <Text style={styles.orderTitle} numberOfLines={2}>
                {itemTitle}
              </Text>
              <Text style={styles.buyerText}>
                Buyer: <Text style={styles.buyerName}>{buyerName}</Text>
              </Text>

              {/* Amount & Target Date */}
              <View style={styles.amountDateRow}>
                <Text style={styles.orderAmount}>{amountFormatted}</Text>
                <Text style={styles.deliveryDate}>Target: {deliveryFormatted}</Text>
              </View>

              {/* Progress & Milestone Indicator (Light Purple Card matching Web) */}
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.milestoneTitle} numberOfLines={1}>
                    {currentMilestoneTitle}
                  </Text>
                  <Text style={styles.progressPercentText}>{progress}% Completed</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
              </View>

              {/* Buyer Interactive Action Banner */}
              <View style={styles.buyerActionWrap}>
                {(item.status === "PO_CREATED" || item.status === "PENDING_ACCEPTANCE") && (
                  <View style={styles.statusNoticeBanner}>
                    <Ionicons name="sync" size={15} color={Colors.warningText} />
                    <Text style={styles.statusNoticeText}>PO Issued • Awaiting Factory Order Acceptance</Text>
                  </View>
                )}

                {item.status === "ACCEPTED" && (
                  <View style={[styles.statusNoticeBanner, { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }]}>
                    <Ionicons name="checkmark-circle" size={15} color={Colors.successText} />
                    <Text style={[styles.statusNoticeText, { color: Colors.successText }]}>
                      Order Accepted by Supplier • PP Sample in Progress
                    </Text>
                  </View>
                )}

                {item.status === "SAMPLE_PENDING" && (
                  <TouchableOpacity
                    onPress={() => handleStatusChange(item.id, "SAMPLE_APPROVED")}
                    disabled={updatingId === item.id}
                    style={styles.actionButtonPrimary}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                    <Text style={styles.actionButtonText}>
                      {updatingId === item.id ? "Approving..." : "Approve PP Sample"}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.status === "DISPATCHED" && (
                  <TouchableOpacity
                    onPress={() => handleStatusChange(item.id, "DELIVERED")}
                    disabled={updatingId === item.id}
                    style={styles.actionButtonPrimary}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="cube-outline" size={16} color="#FFF" />
                    <Text style={styles.actionButtonText}>
                      {updatingId === item.id ? "Confirming..." : "Confirm Delivery Received"}
                    </Text>
                  </TouchableOpacity>
                )}

                {item.status === "DELIVERED" && (
                  <TouchableOpacity
                    onPress={() => handleStatusChange(item.id, "COMPLETED")}
                    disabled={updatingId === item.id}
                    style={styles.actionButtonPrimary}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="wallet-outline" size={16} color="#FFF" />
                    <Text style={styles.actionButtonText}>
                      {updatingId === item.id ? "Releasing..." : "Release Payment & Complete"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Action Links Row (3 Quick Actions matching Web) */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  onPress={() => router.push(`/(buyer)/production?orderId=${item.id}`)}
                  style={styles.quickActionItem}
                >
                  <Ionicons name="construct-outline" size={17} color={Colors.textHeading} />
                  <Text style={styles.quickActionText}>Track Milestones</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/(buyer)/samples")}
                  style={styles.quickActionItem}
                >
                  <Ionicons name="shirt-outline" size={17} color={Colors.textHeading} />
                  <Text style={styles.quickActionText}>View Samples</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/(buyer)/payments")}
                  style={styles.quickActionItem}
                >
                  <Ionicons name="wallet-outline" size={17} color={Colors.textHeading} />
                  <Text style={styles.quickActionText}>Secure Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        visible={Boolean(selectedOrderForDetails)}
        onClose={() => setSelectedOrderForDetails(null)}
        order={selectedOrderForDetails}
        onTrackProduction={(orderId) => router.push(`/(buyer)/production?orderId=${orderId}`)}
        onSecurePayment={() => router.push("/(buyer)/payments")}
        onStatusChange={handleStatusChange}
        updating={Boolean(updatingId)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 40,
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
  newOrderBtn: {
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
  newOrderBtnText: {
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
  statusPillsWrap: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 10,
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
    maxWidth: 280,
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
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginHorizontal: 16,
    marginTop: 14,
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
  poNumberText: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  moreBtn: {
    padding: 4,
  },
  supplierText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
    marginTop: 6,
    lineHeight: 22,
  },
  buyerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  buyerName: {
    fontWeight: "700",
    color: Colors.textHeading,
  },
  amountDateRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 10,
  },
  orderAmount: {
    fontSize: 20,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: Colors.primary,
  },
  deliveryDate: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  progressCard: {
    backgroundColor: "#f7f2ff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ede5fc",
    padding: 12,
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  milestoneTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    flex: 1,
    marginRight: 6,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#e9ddff",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  buyerActionWrap: {
    marginTop: 12,
  },
  statusNoticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  statusNoticeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.warningText,
    flex: 1,
  },
  actionButtonPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quickActionItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    gap: 4,
  },
  quickActionText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textHeading,
    textAlign: "center",
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
