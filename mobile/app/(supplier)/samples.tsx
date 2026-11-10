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
        notes: `Carrier: ${courierName.trim()} | AWB: ${trackingNumber.trim()} | Notes: ${dispatchNotes.trim()}`,
      });
      setDispatchModalVisible(false);
      setTrackingNumber("");
      setDispatchNotes("");
      Alert.alert("Sample Dispatched", "Courier details shared with buyer.");
      loadSamples();
    } catch (e) {
      Alert.alert("Error", "Could not dispatch sample.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Factory Samples"
        subtitle="Sampling pipeline & dispatch courier info"
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
              title="No Samples Requested"
              description="Sample requests from buyers will appear here for mill development and courier dispatch."
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const sampleCode = `SMP-2026-${(item.id || "100").slice(-4).replace(/\D/g, "").padStart(4, "0") || (100 + index).toString()}`;
          const isApproved = item.status === "APPROVED";
          const isRevision = item.status === "REVISION_REQUIRED";
          const canDispatch = item.status === "REQUESTED" || item.status === "IN_PROGRESS" || isRevision;

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
                      : { backgroundColor: Colors.primaryLight, borderColor: Colors.borderPrimary },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isApproved
                        ? { color: Colors.successText }
                        : isRevision
                        ? { color: Colors.dangerText }
                        : { color: Colors.primary },
                    ]}
                  >
                    {item.status.replace("_", " ")}
                  </Text>
                </View>
              </View>

              <Text style={styles.sampleTitle}>
                {item.sampleType || "Pre-Production Fit Sample"}
              </Text>
              <Text style={styles.orderRefText}>
                Order: {item.order?.poNumber || "PO-2026-ACTIVE"} • Buyer: {item.order?.buyerOrg?.name || "Enterprise Brand"}
              </Text>

              {item.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>{item.notes}</Text>
                </View>
              ) : null}

              {canDispatch && (
                <Button
                  title="Dispatch Sample Package"
                  onPress={() => {
                    setSelectedSample(item);
                    setDispatchModalVisible(true);
                  }}
                  size="sm"
                  style={{ marginTop: 6 }}
                />
              )}
            </View>
          );
        }}
      />

      {/* Dispatch Modal */}
      <Modal
        visible={dispatchModalVisible}
        onClose={() => setDispatchModalVisible(false)}
        title="Dispatch Sample Package"
      >
        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          <Input
            label="Courier Partner *"
            placeholder="e.g. BlueDart Express, DHL, Delhivery"
            value={courierName}
            onChangeText={setCourierName}
          />

          <Input
            label="Airway Bill (AWB) / Tracking Number *"
            placeholder="e.g. BLU789456123"
            value={trackingNumber}
            onChangeText={setTrackingNumber}
          />

          <Input
            label="Package Contents & Notes"
            placeholder="e.g. Size L & M garments enclosed with measurement audit sheet..."
            value={dispatchNotes}
            onChangeText={setDispatchNotes}
            multiline
            numberOfLines={3}
          />

          <Button
            title="Confirm Dispatch"
            onPress={handleDispatch}
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
});
