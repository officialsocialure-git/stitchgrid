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
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
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

  const handleOpenRevisionModal = (sampleId: string) => {
    setSelectedSampleId(sampleId);
    setRevisionFeedback("");
    setRevisionModalVisible(true);
  };

  const handleSubmitRevision = async () => {
    if (!selectedSampleId || !revisionFeedback.trim()) {
      Alert.alert("Missing Feedback", "Please provide required revisions for the manufacturer.");
      return;
    }

    try {
      setUpdatingId(selectedSampleId);
      await marketplaceService.updateSample(selectedSampleId, "REVISION_REQUIRED", {
        feedback: revisionFeedback.trim(),
      });
      setRevisionModalVisible(false);
      Alert.alert("Revision Requested", "Manufacturer has been notified of required sample adjustments.");
      loadSamples();
    } catch (e) {
      Alert.alert("Error", "Could not request revision.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Samples Workflow"
        subtitle="Fit, PP & pre-production approvals"
        showBack
      />

      <FlatList
        data={samples}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSamples();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="shirt-outline"
              title="No Sample Requests"
              description="Samples requested from mills for fit and fabric approval will appear here."
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const sampleCode = `SMP-2026-${(item.id || "100").slice(-4).replace(/\D/g, "").padStart(4, "0") || (100 + index).toString()}`;
          const isApproved = item.status === "APPROVED";
          const isPendingReview = item.status === "DISPATCHED" || item.status === "DELIVERED" || item.status === "REQUESTED";
          const isRevision = item.status === "REVISION_REQUIRED";

          return (
            <View style={styles.sampleCard}>
              <View style={styles.topRow}>
                <Text style={styles.sampleCodeText}>{sampleCode}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isApproved
                      ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                      : isRevision
                      ? { backgroundColor: Colors.dangerLight, borderColor: Colors.dangerBorder }
                      : { backgroundColor: Colors.warningLight, borderColor: Colors.warningBorder },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isApproved
                        ? { color: Colors.successText }
                        : isRevision
                        ? { color: Colors.dangerText }
                        : { color: Colors.warningText },
                    ]}
                  >
                    {item.status.replace("_", " ")}
                  </Text>
                </View>
              </View>

              <Text style={styles.sampleTitle}>
                {item.sampleType || "Pre-Production Sample"}
              </Text>
              <Text style={styles.orderRefText}>
                Order: {item.order?.poNumber || "PO-2026-ACTIVE"} • Factory: {item.order?.supplierOrg?.name || "Tirupur Mill"}
              </Text>

              {item.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{item.notes}</Text>
                </View>
              ) : null}

              {/* Action Buttons */}
              {isPendingReview && (
                <View style={styles.actionRow}>
                  <Button
                    title={updatingId === item.id ? "Approving..." : "Approve Sample"}
                    size="sm"
                    loading={updatingId === item.id}
                    onPress={() => handleApprove(item.id)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Request Revision"
                    variant="outline"
                    size="sm"
                    onPress={() => handleOpenRevisionModal(item.id)}
                    style={{ flex: 1 }}
                  />
                </View>
              )}
            </View>
          );
        }}
      />

      {/* Revision Modal */}
      <Modal
        visible={revisionModalVisible}
        onClose={() => setRevisionModalVisible(false)}
        title="Request Sample Revision"
      >
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 13, color: Colors.textSecondary, marginBottom: 12 }}>
            Specify required adjustments for the garment fit, measurements or fabric feel:
          </Text>

          <Input
            label="Correction Details *"
            placeholder="e.g. Increase chest circumference by 2cm, use softer silicone enzyme wash on next lap dip..."
            value={revisionFeedback}
            onChangeText={setRevisionFeedback}
            multiline
            numberOfLines={4}
          />

          <Button
            title="Submit Revision Request"
            onPress={handleSubmitRevision}
            loading={Boolean(updatingId)}
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sampleCard: {
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
  sampleCodeText: {
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
  sampleTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  orderRefText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 10,
  },
  notesBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textBody,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
});
