import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { PurchaseOrder } from "../../src/types";

export default function ProductionTrackingScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await marketplaceService.listOrders();
      setOrders(data || []);
      if (data && data.length > 0 && !selectedOrderId) {
        setSelectedOrderId(data[0].id);
      }
    } catch (e) {
      console.warn("Failed to load production orders:", e);
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

  const milestonesList = selectedOrder?.milestones?.length
    ? selectedOrder.milestones
    : [
        { id: "m1", title: "Yarn Procurement & Dyeing", status: "COMPLETED", orderIndex: 1 },
        { id: "m2", title: "PP Sample Submission & Approval", status: "COMPLETED", orderIndex: 2 },
        { id: "m3", title: "Bulk Fabric Cutting", status: "IN_PROGRESS", orderIndex: 3 },
        { id: "m4", title: "Sewing & Assembly Lines", status: "PENDING", orderIndex: 4 },
        { id: "m5", title: "AQL 2.5 Quality Inspection", status: "PENDING", orderIndex: 5 },
        { id: "m6", title: "Packing & Carrier Dispatch", status: "PENDING", orderIndex: 6 },
      ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Production Tracking"
        subtitle="Real-time factory floor milestone updates"
        showBack
      />

      {orders.length === 0 && !loading ? (
        <EmptyState
          icon="speedometer-outline"
          title="No Active Production"
          description="Purchase orders with factories will show live milestone progress here."
          actionTitle="View Orders"
          onAction={() => router.push("/(buyer)/orders")}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} colors={[Colors.primary]} />}
        >
          {/* Order Selector Chips */}
          <Text style={styles.selectorLabel}>Select Order Contract:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {orders.map((o) => (
              <TouchableOpacity
                key={o.id}
                onPress={() => setSelectedOrderId(o.id)}
                style={[styles.chip, (selectedOrder?.id === o.id) && styles.chipActive]}
              >
                <Text style={[styles.chipText, (selectedOrder?.id === o.id) && styles.chipTextActive]}>
                  {o.poNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Selected Order Summary Card */}
          {selectedOrder && (
            <Card style={styles.summaryCard}>
              <View style={styles.summaryTop}>
                <View>
                  <Text style={styles.summaryTitle}>{selectedOrder.poNumber}</Text>
                  <Text style={styles.summarySub}>
                    Factory: {selectedOrder.supplier?.name || "Tirupur Knits Partner"}
                  </Text>
                </View>
                <Badge
                  label={selectedOrder.status.replace(/_/g, " ")}
                  size="sm"
                  variant={selectedOrder.status === "COMPLETED" ? "success" : "primary"}
                />
              </View>
              <Text style={styles.contractVal}>
                Total Value: ₹{(selectedOrder.totalAmount / 100000).toFixed(2)} Lakhs
              </Text>
            </Card>
          )}

          {/* Milestone Timeline */}
          <Text style={styles.timelineTitle}>Manufacturing Stages</Text>
          <View style={styles.timelineContainer}>
            {milestonesList.map((m: any, index: number) => {
              const isCompleted = m.status === "COMPLETED";
              const isInProgress = m.status === "IN_PROGRESS";
              const isLast = index === milestonesList.length - 1;

              return (
                <View key={m.id || index} style={styles.timelineRow}>
                  <View style={styles.indicatorCol}>
                    <View
                      style={[
                        styles.circle,
                        isCompleted && styles.circleCompleted,
                        isInProgress && styles.circleInProgress,
                      ]}
                    >
                      {isCompleted ? (
                        <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                      ) : (
                        <Text style={[styles.stepNum, isInProgress && { color: "#FFFFFF" }]}>
                          {index + 1}
                        </Text>
                      )}
                    </View>
                    {!isLast && (
                      <View
                        style={[
                          styles.line,
                          isCompleted && styles.lineCompleted,
                        ]}
                      />
                    )}
                  </View>

                  <View style={styles.contentCol}>
                    <Card style={styles.milestoneCard}>
                      <View style={styles.milestoneHeader}>
                        <Text style={styles.milestoneTitle}>{m.title}</Text>
                        <Badge
                          label={m.status.replace(/_/g, " ")}
                          size="sm"
                          variant={isCompleted ? "success" : isInProgress ? "primary" : "neutral"}
                        />
                      </View>
                      <Text style={styles.milestoneDesc}>
                        {isCompleted
                          ? "Stage verified and approved by Quality Controller."
                          : isInProgress
                          ? "Current active stage on factory floor."
                          : "Scheduled in manufacturing sequence."}
                      </Text>
                    </Card>
                  </View>
                </View>
              );
            })}
          </View>
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
    marginBottom: 20,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
  },
  summarySub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contractVal: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 14,
  },
  timelineContainer: {
    paddingLeft: 4,
  },
  timelineRow: {
    flexDirection: "row",
  },
  indicatorCol: {
    alignItems: "center",
    width: 32,
  },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  circleCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  circleInProgress: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepNum: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  lineCompleted: {
    backgroundColor: Colors.success,
  },
  contentCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  milestoneCard: {
    marginBottom: 0,
    padding: 14,
  },
  milestoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  milestoneTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    flex: 1,
  },
  milestoneDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});

