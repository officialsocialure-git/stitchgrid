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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
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
      Alert.alert("Quotation Submitted!", "Your offer has been submitted directly to the buyer for review.");
      loadRequests();
    } catch (err: any) {
      Alert.alert("Submission Failed", err.response?.data?.message || "Could not submit quotation.");
    } finally {
      setSubmitting(false);
    }
  };

  const openRfqs = rfqs.filter((r) => {
    const isAvailable = r.status === "OPEN";
    const matchesSearch =
      !searchQuery.trim() ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.buyer?.name && r.buyer.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return isAvailable && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Buyer Requests"
        subtitle="Live apparel manufacturing bids"
      />

      <View style={styles.searchSection}>
        <Input
          placeholder="Search requests by garment or brand..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
        />
      </View>

      <FlatList
        data={openRfqs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="reader-outline"
              title="No Open Requests"
              description="New buyer requirements will appear here as brands publish RFQs."
            />
          ) : null
        }
        renderItem={({ item }) => {
          return (
            <Card style={styles.reqCard}>
              <View style={styles.topRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqTitle}>{item.title}</Text>
                  <Text style={styles.buyerName}>
                    Buyer: {item.buyer?.name || "Verified Brand"} • 📍 {item.buyer?.city || "India"}
                  </Text>
                </View>
                <Badge label="OPEN BID" variant="primary" size="sm" />
              </View>

              <Text style={styles.specText}>
                {item.garmentType || "Apparel"} • {item.fabricSpec || "Standard Knit Construction"}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaBox}>
                  <Text style={styles.metaLabel}>Order Quantity</Text>
                  <Text style={styles.metaVal}>{item.targetQuantity.toLocaleString()} pcs</Text>
                </View>
                {item.targetPrice && (
                  <View style={styles.metaBox}>
                    <Text style={styles.metaLabel}>Buyer Target Price</Text>
                    <Text style={styles.metaVal}>₹{item.targetPrice}/pc</Text>
                  </View>
                )}
              </View>

              <Button
                title="Submit Quotation Bid"
                size="md"
                onPress={() => openQuoteModal(item)}
                style={{ marginTop: 8 }}
              />
            </Card>
          );
        }}
      />

      {/* Quote Submission Modal */}
      <Modal visible={!!selectedRfq} onClose={() => setSelectedRfq(null)} title="Submit Factory Quotation">
        {selectedRfq && (
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalRfqTitle}>{selectedRfq.title}</Text>
            <Text style={styles.modalRfqSub}>
              Lot: {selectedRfq.targetQuantity.toLocaleString()} pcs
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Input
                label="Unit Price (₹/pc) *"
                placeholder="e.g. 175"
                value={unitPrice}
                onChangeText={setUnitPrice}
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Lead Time (Days) *"
                placeholder="e.g. 30"
                value={leadTimeDays}
                onChangeText={setLeadTimeDays}
                keyboardType="number-pad"
                containerStyle={{ flex: 1 }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Input
                label="Minimum Order Qty"
                placeholder="e.g. 500"
                value={moq}
                onChangeText={setMoq}
                keyboardType="number-pad"
                containerStyle={{ flex: 1 }}
              />
              <Input
                label="Sample Cost (₹)"
                placeholder="0 for free"
                value={sampleCost}
                onChangeText={setSampleCost}
                keyboardType="numeric"
                containerStyle={{ flex: 1 }}
              />
            </View>

            <Input
              label="Payment Terms & Milestone Notes"
              placeholder="e.g. 30% Escrow deposit, 70% upon final inspection"
              value={terms}
              onChangeText={setTerms}
            />

            <View style={styles.totalCalcBox}>
              <Text style={styles.totalCalcLabel}>Estimated Total Contract:</Text>
              <Text style={styles.totalCalcVal}>
                ₹{((parseFloat(unitPrice || "0") * selectedRfq.targetQuantity) / 100000).toFixed(2)} Lakhs
              </Text>
            </View>

            <Button
              title="Submit Formal Bid"
              onPress={handleSubmitQuote}
              loading={submitting}
              size="lg"
              style={{ marginTop: 12, marginBottom: 20 }}
            />
          </ScrollView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  reqCard: {
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reqTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  buyerName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  specText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: Colors.surfaceSubtle,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  metaBox: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  metaVal: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 2,
  },
  modalRfqTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  modalRfqSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  totalCalcBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  totalCalcLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  totalCalcVal: {
    fontSize: 16,
    fontWeight: "900",
    color: Colors.primary,
  },
});

