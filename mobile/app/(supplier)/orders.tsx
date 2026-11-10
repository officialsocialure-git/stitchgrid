import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { PurchaseOrder } from "../../src/types";

export default function SupplierOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await marketplaceService.listOrders();
      setOrders(data || []);
    } catch (e) {
      console.warn("Failed to load supplier orders:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useRealtimeSync({
    topics: ["order:created", "order:updated", "milestone:updated", "sample:updated"],
    onSync: loadOrders,
    pollIntervalMs: 20000,
  });

  const handleUpdateStatus = async (orderId: string, nextStatus: string, actionName: string) => {
    try {
      setUpdatingId(orderId);
      await marketplaceService.updateOrderStatus(orderId, nextStatus, {
        note: `Factory updated status to ${nextStatus}`,
      });
      Alert.alert("Status Updated", `Order advanced to ${actionName} successfully.`);
      loadOrders();
    } catch (e) {
      Alert.alert("Error", "Could not update order status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "ISSUED":
        return 15;
      case "ACCEPTED":
      case "SAMPLE_PENDING":
        return 30;
      case "SAMPLE_APPROVED":
      case "PRODUCTION_STARTED":
      case "IN_PRODUCTION":
        return 65;
      case "QC":
        return 80;
      case "DISPATCHED":
        return 90;
      case "COMPLETED":
        return 100;
      default:
        return 25;
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesFilter =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && o.status !== "COMPLETED" && o.status !== "CANCELLED") ||
      o.status === statusFilter;
    const matchesQuery =
      !searchQuery.trim() ||
      (o.poNumber && o.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (o.buyerOrg?.name && o.buyerOrg.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesQuery;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Production Orders"
        subtitle="Manage factory lines & fulfillment"
      />

      {/* Filter Row */}
      <View style={styles.filterSection}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <Input
            placeholder="Search orders by PO#, buyer..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ flex: 1, marginBottom: 0 }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          {["ALL", "ACTIVE", "IN_PRODUCTION", "COMPLETED"].map((st) => (
            <TouchableOpacity
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[styles.pill, statusFilter === st && styles.pillActive]}
            >
              <Text style={[styles.pillText, statusFilter === st && styles.pillTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

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
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cube-outline"
              title="No Factory Orders"
              description="When buyers accept your bids, purchase orders will appear here for manufacturing fulfillment."
              actionTitle="Browse Buyer Requests"
              onAction={() => router.push("/(supplier)/buyer-requests")}
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const poDisplay = item.poNumber || `PO-2026-${(item.id || "100").slice(-4).replace(/\D/g, "").padStart(4, "0") || (1000 + index).toString()}`;
          const progress = getProgressPercentage(item.status);
          const isIssued = item.status === "ISSUED";
          const isSampleApproved = item.status === "SAMPLE_APPROVED";
          const isInProduction = item.status === "IN_PRODUCTION" || item.status === "PRODUCTION_STARTED";
          const isQc = item.status === "QC";
          const isCompleted = item.status === "COMPLETED";

          return (
            <View style={styles.orderCard}>
              <View style={styles.topRow}>
                <Text style={styles.poNumberText}>{poDisplay}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isCompleted
                      ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                      : { backgroundColor: Colors.primaryLight, borderColor: Colors.borderPrimary },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isCompleted ? { color: Colors.successText } : { color: Colors.primary },
                    ]}
                  >
                    {item.status.replace("_", " ")}
                  </Text>
                </View>
              </View>

              <Text style={styles.buyerText}>
                Buyer: <Text style={{ color: Colors.textHeading, fontWeight: "800" }}>{item.buyerOrg?.name || "Enterprise Apparel Brand"}</Text>
              </Text>

              <View style={styles.pricingRow}>
                <View>
                  <Text style={styles.label}>Contract Revenue</Text>
                  <Text style={styles.amountText}>₹{item.totalAmount.toLocaleString()}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.label}>Fulfillment</Text>
                  <Text style={styles.progressPercentText}>{progress}%</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>

              <View style={styles.stageLabelsRow}>
                <Text style={styles.stageText}>Deposit</Text>
                <Text style={styles.stageText}>Sample</Text>
                <Text style={styles.stageText}>Bulk Cut</Text>
                <Text style={styles.stageText}>QC Pass</Text>
                <Text style={styles.stageText}>Dispatched</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {isIssued && (
                  <Button
                    title={updatingId === item.id ? "Accepting..." : "Accept Purchase Order"}
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, "ACCEPTED", "Accepted Contract")}
                    style={{ flex: 1 }}
                  />
                )}

                {isSampleApproved && (
                  <Button
                    title={updatingId === item.id ? "Updating..." : "Start Bulk Cutting"}
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, "IN_PRODUCTION", "Bulk Production")}
                    style={{ flex: 1 }}
                  />
                )}

                {isInProduction && (
                  <Button
                    title={updatingId === item.id ? "Updating..." : "Submit for QC"}
                    size="sm"
                    variant="primary"
                    loading={updatingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, "QC", "AQL Quality Inspection")}
                    style={{ flex: 1 }}
                  />
                )}

                {isQc && (
                  <Button
                    title={updatingId === item.id ? "Updating..." : "Mark Dispatched"}
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, "DISPATCHED", "Carrier Dispatch")}
                    style={{ flex: 1 }}
                  />
                )}

                <Button
                  title="Tracking"
                  variant="outline"
                  size="sm"
                  onPress={() => router.push("/(supplier)/production")}
                  style={{ minWidth: 90 }}
                />
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
    padding: 16,
    paddingBottom: 40,
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
  buyerText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
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
