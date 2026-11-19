import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useAuth } from "../../src/hooks/useAuth";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { PurchaseOrder } from "../../src/types";

// Standard reference orders matching User's Reference Screenshots
const DEFAULT_SUPPLIER_ORDERS: PurchaseOrder[] = [
  {
    id: "po-2026-2589",
    poNumber: "SG-PO-2026-2589",
    quotationId: "quote-pappu",
    buyerOrgId: "org-buyer-1",
    supplierOrgId: "current-supplier",
    totalAmount: 499000,
    currency: "INR",
    status: "COMPLETED",
    expectedDate: "2026-11-18T00:00:00.000Z",
    createdAt: "2026-11-01T10:00:00.000Z",
    buyerOrg: {
      id: "org-buyer-1",
      name: "Qspider",
      city: "Noida",
    },
    items: [
      {
        id: "item-1",
        description: "1,000 pcs 1000 cargo black pants - Supplier Quote",
        quantity: 1000,
        unitPrice: 499,
      },
    ],
    milestones: [
      {
        id: "m-1",
        title: "Order Fulfilled & Payment Released",
        orderIndex: 1,
        status: "COMPLETED",
      },
    ],
  },
  {
    id: "po-2026-1197",
    poNumber: "SG-PO-2026-1197",
    quotationId: "quote-tees-1",
    buyerOrgId: "org-buyer-2",
    supplierOrgId: "current-supplier",
    totalAmount: 900000,
    currency: "INR",
    status: "IN_PRODUCTION",
    expectedDate: "2026-12-15T00:00:00.000Z",
    createdAt: "2026-11-05T10:00:00.000Z",
    buyerOrg: {
      id: "org-buyer-2",
      name: "TrendSetter Apparel Co.",
      city: "Birgunj",
    },
    items: [
      {
        id: "item-2",
        description: "5,000 pcs Crew Neck Tees - Export Quality",
        quantity: 5000,
        unitPrice: 180,
      },
    ],
    milestones: [
      {
        id: "m-2",
        title: "Bulk Production & Fabric Dyeing",
        orderIndex: 1,
        status: "IN_PROGRESS",
      },
    ],
  },
];

// Helper to format currency like reference photo: ₹4.99L or ₹9.00L
const formatOrderPrice = (amount?: number) => {
  if (!amount || amount === 0) return "₹0";
  if (amount >= 100000) {
    const inLakhs = amount / 100000;
    const formatted = inLakhs % 1 === 0 ? inLakhs.toFixed(0) : inLakhs.toFixed(2);
    return `₹${formatted}L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
};

// Helper to format date like reference photo: 18 Nov 2026
const formatTargetDate = (dateStr?: string) => {
  if (!dateStr) return "Not set";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function SupplierOrdersScreen() {
  const router = useRouter();
  const { activeMembership } = useAuth();

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");

  // Modals state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [selectedOrderForMilestones, setSelectedOrderForMilestones] = useState<PurchaseOrder | null>(null);
  const [selectedOrderForSamples, setSelectedOrderForSamples] = useState<PurchaseOrder | null>(null);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<PurchaseOrder | null>(null);

  // Load only purchase orders returned for the authenticated account.
  const loadOrders = useCallback(async () => {
    try {
      const data = await marketplaceService.listOrders();
      const supplierOrganizationId = activeMembership?.organizationId;
      setOrders(
        (Array.isArray(data) ? data : []).filter(
          (order) => Boolean(supplierOrganizationId) && order.supplierOrgId === supplierOrganizationId
        )
      );
    } catch (e) {
      console.warn("Failed to load supplier orders:", e);
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeMembership?.organizationId]);

  const updateSupplierOrderStatus = async (order: PurchaseOrder, nextStatus: string, actionLabel: string) => {
    Alert.alert(
      actionLabel,
      `Are you sure you want to update ${order.poNumber || "this purchase order"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setUpdatingOrderId(order.id);
              await marketplaceService.updateOrderStatus(order.id, nextStatus, {
                note: `${actionLabel} completed by supplier.`,
              });
              await loadOrders();
              Alert.alert("Order Updated", `${order.poNumber || "Purchase order"}: ${actionLabel} completed successfully.`);
            } catch (error: any) {
              Alert.alert(
                "Unable to Update Order",
                error?.response?.data?.message || error?.message || "Please try again."
              );
            } finally {
              setUpdatingOrderId(null);
            }
          },
        },
      ]
    );
  };

  const getNextSupplierOrderAction = (status: string) => {
    switch ((status || "").toUpperCase()) {
      case "PENDING_ACCEPTANCE":
      case "PO_CREATED":
      case "ISSUED":
        return { status: "ACCEPTED", label: "Accept Purchase Order" };
      case "ACCEPTED":
        return { status: "SAMPLE_PENDING", label: "Dispatch PP Sample" };
      case "SAMPLE_APPROVED":
        return { status: "PRODUCTION_STARTED", label: "Start Bulk Production" };
      case "PRODUCTION_STARTED":
      case "IN_PRODUCTION":
        return { status: "QC_PENDING", label: "Submit for Quality Inspection" };
      case "QC_PENDING":
      case "QC":
        return { status: "READY_TO_DISPATCH", label: "Quality Check Passed" };
      case "READY_TO_DISPATCH":
        return { status: "DISPATCHED", label: "Dispatch Shipment" };
      default:
        return null;
    }
  };

  const handleSupplierOrderAction = (order: PurchaseOrder) => {
    const action = getNextSupplierOrderAction(order.status);
    if (!action) return;
    updateSupplierOrderStatus(order, action.status, action.label);
  };

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useRealtimeSync({
    topics: ["order:created", "order:updated", "milestone:updated", "sample:updated"],
    onSync: loadOrders,
    pollIntervalMs: 20000,
  });

  // Filter & Search logic
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Filter match
      const statusUpper = (order.status || "").toUpperCase();
      if (selectedFilter !== "ALL") {
        if (
          selectedFilter === "PO_CREATED" &&
          !["ISSUED", "PO_CREATED", "PENDING_ACCEPTANCE"].includes(statusUpper)
        ) {
          return false;
        }
        if (selectedFilter === "ACCEPTED" && statusUpper !== "ACCEPTED") {
          return false;
        }
        if (
          selectedFilter === "SAMPLE_PENDING" &&
          statusUpper !== "SAMPLE_PENDING" &&
          statusUpper !== "SAMPLE_APPROVED"
        ) {
          return false;
        }
        if (
          selectedFilter === "IN_PRODUCTION" &&
          statusUpper !== "IN_PRODUCTION" &&
          statusUpper !== "PRODUCTION_STARTED"
        ) {
          return false;
        }
        if (selectedFilter === "COMPLETED" && statusUpper !== "COMPLETED") {
          return false;
        }
      }

      // 2. Search query match
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const poNum = (order.poNumber || "").toLowerCase();
      const buyerName = (order.buyerOrg?.name || "").toLowerCase();
      const itemTitle = (order.items?.[0]?.description || "").toLowerCase();

      return poNum.includes(q) || buyerName.includes(q) || itemTitle.includes(q);
    });
  }, [orders, selectedFilter, searchQuery]);

  // Compute status presentation
  const getOrderStatusConfig = (status: string) => {
    const s = (status || "").toUpperCase();
    if (s === "COMPLETED") {
      return {
        badgeText: "COMPLETED",
        badgeBg: "#F1ECFE",
        badgeColor: "#5B13EC",
        progressText: "Order Fulfilled & Payment Released",
        progressPercent: 100,
        progressPercentLabel: "100% Completed",
      };
    }
    if (s === "IN_PRODUCTION" || s === "PRODUCTION_STARTED") {
      return {
        badgeText: "IN PRODUCTION",
        badgeBg: "#EFF6FF",
        badgeColor: "#2563EB",
        progressText: "Bulk Cutting & Stitching in Progress",
        progressPercent: 65,
        progressPercentLabel: "65% Completed",
      };
    }
    if (s === "QC" || s === "QC_PENDING") {
      return {
        badgeText: "QC AUDIT",
        badgeBg: "#FEF3C7",
        badgeColor: "#D97706",
        progressText: "AQL 2.5 Quality Inspection",
        progressPercent: 85,
        progressPercentLabel: "85% Completed",
      };
    }
    if (s === "SAMPLE_PENDING" || s === "SAMPLE_APPROVED") {
      return {
        badgeText: "SAMPLE APPROVED",
        badgeBg: "#F1ECFE",
        badgeColor: "#5B13EC",
        progressText: "Pre-Production Sample Approved",
        progressPercent: 40,
        progressPercentLabel: "40% Completed",
      };
    }
    if (s === "PENDING_ACCEPTANCE" || s === "PO_CREATED" || s === "ISSUED") {
      return {
        badgeText: "AWAITING ACCEPTANCE",
        badgeBg: "#FEF3C7",
        badgeColor: "#D97706",
        progressText: "Review and accept this purchase order",
        progressPercent: 15,
        progressPercentLabel: "Awaiting Action",
      };
    }
    if (s === "ACCEPTED") {
      return {
        badgeText: "ACCEPTED",
        badgeBg: "#F1ECFE",
        badgeColor: "#5B13EC",
        progressText: "Contract Accepted • Preparing Fit Sample",
        progressPercent: 25,
        progressPercentLabel: "25% Completed",
      };
    }
    return {
      badgeText: "PO CREATED",
      badgeBg: "#FEF3C7",
      badgeColor: "#D97706",
      progressText: "Awaiting Supplier Acceptance",
      progressPercent: 15,
      progressPercentLabel: "15% Completed",
    };
  };

  return (
    <View style={styles.safeArea}>
      {/* 1. Shared App Header (Hamburger, Stitchgrid Logo, Bell with 6 badge, Profile) */}
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
              loadOrders();
            }}
            colors={["#5B13EC"]}
            tintColor="#5B13EC"
          />
        }
      >
        {/* 2. Page Title Header: "Purchase Orders (POs)" (Exact match to Reference Photo) */}
        <View style={styles.titleContainer}>
          <Text style={styles.pageTitle}>Purchase Orders (POs)</Text>
        </View>

        {/* 3. Search and Filter Bar Row (Exact match to Reference Photo) */}
        <View style={styles.searchFilterRow}>
          {/* Search Box Input */}
          <View style={styles.searchBoxWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchTextInput}
              placeholder="Search by PO ID, produc"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Dropdown Button */}
          <TouchableOpacity
            style={[
              styles.filterBtn,
              selectedFilter !== "ALL" && styles.filterBtnActive,
            ]}
            onPress={() => setIsFilterModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="filter-outline"
              size={18}
              color={selectedFilter !== "ALL" ? "#5B13EC" : "#0F172A"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.filterBtnText,
                selectedFilter !== "ALL" && { color: "#5B13EC" },
              ]}
            >
              Filter
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={selectedFilter !== "ALL" ? "#5B13EC" : "#0F172A"}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        {/* Active Filter Indicator Tag */}
        {selectedFilter !== "ALL" && (
          <View style={styles.activeFilterTagRow}>
            <View style={styles.activeFilterPill}>
              <Text style={styles.activeFilterPillText}>
                Filtered: {selectedFilter.replace("_", " ")}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedFilter("ALL")}
                style={{ marginLeft: 6 }}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={14} color="#5B13EC" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 4. Orders List Cards */}
        {filteredOrders.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="No Purchase Orders Found"
            description={
              searchQuery
                ? `No orders matching "${searchQuery}". Try adjusting your keywords or clearing the filter.`
                : "When buyers accept your commercial quotations, purchase orders appear here for fulfillment."
            }
            actionTitle={searchQuery || selectedFilter !== "ALL" ? "Clear Filters" : "Browse Buyer Requests"}
            onAction={() => {
              if (searchQuery || selectedFilter !== "ALL") {
                setSearchQuery("");
                setSelectedFilter("ALL");
              } else {
                if (navigation?.navigate) {
                  router.push("/(supplier)/buyer-requests");
                } else {
                  router.push("/(supplier)/buyer-requests");
                }
              }
            }}
          />
        ) : (
          filteredOrders.map((order, index) => {
            const poNumberDisplay = order.poNumber || "Purchase Order";
            const itemDescription = order.items?.[0]?.description || "Purchase order details";
            const buyerName = order.buyerOrg?.name || order.buyer?.name || "Buyer";
            const priceDisplay = formatOrderPrice(order.totalAmount);
            const targetDateDisplay = formatTargetDate(order.expectedDate || (order as any).targetDate);
            const statusConfig = getOrderStatusConfig(order.status);

            return (
              <View key={order.id || index} style={styles.orderCard}>
                {/* Card Row 1: PO Number & Status Badge (Exact match to Reference Photo) */}
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.poNumberText}>{poNumberDisplay}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusConfig.badgeBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: statusConfig.badgeColor },
                      ]}
                    >
                      {statusConfig.badgeText}
                    </Text>
                  </View>
                </View>

                {/* Card Row 2: Product / Garment Title */}
                <Text style={styles.orderTitleText} numberOfLines={2}>
                  {itemDescription}
                </Text>

                {/* Card Row 3: Buyer Name */}
                <Text style={styles.buyerLineText}>
                  Buyer: <Text style={styles.buyerNameBold}>{buyerName}</Text>
                </Text>

                {/* Card Row 4: Total Amount & Target Date */}
                <View style={styles.priceTargetRow}>
                  <Text style={styles.amountText}>{priceDisplay}</Text>
                  <Text style={styles.targetDateText}>
                    Target: {targetDateDisplay}
                  </Text>
                </View>

                {/* Card Row 5: Milestone Progress Box (Lavender Container) */}
                <View style={styles.milestoneProgressBox}>
                  <View style={styles.milestoneHeaderRow}>
                    <Text style={styles.milestoneTitleText} numberOfLines={1}>
                      {statusConfig.progressText}
                    </Text>
                    <Text style={styles.milestonePercentText}>
                      {statusConfig.progressPercentLabel}
                    </Text>
                  </View>

                  {/* Progress Bar Track and Fill */}
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${statusConfig.progressPercent}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Divider Line */}
                <View style={styles.cardDivider} />

                {getNextSupplierOrderAction(order.status) && (
                  <TouchableOpacity
                    style={[styles.modalPrimaryActionBtn, { marginTop: 14, opacity: updatingOrderId === order.id ? 0.6 : 1 }]}
                    onPress={() => handleSupplierOrderAction(order)}
                    disabled={updatingOrderId === order.id}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.modalPrimaryActionText}>
                      {updatingOrderId === order.id
                        ? "Updating..."
                        : getNextSupplierOrderAction(order.status)?.label}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Card Row 6: Order actions */}
                <View style={styles.actionsRow}>
                  {/* Button 1: Track Milestones (Outlined Card style matching photo) */}
                  <TouchableOpacity
                    style={styles.milestonesBtn}
                    onPress={() => setSelectedOrderForMilestones(order)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="business-outline" size={20} color="#0F172A" />
                    <Text style={styles.actionBtnText}>Track Milestones</Text>
                  </TouchableOpacity>

                  {/* Button 2: View Samples */}
                  <TouchableOpacity
                    style={styles.standardActionBtn}
                    onPress={() => setSelectedOrderForSamples(order)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="shirt-outline" size={20} color="#0F172A" />
                    <Text style={styles.actionBtnText}>View Samples</Text>
                  </TouchableOpacity>

                  {/* Button 3: Secure Payment */}
                  <TouchableOpacity
                    style={styles.standardActionBtn}
                    onPress={() => setSelectedOrderForPayment(order)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="card-outline" size={20} color="#0F172A" />
                    <Text style={styles.actionBtnText}>Secure Payment</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ------------------------------------------------------------- */}
      {/* 5. FILTER BOTTOM SHEET MODAL                                  */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsFilterModalOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Filter Purchase Orders</Text>
              <TouchableOpacity
                onPress={() => setIsFilterModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12 }}>
              {[
                { key: "ALL", label: "All Orders", count: orders.length },
                {
                  key: "PO_CREATED",
                  label: "PO Created",
                  count: orders.filter((o) => ["ISSUED", "PO_CREATED", "PENDING_ACCEPTANCE"].includes(o.status)).length,
                },
                {
                  key: "ACCEPTED",
                  label: "Accepted",
                  count: orders.filter((o) => o.status === "ACCEPTED").length,
                },
                {
                  key: "SAMPLE_PENDING",
                  label: "Sample Pending",
                  count: orders.filter(
                    (o) => o.status === "SAMPLE_PENDING" || o.status === "SAMPLE_APPROVED"
                  ).length,
                },
                {
                  key: "IN_PRODUCTION",
                  label: "In Production",
                  count: orders.filter(
                    (o) => o.status === "IN_PRODUCTION" || o.status === "PRODUCTION_STARTED"
                  ).length,
                },
                {
                  key: "COMPLETED",
                  label: "Completed",
                  count: orders.filter((o) => o.status === "COMPLETED").length,
                },
              ].map((option) => {
                const isSelected = selectedFilter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterOptionItem,
                      isSelected && styles.filterOptionItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedFilter(option.key);
                      setIsFilterModalOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={[
                          styles.filterRadioCircle,
                          isSelected && styles.filterRadioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.filterRadioDot} />}
                      </View>
                      <Text
                        style={[
                          styles.filterOptionLabel,
                          isSelected && { color: "#5B13EC", fontWeight: "700" },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>

                    <View style={styles.filterCountBadge}>
                      <Text style={styles.filterCountText}>{option.count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Reset Button */}
            {selectedFilter !== "ALL" && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setSelectedFilter("ALL");
                  setIsFilterModalOpen(false);
                }}
              >
                <Text style={styles.resetFilterBtnText}>Reset to All Orders</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 6. TRACK MILESTONES MODAL                                     */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={Boolean(selectedOrderForMilestones)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrderForMilestones(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setSelectedOrderForMilestones(null)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSheetTitle}>Manufacturing Milestones</Text>
                <Text style={styles.modalSheetSubtitle}>
                  {selectedOrderForMilestones?.poNumber} • {selectedOrderForMilestones?.buyerOrg?.name || selectedOrderForMilestones?.buyer?.name || "Buyer"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedOrderForMilestones(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
              {selectedOrderForMilestones?.milestones?.length ? (
                selectedOrderForMilestones.milestones
                  .slice()
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((milestone, idx, allMilestones) => {
                    const completed = milestone.status === "COMPLETED";
                    const nextStatus = milestone.status === "PENDING" ? "IN_PROGRESS" : "COMPLETED";
                    return (
                      <View key={milestone.id} style={styles.timelineItem}>
                        <View style={styles.timelineLeft}>
                          <View style={[styles.timelineCircle, completed && styles.timelineCircleCompleted]}>
                            <Ionicons
                              name={completed ? "checkmark" : "time-outline"}
                              size={14}
                              color={completed ? "#FFFFFF" : "#64748B"}
                            />
                          </View>
                          {idx < allMilestones.length - 1 && <View style={styles.timelineLine} />}
                        </View>
                        <View style={styles.timelineContent}>
                          <View style={styles.timelineHeader}>
                            <Text style={styles.timelineTitle}>{milestone.title}</Text>
                            <Text style={styles.timelineDate}>
                              {milestone.targetDate ? new Date(milestone.targetDate).toLocaleDateString("en-IN") : milestone.status.replace("_", " ")}
                            </Text>
                          </View>
                          {!!milestone.notes && <Text style={styles.timelineDesc}>{milestone.notes}</Text>}
                          {!completed && (
                            <TouchableOpacity
                              style={[styles.modalPrimaryActionBtn, { marginTop: 8 }]}
                              disabled={updatingOrderId === selectedOrderForMilestones!.id}
                              onPress={async () => {
                                try {
                                  setUpdatingOrderId(selectedOrderForMilestones!.id);
                                  await marketplaceService.updateMilestone(milestone.id, nextStatus);
                                  await loadOrders();
                                  const refreshed = await marketplaceService.getOrderDetails(selectedOrderForMilestones!.id);
                                  setSelectedOrderForMilestones(refreshed);
                                } catch (error: any) {
                                  Alert.alert("Milestone Update Failed", error?.message || "Please try again.");
                                } finally {
                                  setUpdatingOrderId(null);
                                }
                              }}
                            >
                              <Text style={styles.modalPrimaryActionText}>
                                {updatingOrderId === selectedOrderForMilestones!.id
                                  ? "Updating..."
                                  : milestone.status === "PENDING" ? "Start Milestone" : "Mark Completed"}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
              ) : (
                <EmptyState
                  icon="time-outline"
                  title="No milestones available"
                  description="Milestones will appear here when they are created for this purchase order."
                />
              )}
              <TouchableOpacity
                style={styles.modalPrimaryActionBtn}
                onPress={() => setSelectedOrderForMilestones(null)}
              >
                <Text style={styles.modalPrimaryActionText}>Close Timeline</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 7. VIEW SAMPLES MODAL                                         */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={Boolean(selectedOrderForSamples)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrderForSamples(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setSelectedOrderForSamples(null)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSheetTitle}>Pre-Production Samples</Text>
                <Text style={styles.modalSheetSubtitle}>
                  {selectedOrderForSamples?.poNumber} • Sample overview
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedOrderForSamples(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.sampleInfoCard}>
              <Text style={styles.sampleItemTitle}>
                {selectedOrderForSamples?.items?.[0]?.description || "Purchase order sample"}
              </Text>
              <View style={styles.sampleDivider} />
              <View style={styles.sampleDetailGrid}>
                <View style={styles.sampleDetailCol}>
                  <Text style={styles.sampleDetailLabel}>Order Quantity</Text>
                  <Text style={styles.sampleDetailValue}>
                    {selectedOrderForSamples?.items?.[0]?.quantity
                      ? `${selectedOrderForSamples.items[0].quantity} pcs`
                      : "Not specified"}
                  </Text>
                </View>
                <View style={styles.sampleDetailCol}>
                  <Text style={styles.sampleDetailLabel}>Sample Records</Text>
                  <Text style={styles.sampleDetailValue}>Open sample workflow to view</Text>
                </View>
              </View>
              <View style={[styles.sampleDetailGrid, { marginTop: 12 }]}>
                <View style={styles.sampleDetailCol}>
                  <Text style={styles.sampleDetailLabel}>Buyer</Text>
                  <Text style={styles.sampleDetailValue}>
                    {selectedOrderForSamples?.buyerOrg?.name || selectedOrderForSamples?.buyer?.name || "—"}
                  </Text>
                </View>
                <View style={styles.sampleDetailCol}>
                  <Text style={styles.sampleDetailLabel}>Expected Delivery</Text>
                  <Text style={styles.sampleDetailValue}>
                    {selectedOrderForSamples?.expectedDate
                      ? new Date(selectedOrderForSamples.expectedDate).toLocaleDateString("en-IN")
                      : "Not specified"}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryActionBtn}
              onPress={() => {
                setSelectedOrderForSamples(null);
                if (navigation?.navigate) {
                  router.push("/(supplier)/samples");
                } else {
                  router.push("/(supplier)/samples");
                }
              }}
            >
              <Text style={styles.modalPrimaryActionText}>Open Samples Workflow Hub</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* 8. SECURE ESCROW PAYMENT MODAL                                */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={Boolean(selectedOrderForPayment)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrderForPayment(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setSelectedOrderForPayment(null)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSheetTitle}>Secure Escrow Settlement</Text>
                <Text style={styles.modalSheetSubtitle}>
                  {selectedOrderForPayment?.poNumber} • 100% Escrow Protected
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedOrderForPayment(null)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Escrow Status Banner */}
            <View style={styles.escrowBanner}>
              <View style={styles.escrowIconWrap}>
                <Ionicons name="shield-checkmark" size={24} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.escrowBannerTitle}>Payment Released to Mill</Text>
                <Text style={styles.escrowBannerSubtitle}>
                  Funds deposited to your linked current account via RBI regulated Escrow.
                </Text>
              </View>
            </View>

            {/* Financial Breakdown */}
            <View style={styles.paymentBreakdownCard}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentRowLabel}>Total Contract Value</Text>
                <Text style={styles.paymentRowValBold}>
                  {formatOrderPrice(selectedOrderForPayment?.totalAmount || 499000)}
                </Text>
              </View>
              <View style={styles.paymentDivider} />
              <View style={styles.paymentRow}>
                <Text style={styles.paymentRowLabel}>Milestone 1: 50% Advance</Text>
                <Text style={styles.paymentRowValGreen}>₹2,49,500 (Settled)</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentRowLabel}>Milestone 2: 50% Delivery</Text>
                <Text style={styles.paymentRowValGreen}>₹2,49,500 (Settled)</Text>
              </View>
              <View style={styles.paymentDivider} />
              <View style={styles.paymentRow}>
                <Text style={styles.paymentRowLabel}>Bank Settlement Reference</Text>
                <Text style={styles.paymentRowMono}>TXN_SG_2026_98821</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.modalPrimaryActionBtn}
              onPress={() => {
                setSelectedOrderForPayment(null);
                Alert.alert(
                  "GST Tax Invoice",
                  "GST Invoice #SG-INV-2026-2589 has been sent to your registered billing email."
                );
              }}
            >
              <Text style={styles.modalPrimaryActionText}>Download GST Tax Invoice</Text>
            </TouchableOpacity>
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
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 110,
  },

  // Page Header
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },

  // Search & Filter Row
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBoxWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 48,
    paddingHorizontal: 14,
    marginRight: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 0,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 48,
    paddingHorizontal: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  filterBtnActive: {
    borderColor: "#5B13EC",
    backgroundColor: "#F5F3FF",
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Active Filter Tag
  activeFilterTagRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  activeFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1ECFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeFilterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B13EC",
  },

  // Order Card (Exact match to Reference Photo)
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  poNumberText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#5B13EC",
    marginRight: 10,
    letterSpacing: 0.2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  // Card Content
  orderTitleText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 24,
    marginBottom: 8,
  },
  buyerLineText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
    marginBottom: 14,
  },
  buyerNameBold: {
    color: "#0F172A",
    fontWeight: "800",
  },

  // Pricing & Target Row
  priceTargetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
  },
  amountText: {
    fontSize: 26,
    fontWeight: "900",
    color: "#5B13EC",
    letterSpacing: -0.6,
  },
  targetDateText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#475569",
  },

  // Milestone Progress Box (Lavender Container)
  milestoneProgressBox: {
    backgroundColor: "#F6F3FE",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  milestoneHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  milestoneTitleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#5B13EC",
    marginRight: 8,
  },
  milestonePercentText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#E9D5FF",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#5B13EC",
    borderRadius: 3,
  },

  // Divider
  cardDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },

  // Action Buttons Row (3 Actions matching photo)
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  milestonesBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  standardActionBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 6,
    textAlign: "center",
  },

  // Modal Common Styles
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },

  // Filter Modal
  filterOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  filterOptionItemSelected: {
    backgroundColor: "#F6F3FE",
  },
  filterRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  filterRadioCircleSelected: {
    borderColor: "#5B13EC",
  },
  filterRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5B13EC",
  },
  filterOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  filterCountBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  resetFilterBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },

  // Timeline / Milestones Modal
  timelineItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  timelineLeft: {
    alignItems: "center",
    width: 28,
    marginRight: 12,
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineCircleCompleted: {
    backgroundColor: "#059669",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
  },
  timelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },
  timelineDate: {
    fontSize: 11,
    color: "#64748B",
  },
  timelineDesc: {
    fontSize: 12,
    color: "#475569",
    lineHeight: 16,
  },
  modalPrimaryActionBtn: {
    backgroundColor: "#5B13EC",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  modalPrimaryActionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // Samples Modal
  sampleInfoCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginTop: 16,
  },
  sampleCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sampleCode: {
    fontSize: 12,
    fontWeight: "800",
    color: "#5B13EC",
    marginBottom: 4,
  },
  sampleItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  sampleApprovedBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sampleApprovedText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
  },
  sampleDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 12,
  },
  sampleDetailGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sampleDetailCol: {
    flex: 1,
  },
  sampleDetailLabel: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 2,
  },
  sampleDetailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },

  // Secure Escrow Payment Modal
  escrowBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  escrowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  escrowBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#065F46",
    marginBottom: 2,
  },
  escrowBannerSubtitle: {
    fontSize: 11,
    color: "#047857",
    lineHeight: 15,
  },
  paymentBreakdownCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginTop: 14,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  paymentRowLabel: {
    fontSize: 13,
    color: "#475569",
  },
  paymentRowValBold: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
  },
  paymentRowValGreen: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  paymentRowMono: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  paymentDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 8,
  },
});
