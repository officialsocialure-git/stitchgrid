import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { Modal } from "../../src/components/common/Modal";
import { EmptyState } from "../../src/components/common/EmptyState";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Rfq } from "../../src/types";

export default function SupplierBuyerRequestsScreen() {
  const { activeMembership } = useAuth();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Quotation Submission Modal State
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [unitPrice, setUnitPrice] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("30");
  const [moq, setMoq] = useState("500");
  const [sampleCost, setSampleCost] = useState("0");
  const [terms, setTerms] = useState("30% Advance Escrow, 70% Upon Dispatch Inspection");
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const data = await marketplaceService.listMyRfqs();
      setRfqs(data || []);
    } catch (e) {
      console.warn("Failed to load requests:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useRealtimeSync({
    topics: ["rfq:created", "quotation:created"],
    onSync: loadRequests,
    pollIntervalMs: 20000,
  });

  const openQuoteModal = (rfq: Rfq) => {
    setSelectedRfq(rfq);
    setUnitPrice(rfq.targetPrice ? String(rfq.targetPrice) : "180");
    setMoq(String(Math.min(500, rfq.targetQuantity)));
  };

  const handleSubmitQuote = async () => {
    if (!selectedRfq || !unitPrice.trim() || !leadTimeDays.trim()) {
      Alert.alert("Missing Fields", "Please specify unit price and lead time.");
      return;
    }

    const priceNum = parseFloat(unitPrice);
    const totalAmount = priceNum * selectedRfq.targetQuantity;

    try {
      setSubmitting(true);
      await marketplaceService.submitQuote({
        rfqId: selectedRfq.id,
        supplierOrgId: activeMembership?.organizationId || "",
        totalAmount,
        currency: "INR",
        leadTimeDays: parseInt(leadTimeDays, 10) || 30,
        moq: parseInt(moq, 10) || 500,
        sampleCost: parseFloat(sampleCost) || 0,
        terms: terms.trim(),
        items: [
          {
            description: selectedRfq.title,
            quantity: selectedRfq.targetQuantity,
            unitPrice: priceNum,
            rfqItemId: selectedRfq.items?.[0]?.id,
          },
        ],
      });
      setSelectedRfq(null);
      Alert.alert("Quotation Sent!", "Your commercial offer has been submitted to the buyer.");
      loadRequests();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to submit quote.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRfqs = rfqs.filter((r) => {
    const matchesCategory =
      categoryFilter === "ALL" ||
      (r.garmentType && r.garmentType.toLowerCase().includes(categoryFilter.toLowerCase()));
    const matchesQuery =
      !searchQuery.trim() ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.garmentType && r.garmentType.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Buyer Requests"
        subtitle="Live apparel requirements & contract tenders"
      />

      {/* Filter Section */}
      <View style={styles.filterSection}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <Input
            placeholder="Search requirements by garment, title..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ flex: 1, marginBottom: 0 }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          {["ALL", "Knits", "Woven", "Denim", "Activewear"].map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategoryFilter(cat)}
              style={[styles.pill, categoryFilter === cat && styles.pillActive]}
            >
              <Text style={[styles.pillText, categoryFilter === cat && styles.pillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredRfqs}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRequests();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="search-outline"
              title="No Buyer Requests Matching"
              description="New garment requirements from brand buyers will appear here in real time."
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const rfqIdDisplay = `RFQ-2026-${(item.id || "1040").slice(-4).replace(/\D/g, "").padStart(4, "0") || (1040 + index).toString()}`;
          return (
            <View style={styles.requestCard}>
              <View style={styles.topRow}>
                <Text style={styles.rfqIdText}>{rfqIdDisplay}</Text>
                <View style={styles.openPill}>
                  <Text style={styles.openPillText}>OPEN FOR QUOTES</Text>
                </View>
              </View>

              <Text style={styles.requestTitle}>{item.title}</Text>
              <Text style={styles.requestBuyer}>
                Buyer: <Text style={{ color: Colors.textHeading, fontWeight: "700" }}>{item.buyer?.name || "Verified Brand Buyer"}</Text>
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Required Qty</Text>
                  <Text style={styles.metaVal}>{item.targetQuantity.toLocaleString()} pcs</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Target Price</Text>
                  <Text style={styles.metaVal}>
                    {item.targetPrice ? `₹${item.targetPrice}/pc` : "Open Bid"}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Target Delivery</Text>
                  <Text style={styles.metaVal}>{item.targetDate || "30 Days"}</Text>
                </View>
              </View>

              <Button
                title="Send Quotation"
                onPress={() => openQuoteModal(item)}
                size="sm"
                style={{ marginTop: 4 }}
              />
            </View>
          );
        }}
      />

      {/* Submit Quote Modal */}
      <Modal
        visible={Boolean(selectedRfq)}
        onClose={() => setSelectedRfq(null)}
        title="Submit Commercial Quotation"
      >
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 14 }}>
            Quoting on: <Text style={{ fontWeight: "700", color: Colors.textHeading }}>{selectedRfq?.title}</Text>
          </Text>

          <Input
            label="Unit Price (₹ Per Piece) *"
            placeholder="e.g. 185"
            value={unitPrice}
            onChangeText={setUnitPrice}
            keyboardType="numeric"
          />

          <Input
            label="Production Lead Time (Days) *"
            placeholder="e.g. 30"
            value={leadTimeDays}
            onChangeText={setLeadTimeDays}
            keyboardType="numeric"
          />

          <Input
            label="Minimum Order Qty (MOQ)"
            placeholder="e.g. 500"
            value={moq}
            onChangeText={setMoq}
            keyboardType="numeric"
          />

          <Input
            label="Payment & Delivery Terms"
            placeholder="Payment milestones, shipping terms..."
            value={terms}
            onChangeText={setTerms}
          />

          <Button
            title="Submit Quotation"
            onPress={handleSubmitQuote}
            loading={submitting}
            size="lg"
            style={{ marginTop: 14 }}
          />
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  filterPills: {
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.slate600,
  },
  pillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  requestCard: {
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
  rfqIdText: {
    fontSize: 12,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.primary,
  },
  openPill: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  openPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary,
  },
  requestTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    lineHeight: 20,
  },
  requestBuyer: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
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
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
});
