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
import { Quotation } from "../../src/types";

export default function SupplierMyOffersScreen() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOffers = useCallback(async () => {
    try {
      const rfqs = await marketplaceService.listMyRfqs();
      const allQuotes: Quotation[] = [];
      rfqs?.forEach((r) => {
        if (r.quotations && r.quotations.length > 0) {
          allQuotes.push(...r.quotations);
        }
      });
      setQuotes(allQuotes);
    } catch (e) {
      console.warn("Failed to load supplier offers:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  useRealtimeSync({
    topics: ["quotation:created", "quotation:updated", "order:created"],
    onSync: loadOffers,
    pollIntervalMs: 20000,
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="My Offers"
        subtitle="Quotations submitted to buyers"
      />

      <FlatList
        data={quotes}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadOffers();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="pricetag-outline"
              title="No Offers Submitted Yet"
              description="Review open Buyer Requests and submit competitive quotes to win apparel manufacturing contracts."
              actionTitle="Browse Buyer Requests"
              onAction={() => router.push("/(supplier)/buyer-requests")}
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const isAccepted = item.status === "ACCEPTED";
          const isPending = item.status === "PENDING";
          const quoteCode = `QTN-2026-${(item.id || "100").slice(-4).replace(/\D/g, "").padStart(4, "0") || (100 + index).toString()}`;
          const unitPrice = item.items?.[0]?.unitPrice || Math.round(item.totalAmount / 1000);

          return (
            <View style={styles.offerCard}>
              <View style={styles.topRow}>
                <Text style={styles.quoteCodeText}>{quoteCode}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isAccepted
                      ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                      : isPending
                      ? { backgroundColor: Colors.warningLight, borderColor: Colors.warningBorder }
                      : { backgroundColor: Colors.dangerLight, borderColor: Colors.dangerBorder },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isAccepted
                        ? { color: Colors.successText }
                        : isPending
                        ? { color: Colors.warningText }
                        : { color: Colors.dangerText },
                    ]}
                  >
                    {isAccepted ? "Awarded" : isPending ? "In Review" : item.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.offerTitle}>
                {item.rfq?.title || "Garment Manufacturing Order"}
              </Text>
              <Text style={styles.buyerNameText}>
                Buyer: <Text style={{ color: Colors.textHeading, fontWeight: "700" }}>{item.rfq?.buyer?.name || "Enterprise Brand"}</Text>
              </Text>

              <View style={styles.pricingRow}>
                <View>
                  <Text style={styles.priceLabel}>Quoted Price</Text>
                  <Text style={styles.priceVal}>₹{unitPrice}/pc</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.priceLabel}>Total Value</Text>
                  <Text style={styles.totalPriceVal}>₹{item.totalAmount.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Lead Time</Text>
                  <Text style={styles.metaVal}>{item.leadTimeDays} Days</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>MOQ Quoted</Text>
                  <Text style={styles.metaVal}>{item.moq || 500} pcs</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Terms</Text>
                  <Text style={styles.metaVal}>Milestone Escrow</Text>
                </View>
              </View>

              {isAccepted && (
                <Button
                  title="View Active Purchase Order"
                  size="sm"
                  onPress={() => router.push("/(supplier)/orders")}
                  style={{ marginTop: 8 }}
                />
              )}
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  offerCard: {
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
  quoteCodeText: {
    fontSize: 12,
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
  offerTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    lineHeight: 20,
  },
  buyerNameText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  pricingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: "600",
  },
  priceVal: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.primary,
    marginTop: 2,
  },
  totalPriceVal: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.textHeading,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
});
