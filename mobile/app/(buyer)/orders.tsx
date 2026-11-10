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
import { Input } from "../../src/components/common/Input";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { PurchaseOrder } from "../../src/types";

export default function BuyerOrdersScreen() {
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
      case "CANCELLED":
        return { label: status, variant: "danger" };
      default:
        return { label: status.replace(/_/g, " "), variant: "info" };
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case "PO_CREATED":
      case "PENDING_ACCEPTANCE":
        return 10;
      case "ACCEPTED":
        return 20;
      case "SAMPLE_PENDING":
        return 35;
      case "SAMPLE_APPROVED":
        return 50;
      case "PRODUCTION_STARTED":
      case "IN_PRODUCTION":
        return 70;
      case "QC_PENDING":
      case "QC":
        return 85;
      case "READY_TO_DISPATCH":
      case "DISPATCHED":
        return 95;
      case "DELIVERED":
      case "COMPLETED":
        return 100;
      default:
        return 30;
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesFilter = statusFilter === "ALL" || o.status === statusFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      o.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.supplier?.name && o.supplier.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="My Orders"
        subtitle="Track active apparel contracts & milestones"
      />

      <View style={styles.searchSection}>
        <Input
          placeholder="Search by PO number or factory..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
          containerStyle={{ marginBottom: 10 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
          {["ALL", "IN_PRODUCTION", "SAMPLE_PENDING", "QC", "COMPLETED"].map((st) => (
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
      </View>

      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="cube-outline"
              title="No Purchase Orders"
              description="Accepted quotations will appear here as active purchase orders."
              actionTitle="View Requests"
              onAction={() => router.push("/(buyer)/rfqs")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const progress = getProgressPercentage(item.status);
          const firstItem = item.items?.[0];
          const itemTitle = firstItem ? `${firstItem.quantity?.toLocaleString()} pcs ${firstItem.description}` : "Garment Lot Contract";

          return (
            <Card style={styles.orderCard}>
              <View style={styles.orderTopRow}>
                <View>
                  <Text style={styles.poNumber}>{item.poNumber}</Text>
                  <Text style={styles.supplierText}>
                    Factory: {item.supplier?.name || "Verified Tirupur Unit"}
                  </Text>
                </View>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>

              <Text style={styles.itemTitle}>{itemTitle}</Text>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.milestoneLabel}>
                    {item.status === "SAMPLE_PENDING"
                      ? "PP Sample In Review"
                      : item.status === "COMPLETED"
                      ? "Fulfilled & Escrow Released"
                      : "Production In Progress"}
                  </Text>
                  <Text style={styles.progressPercent}>{progress}%</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
              </View>

              {/* Price & Expected Date */}
              <View style={styles.metaRow}>
                <View>
                  <Text style={styles.metaLabel}>Contract Value</Text>
                  <Text style={styles.amountText}>₹{(item.totalAmount / 100000).toFixed(2)} Lakhs</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.metaLabel}>Delivery Date</Text>
                  <Text style={styles.dateText}>
                    {item.expectedDate ? new Date(item.expectedDate).toLocaleDateString("en-IN") : "Scheduled"}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                {item.status === "SAMPLE_PENDING" && (
                  <Button
                    title="Approve PP Sample"
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleApproveSample(item.id)}
                    style={{ flex: 1 }}
                  />
                )}
                <Button
                  title="Track Milestones"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push("/(buyer)/production")}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Pay"
                  size="sm"
                  variant="secondary"
                  onPress={() => router.push("/(buyer)/payments")}
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
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPills: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
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
  orderTopRow: {
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
  supplierText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: 12,
  },
  progressContainer: {
    marginBottom: 14,
    backgroundColor: Colors.surfaceSubtle,
    padding: 10,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  milestoneLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.text,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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

