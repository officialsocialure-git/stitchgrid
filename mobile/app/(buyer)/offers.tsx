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
  StatusBar,
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
  const [currentRfq, setCurrentRfq] = useState<any>(null);
  const [allRfqs, setAllRfqs] = useState<any[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    try {
      const rfqs = await marketplaceService.listMyRfqs();
      setAllRfqs(rfqs || []);
      const activeRfqId = rfqId || rfqs?.find((r) => r.quotations?.length)?.id || rfqs?.[0]?.id;
      if (activeRfqId) {
        const rfq = await marketplaceService.getRfqDetails(activeRfqId);
        setCurrentRfq(rfq || null);
        const nextQuotes = rfq?.quotations || [];
        setQuotes(nextQuotes);
        setSelectedQuoteId((current) =>
          nextQuotes.some((quote: Quotation) => quote.id === current)
            ? current
            : nextQuotes[0]?.id || ""
        );
      } else {
        setCurrentRfq(null);
        setQuotes([]);
        setSelectedQuoteId("");
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
    <SafeAreaView style={[styles.safeArea, Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight || 0 } : null]}>
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
        ListHeaderComponent={
          <View style={styles.rfqContextCard}>
            <View style={styles.rfqBadgesRow}>
              <Text style={styles.rfqCode}>RFQ #{currentRfq?.id?.slice(0, 14) || "—"}</Text>
              <Text style={styles.quotesCount}>{quotes.length} QUOTES SUBMITTED</Text>
            </View>
            {allRfqs.length > 1 && (
              <TouchableOpacity
                style={styles.rfqPickerWrap}
                activeOpacity={0.8}
                onPress={() => Alert.alert(
                  "Select Buyer Request",
                  "Choose an RFQ to compare its supplier quotations.",
                  allRfqs.map((rfq) => ({
                    text: rfq.title + " (" + (rfq.quotations?.length || 0) + " quotes)",
                    onPress: () => router.replace(("/(buyer)/offers?rfqId=" + rfq.id) as any),
                  })).concat([{ text: "Cancel", style: "cancel" } as any])
                )}
              >
                <Text style={styles.rfqPickerText} numberOfLines={1}>
                  {currentRfq?.title || "Select Request"} ({quotes.length} {quotes.length === 1 ? "quote" : "quotes"})
                </Text>
                <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
              </TouchableOpacity>
            )}
            <Text style={styles.rfqTitle}>{currentRfq?.title || "Supplier Offers"}</Text>
            <Text style={styles.rfqDescription}>
              Target Quantity: {Number(currentRfq?.targetQuantity || 0).toLocaleString()} pcs
              {currentRfq?.targetDate ? " • Delivery: " + new Date(currentRfq.targetDate).toLocaleDateString() : ""}
              {currentRfq?.fabricSpec ? " • " + currentRfq.fabricSpec : ""}
            </Text>
            <View style={styles.rfqActions}>
              <Button title="Back to My Requests" variant="outline" size="sm" onPress={() => router.push("/(buyer)/rfqs")} />
              {quotes.some((q) => q.status === "ACCEPTED") ? (
                <Button title="View Purchase Order →" size="sm" onPress={() => router.push("/(buyer)/orders")} />
              ) : (
                <Button
                  title="Accept This Quote"
                  size="sm"
                  disabled={!selectedQuoteId || quotes.length === 0}
                  onPress={() => {
                    const selected = quotes.find((q) => q.id === selectedQuoteId);
                    if (selected) handleAcceptQuote(selected);
                  }}
                />
              )}
            </View>
          </View>
        }
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
          const isAccepted = item.status === "ACCEPTED";
          const isSelected = selectedQuoteId === item.id;
          const isRfqAwarded = quotes.some((quote) => quote.status === "ACCEPTED");
          const unitPrice = item.items?.[0]?.unitPrice || item.totalAmount / (currentRfq?.targetQuantity || 1);
          const supplierName = item.supplierOrg?.name || item.supplier?.name || "Verified Supplier";
          const supplierCity = item.supplierOrg?.city || item.supplier?.city || "India";

          return (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => setSelectedQuoteId(item.id)}
              style={[styles.quoteCard, isSelected && styles.quoteCardSelected]}
            >
              <View style={styles.webCardTopRow}>
                <View style={styles.recommendationBadge}>
                  <Ionicons name="ribbon" size={17} color={Colors.primary} />
                  <Text style={styles.recommendationText}>
                    {index === 0 ? "BEST VALUE RATING" : index === 1 ? "FASTEST LEAD TIME" : "SUPPLIER QUOTE"}
                  </Text>
                </View>
                <Ionicons
                  name={isSelected ? "radio-button-on" : "radio-button-off"}
                  size={23}
                  color={isSelected ? Colors.primary : Colors.textMuted}
                />
              </View>

              <Text style={styles.supplierName}>{supplierName}</Text>
              <Text style={styles.locationText}>{supplierCity}, India</Text>

              <View style={styles.webPriceBand}>
                <View style={styles.webPriceLeft}>
                  <Text style={styles.webUnitPrice}>₹{Math.round(unitPrice)}</Text>
                  <Text style={styles.webPerPiece}> / piece</Text>
                </View>
                <Text style={styles.webTotalPrice}>₹{(item.totalAmount / 100000).toFixed(2)}L Total</Text>
              </View>

              <View style={styles.webSpecRow}>
                <Text style={styles.webSpecLabel}>Bulk Production</Text>
                <Text style={styles.webSpecValue}>{item.leadTimeDays} Days</Text>
              </View>
              <View style={styles.webSpecRow}>
                <Text style={styles.webSpecLabel}>Pre-Prod Sample</Text>
                <Text style={styles.webSpecValue}>{item.sampleLeadDays || 7} Days</Text>
              </View>
              <View style={styles.webSpecRow}>
                <Text style={styles.webSpecLabel}>Fabric Spec</Text>
                <Text style={styles.webSpecValue} numberOfLines={1}>{currentRfq?.fabricSpec || currentRfq?.title || "Garment Specification"}</Text>
              </View>
              <View style={styles.webSpecRow}>
                <Text style={styles.webSpecLabel}>Payment Terms</Text>
                <Text style={styles.webSpecValue} numberOfLines={1}>{item.terms || "Secure Payment Protected"}</Text>
              </View>

              <View style={styles.webCardFooter}>
                {isAccepted ? (
                  <View style={styles.acceptedNotice}>
                    <Ionicons name="shield-checkmark" size={18} color={Colors.successText} />
                    <Text style={styles.acceptedNoticeText}>Quote Accepted • PO Issued</Text>
                  </View>
                ) : isRfqAwarded ? (
                  <View style={styles.notAwardedNotice}>
                    <Text style={styles.notAwardedText}>Not Awarded</Text>
                  </View>
                ) : (
                  <Button
                    title={acceptingId === item.id ? "Accepting..." : "Accept This Quote"}
                    onPress={() => {
                      setSelectedQuoteId(item.id);
                      handleAcceptQuote(item);
                    }}
                    loading={acceptingId === item.id}
                    size="md"
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 112,
  },
  rfqContextCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 18,
  },
  rfqBadgesRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  rfqCode: { color: Colors.primary, backgroundColor: Colors.primaryLight, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, fontSize: 12, fontWeight: "800" },
  quotesCount: { color: Colors.successText, backgroundColor: Colors.successLight, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 18, fontSize: 11, fontWeight: "800" },
  rfqPickerWrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 10, marginBottom: 12 },
  rfqPickerText: { flex: 1, color: Colors.textHeading, fontSize: 13, fontWeight: "600" },
  rfqTitle: { color: Colors.textHeading, fontSize: 27, lineHeight: 34, fontWeight: "800", marginBottom: 8 },
  rfqDescription: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22 },
  rfqActions: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 18 },
  webCardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  recommendationBadge: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 8 },
  recommendationText: { color: Colors.primary, fontSize: 10, fontWeight: "800" },
  quoteCardSelected: { borderColor: Colors.primary, borderWidth: 2, shadowOpacity: 0.1, elevation: 3 },
  webPriceBand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#EAF2FF", borderRadius: 14, padding: 14, marginTop: 18, marginBottom: 16 },
  webPriceLeft: { flexDirection: "row", alignItems: "baseline" },
  webUnitPrice: { color: Colors.primary, fontSize: 25, fontWeight: "900" },
  webPerPiece: { color: Colors.textSecondary, fontSize: 13 },
  webTotalPrice: { color: Colors.textHeading, fontSize: 13, fontWeight: "800" },
  webSpecRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  webSpecLabel: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  webSpecValue: { color: Colors.textHeading, fontSize: 13, fontWeight: "600", flex: 1, textAlign: "right" },
  webCardFooter: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  acceptedNotice: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.successLight, borderColor: Colors.successBorder, borderWidth: 1, borderRadius: 13, padding: 13 },
  acceptedNoticeText: { color: Colors.successText, fontSize: 13, fontWeight: "800" },
  notAwardedNotice: { backgroundColor: Colors.surfaceSubtle, borderRadius: 12, padding: 13, alignItems: "center" },
  notAwardedText: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },
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
