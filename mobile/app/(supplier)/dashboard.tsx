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
import { Button } from "../../src/components/common/Button";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { PurchaseOrder, Rfq } from "../../src/types";

export default function SupplierDashboardScreen() {
  const router = useRouter();
  const { user, activeMembership } = useAuth();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [allRfqs, orderList] = await Promise.all([
        marketplaceService.listMyRfqs(),
        marketplaceService.listOrders(),
      ]);
      setRfqs(allRfqs || []);
      setOrders(orderList || []);
    } catch (e) {
      console.warn("Supplier dashboard error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync({
    topics: ["rfq:created", "order:created", "order:updated", "milestone:updated", "sample:updated"],
    onSync: loadData,
    pollIntervalMs: 25000,
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openRfqs = rfqs.filter((r) => r.status === "OPEN").length;
  const activeOrders = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header subtitle={activeMembership?.organization?.name || "Manufacturer Workspace"} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeBanner}>
          <Text style={styles.greeting}>Factory Hub: {activeMembership?.organization?.name || "Tirupur Mill"} 🏭</Text>
          <Text style={styles.greetingSub}>Review live apparel requirements & update bulk lines</Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(supplier)/buyer-requests")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="reader" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.metricValue}>{openRfqs}</Text>
            <Text style={styles.metricLabel}>New Buyer RFQs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(supplier)/orders")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.successLight }]}>
              <Ionicons name="cube" size={20} color={Colors.success} />
            </View>
            <Text style={styles.metricValue}>{activeOrders}</Text>
            <Text style={styles.metricLabel}>Active Contracts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(supplier)/my-offers")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="pricetag" size={20} color={Colors.warning} />
            </View>
            <Text style={styles.metricValue}>Bids</Text>
            <Text style={styles.metricLabel}>Submitted Offers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(supplier)/samples")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.infoLight }]}>
              <Ionicons name="shirt" size={20} color={Colors.info} />
            </View>
            <Text style={styles.metricValue}>Samples</Text>
            <Text style={styles.metricLabel}>PP Sampling</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Buttons */}
        <View style={styles.actionsRow}>
          <Button
            title="Browse Buyer RFQs"
            onPress={() => router.push("/(supplier)/buyer-requests")}
            style={{ flex: 1 }}
          />
          <Button
            title="Floor Tracking"
            variant="outline"
            onPress={() => router.push("/(supplier)/production")}
            style={{ flex: 1 }}
          />
        </View>

        {/* Active Production Orders List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Floor Orders</Text>
          <TouchableOpacity onPress={() => router.push("/(supplier)/orders")}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {orders.length === 0 ? (
          <Card>
            <View style={styles.emptyCard}>
              <Ionicons name="business-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Floor Contracts</Text>
              <Text style={styles.emptyDesc}>
                Submit quotation bids on buyer RFQs to win manufacturing contracts.
              </Text>
            </View>
          </Card>
        ) : (
          orders.slice(0, 3).map((order) => (
            <Card key={order.id} onPress={() => router.push("/(supplier)/orders")}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>{order.poNumber}</Text>
                <Badge
                  label={order.status.replace(/_/g, " ")}
                  size="sm"
                  variant={order.status === "COMPLETED" ? "success" : "primary"}
                />
              </View>
              <Text style={styles.orderBuyer}>Buyer: {order.buyer?.name || "Fashion Retail Brand"}</Text>
              <View style={styles.orderFooter}>
                <Text style={styles.orderAmount}>
                  ₹{(order.totalAmount / 100000).toFixed(2)}L
                </Text>
                <Text style={styles.orderDate}>
                  Expected: {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("en-IN") : "In Progress"}
                </Text>
              </View>
            </Card>
          ))
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
  welcomeBanner: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  greetingSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metricIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 8,
  },
  emptyDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  orderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  orderBuyer: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  orderFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});

