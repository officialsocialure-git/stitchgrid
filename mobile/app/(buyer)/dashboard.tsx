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

export default function BuyerDashboardScreen() {
  const router = useRouter();
  const { user, activeMembership } = useAuth();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [rfqRes, orderRes] = await Promise.all([
        marketplaceService.listMyRfqs(activeMembership?.organizationId),
        marketplaceService.listOrders(),
      ]);
      setRfqs(rfqRes || []);
      setOrders(orderRes || []);
    } catch (e) {
      console.warn("Failed to load dashboard data:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeMembership?.organizationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync({
    topics: ["rfq:created", "quotation:created", "order:created", "order:updated", "milestone:updated"],
    onSync: loadData,
    pollIntervalMs: 25000,
  });

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const activeOrdersCount = orders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length;
  const openRfqsCount = rfqs.filter((r) => r.status === "OPEN").length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header subtitle={activeMembership?.organization?.name || "Buyer Workspace"} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeBanner}>
          <Text style={styles.greeting}>Hello, {user?.fullName || "Buyer"} 👋</Text>
          <Text style={styles.greetingSub}>Manage your production lines and suppliers in real time</Text>
        </View>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(buyer)/rfqs")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.primaryLight }]}>
              <Ionicons name="document-text" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.metricValue}>{openRfqsCount}</Text>
            <Text style={styles.metricLabel}>Open RFQs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(buyer)/orders")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.successLight }]}>
              <Ionicons name="cube" size={20} color={Colors.success} />
            </View>
            <Text style={styles.metricValue}>{activeOrdersCount}</Text>
            <Text style={styles.metricLabel}>Active Orders</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(buyer)/samples")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.warningLight }]}>
              <Ionicons name="shirt" size={20} color={Colors.warning} />
            </View>
            <Text style={styles.metricValue}>Samples</Text>
            <Text style={styles.metricLabel}>Workflow</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => router.push("/(buyer)/payments")}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: Colors.infoLight }]}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.info} />
            </View>
            <Text style={styles.metricValue}>Escrow</Text>
            <Text style={styles.metricLabel}>Protected</Text>
          </TouchableOpacity>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <Button
            title="+ Post New RFQ"
            onPress={() => router.push("/(buyer)/rfqs")}
            style={{ flex: 1 }}
          />
          <Button
            title="Find Suppliers"
            variant="outline"
            onPress={() => router.push("/(buyer)/suppliers")}
            style={{ flex: 1 }}
          />
        </View>

        {/* Quick Links Section */}
        <Text style={styles.sectionTitle}>Production Shortcuts</Text>
        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() => router.push("/(buyer)/production")}
          >
            <Ionicons name="speedometer-outline" size={22} color={Colors.primary} />
            <Text style={styles.shortcutText}>Production Tracking</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() => router.push("/(buyer)/offers")}
          >
            <Ionicons name="pricetag-outline" size={22} color={Colors.primary} />
            <Text style={styles.shortcutText}>Review Offers & Quotes</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </View>

        {/* Active Orders List Preview */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Orders</Text>
          <TouchableOpacity onPress={() => router.push("/(buyer)/orders")}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {orders.length === 0 ? (
          <Card>
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Orders Yet</Text>
              <Text style={styles.emptyDesc}>Post an RFQ to receive factory bids and create your first purchase order.</Text>
            </View>
          </Card>
        ) : (
          orders.slice(0, 3).map((order) => (
            <Card key={order.id} onPress={() => router.push("/(buyer)/orders")}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderNumber}>{order.poNumber}</Text>
                <Badge label={order.status.replace(/_/g, " ")} size="sm" variant={order.status === "COMPLETED" ? "success" : "primary"} />
              </View>
              <Text style={styles.orderSupplier}>
                Supplier: {order.supplier?.name || "Verified Factory"}
              </Text>
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
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
  },
  greetingSub: {
    fontSize: 14,
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
    fontSize: 17,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 8,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  shortcutsGrid: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 24,
    overflow: "hidden",
  },
  shortcutItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  shortcutText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
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
  orderSupplier: {
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

