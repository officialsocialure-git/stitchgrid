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
  StatusBar,
  Modal as NativeModal,
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
  const [navigationMenuOpen, setNavigationMenuOpen] = useState(false);

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
    const matchesQuery =
      !searchQuery.trim() ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.garmentType && r.garmentType.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesQuery;
  });

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight || 0 } : null,
      ]}
    >
      <Header showMenuButton onMenuPress={() => setNavigationMenuOpen(true)} />

      <NativeModal
        visible={navigationMenuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setNavigationMenuOpen(false)}
      >
        <View style={styles.navigationOverlay}>
          <TouchableOpacity
            style={styles.navigationBackdrop}
            activeOpacity={1}
            onPress={() => setNavigationMenuOpen(false)}
          />
          <View style={styles.navigationDrawer}>
            <View style={styles.navigationHeader}>
              <Text style={styles.navigationTitle}>STITCHGRID</Text>
              <TouchableOpacity onPress={() => setNavigationMenuOpen(false)} style={styles.navigationCloseButton}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.navigationSubtitle}>Buyer Workspace</Text>
            {[
              { label: "Dashboard", icon: "grid-outline", route: "/(buyer)/dashboard" },
              { label: "Buyer Requests", icon: "document-text-outline", route: "/(buyer)/rfqs" },
              { label: "My Offers", icon: "pricetags-outline", route: "/(buyer)/offers" },
              { label: "Orders", icon: "cube-outline", route: "/(buyer)/orders" },
              { label: "Samples", icon: "layers-outline", route: "/(buyer)/samples" },
              { label: "Production", icon: "construct-outline", route: "/(buyer)/production" },
              { label: "Payments", icon: "card-outline", route: "/(buyer)/payments" },
              { label: "Messages", icon: "chatbubble-ellipses-outline", route: "/(buyer)/messages" },
              { label: "Profile", icon: "person-outline", route: "/(buyer)/profile" },
              { label: "Settings", icon: "settings-outline", route: "/(shared)/settings" },
              { label: "Notifications", icon: "notifications-outline", route: "/(shared)/notifications" },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.navigationItem}
                onPress={() => {
                  setNavigationMenuOpen(false);
                  router.push(item.route as any);
                }}
              >
                <Ionicons name={item.icon as any} size={20} color={Colors.primary} />
                <Text style={styles.navigationItemText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </NativeModal>

      <ScrollView
        style={styles.pageIntroScroll}
        contentContainerStyle={styles.pageIntro}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageTitleRow}>
          <Text style={styles.pageTitle}>My Requests</Text>
          <View style={styles.pageTag}><Text style={styles.pageTagText}>Buyer Sourcing Hub</Text></View>
        </View>
        <Text style={styles.pageDescription}>
          Create and manage your production requests (RFQs), compare supplier quotes, and move to order.
        </Text>
        <Button
          title="+ Post New Request"
          size="lg"
          onPress={() => setModalVisible(true)}
          style={styles.newRequestButton}
        />
      </ScrollView>

      {/* Filter Row: Search & Status Pills */}
      <View style={styles.filterSection}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <Input
            placeholder="Search requests by title, garment..."
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRfqs();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="document-text-outline"
              title="No Requests Found"
              description="Post a request for quotation to receive competitive offers from verified mills."
              actionTitle="+ Post New RFQ"
              onAction={() => setModalVisible(true)}
            />
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const quoteCount = item.quotations?.length || 0;
          const rfqIdDisplay = `RFQ-2026-${(item.id || "1040").slice(-4).replace(/\D/g, "").padStart(4, "0") || (1040 + index).toString()}`;
          const isAwarded = item.status === "AWARDED";
          const isOpen = item.status === "OPEN";

          return (
            <View style={styles.rfqCard}>
              <View style={styles.rfqTopRow}>
                <Text style={styles.rfqIdText}>{rfqIdDisplay}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={[
                      styles.statusBadge,
                      isAwarded
                        ? { backgroundColor: Colors.successLight, borderColor: Colors.successBorder }
                        : isOpen
                        ? { backgroundColor: Colors.primaryLight, borderColor: Colors.borderPrimary }
                        : { backgroundColor: Colors.surfaceSubtle, borderColor: Colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isAwarded
                          ? { color: Colors.successText }
                          : isOpen
                          ? { color: Colors.primary }
                          : { color: Colors.textSecondary },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteRfq(item.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={17} color={Colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.rfqTitle}>{item.title}</Text>
              <Text style={styles.rfqSpec}>
                {item.garmentType || "Apparel"} • {item.fabricSpec || "Standard Cotton"}
              </Text>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Target Qty</Text>
                  <Text style={styles.metaVal}>{item.targetQuantity.toLocaleString()} pcs</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Target Price</Text>
                  <Text style={styles.metaVal}>
                    {item.targetPrice ? `₹${item.targetPrice}` : "Market"}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Quotes</Text>
                  <Text
                    style={[
                      styles.metaVal,
                      quoteCount > 0 ? { color: Colors.primary, fontWeight: "800" } : null,
                    ]}
                  >
                    {quoteCount} received
                  </Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <Button
                  title={quoteCount > 0 ? `Compare Quotes (${quoteCount})` : "View Offers"}
                  size="sm"
                  variant={quoteCount > 0 ? "primary" : "secondary"}
                  onPress={() => router.push(`/(buyer)/offers?rfqId=${item.id}`)}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          );
        }}
      />

      {/* Create RFQ Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Post New Garment RFQ"
      >
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          <Input
            label="Garment Title / Requirement *"
            placeholder="e.g. 100% Combed Cotton Crew Neck T-Shirts"
            value={title}
            onChangeText={setTitle}
          />

          <Input
            label="Garment Category"
            placeholder="e.g. Knits, Denim, Hoodies, Shirts"
            value={garmentType}
            onChangeText={setGarmentType}
          />

          <Input
            label="Fabric & Construction Specifications"
            placeholder="e.g. 180 GSM, Single Jersey, Bio-Washed"
            value={fabricSpec}
            onChangeText={setFabricSpec}
          />

          <Input
            label="Target Quantity (Pcs) *"
            placeholder="e.g. 2000"
            value={targetQuantity}
            onChangeText={setTargetQuantity}
            keyboardType="numeric"
          />

          <Input
            label="Target Price Per Piece (₹)"
            placeholder="e.g. 180"
            value={targetPrice}
            onChangeText={setTargetPrice}
            keyboardType="numeric"
          />

          <Button
            title="Publish RFQ to Mills"
            onPress={handleCreateRfq}
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
  pageIntroScroll: {
    flexGrow: 0,
    backgroundColor: Colors.background,
  },
  pageIntro: {
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 18,
  },
  pageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  pageTitle: {
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  pageTag: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pageTagText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  pageDescription: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
  },
  newRequestButton: {
    alignSelf: "flex-start",
    marginTop: 18,
    minWidth: 190,
  },
  navigationOverlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(15, 23, 42, 0.42)",
  },
  navigationBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  navigationDrawer: {
    width: "82%",
    maxWidth: 340,
    height: "100%",
    backgroundColor: Colors.surface,
    paddingTop: Platform.OS === "ios" ? 58 : (StatusBar.currentHeight || 0) + 18,
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    elevation: 18,
  },
  navigationHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  navigationTitle: {
    color: Colors.primary,
    fontSize: 19,
    fontWeight: "900",
  },
  navigationCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surfaceSubtle,
  },
  navigationSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 18,
  },
  navigationItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  navigationItemText: {
    flex: 1,
    color: Colors.textHeading,
    fontSize: 14,
    fontWeight: "600",
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 112,
  },
  rfqCard: {
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
  rfqTopRow: {
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  rfqTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    lineHeight: 20,
  },
  rfqSpec: {
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
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
