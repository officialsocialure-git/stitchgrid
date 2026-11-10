import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { PurchaseOrder } from "../../src/types";

export default function SupplierProductionScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingMilestoneId, setUpdatingMilestoneId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await marketplaceService.listOrders();
      setOrders(data || []);
      if (data && data.length > 0 && !selectedOrderId) {
        setSelectedOrderId(data[0].id);
      }
    } catch (e) {
      console.warn("Failed to load factory floor orders:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedOrderId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync({
    topics: ["order:updated", "milestone:updated"],
    onSync: loadData,
    pollIntervalMs: 20000,
  });

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const handleUpdateMilestone = async (milestoneId: string, nextStatus: string) => {
    try {
      setUpdatingMilestoneId(milestoneId);
      await marketplaceService.updateMilestone(milestoneId, nextStatus);
      Alert.alert("Milestone Updated", `Stage marked as ${nextStatus.replace(/_/g, " ")}. Buyer dashboard notified in real-time.`);
      loadData();
    } catch (e) {
      Alert.alert("Error", "Could not update milestone.");
    } finally {
      setUpdatingMilestoneId(null);
    }
  };

  const milestonesList = selectedOrder?.milestones?.length
    ? selectedOrder.milestones
    : [
        { id: "m1", title: "1. Yarn & Fabric Dyeing", status: "COMPLETED", orderIndex: 1 },
        { id: "m2", title: "2. PP Sample Sign-off", status: "COMPLETED", orderIndex: 2 },
        { id: "m3", title: "3. Bulk Fabric Cutting", status: "IN_PROGRESS", orderIndex: 3 },
        { id: "m4", title: "4. Sewing Lines & Assembly", status: "PENDING", orderIndex: 4 },
        { id: "m5", title: "5. AQL 2.5 Quality Inspection", status: "PENDING", orderIndex: 5 },
        { id: "m6", title: "6. Packing & Final Dispatch", status: "PENDING", orderIndex: 6 },
      ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Floor Operations"
        subtitle="Advance apparel manufacturing stages"
        showBack
      />

      {orders.length === 0 && !loading ? (
        <EmptyState
          icon="speedometer-outline"
          title="No Active Floor Orders"
          description="Orders awarded to your factory will show live milestone update controls here."
          actionTitle="View Orders"
          onAction={() => router.push("/(supplier)/orders")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} />}
        >
          {/* Order Chips */}
          <Text style={styles.selectorLabel}>Select Manufacturing Lot:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {orders.map((o) => (
              <TouchableOpacity
                key={o.id}
                onPress={() => setSelectedOrderId(o.id)}
                style={[styles.chip, selectedOrder?.id === o.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedOrder?.id === o.id && styles.chipTextActive]}>
                  {o.poNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Selected Order Summary */}
          {selectedOrder && (
            <Card style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryTitle}>{selectedOrder.poNumber}</Text>
                  <Text style={styles.summaryBuyer}>Buyer: {selectedOrder.buyer?.name || "Client"}</Text>
                </View>
                <Badge label={selectedOrder.status.replace(/_/g, " ")} size="sm" variant="primary" />
              </View>
            </Card>
          )}

          {/* Milestone Cards */}
          <Text style={styles.milestonesHeading}>Update Manufacturing Stages</Text>
          {milestonesList.map((m: any) => {
            const isCompleted = m.status === "COMPLETED";
            const isInProgress = m.status === "IN_PROGRESS";

            return (
              <Card key={m.id} style={styles.milestoneCard}>
                <View style={styles.milestoneTop}>
                  <Text style={styles.milestoneTitle}>{m.title}</Text>
                  <Badge
                    label={m.status.replace(/_/g, " ")}
                    size="sm"
                    variant={isCompleted ? "success" : isInProgress ? "primary" : "neutral"}
                  />
                </View>

                <View style={styles.actionsRow}>
                  {!isCompleted && !isInProgress && (
                    <Button
                      title="Start Stage"
                      size="sm"
                      loading={updatingMilestoneId === m.id}
                      onPress={() => handleUpdateMilestone(m.id, "IN_PROGRESS")}
                      style={{ flex: 1 }}
                    />
                  )}
                  {isInProgress && (
                    <Button
                      title="Mark Completed ✓"
                      size="sm"
                      loading={updatingMilestoneId === m.id}
                      onPress={() => handleUpdateMilestone(m.id, "COMPLETED")}
                      style={{ flex: 1 }}
                    />
                  )}
                  {isCompleted && (
                    <Text style={styles.completedNotice}>Stage Completed & Signed Off</Text>
                  )}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  selectorLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  summaryCard: {
    marginBottom: 16,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  summaryBuyer: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  milestonesHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 12,
  },
  milestoneCard: {
    marginBottom: 12,
  },
  milestoneTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  milestoneTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  completedNotice: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.success,
  },
});

