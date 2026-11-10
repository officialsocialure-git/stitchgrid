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
import { useRouter, useLocalSearchParams } from "expo-router";
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

export default function BuyerOffersScreen() {
  const router = useRouter();
  const { rfqId } = useLocalSearchParams<{ rfqId?: string }>();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    try {
      if (rfqId) {
        const rfq = await marketplaceService.getRfqDetails(rfqId);
        setQuotes(rfq?.quotations || []);
      } else {
        const rfqs = await marketplaceService.listMyRfqs();
        const allQuotes: Quotation[] = [];
        rfqs?.forEach((r) => {
          if (r.quotations && r.quotations.length > 0) {
            allQuotes.push(...r.quotations);
          }
        });
        setQuotes(allQuotes);
      }
    } catch (e) {
      console.warn("Failed to load quotations:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rfqId]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  useRealtimeSync({
    topics: ["quotation:created", "quotation:updated", "order:created"],
    onSync: loadOffers,
    pollIntervalMs: 20000,
  });

  const handleAcceptOffer = async (quoteId: string, supplierName?: string) => {
    Alert.alert(
      "Issue Purchase Order",
      `Accept quotation from ${supplierName || "this supplier"} and issue formal Purchase Order?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Issue PO",
          onPress: async () => {
            try {
              setAcceptingId(quoteId);
              const po = await marketplaceService.createPurchaseOrder(quoteId);
              Alert.alert(
                "Purchase Order Issued!",
                `Order #${po.poNumber || "SG-PO"} created. Supplier notified to accept and prepare PP Sample.`,
                [
                  {
                    text: "View Orders",
                    onPress: () => router.push("/(buyer)/orders"),
                  },
                ]
              );
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.message || "Failed to create Purchase Order.");
            } finally {
              setAcceptingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Supplier Offers"
        subtitle="Compare factory pricing & issue purchase orders"
        showBack
      />

      <FlatList
        data={quotes}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOffers(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="pricetag-outline"
              title="No Offers Found"
              description="When manufacturers respond to your RFQs, their quotations will appear here."
              actionTitle="View Requests"
              onAction={() => router.push("/(buyer)/rfqs")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const supplierName = item.supplier?.name || "Verified Factory";
          const firstItem = item.items?.[0];
          const unitPrice = firstItem?.unitPrice || 0;

          return (
            <Card style={styles.quoteCard}>
              <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supplierTitle}>{supplierName}</Text>
                  <Text style={styles.rfqRef}>
                    {item.rfq?.title || "Garment Production Lot"}
                  </Text>
                </View>
                <Badge
                  label={item.status}
                  size="sm"
                  variant={item.status === "ACCEPTED" ? "success" : "primary"}
                />
              </View>

              <View style={styles.priceBreakdown}>
                <View style={styles.priceCol}>
                  <Text style={styles.priceLabel}>Total Quote</Text>
                  <Text style={styles.priceTotal}>₹{(item.totalAmount / 100000).toFixed(2)}L</Text>
                </View>
                {unitPrice > 0 && (
                  <View style={styles.priceCol}>
                    <Text style={styles.priceLabel}>Unit Price</Text>
                    <Text style={styles.priceValue}>₹{unitPrice}/pc</Text>
                  </View>
                )}
                <View style={styles.priceCol}>
                  <Text style={styles.priceLabel}>Lead Time</Text>
                  <Text style={styles.priceValue}>{item.leadTimeDays} days</Text>
                </View>
              </View>

              <View style={styles.termsBox}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
                <Text style={styles.termsText}>
                  {item.terms || "Standard B2B Escrow Milestones • 100% Quality Guaranteed"}
                </Text>
              </View>

              <View style={styles.actionRow}>
                {item.status !== "ACCEPTED" ? (
                  <Button
                    title="Accept Offer & Issue PO"
                    size="md"
                    loading={acceptingId === item.id}
                    onPress={() => handleAcceptOffer(item.id, supplierName)}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Button
                    title="PO Already Generated"
                    variant="secondary"
                    size="md"
                    disabled
                    style={{ flex: 1 }}
                  />
                )}
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  quoteCard: {
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  supplierTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  rfqRef: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  priceBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  priceCol: {
    alignItems: "center",
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  priceTotal: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.primary,
    marginTop: 2,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    marginTop: 2,
  },
  termsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  termsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
});

