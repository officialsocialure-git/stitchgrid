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
import { useRouter } from "expo-router";
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

export default function BuyerRfqsScreen() {
  const router = useRouter();
  const { activeMembership } = useAuth();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Create RFQ Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [garmentType, setGarmentType] = useState("Knits & T-Shirts");
  const [fabricSpec, setFabricSpec] = useState("100% Combed Cotton 180 GSM");
  const [targetQuantity, setTargetQuantity] = useState("2000");
  const [targetPrice, setTargetPrice] = useState("180");
  const [submitting, setSubmitting] = useState(false);

  const loadRfqs = useCallback(async () => {
    try {
      const data = await marketplaceService.listMyRfqs(activeMembership?.organizationId);
      setRfqs(data || []);
    } catch (e) {
      console.warn("Error loading RFQs:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeMembership?.organizationId]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  useRealtimeSync({
    topics: ["rfq:created", "quotation:created", "quotation:updated"],
    onSync: loadRfqs,
    pollIntervalMs: 20000,
  });

  const handleCreateRfq = async () => {
    if (!title.trim() || !targetQuantity.trim()) {
      Alert.alert("Missing Fields", "Please enter RFQ Title and Target Quantity.");
      return;
    }

    try {
      setSubmitting(true);
      await marketplaceService.createRfq({
        buyerOrgId: activeMembership?.organizationId || "",
        title: title.trim(),
        garmentType,
        fabricSpec,
        targetQuantity: parseInt(targetQuantity, 10) || 1000,
        targetPrice: parseFloat(targetPrice) || undefined,
        status: "OPEN",
        items: [
          {
            name: title.trim(),
            quantity: parseInt(targetQuantity, 10) || 1000,
            unit: "pcs",
            description: `${garmentType} - ${fabricSpec}`,
          },
        ],
      });
      setModalVisible(false);
      setTitle("");
      loadRfqs();
      Alert.alert("Success", "RFQ published to verified manufacturers successfully!");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to create RFQ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRfq = (rfqId: string) => {
    Alert.alert("Delete RFQ", "Are you sure you want to delete this RFQ?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await marketplaceService.deleteRfq(rfqId);
            loadRfqs();
          } catch (e) {
            Alert.alert("Error", "Could not delete RFQ.");
          }
        },
      },
    ]);
  };

  const filteredRfqs = rfqs.filter((r) => {
    const matchesFilter = statusFilter === "ALL" || r.status === statusFilter;
    const matchesQuery = !searchQuery.trim() || r.title.toLowerCase().includes(searchQuery.toLowerCase()) || (r.garmentType && r.garmentType.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesQuery;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="My Requests"
        subtitle="Manage apparel RFQs & specifications"
        rightAction={
          <Button
            title="+ New RFQ"
            size="sm"
            onPress={() => setModalVisible(true)}
          />
        }
      />

      {/* Filter Row */}
      <View style={styles.filterSection}>
        <Input
          placeholder="Search requests by title, garment..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
          containerStyle={{ marginBottom: 10 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
          {["ALL", "OPEN", "AWARDED", "CLOSED"].map((st) => (
            <TouchableOpacity
              key={st}
              onPress={() => setStatusFilter(st)}
              style={[styles.pill, statusFilter === st && styles.pillActive]}
            >
              <Text style={[styles.pillText, statusFilter === st && styles.pillTextActive]}>
                {st}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredRfqs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRfqs(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="document-text-outline"
              title="No Requests Found"
              description="Post a request for quotation to receive competitive offers from Tirupur mills."
              actionTitle="+ Post New RFQ"
              onAction={() => setModalVisible(true)}
            />
          ) : null
        }
        renderItem={({ item }) => {
          const quoteCount = item.quotations?.length || 0;
          return (
            <Card style={styles.rfqCard}>
              <View style={styles.rfqTopRow}>
                <Badge
                  label={item.status}
                  size="sm"
                  variant={item.status === "OPEN" ? "primary" : item.status === "AWARDED" ? "success" : "neutral"}
                />
                <TouchableOpacity onPress={() => handleDeleteRfq(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>

              <Text style={styles.rfqTitle}>{item.title}</Text>
              <Text style={styles.rfqSpec}>
                {item.garmentType || "Apparel"} • {item.fabricSpec || "Standard Cotton"}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Target Qty</Text>
                  <Text style={styles.metaValue}>{item.targetQuantity.toLocaleString()} pcs</Text>
                </View>
                {item.targetPrice && (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>Target Price</Text>
                    <Text style={styles.metaValue}>₹{item.targetPrice}/pc</Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Offers</Text>
                  <Text style={[styles.metaValue, { color: Colors.primary }]}>{quoteCount} received</Text>
                </View>
              </View>

              <View style={styles.rfqActions}>
                <Button
                  title={quoteCount > 0 ? `View ${quoteCount} Offers` : "View Offers"}
                  size="sm"
                  variant={quoteCount > 0 ? "primary" : "secondary"}
                  onPress={() => router.push({ pathname: "/(buyer)/offers", params: { rfqId: item.id } })}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          );
        }}
      />

      {/* Create RFQ Modal */}
      <Modal visible={modalVisible} onClose={() => setModalVisible(false)} title="Issue New RFQ">
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <Input
            label="Product Title *"
            placeholder="e.g. 5,000 pcs 180 GSM Crew Neck T-Shirts"
            value={title}
            onChangeText={setTitle}
          />
          <Input
            label="Garment Category"
            placeholder="e.g. Knits, Polos, Hoodies, Denims"
            value={garmentType}
            onChangeText={setGarmentType}
          />
          <Input
            label="Fabric & Construction Specification"
            placeholder="e.g. 100% Combed Cotton, Bio-washed, 180 GSM"
            value={fabricSpec}
            onChangeText={setFabricSpec}
          />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Input
              label="Target Quantity (pcs) *"
              placeholder="e.g. 2000"
              value={targetQuantity}
              onChangeText={setTargetQuantity}
              keyboardType="number-pad"
              containerStyle={{ flex: 1 }}
            />
            <Input
              label="Target Price (₹/pc)"
              placeholder="e.g. 175"
              value={targetPrice}
              onChangeText={setTargetPrice}
              keyboardType="numeric"
              containerStyle={{ flex: 1 }}
            />
          </View>
          <Button
            title="Publish RFQ to Factories"
            onPress={handleCreateRfq}
            loading={submitting}
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
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filterPills: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
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
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  rfqCard: {
    marginBottom: 14,
  },
  rfqTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  rfqTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  rfqSpec: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  metaItem: {
    alignItems: "center",
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  metaValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 2,
  },
  rfqActions: {
    flexDirection: "row",
    gap: 10,
  },
});

