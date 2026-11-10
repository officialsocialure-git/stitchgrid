import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
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

export default function BuyerPaymentsScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const data = await marketplaceService.listPayments();
      setPayments(data || []);
    } catch (e) {
      console.warn("Failed to load payments:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useRealtimeSync({
    topics: ["order:updated"],
    onSync: loadPayments,
    pollIntervalMs: 20000,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Escrow & Payments"
        subtitle="Milestone-protected apparel contracts"
        showBack
      />

      {/* Escrow Protection Hero Card */}
      <View style={styles.heroWrap}>
        <View style={styles.heroCard}>
          <View style={styles.shieldWrap}>
            <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>B2B Vault Protection Active</Text>
            <Text style={styles.heroDesc}>
              Funds are secured in milestone escrow until quality inspection (AQL 2.5) is signed off.
            </Text>
          </View>
        </View>
        <View style={styles.disclaimerBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.disclaimerText}>
            Escrow ledger transactions are recorded on the secure STITCHGUARD database. Live banking gateway settlement requires aggregator credentials.
          </Text>
        </View>
      </View>

      <FlatList
        data={payments}
        keyExtractor={(item) => item.id || String(Math.random())}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadPayments(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.sectionTitle}>Escrow Transactions</Text>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="card-outline"
              title="No Payment Records"
              description="Milestone deposits and release transactions for your purchase orders will appear here."
              actionTitle="View Orders"
              onAction={() => router.push("/(buyer)/orders")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const isReleased = item.status === "RELEASED" || item.status === "COMPLETED";
          return (
            <Card style={styles.paymentCard}>
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.orderPo}>
                    PO: {item.order?.poNumber || item.poNumber || "SG-PO-CONTRACT"}
                  </Text>
                  <Text style={styles.payDate}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : "Recent"}
                  </Text>
                </View>
                <Badge
                  label={item.status || "ESCROW HELD"}
                  size="sm"
                  variant={isReleased ? "success" : "primary"}
                />
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Milestone Amount</Text>
                <Text style={styles.amountVal}>₹{(Number(item.amount || 0) / 100000).toFixed(2)} Lakhs</Text>
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
  heroWrap: {
    padding: 16,
    paddingBottom: 0,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
  },
  disclaimerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 15,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  shieldWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroDesc: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
    lineHeight: 16,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 12,
    marginTop: 10,
  },
  paymentCard: {
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  orderPo: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
  },
  payDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  amountLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  amountVal: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
  },
});

