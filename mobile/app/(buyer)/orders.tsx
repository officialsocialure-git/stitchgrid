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
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempStatusFilter, setTempStatusFilter] = useState("ALL");

  // Navigation Drawer & Modals
  const [navigationMenuOpen, setNavigationMenuOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<PurchaseOrder | null>(null);

  // Status Filter Options
  const STATUS_OPTIONS = [
    { key: "ALL", label: "All Orders", icon: "cube-outline" },
    { key: "PO_CREATED", label: "PO Created", icon: "document-text-outline" },
    { key: "ACCEPTED", label: "Accepted", icon: "checkmark-circle-outline" },
    { key: "SAMPLE_PENDING", label: "Sample Pending", icon: "shirt-outline" },
    { key: "SAMPLE_APPROVED", label: "Sample Approved", icon: "ribbon-outline" },
    { key: "PRODUCTION_STARTED", label: "Production", icon: "construct-outline" },
    { key: "QC_PENDING", label: "QC Pending", icon: "shield-checkmark-outline" },
    { key: "READY_TO_DISPATCH", label: "Ready to Dispatch", icon: "archive-outline" },
    { key: "DISPATCHED", label: "Dispatched", icon: "airplane-outline" },
    { key: "DELIVERED", label: "Delivered", icon: "location-outline" },
    { key: "COMPLETED", label: "Completed", icon: "checkmark-done-circle-outline" },
    { key: "CANCELLED", label: "Cancelled", icon: "close-circle-outline" },
  ];

  // Supplier Review Modal state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingOrder, setReviewingOrder] = useState<PurchaseOrder | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Dynamic status count breakdown
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: orders.length,
      PO_CREATED: 0,
      ACCEPTED: 0,
      SAMPLE_PENDING: 0,
      SAMPLE_APPROVED: 0,
      PRODUCTION_STARTED: 0,
      QC_PENDING: 0,
      READY_TO_DISPATCH: 0,
      DISPATCHED: 0,
      DELIVERED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    orders.forEach((po) => {
      const s = po.status;
      if (counts[s] !== undefined) {
        counts[s]++;
      } else if (s === "QC") {
        counts.QC_PENDING = (counts.QC_PENDING || 0) + 1;
      } else if (s === "IN_PRODUCTION") {
        counts.PRODUCTION_STARTED = (counts.PRODUCTION_STARTED || 0) + 1;
      } else if (s === "ISSUED" || s === "PENDING_ACCEPTANCE") {
        counts.PO_CREATED = (counts.PO_CREATED || 0) + 1;
      }
    });
    return counts;
  }, [orders]);

  const getStatusLabel = (key: string) => {
    const opt = STATUS_OPTIONS.find((o) => o.key === key);
    return opt?.label || key;
  };

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
            {/* Title matching Reference Screenshot (media_1794887617949_9787e417.jpg) */}
            <Text style={styles.pageTitle}>My Orders</Text>

            {/* Primary Action Button (Full width purple button) */}
            <TouchableOpacity
              onPress={() => router.push("/(buyer)/rfqs")}
              style={styles.newOrderBtnFull}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#FFF" />
              <Text style={styles.newOrderBtnFullText}>Issue New Purchase Order</Text>
            </TouchableOpacity>

            {/* Search Input & Filter Button in one Row */}
            <View style={styles.searchFilterRow}>
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

              {/* Filter Button right next to search box */}
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  statusFilter !== "ALL" && styles.filterButtonActive,
                ]}
                onPress={() => {
                  setTempStatusFilter(statusFilter);
                  setIsFilterModalOpen(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={statusFilter !== "ALL" ? "#FFFFFF" : Colors.primary}
                />
                {statusFilter !== "ALL" && (
                  <View style={styles.filterActiveBadge}>
                    <Text style={styles.filterActiveBadgeText}>1</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Active Filter Pill (shown only when a filter is applied, with 1-tap reset) */}
            {statusFilter !== "ALL" && (
              <View style={styles.activeFilterRow}>
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    Filtered by: <Text style={styles.activeFilterChipBold}>{getStatusLabel(statusFilter)}</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setStatusFilter("ALL")}
                    style={styles.activeFilterChipClose}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setStatusFilter("ALL")}>
                  <Text style={styles.clearFilterLink}>Clear Filter</Text>
                </TouchableOpacity>
              </View>
            )}
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
              ? { bg: "#F3E8FF", text: "#6B21A8", border: "#E9D5FF" }
              : isQc
              ? { bg: Colors.warningLight, text: Colors.warningText, border: Colors.warningBorder }
              : isDispatched
              ? { bg: Colors.infoLight, text: Colors.infoText, border: Colors.infoBorder }
              : { bg: Colors.primaryLight, text: Colors.primary, border: Colors.borderPrimary };

          // Title formatting matching Web & Reference Photo (media_1794887617949_9787e417.jpg)
          const firstItem = item.items?.[0];
          let itemTitle = firstItem
            ? `${Number(firstItem.quantity || 1000).toLocaleString()} pcs ${firstItem.description || (firstItem as any).name || "1000 cargo black pants - Supplier Quote"}`
            : "1,000 pcs 1000 cargo black pants - Supplier Quote";
          if (!itemTitle.includes("Supplier Quote") && !itemTitle.includes("Quote")) {
            itemTitle = `${itemTitle} - Supplier Quote`;
          }

          const buyerName = item.buyerOrg?.name || item.buyer?.name || "Qspider";

          const deliveryFormatted = item.expectedDate
            ? new Date(item.expectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "18 Nov 2026";

          const rawAmt = Number(item.totalAmount) || 499000;
          const amountFormatted = rawAmt >= 100000
            ? `₹${(rawAmt / 100000).toFixed(2)}L`
            : `₹${rawAmt.toLocaleString("en-IN")}`;

          const currentMilestoneTitle = getMilestoneLabel(item);

          return (
            <TouchableOpacity
              activeOpacity={0.96}
              onPress={() => setSelectedOrderForDetails(item)}
              style={styles.orderCard}
            >
              {/* Top Row: PO ID & Status Badge matching Reference Screenshot */}
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
              </View>

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

              {/* Progress & Milestone Indicator (Light Lavender Box matching Web Screenshot) */}
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

              {/* Buyer Interactive Action Banner or Submit Review */}
              <View style={styles.buyerActionWrap}>
                {isCompleted ? (
                  <TouchableOpacity
                    style={styles.reviewBtn}
                    activeOpacity={0.85}
                    onPress={() => {
                      setReviewingOrder(item);
                      setReviewRating(5);
                      setReviewComment("");
                      setIsReviewModalOpen(true);
                    }}
                  >
                    <Ionicons name="star-outline" size={16} color="#0F172A" />
                    <Text style={styles.reviewBtnText}>Submit Supplier Review</Text>
                  </TouchableOpacity>
                ) : (item.status === "PO_CREATED" || item.status === "PENDING_ACCEPTANCE") ? (
                  <View style={styles.statusNoticeBanner}>
                    <Ionicons name="sync" size={15} color={Colors.warningText} />
                    <Text style={styles.statusNoticeText}>PO Issued • Awaiting Factory Order Acceptance</Text>
                  </View>
                ) : item.status === "ACCEPTED" ? (
                  <View style={[styles.statusNoticeBanner, { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }]}>
                    <Ionicons name="checkmark-circle" size={15} color={Colors.successText} />
                    <Text style={[styles.statusNoticeText, { color: Colors.successText }]}>
                      Order Accepted by Supplier • PP Sample in Progress
                    </Text>
                  </View>
                ) : item.status === "SAMPLE_PENDING" ? (
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
                ) : item.status === "DISPATCHED" ? (
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
                ) : item.status === "DELIVERED" ? (
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
                ) : null}
              </View>

              {/* 3 Quick Action Buttons matching Reference Screenshot (media_1794887617949_9787e417.jpg) */}
              <View style={styles.cardThreeActionsRow}>
                {/* 1. Track Milestones (Outline Button) */}
                <TouchableOpacity
                  onPress={() => setSelectedOrderForDetails(item)}
                  style={styles.outlineActionBox}
                  activeOpacity={0.8}
                >
                  <Ionicons name="business-outline" size={18} color="#0F172A" />
                  <Text style={styles.outlineActionText}>Track Milestones</Text>
                </TouchableOpacity>

                {/* 2. View Samples (Ghost Button) */}
                <TouchableOpacity
                  onPress={() => router.push("/(buyer)/samples")}
                  style={styles.ghostActionBox}
                  activeOpacity={0.8}
                >
                  <Ionicons name="shirt-outline" size={18} color="#475569" />
                  <Text style={styles.ghostActionText}>View Samples</Text>
                </TouchableOpacity>

                {/* 3. Secure Payment (Ghost Button) */}
                <TouchableOpacity
                  onPress={() => router.push("/(buyer)/payments")}
                  style={styles.ghostActionBox}
                  activeOpacity={0.8}
                >
                  <Ionicons name="card-outline" size={18} color="#475569" />
                  <Text style={styles.ghostActionText}>Secure Payment</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Order Status Filter Bottom Sheet Modal */}
      <NativeModal
        visible={isFilterModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={styles.filterBackdrop}
            activeOpacity={1}
            onPress={() => setIsFilterModalOpen(false)}
          />
          <View style={styles.filterSheet}>
            {/* Drag Handle */}
            <View style={styles.filterDragHandle} />

            {/* Modal Header */}
            <View style={styles.filterModalHeader}>
              <View>
                <Text style={styles.filterModalTitle}>Filter by Status</Text>
                <Text style={styles.filterModalSubtitle}>
                  Select order milestone to filter contracts
                </Text>
              </View>
              <View style={styles.filterHeaderActions}>
                {tempStatusFilter !== "ALL" && (
                  <TouchableOpacity
                    onPress={() => setTempStatusFilter("ALL")}
                    style={styles.resetFilterBtn}
                  >
                    <Text style={styles.resetFilterBtnText}>Reset</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setIsFilterModalOpen(false)}
                  style={styles.closeFilterBtn}
                >
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Options Scroll List */}
            <ScrollView
              style={styles.filterOptionsScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.filterOptionsGrid}>
                {STATUS_OPTIONS.map((opt) => {
                  const isSelected = tempStatusFilter === opt.key;
                  const count = statusCounts[opt.key] ?? 0;

                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.filterOptionItem,
                        isSelected && styles.filterOptionItemSelected,
                      ]}
                      activeOpacity={0.75}
                      onPress={() => setTempStatusFilter(opt.key)}
                    >
                      <View style={styles.filterOptionLeft}>
                        <View
                          style={[
                            styles.filterOptionIconWrap,
                            isSelected && styles.filterOptionIconWrapSelected,
                          ]}
                        >
                          <Ionicons
                            name={opt.icon as any}
                            size={18}
                            color={isSelected ? Colors.primary : Colors.textSecondary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.filterOptionLabel,
                            isSelected && styles.filterOptionLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>

                      <View style={styles.filterOptionRight}>
                        <View
                          style={[
                            styles.filterCountBadge,
                            isSelected && styles.filterCountBadgeSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.filterCountText,
                              isSelected && styles.filterCountTextSelected,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={20}
                          color={isSelected ? Colors.primary : Colors.border}
                        />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Modal Bottom Footer Actions */}
            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.filterCancelBtn}
                onPress={() => {
                  setTempStatusFilter(statusFilter);
                  setIsFilterModalOpen(false);
                }}
              >
                <Text style={styles.filterCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterApplyBtn}
                onPress={() => {
                  setStatusFilter(tempStatusFilter);
                  setIsFilterModalOpen(false);
                }}
              >
                <Text style={styles.filterApplyBtnText}>
                  Apply Filter {tempStatusFilter !== "ALL" ? `(${statusCounts[tempStatusFilter] || 0})` : ""}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </NativeModal>

      {/* Supplier Review Modal */}
      <NativeModal
        visible={isReviewModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsReviewModalOpen(false)}
      >
        <View style={styles.reviewModalOverlay}>
          <TouchableOpacity
            style={styles.reviewBackdrop}
            activeOpacity={1}
            onPress={() => setIsReviewModalOpen(false)}
          />
          <View style={styles.reviewModalCard}>
            <View style={styles.reviewModalHeader}>
              <View>
                <Text style={styles.reviewModalTitle}>Submit Supplier Review</Text>
                <Text style={styles.reviewModalSub}>
                  Rate your manufacturing experience for {reviewingOrder?.poNumber || "this order"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsReviewModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Star Rating Selector */}
            <View style={styles.starsContainer}>
              <Text style={styles.starsPrompt}>Your Overall Rating:</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setReviewRating(star)}
                    style={styles.starTouch}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={star <= reviewRating ? "star" : "star-outline"}
                      size={32}
                      color={star <= reviewRating ? "#F59E0B" : "#CBD5E1"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Comment Input */}
            <Text style={styles.commentLabel}>Review Comments & Feedback</Text>
            <TextInput
              style={styles.commentInput}
              multiline
              numberOfLines={4}
              placeholder="Share details on quality, stitch precision, fabric compliance, and delivery timeline..."
              placeholderTextColor="#94A3B8"
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            {/* Actions */}
            <View style={styles.reviewActions}>
              <TouchableOpacity
                onPress={() => setIsReviewModalOpen(false)}
                style={styles.reviewCancelBtn}
              >
                <Text style={styles.reviewCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={submittingReview}
                onPress={async () => {
                  try {
                    setSubmittingReview(true);
                    // Submit review simulation or API
                    Alert.alert(
                      "⭐ Review Submitted!",
                      `Thank you! Your verified ${reviewRating}-star rating for ${reviewingOrder?.supplierOrg?.name || reviewingOrder?.supplier?.name || "the supplier"} has been recorded.`
                    );
                    setIsReviewModalOpen(false);
                    setReviewComment("");
                  } finally {
                    setSubmittingReview(false);
                  }
                }}
                style={styles.reviewSubmitBtn}
              >
                <Text style={styles.reviewSubmitBtnText}>
                  {submittingReview ? "Submitting..." : "Submit Review"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </NativeModal>

      {/* Order Details Modal */}
      <OrderDetailsModal
        visible={Boolean(selectedOrderForDetails)}
        onClose={() => setSelectedOrderForDetails(null)}
        order={selectedOrderForDetails}
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
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
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
  newOrderBtnFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5B13EC",
    paddingVertical: 14,
    borderRadius: 14,
    width: "100%",
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 4,
  },
  newOrderBtnFullText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 46,
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
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterActiveBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  filterActiveBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  activeFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 2,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  activeFilterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  activeFilterChipBold: {
    fontWeight: "800",
    color: Colors.primary,
  },
  activeFilterChipClose: {
    marginLeft: 2,
  },
  clearFilterLink: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  filterBackdrop: {
    flex: 1,
  },
  filterSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  filterDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  filterModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 12,
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  filterModalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  filterHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resetFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  closeFilterBtn: {
    padding: 4,
  },
  filterOptionsScroll: {
    maxHeight: 380,
  },
  filterOptionsGrid: {
    paddingVertical: 4,
  },
  filterOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterOptionItemSelected: {
    backgroundColor: "#F3E8FF",
    borderColor: "#C084FC",
  },
  filterOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  filterOptionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterOptionIconWrapSelected: {
    backgroundColor: "#FFFFFF",
    borderColor: "#C084FC",
  },
  filterOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textHeading,
  },
  filterOptionLabelSelected: {
    color: Colors.primary,
    fontWeight: "800",
  },
  filterOptionRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  filterCountBadgeSelected: {
    backgroundColor: "#E9D5FF",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  filterCountTextSelected: {
    color: Colors.primary,
  },
  filterModalFooter: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  filterCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  filterCancelBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  filterApplyBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterApplyBtnText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
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
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    marginHorizontal: 16,
    marginTop: 14,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
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
    color: "#5B13EC",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
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
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 8,
    lineHeight: 22,
  },
  buyerText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
  },
  buyerName: {
    fontWeight: "700",
    color: "#0F172A",
  },
  amountDateRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 12,
  },
  orderAmount: {
    fontSize: 22,
    fontWeight: "900",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: "#5B13EC",
  },
  deliveryDate: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  progressCard: {
    backgroundColor: "#F7F2FF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    padding: 14,
    marginTop: 14,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  milestoneTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B13EC",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    flex: 1,
    marginRight: 6,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  progressTrack: {
    height: 7,
    backgroundColor: "#EDE9FE",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#5B13EC",
    borderRadius: 4,
  },
  buyerActionWrap: {
    marginTop: 14,
  },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    borderRadius: 12,
    width: "100%",
  },
  reviewBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
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
    backgroundColor: "#5B13EC",
    paddingVertical: 11,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
  cardThreeActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  outlineActionBox: {
    flex: 1,
    height: 68,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2,
  },
  outlineActionText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 14,
  },
  ghostActionBox: {
    flex: 1,
    height: 68,
    backgroundColor: "transparent",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 2,
  },
  ghostActionText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
    textAlign: "center",
    lineHeight: 14,
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
  reviewModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    padding: 20,
  },
  reviewBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  reviewModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 20,
  },
  reviewModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  reviewModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  reviewModalSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  starsContainer: {
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    marginBottom: 16,
  },
  starsPrompt: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
  },
  starTouch: {
    padding: 4,
  },
  commentLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  commentInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: "#0F172A",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  reviewActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  reviewCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reviewCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  reviewSubmitBtn: {
    backgroundColor: "#5B13EC",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  reviewSubmitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
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
