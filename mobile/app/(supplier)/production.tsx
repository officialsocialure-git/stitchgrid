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
      Alert.alert(
        "Milestone Updated",
        `Stage marked as ${nextStatus.replace(/_/g, " ")}. Buyer dashboard notified in real-time.`
      );
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
        { id: "m1", title: "Fabric Procurement & Dyeing", status: "COMPLETED", orderIndex: 1 },
        { id: "m2", title: "PP Sample Submission", status: "COMPLETED", orderIndex: 2 },
        { id: "m3", title: "Bulk Cutting (Spreading & Cut)", status: "IN_PROGRESS", orderIndex: 3 },
        { id: "m4", title: "Sewing & Assembly Operations", status: "PENDING", orderIndex: 4 },
        { id: "m5", title: "Ironing & In-Line QC", status: "PENDING", orderIndex: 5 },
        { id: "m6", title: "Final Dispatch & Logistics", status: "PENDING", orderIndex: 6 },
      ];

  const completedCount = milestonesList.filter((m: any) => m.status === "COMPLETED").length;
  const progressPercent = Math.round((completedCount / milestonesList.length) * 100);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Factory Floor Timeline"
        subtitle="Update milestone progression for buyer visibility"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            colors={[Colors.primary]}
          />
        }
      >
        {orders.length === 0 && !loading ? (
          <EmptyState
            icon="hammer-outline"
            title="No Orders in Production"
            description="Accepted purchase orders will show here for line scheduling and milestone sign-off."
            actionTitle="View Factory Orders"
            onAction={() => router.push("/(supplier)/orders")}
          />
        ) : (
          <>
            {/* Order Selector Horizontal Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.orderPillsScroll}
            >
              {orders.map((order, idx) => {
                const isSelected = (selectedOrderId || orders[0]?.id) === order.id;
                const poNumber = order.poNumber || `PO-2026-${(1000 + idx).toString()}`;
                return (
                  <TouchableOpacity
                    key={order.id}
                    onPress={() => setSelectedOrderId(order.id)}
                    style={[styles.orderPill, isSelected && styles.orderPillActive]}
                  >
                    <Text
                      style={[styles.orderPillText, isSelected && styles.orderPillTextActive]}
                    >
                      {poNumber}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Overview Card */}
            <View style={styles.overviewCard}>
              <View style={styles.overviewTop}>
                <View>
                  <Text style={styles.overviewPo}>{selectedOrder?.poNumber || "PO-2026-ACTIVE"}</Text>
                  <Text style={styles.overviewBuyer}>
                    Buyer: {selectedOrder?.buyerOrg?.name || "Apparel Retail Partner"}
                  </Text>
                </View>
                <View style={styles.percentBadge}>
                  <Text style={styles.percentText}>{progressPercent}%</Text>
                </View>
              </View>

              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
              </View>

              <View style={styles.statsRow}>
                <View>
                  <Text style={styles.statLabel}>Completed Stages</Text>
                  <Text style={styles.statVal}>
                    {completedCount} of {milestonesList.length}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.statLabel}>Order Status</Text>
                  <Text style={[styles.statVal, { color: Colors.primary }]}>
                    {selectedOrder?.status?.replace("_", " ") || "IN PRODUCTION"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Milestones List */}
            <Text style={styles.timelineHeading}>Production Line Stages</Text>

            <View style={styles.timelineList}>
              {milestonesList.map((m: any, idx: number) => {
                const isCompleted = m.status === "COMPLETED";
                const isInProgress = m.status === "IN_PROGRESS";
                const isLast = idx === milestonesList.length - 1;

                return (
                  <View key={m.id || idx} style={styles.timelineItem}>
                    {/* Left Icon & Connector */}
                    <View style={styles.timelineLeftCol}>
                      <View
                        style={[
                          styles.timelineCircle,
                          isCompleted
                            ? styles.circleCompleted
                            : isInProgress
                            ? styles.circleInProgress
                            : styles.circlePending,
                        ]}
                      >
                        {isCompleted ? (
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        ) : isInProgress ? (
                          <Ionicons name="ellipsis-horizontal" size={14} color="#FFFFFF" />
                        ) : (
                          <Text style={styles.circleNumber}>{idx + 1}</Text>
                        )}
                      </View>
                      {!isLast && (
                        <View
                          style={[
                            styles.connectorLine,
                            isCompleted && styles.connectorLineCompleted,
                          ]}
                        />
                      )}
                    </View>

                    {/* Right Card */}
                    <View style={styles.milestoneCard}>
                      <View style={styles.milestoneTop}>
                        <Text style={styles.milestoneTitle}>{m.title}</Text>
                        <View
                          style={[
                            styles.statusPill,
                            isCompleted
                              ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                              : isInProgress
                              ? { backgroundColor: Colors.primaryLight, borderColor: Colors.borderPrimary }
                              : { backgroundColor: Colors.surfaceSubtle, borderColor: Colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              isCompleted
                                ? { color: Colors.successText }
                                : isInProgress
                                ? { color: Colors.primary }
                                : { color: Colors.textSecondary },
                            ]}
                          >
                            {m.status.replace("_", " ")}
                          </Text>
                        </View>
                      </View>

                      {/* Action buttons for supplier to advance milestone */}
                      {!isCompleted && (
                        <View style={{ marginTop: 8 }}>
                          <Button
                            title={
                              updatingMilestoneId === m.id
                                ? "Updating..."
                                : isInProgress
                                ? "Mark Stage Completed"
                                : "Start This Stage"
                            }
                            size="sm"
                            variant={isInProgress ? "primary" : "secondary"}
                            loading={updatingMilestoneId === m.id}
                            onPress={() =>
                              handleUpdateMilestone(
                                m.id,
                                isInProgress ? "COMPLETED" : "IN_PROGRESS"
                              )
                            }
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
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
  orderPillsScroll: {
    gap: 8,
    marginBottom: 14,
  },
  orderPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  orderPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.slate600,
  },
  orderPillTextActive: {
    color: "#FFFFFF",
  },
  overviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  overviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  overviewPo: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textHeading,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  overviewBuyer: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  percentText: {
    fontSize: 14,
    fontWeight: "900",
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.borderLight,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  statVal: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  timelineHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    marginBottom: 12,
  },
  timelineList: {
    paddingLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 12,
  },
  timelineLeftCol: {
    alignItems: "center",
    width: 32,
    marginRight: 10,
  },
  timelineCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  circleCompleted: {
    backgroundColor: Colors.success,
  },
  circleInProgress: {
    backgroundColor: Colors.primary,
  },
  circlePending: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  circleNumber: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 4,
  },
  connectorLineCompleted: {
    backgroundColor: Colors.successBorder,
  },
  milestoneCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  milestoneTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 6,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});
