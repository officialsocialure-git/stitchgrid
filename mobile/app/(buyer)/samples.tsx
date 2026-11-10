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

export default function BuyerSamplesScreen() {
  const router = useRouter();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Revision Modal State
  const [revisionModalVisible, setRevisionModalVisible] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  const loadSamples = useCallback(async () => {
    try {
      const data = await marketplaceService.listSamples();
      setSamples(data || []);
    } catch (e) {
      console.warn("Failed to load samples:", e);
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

  const handleApprove = async (sampleId: string) => {
    try {
      setUpdatingId(sampleId);
      await marketplaceService.updateSample(sampleId, "APPROVED", {
        feedback: "Approved by buyer via Mobile App",
      });
      Alert.alert("Sample Approved", "Pre-production sample approved. The factory can now initiate bulk cutting.");
      loadSamples();
    } catch (e) {
      Alert.alert("Error", "Could not approve sample.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendRevision = async () => {
    if (!selectedSampleId || !revisionFeedback.trim()) {
      Alert.alert("Feedback Required", "Please describe the changes needed for the revised sample.");
      return;
    }
    try {
      setUpdatingId(selectedSampleId);
      await marketplaceService.updateSample(selectedSampleId, "REJECTED", {
        feedback: revisionFeedback.trim(),
      });
      setRevisionModalVisible(false);
      setRevisionFeedback("");
      Alert.alert("Revision Sent", "Feedback delivered to factory. They will prepare a revised sample.");
      loadSamples();
    } catch (e) {
      Alert.alert("Error", "Could not submit revision feedback.");
    } finally {
      setUpdatingId(null);
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
        title="Sample Approvals"
        subtitle="Review PP, Fit and Counter samples"
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
              title="No Samples Submitted"
              description="Samples requested from factories on your orders will show up here."
              actionTitle="View Orders"
              onAction={() => router.push("/(buyer)/orders")}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const badge = getStatusBadge(item.status);
          const isPending = item.status === "REQUESTED" || item.status === "DISPATCHED" || item.status === "RECEIVED";

          return (
            <Card style={styles.sampleCard}>
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.sampleType}>{item.sampleType || "PP"} Sample</Text>
                  <Text style={styles.orderRef}>
                    PO: {item.purchaseOrder?.poNumber || "Active Contract"}
                  </Text>
                </View>
                <Badge label={badge.label} variant={badge.variant} size="sm" />
              </View>

              <Text style={styles.supplierName}>
                Factory: {item.supplier?.name || "Verified Tirupur Unit"}
              </Text>

              {item.trackingNumber && (
                <View style={styles.trackingBox}>
                  <Ionicons name="airplane-outline" size={16} color={Colors.primary} />
                  <Text style={styles.trackingText}>
                    Courier: {item.courierName || "BlueDart / DTDC"} • AWB: {item.trackingNumber}
                  </Text>
                </View>
              )}

              {item.feedback && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>Notes / Feedback:</Text>
                  <Text style={styles.feedbackText}>{item.feedback}</Text>
                </View>
              )}

              {isPending && (
                <View style={styles.actionsRow}>
                  <Button
                    title="Approve Sample"
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleApprove(item.id)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Request Revision"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setSelectedSampleId(item.id);
                      setRevisionModalVisible(true);
                    }}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Revision Modal */}
      <Modal visible={revisionModalVisible} onClose={() => setRevisionModalVisible(false)} title="Request Sample Revision">
        <ScrollView style={{ maxHeight: 360 }}>
          <Text style={styles.modalSub}>
            Provide specific measurements, fit issues, or finishing adjustments required from the mill:
          </Text>
          <Input
            placeholder="e.g. Sleeve length +1.5cm, neckline binding rib width 2cm instead of 2.5cm"
            value={revisionFeedback}
            onChangeText={setRevisionFeedback}
            multiline
            numberOfLines={4}
            containerStyle={{ minHeight: 90 }}
          />
          <Button
            title="Submit Revision Feedback"
            onPress={handleSendRevision}
            loading={updatingId === selectedSampleId}
            size="lg"
            style={{ marginTop: 12, marginBottom: 20 }}
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
  supplierName: {
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
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
});

