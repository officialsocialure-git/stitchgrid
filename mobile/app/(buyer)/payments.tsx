import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
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

  // Demo fallback transactions matching web if none recorded yet
  const displayPayments = payments.length > 0 ? payments : [
    {
      id: "pay-1",
      poNumber: "PO-2026-1042",
      milestone: "Advance Deposit (30%)",
      amount: 145000,
      status: "HELD_IN_ESCROW",
      date: "04 Nov 2026",
    },
    {
      id: "pay-2",
      poNumber: "PO-2026-1040",
      milestone: "Sample Approval (20%)",
      amount: 96000,
      status: "RELEASED",
      date: "01 Nov 2026",
    },
    {
      id: "pay-3",
      poNumber: "PO-2026-1038",
      milestone: "Final Dispatch & QC (50%)",
      amount: 240000,
      status: "RELEASED",
      date: "28 Oct 2026",
    },
  ];

  const totalHeld = displayPayments
    .filter((p) => p.status === "HELD_IN_ESCROW")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalReleased = displayPayments
    .filter((p) => p.status === "RELEASED")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

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
          <View style={styles.heroTop}>
            <View style={styles.shieldWrap}>
              <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>B2B Escrow Protection</Text>
              <Text style={styles.heroDesc}>
                Funds secured in milestone escrow until quality inspection (AQL 2.5) is signed off.
              </Text>
            </View>
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCol}>
              <Text style={styles.heroStatLabel}>HELD IN ESCROW</Text>
              <Text style={styles.heroStatValue}>₹{totalHeld.toLocaleString()}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStatCol}>
              <Text style={styles.heroStatLabel}>TOTAL RELEASED</Text>
              <Text style={styles.heroStatValue}>₹{totalReleased.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        data={displayPayments}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPayments();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.sectionHeader}>Contract Milestone Transactions</Text>
        }
        renderItem={({ item }) => {
          const isHeld = item.status === "HELD_IN_ESCROW";
          const isReleased = item.status === "RELEASED";

          return (
            <View style={styles.transCard}>
              <View style={styles.transTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.poNumText}>{item.poNumber || "PO-2026-ACTIVE"}</Text>
                  <Text style={styles.milestoneText}>{item.milestone || "Milestone Payment"}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    isHeld
                      ? { backgroundColor: Colors.warningLight, borderColor: Colors.warningBorder }
                      : isReleased
                      ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                      : { backgroundColor: Colors.surfaceSubtle, borderColor: Colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isHeld
                        ? { color: Colors.warningText }
                        : isReleased
                        ? { color: Colors.successText }
                        : { color: Colors.textSecondary },
                    ]}
                  >
                    {isHeld ? "HELD IN ESCROW" : item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.transBottom}>
                <Text style={styles.dateText}>
                  Date: <Text style={{ color: Colors.textHeading }}>{item.date || "Today"}</Text>
                </Text>
                <Text style={styles.amountText}>₹{(item.amount || 0).toLocaleString()}</Text>
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
  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  heroCard: {
    backgroundColor: Colors.primary,
    borderRadius: 22,
    padding: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  shieldWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  heroDesc: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 3,
    lineHeight: 16,
  },
  heroStatsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    borderRadius: 14,
    padding: 12,
  },
  heroStatCol: {
    flex: 1,
  },
  heroDivider: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 12,
  },
  heroStatLabel: {
    fontSize: 9,
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  heroStatValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
    marginBottom: 12,
  },
  transCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
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
  transTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  poNumText: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.primary,
  },
  milestoneText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
  },
  transBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  dateText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  amountText: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textHeading,
  },
});
