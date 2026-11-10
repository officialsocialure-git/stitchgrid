import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
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
import { Quotation } from "../../src/types";

export default function SupplierMyOffersScreen() {
  const router = useRouter();
  const [offers, setOffers] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOffers = useCallback(async () => {
    try {
      const rfqs = await marketplaceService.listMyRfqs();
      const myQuotes: Quotation[] = [];
      rfqs?.forEach((r) => {
        if (r.quotations && r.quotations.length > 0) {
          myQuotes.push(...r.quotations);
        }
      });
      setOffers(myQuotes);
    } catch (e) {
      console.warn("Failed to load factory offers:", e);
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
        title="My Submitted Bids"
        subtitle="Track submitted factory quotations & statuses"
        showBack
      />

      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOffers(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="pricetag-outline"
              title="No Submitted Bids"
              description="Browse open buyer RFQs and submit quotation offers to see them here."
              actionTitle="Browse RFQs"
              onAction={() => router.push("/(supplier)/buyer-requests")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const firstItem = item.items?.[0];
          const isAccepted = item.status === "ACCEPTED";

          return (
            <Card style={styles.offerCard}>
              <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rfqTitle}>{item.rfq?.title || "Garment Production Bid"}</Text>
                  <Text style={styles.leadTime}>Lead Time: {item.leadTimeDays} days • MOQ: {item.moq || 500} pcs</Text>
                </View>
                <Badge
                  label={item.status}
                  size="sm"
                  variant={isAccepted ? "success" : "primary"}
                />
              </View>

              <View style={styles.metaRow}>
                <View>
                  <Text style={styles.metaLabel}>Quoted Total</Text>
                  <Text style={styles.totalAmount}>₹{(item.totalAmount / 100000).toFixed(2)}L</Text>
                </View>
                {firstItem?.unitPrice && (
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.metaLabel}>Unit Price</Text>
                    <Text style={styles.unitPrice}>₹{firstItem.unitPrice}/pc</Text>
                  </View>
                )}
              </View>

              {isAccepted && (
                <View style={styles.acceptedRow}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.acceptedText}>Awarded! Buyer issued Purchase Order.</Text>
                </View>
              )}
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  offerCard: {
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  rfqTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  leadTime: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    padding: 12,
    borderRadius: 12,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  unitPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 2,
  },
  acceptedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  acceptedText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.success,
  },
});

