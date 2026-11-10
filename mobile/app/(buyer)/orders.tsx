import React, { useState, useEffect, useCallback } from "react";
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

export default function BuyerOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await marketplaceService.listOrders();
      setOrders(data || []);
    } catch (e) {
      console.warn("Failed to load orders:", e);
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
    pollIntervalMs: 20000,
  });

  const handleApproveSample = async (orderId: string) => {
    try {
      setUpdatingId(orderId);
      await marketplaceService.updateOrderStatus(orderId, "SAMPLE_APPROVED", {
        note: "Buyer approved PP Sample from Mobile App",
      });
      Alert.alert("Approved", "PP Sample approved! Order transitioned to Bulk Production.");
      loadOrders();
    } catch (e) {
      Alert.alert("Error", "Could not approve sample.");
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
        return 10;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>My Orders</Text>
            <Button
              title="Issue New Purchase Order"
              onPress={() => router.push("/(buyer)/rfqs")}
              size="lg"
              style={styles.newOrderButton}
            />
          </View>
        }
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
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cube-outline"
              title="No Orders Found"
              description="Accepted quotations will appear here as formal purchase orders with escrow tracking."
              actionTitle="View Quotations"
              onAction={() => router.push("/(buyer)/offers")}
            />
          ) : undefined
        }
        renderItem={({ item }) => {
          const progress = getProgressPercentage(item.status);
          const isSamplePending = item.status === "SAMPLE_PENDING";
          const isCompleted = item.status === "COMPLETED";
          const itemTitle = item.items?.length
            ? item.items.map((part) => `${Number(part.quantity || 0).toLocaleString()} pcs ${part.description || "Apparel"}`).join(", ")
            : "Apparel Production Order";
          const buyerName = item.buyerOrg?.name || item.buyer?.name || "Buyer";
          const deliveryDate = item.expectedDate
            ? new Date(item.expectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
            : "Not specified";
          const currentMilestone = item.milestones?.find((milestone) => milestone.status === "IN_PROGRESS")?.title
            || (isCompleted ? "Order Fulfilled & Payment Released"
            : item.status === "DISPATCHED" ? "In Transit"
            : item.status === "QC" || item.status === "QC_PENDING" ? "Quality Inspection (AQL 2.5)"
            : item.status === "PRODUCTION_STARTED" || item.status === "IN_PRODUCTION" ? "Bulk Production Lines Active"
            : item.status === "SAMPLE_APPROVED" ? "Pre-Production Sample Approved"
            : item.status === "SAMPLE_PENDING" ? "PP Sample in Review"
            : item.status === "ACCEPTED" ? "Order Accepted by Factory"
            : "Purchase Order Generated");

          return (
            <View style={styles.orderCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.poNumberText}>{item.poNumber || "Purchase Order"}</Text>
                <View style={[
                  styles.statusPill,
                  isCompleted
                    ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                    : { backgroundColor: Colors.primaryLight, borderColor: Colors.borderPrimary },
                ]}>
                  <Text style={[
                    styles.statusPillText,
                    isCompleted ? { color: Colors.successText } : { color: Colors.primary },
                  ]}>{item.status.replace(/_/g, " ")}</Text>
                </View>
              </View>

              <Text style={styles.orderTitle}>{itemTitle}</Text>
              <Text style={styles.buyerText}>Buyer: <Text style={styles.buyerName}>{buyerName}</Text></Text>

              <View style={styles.amountDateRow}>
                <Text style={styles.orderAmount}>₹{(Number(item.totalAmount) / 100000).toFixed(2)}L</Text>
                <Text style={styles.deliveryDate}>Target: {deliveryDate}</Text>
              </View>

              <View style={styles.milestonePanel}>
                <View style={styles.milestoneTopRow}>
                  <Text style={styles.currentMilestone} numberOfLines={1}>{currentMilestone}</Text>
                  <Text style={styles.completedText}>{progress}% Completed</Text>
                </View>
                <View style={styles.webProgressTrack}>
                  <View style={[styles.webProgressFill, { width: `${progress}%` }]} />
                </View>
              </View>

              <View style={styles.actionsDivider} />
              {isSamplePending && (
                <Button
                  title={updatingId === item.id ? "Approving..." : "Approve PP Sample"}
                  size="md"
                  loading={updatingId === item.id}
                  onPress={() => handleApproveSample(item.id)}
                  style={styles.approveButton}
                />
              )}

              <View style={styles.quickActions}>
                <TouchableOpacity style={styles.quickAction} onPress={() => router.push(`/(buyer)/production?orderId=${item.id}`)}>
                  <Ionicons name="business-outline" size={24} color={Colors.textHeading} />
                  <Text style={styles.quickActionText}>Track Milestones</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction} onPress={() => router.push("/(buyer)/samples")}>
                  <Ionicons name="shirt-outline" size={24} color={Colors.textHeading} />
                  <Text style={styles.quickActionText}>View Samples</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickAction} onPress={() => router.push("/(buyer)/payments")}>
                  <Ionicons name="wallet-outline" size={24} color={Colors.textHeading} />
                  <Text style={styles.quickActionText}>Secure Payment</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  filterPills: {
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.slate600,
  },
  pillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 112,
  },
  pageHeader: {
    paddingBottom: 18,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 16,
  },
  pageTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: "900",
    color: Colors.textHeading,
  },
  newOrderButton: {
    alignSelf: "flex-start",
    minWidth: 0,
  },
  orderCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  poNumberText: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.primary,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  supplierText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  orderTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800",
    color: Colors.textHeading,
    marginBottom: 8,
  },
  buyerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  buyerName: {
    color: Colors.textHeading,
    fontWeight: "800",
  },
  amountDateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  orderAmount: {
    fontSize: 27,
    fontWeight: "900",
    color: Colors.primary,
  },
  deliveryDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  milestonePanel: {
    backgroundColor: "#F7F2FF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E9DFFF",
    padding: 14,
  },
  milestoneTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 9,
  },
  currentMilestone: {
    flex: 1,
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  completedText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  webProgressTrack: {
    height: 9,
    borderRadius: 8,
    backgroundColor: "#DCE8FF",
    overflow: "hidden",
  },
  webProgressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  actionsDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginTop: 18,
    marginBottom: 14,
  },
  approveButton: {
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  quickActions: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 8,
  },
  quickAction: {
    flex: 1,
    minHeight: 84,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 10,
    gap: 7,
  },
  quickActionText: {
    color: Colors.textHeading,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  amountText: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textHeading,
    marginTop: 2,
  },
  progressPercentText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  stageLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  stageText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
