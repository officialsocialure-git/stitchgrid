import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/common/Card";
import { Badge, BadgeVariant } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { Modal } from "../../src/components/common/Modal";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Sample } from "../../src/types";

export default function SupplierSamplesScreen() {
  const router = useRouter();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dispatch Sample Modal State
  const [dispatchModalVisible, setDispatchModalVisible] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [courierName, setCourierName] = useState("BlueDart Express");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [dispatchNotes, setDispatchNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadSamples = useCallback(async () => {
    try {
      const data = await marketplaceService.listSamples();
      setSamples(data || []);
    } catch (e) {
      console.warn("Failed to load supplier samples:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  useRealtimeSync({
    topics: ["sample:created", "sample:updated", "order:updated"],
    onSync: loadSamples,
    pollIntervalMs: 20000,
  });

  const handleDispatch = async () => {
    if (!selectedSample || !trackingNumber.trim()) {
      Alert.alert("Missing AWB", "Please enter the courier tracking / AWB number.");
      return;
    }

    try {
      setSubmitting(true);
      await marketplaceService.updateSample(selectedSample.id, "DISPATCHED", {
        notes: `Shipped via ${courierName} (AWB: ${trackingNumber.trim()}). ${dispatchNotes}`,
      });
      setDispatchModalVisible(false);
      setSelectedSample(null);
      setTrackingNumber("");
      Alert.alert("Sample Dispatched!", "Tracking details sent to buyer. Live status updated to IN TRANSIT.");
      loadSamples();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Could not update sample dispatch status.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string): { label: string; variant: BadgeVariant } => {
    switch (status) {
      case "APPROVED":
        return { label: "APPROVED", variant: "success" };
      case "REJECTED":
      case "REVISED":
        return { label: "REVISION REQ", variant: "danger" };
      case "DISPATCHED":
        return { label: "IN TRANSIT", variant: "info" };
      default:
        return { label: status, variant: "warning" };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Sample Management"
        subtitle="Manage PP samples & courier dispatch"
        showBack
      />

      <FlatList
        data={samples}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSamples(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="shirt-outline"
              title="No Sample Workflows"
              description="Orders requiring pre-production samples will appear here."
              actionTitle="View Orders"
              onAction={() => router.push("/(supplier)/orders")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const canDispatch = item.status === "REQUESTED" || item.status === "REVISED";

          return (
            <Card style={styles.sampleCard}>
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.sampleType}>{item.sampleType || "PP"} Sample</Text>
                  <Text style={styles.orderRef}>PO: {item.purchaseOrder?.poNumber || "Contract"}</Text>
                </View>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>

              <Text style={styles.buyerName}>Buyer: {item.buyer?.name || "Apparel Brand"}</Text>

              {item.trackingNumber && (
                <View style={styles.trackingBox}>
                  <Ionicons name="airplane-outline" size={16} color={Colors.primary} />
                  <Text style={styles.trackingText}>
                    Courier: {item.courierName || "Express Courier"} • AWB: {item.trackingNumber}
                  </Text>
                </View>
              )}

              {item.feedback && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>Buyer Feedback:</Text>
                  <Text style={styles.feedbackText}>{item.feedback}</Text>
                </View>
              )}

              {canDispatch && (
                <View style={styles.actionRow}>
                  <Button
                    title="Dispatch Sample & Add Tracking"
                    size="sm"
                    onPress={() => {
                      setSelectedSample(item);
                      setDispatchModalVisible(true);
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Dispatch Modal */}
      <Modal visible={dispatchModalVisible} onClose={() => setDispatchModalVisible(false)} title="Dispatch Sample to Buyer">
        {selectedSample && (
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSub}>
              Enter courier airway bill details so the buyer can track delivery:
            </Text>

            <Input
              label="Courier Partner *"
              placeholder="e.g. BlueDart, DTDC, DHL, Delhivery"
              value={courierName}
              onChangeText={setCourierName}
            />

            <Input
              label="Airway Bill / Tracking Number *"
              placeholder="e.g. BLUEDART-98721389"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
            />

            <Input
              label="Dispatch Notes"
              placeholder="e.g. 2 pcs Size M with contrast rib neckline"
              value={dispatchNotes}
              onChangeText={setDispatchNotes}
              multiline
            />

            <Button
              title="Confirm Dispatch"
              onPress={handleDispatch}
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sampleCard: {
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  sampleType: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  orderRef: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  buyerName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  trackingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primaryLight,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  trackingText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  feedbackBox: {
    backgroundColor: Colors.surfaceSubtle,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  feedbackLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  feedbackText: {
    fontSize: 13,
    color: Colors.text,
  },
  actionRow: {
    flexDirection: "row",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
});

