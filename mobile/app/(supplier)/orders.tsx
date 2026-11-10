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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/common/Card";
import { Badge, BadgeVariant } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
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

  const getStatusBadge = (status: string): { label: string; variant: BadgeVariant } => {
    switch (status) {
      case "COMPLETED":
      case "DELIVERED":
        return { label: status, variant: "success" };
      case "SAMPLE_PENDING":
      case "QC_PENDING":
        return { label: status.replace(/_/g, " "), variant: "warning" };
      case "IN_PRODUCTION":
      case "PRODUCTION_STARTED":
        return { label: "IN PRODUCTION", variant: "primary" };
      default:
        return { label: status.replace(/_/g, " "), variant: "info" };
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === "ALL") return true;
    return o.status === statusFilter;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Factory Orders"
        subtitle="Manage manufacturing runs & milestone progression"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
        {["ALL", "ACCEPTED", "SAMPLE_PENDING", "IN_PRODUCTION", "QC", "COMPLETED"].map((st) => (
          <TouchableOpacity
            key={st}
            onPress={() => setStatusFilter(st)}
            style={[styles.pill, statusFilter === st && styles.pillActive]}
          >
            <Text style={[styles.pillText, statusFilter === st && styles.pillTextActive]}>
              {st.replace(/_/g, " ")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cube-outline"
              title="No Factory Orders"
              description="Orders awarded to your factory will appear here for floor execution."
              actionTitle="Browse Requests"
              onAction={() => router.push("/(supplier)/buyer-requests")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const firstItem = item.items?.[0];
          const itemTitle = firstItem ? `${firstItem.quantity?.toLocaleString()} pcs ${firstItem.description}` : "Apparel Lot Contract";

          return (
            <Card style={styles.orderCard}>
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.poNumber}>{item.poNumber}</Text>
                  <Text style={styles.buyerName}>Buyer: {item.buyer?.name || "Apparel Brand"}</Text>
                </View>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>

              <Text style={styles.itemTitle}>{itemTitle}</Text>

              <View style={styles.metaRow}>
                <View>
                  <Text style={styles.metaLabel}>Contract Value</Text>
                  <Text style={styles.amountText}>₹{(item.totalAmount / 100000).toFixed(2)}L</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.metaLabel}>Target Ship Date</Text>
                  <Text style={styles.dateText}>
                    {item.expectedDate ? new Date(item.expectedDate).toLocaleDateString("en-IN") : "Scheduled"}
                  </Text>
                </View>
              </View>

              {/* Status Action Buttons */}
              <View style={styles.actionsRow}>
                {(item.status === "PO_CREATED" || item.status === "PENDING_ACCEPTANCE") && (
                  <Button
                    title="Accept Order"
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, "ACCEPTED", "Accepted")}
                    style={{ flex: 1 }}
                  />
                )}
                {item.status === "ACCEPTED" && (
                  <Button
                    title="Submit PP Sample"
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => router.push("/(supplier)/samples")}
                    style={{ flex: 1 }}
                  />
                )}
                {item.status === "SAMPLE_APPROVED" && (
                  <Button
                    title="Start Bulk Production"
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleUpdateStatus(item.id, "IN_PRODUCTION", "In Production")}
                    style={{ flex: 1 }}
                  />
                )}
                {item.status === "IN_PRODUCTION" && (
                  <Button
                    title="Floor Tracking"
                    size="sm"
                    variant="outline"
                    onPress={() => router.push("/(supplier)/production")}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  title="Messages"
                  size="sm"
                  variant="secondary"
                  icon="chatbubble-ellipses-outline"
                  onPress={() => router.push("/(supplier)/messages")}
                />
              </View>
            </Card>
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
  filterPills: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
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
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  orderCard: {
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  poNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  buyerName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  amountText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 2,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.text,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});

