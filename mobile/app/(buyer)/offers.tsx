import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
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

  const handleAcceptQuote = (quote: Quotation) => {
    Alert.alert(
      "Accept Quotation & Issue PO",
      `Accept offer from ${quote.supplierOrg?.name || "Supplier"} for ₹${quote.totalAmount.toLocaleString()}? This will create a binding Purchase Order with milestone escrow.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept & Create PO",
          style: "default",
          onPress: async () => {
            try {
              setAcceptingId(quote.id);
              const po = await marketplaceService.createPurchaseOrder(quote.id);
              Alert.alert("PO Created", `Purchase Order ${po.poNumber || ""} issued successfully!`, [
                {
                  text: "View Orders",
                  onPress: () => router.push("/(buyer)/orders"),
                },
              ]);
              loadOffers();
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.message || "Could not accept quotation.");
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
        title="Quotation Comparison"
        subtitle="Review supplier bids & accept contracts"
        showBack={Boolean(rfqId)}
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
              title="No Quotations Yet"
              description="When verified garment manufacturers submit bids for your RFQs, they will appear here for side-by-side comparison."
              actionTitle="View My Requests"
              onAction={() => router.push("/(buyer)/rfqs")}
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const isPending = item.status === "PENDING";
          const isAccepted = item.status === "ACCEPTED";
          const unitPrice = item.items?.[0]?.unitPrice || item.totalAmount / 1000;
          const quoteCode = `QTN-2026-${(item.id || "200").slice(-4).replace(/\D/g, "").padStart(4, "0") || (200 + index).toString()}`;

          return (
            <View style={styles.quoteCard}>
              <View style={styles.topRow}>
                <Text style={styles.quoteCodeText}>{quoteCode}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isAccepted
                      ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                      : { backgroundColor: Colors.primaryLight, borderColor: Colors.borderPrimary },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isAccepted ? { color: Colors.successText } : { color: Colors.primary },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.supplierName}>
                {item.supplierOrg?.name || "Verified Factory Mill"}
              </Text>
              <Text style={styles.locationText}>
                {item.supplierOrg?.city || "Tirupur Textile Hub"}
              </Text>

              <View style={styles.pricingRow}>
                <View>
                  <Text style={styles.unitPriceLabel}>Quoted Unit Price</Text>
                  <Text style={styles.unitPriceVal}>₹{Math.round(unitPrice)}/pc</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.totalPriceLabel}>Total Contract Value</Text>
                  <Text style={styles.totalPriceVal}>₹{item.totalAmount.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Production Lead</Text>
                  <Text style={styles.metaVal}>{item.leadTimeDays} Days</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Minimum MOQ</Text>
                  <Text style={styles.metaVal}>{item.moq ? `${item.moq} pcs` : "N/A"}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Sample Lead</Text>
                  <Text style={styles.metaVal}>
                    {item.sampleLeadDays ? `${item.sampleLeadDays} Days` : "7 Days"}
                  </Text>
                </View>
              </View>

              {item.terms ? (
                <View style={styles.termsBox}>
                  <Ionicons name="information-circle-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.termsText} numberOfLines={2}>
                    {item.terms}
                  </Text>
                </View>
              ) : null}

              {isPending && (
                <Button
                  title={acceptingId === item.id ? "Accepting..." : "Accept Offer & Issue PO"}
                  onPress={() => handleAcceptQuote(item)}
                  loading={acceptingId === item.id}
                  size="md"
                  style={{ marginTop: 12 }}
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
  quoteCard: {
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
  supplierName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
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
  unitPriceLabel: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: "600",
  },
  unitPriceVal: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.primary,
    marginTop: 2,
  },
  totalPriceLabel: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: "600",
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
    marginBottom: 10,
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
  termsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 10,
    padding: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
});
