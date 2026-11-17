import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  TextInput,
  Modal as RNModal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { Sample } from "../../src/types";
import { SampleDetailsModal } from "../../src/components/samples/SampleDetailsModal";
import { RequestSampleModal } from "../../src/components/samples/RequestSampleModal";

type FilterTab = "All" | "New Samples" | "Checking" | "Approved" | "Changes Needed";

interface SampleRow {
  id: string;
  sampleName: string;
  supplierName: string;
  orderId: string;
  sampleType: string;
  quantity: string;
  sentDate: string;
  rawDate: Date;
  status: "REQUESTED" | "IN_PROGRESS" | "DISPATCHED" | "APPROVED" | "REJECTED" | "REVISION_REQUIRED" | string;
  statusCategory: FilterTab;
  notes: string;
  rawSample: any;
}

export default function BuyerSamplesScreen() {
  const router = useRouter();
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [rawSamples, setRawSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Search & Filter state matching Web
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [draftActiveTab, setDraftActiveTab] = useState<FilterTab>("All");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  // Success alert banner matching Web
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [selectedSample, setSelectedSample] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Quick Revision inline modal for "Ask for Changes" button on list row
  const [quickRevisionSampleId, setQuickRevisionSampleId] = useState<string | null>(null);
  const [quickRevisionFeedback, setQuickRevisionFeedback] = useState("");
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // Load samples from real API / DB
  const loadSamples = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listSamples();
      setRawSamples(Array.isArray(data) ? data : []);

      if (Array.isArray(data) && data.length > 0) {
        const mapped: SampleRow[] = data.map((s: any) => {
          const po = s.purchaseOrder || {};
          const supplier = po.supplier || {};
          const item = po.items?.[0] || {};

          // Clean sample name matching Web
          let name = item.name || item.description || "Apparel Sample";
          if (name.includes("(Cut, Sew")) {
            name = name.split("(")[0].trim();
          }
          if (!name || name === "Apparel Sample" || name === "Apparel Production Lot") {
            if (s.notes?.includes("Hoodie")) name = "Heavyweight Hoodie";
            else if (s.notes?.includes("T-Shirt") || s.notes?.includes("Polo")) name = "Polo T-Shirt";
            else if (s.notes?.includes("Jogger")) name = "Cotton Joggers";
            else name = "Custom Apparel Prototype";
          }

          const orderNum = po.poNumber
            ? po.poNumber.replace("SG-", "")
            : `PO-${s.purchaseOrderId?.slice(-4) || "6479"}`;

          // Sample Type
          const rawNotes = s.notes || "";
          let sampleType = s.parsedMeta?.sampleType || "Final Sample";
          if (rawNotes.toLowerCase().includes("first")) sampleType = "First Sample";
          else if (rawNotes.toLowerCase().includes("color") || rawNotes.toLowerCase().includes("swatch")) sampleType = "Color Sample";
          else if (rawNotes.toLowerCase().includes("lab dip")) sampleType = "Lab Dip";
          else if (rawNotes.toLowerCase().includes("size set")) sampleType = "Size Set";
          else if (rawNotes.toLowerCase().includes("pp") || rawNotes.toLowerCase().includes("pre-production")) sampleType = "Final Sample";

          // Status Category
          let category: FilterTab = "New Samples";
          if (s.status === "APPROVED") category = "Approved";
          else if (s.status === "REVISION_REQUIRED" || s.status === "REJECTED") category = "Changes Needed";
          else if (s.status === "IN_PROGRESS" || s.status === "DISPATCHED") category = "Checking";
          else category = "New Samples";

          const rawDate = new Date(s.createdAt || Date.now());
          const sentDate = rawDate.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          });

          return {
            id: s.id,
            sampleName: name,
            supplierName: supplier.name || "Verified Mill Partner",
            orderId: orderNum,
            sampleType,
            quantity: "5 pcs",
            sentDate,
            rawDate,
            status: s.status || "REQUESTED",
            statusCategory: category,
            notes: s.notes || "",
            rawSample: s,
          };
        });

        setSamples(mapped);
      } else {
        setSamples([]);
      }
    } catch (err) {
      console.warn("Failed to load samples:", err);
      setSamples([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  // Real-time synchronization
  useRealtimeSync({
    topics: ["sample:created", "sample:updated", "order:updated"],
    onSync: loadSamples,
    pollIntervalMs: 20000,
  });

  // Tab counts matching Web
  const counts = useMemo(() => {
    return {
      All: samples.length,
      "New Samples": samples.filter((s) => s.statusCategory === "New Samples").length,
      Checking: samples.filter((s) => s.statusCategory === "Checking").length,
      Approved: samples.filter((s) => s.statusCategory === "Approved").length,
      "Changes Needed": samples.filter((s) => s.statusCategory === "Changes Needed").length,
    };
  }, [samples]);

  // Filtered & Sorted Samples
  const filteredSamples = useMemo(() => {
    let result = [...samples];

    // 1. Tab category filter
    if (activeTab !== "All") {
      result = result.filter((s) => s.statusCategory === activeTab);
    }

    // 2. Type filter
    if (typeFilter !== "All") {
      result = result.filter((s) =>
        s.sampleType.toLowerCase().includes(typeFilter.toLowerCase())
      );
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.sampleName.toLowerCase().includes(q) ||
          s.supplierName.toLowerCase().includes(q) ||
          s.orderId.toLowerCase().includes(q) ||
          s.sampleType.toLowerCase().includes(q)
      );
    }

    // 4. Sort
    result.sort((a, b) => {
      const timeA = a.rawDate.getTime();
      const timeB = b.rawDate.getTime();
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [samples, activeTab, typeFilter, searchQuery, sortBy]);

  // Action: Approve
  const handleApprove = async (sampleId: string) => {
    try {
      setUpdatingId(sampleId);
      await marketplaceService.updateSample(sampleId, "APPROVED", {
        feedback: "Sample prototype approved by buyer for bulk production line.",
      });
      setActionSuccessMsg("Sample approved successfully! Bulk production unlocked.");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadSamples();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to approve sample.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Action: Ask for Changes
  const handleAskChanges = async (sampleId: string, feedback: string) => {
    try {
      setUpdatingId(sampleId);
      await marketplaceService.updateSample(sampleId, "REVISION_REQUIRED", {
        feedback,
      });
      setActionSuccessMsg("Changes requested and feedback sent to manufacturer.");
      setTimeout(() => setActionSuccessMsg(null), 4000);
      await loadSamples();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to submit revision request.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenDetails = (sample: SampleRow) => {
    setSelectedSample(sample.rawSample);
    setIsDetailsOpen(true);
  };

  const handleOpenQuickRevision = (sampleId: string) => {
    setQuickRevisionSampleId(sampleId);
    setQuickRevisionFeedback("");
  };

  const submitQuickRevision = async () => {
    if (!quickRevisionSampleId || !quickRevisionFeedback.trim()) return;
    try {
      setSubmittingRevision(true);
      await handleAskChanges(quickRevisionSampleId, quickRevisionFeedback.trim());
      setQuickRevisionSampleId(null);
      setQuickRevisionFeedback("");
    } finally {
      setSubmittingRevision(false);
    }
  };

  const tabs: FilterTab[] = ["All", "New Samples", "Checking", "Approved", "Changes Needed"];

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        Platform.OS === "android" ? { paddingTop: StatusBar.currentHeight || 0 } : null,
      ]}
    >
      <Header
        title="Samples"
        subtitle="Check product samples and approve them before making bulk order"
        showMenuButton={true}
      />

      <FlatList
        data={filteredSamples}
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
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerSection}>
            {/* Success notification banner matching Web */}
            {actionSuccessMsg && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                <Text style={styles.successBannerText}>{actionSuccessMsg}</Text>
                <TouchableOpacity onPress={() => setActionSuccessMsg(null)}>
                  <Ionicons name="close" size={16} color="#15803D" />
                </TouchableOpacity>
              </View>
            )}

            {/* Top Page Header Banner */}
            <View style={styles.pageTitleCard}>
              <View style={styles.pageTitleLeft}>
                <Text style={styles.pageMainHeading}>Samples</Text>
                <Text style={styles.pageMainSub}>
                  Check product samples and approve them before making bulk order.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.requestSampleBtn}
                activeOpacity={0.85}
                onPress={() => setIsRequestModalOpen(true)}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.requestSampleBtnText}>Request Sample</Text>
              </TouchableOpacity>
            </View>

            {/* Search and Status Filter trigger row matching Web */}
            <View style={styles.searchFilterRow}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search sample name, supplier or order ID..."
                  placeholderTextColor={Colors.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.tuneButton,
                  activeTab !== "All" && styles.tuneButtonActive,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setDraftActiveTab(activeTab);
                  setIsStatusFilterOpen(true);
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={20}
                  color={activeTab !== "All" ? "#5B13EC" : Colors.textHeading}
                />
                {activeTab !== "All" && <View style={styles.tuneActiveDot} />}
              </TouchableOpacity>
            </View>

            {/* Horizontal Filter Tabs matching Web */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabsScroll}
            >
              {tabs.map((tab) => {
                const isActive = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.tabPill, isActive && styles.tabPillActive]}
                  >
                    <Text style={[styles.tabPillText, isActive && styles.tabPillTextActive]}>
                      {tab} <Text style={styles.tabCount}>({counts[tab]})</Text>
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Sample Type & Sorting Chips */}
            <View style={styles.subFilterRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                {["All", "Final", "First", "Color", "Lab Dip", "Size Set"].map((t) => {
                  const isSelected = typeFilter === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setTypeFilter(t)}
                      style={[styles.typeChip, isSelected && styles.typeChipActive]}
                    >
                      <Text style={[styles.typeChipText, isSelected && styles.typeChipTextActive]}>
                        {t === "All" ? "All Types" : t}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setSortBy((curr) => (curr === "newest" ? "oldest" : "newest"))}
                style={styles.sortToggle}
              >
                <Ionicons name="swap-vertical" size={14} color={Colors.textSecondary} />
                <Text style={styles.sortToggleText}>
                  {sortBy === "newest" ? "Newest" : "Oldest"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="shirt-outline"
              title="No Samples Found"
              description={
                searchQuery || typeFilter !== "All" || activeTab !== "All"
                  ? "No samples match your search or filter criteria. Try clearing filters."
                  : "No physical samples have been requested yet for your purchase orders."
              }
              actionTitle="Request Sample"
              onAction={() => setIsRequestModalOpen(true)}
            />
          ) : undefined
        }
        renderItem={({ item }) => {
          const isApproved = item.status === "APPROVED";
          const isChangesNeeded = item.status === "REVISION_REQUIRED" || item.status === "REJECTED";
          const isChecking = item.status === "IN_PROGRESS" || item.status === "DISPATCHED";

          return (
            <View style={styles.sampleCard}>
              {/* Card Header: Sample Name & Status Badge */}
              <View style={styles.cardHeader}>
                <View style={styles.sampleTitleWrap}>
                  <Text style={styles.sampleNameText}>{item.sampleName}</Text>
                  <View style={styles.metaLine}>
                    <View style={styles.metaItem}>
                      <Ionicons name="business-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {item.supplierName}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="receipt-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.metaTextMono}>Order ID: {item.orderId}</Text>
                    </View>
                  </View>
                </View>

                {/* Status Pill matching Web */}
                <View
                  style={[
                    styles.statusBadge,
                    isApproved
                      ? styles.statusBadgeApproved
                      : isChangesNeeded
                      ? styles.statusBadgeChanges
                      : isChecking
                      ? styles.statusBadgeChecking
                      : styles.statusBadgeNew,
                  ]}
                >
                  <Ionicons
                    name={
                      isApproved
                        ? "checkmark"
                        : isChangesNeeded
                        ? "sync-outline"
                        : isChecking
                        ? "time-outline"
                        : "sparkles"
                    }
                    size={12}
                    color={
                      isApproved
                        ? "#15803D"
                        : isChangesNeeded
                        ? "#B91C1C"
                        : isChecking
                        ? "#1D4ED8"
                        : "#92400E"
                    }
                  />
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isApproved
                        ? styles.statusTextApproved
                        : isChangesNeeded
                        ? styles.statusTextChanges
                        : isChecking
                        ? styles.statusTextChecking
                        : styles.statusTextNew,
                    ]}
                  >
                    {isApproved
                      ? "Approved"
                      : isChangesNeeded
                      ? "Changes Needed"
                      : isChecking
                      ? "Checking"
                      : "New Sample"}
                  </Text>
                </View>
              </View>

              {/* Specifications row matching Web App */}
              <View style={styles.cardSpecsBand}>
                <View style={styles.specColumn}>
                  <Text style={styles.specLabel}>Sample Type</Text>
                  <Text style={styles.specVal}>{item.sampleType}</Text>
                </View>
                <View style={styles.specDivider} />
                <View style={styles.specColumn}>
                  <Text style={styles.specLabel}>Quantity</Text>
                  <Text style={styles.specVal}>{item.quantity}</Text>
                </View>
                <View style={styles.specDivider} />
                <View style={styles.specColumn}>
                  <Text style={styles.specLabel}>Sent on</Text>
                  <Text style={styles.specVal}>{item.sentDate}</Text>
                </View>
              </View>

              {/* Action Buttons Row matching Web */}
              <View style={styles.cardActionsRow}>
                <TouchableOpacity
                  style={styles.viewDetailsBtn}
                  activeOpacity={0.8}
                  onPress={() => handleOpenDetails(item)}
                >
                  <Text style={styles.viewDetailsBtnText}>View Details</Text>
                </TouchableOpacity>

                {!isApproved && (
                  <TouchableOpacity
                    style={styles.approveBtn}
                    activeOpacity={0.85}
                    disabled={updatingId === item.id}
                    onPress={() => handleApprove(item.id)}
                  >
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                    <Text style={styles.approveBtnText}>
                      {updatingId === item.id ? "Approving..." : "Approve"}
                    </Text>
                  </TouchableOpacity>
                )}

                {!isApproved && (
                  <TouchableOpacity
                    style={[
                      styles.changesBtn,
                      isChangesNeeded && styles.changesBtnActive,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => handleOpenQuickRevision(item.id)}
                  >
                    <Ionicons
                      name="sync"
                      size={13}
                      color={isChangesNeeded ? "#FFF" : Colors.textHeading}
                    />
                    <Text
                      style={[
                        styles.changesBtnText,
                        isChangesNeeded && styles.changesBtnTextActive,
                      ]}
                    >
                      Ask for Changes
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Quick Revision Modal for direct card action */}
      <RNModal
        visible={Boolean(quickRevisionSampleId)}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setQuickRevisionSampleId(null)}
      >
        <View style={styles.quickModalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setQuickRevisionSampleId(null)}
          />
          <View style={styles.quickModalCard}>
            <View style={styles.quickModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons name="sync" size={18} color="#5B13EC" />
                <Text style={styles.quickModalTitle}>Ask for Changes</Text>
              </View>
              <TouchableOpacity onPress={() => setQuickRevisionSampleId(null)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.quickModalSub}>
              Provide specific feedback or modification requests for the manufacturer regarding this physical sample.
            </Text>

            <TextInput
              style={styles.quickModalInput}
              multiline
              numberOfLines={3}
              value={quickRevisionFeedback}
              onChangeText={setQuickRevisionFeedback}
              placeholder="e.g. Neck rib elasticity is loose, adjust fabric wash tone, check seam tolerance..."
              placeholderTextColor={Colors.textMuted}
            />

            <View style={styles.quickModalActions}>
              <TouchableOpacity
                onPress={() => setQuickRevisionSampleId(null)}
                style={styles.quickModalCancel}
              >
                <Text style={styles.quickModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={submitQuickRevision}
                disabled={submittingRevision || !quickRevisionFeedback.trim()}
                style={[
                  styles.quickModalSubmit,
                  (!quickRevisionFeedback.trim() || submittingRevision) && { opacity: 0.5 },
                ]}
              >
                <Text style={styles.quickModalSubmitText}>
                  {submittingRevision ? "Submitting..." : "Send Feedback"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* Status Filter Sheet Modal */}
      <RNModal
        visible={isStatusFilterOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsStatusFilterOpen(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setIsStatusFilterOpen(false)}
          />
          <View style={styles.filterSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Filter Samples</Text>
              <TouchableOpacity onPress={() => setIsStatusFilterOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              {tabs.map((tab) => {
                const isSelected = draftActiveTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setDraftActiveTab(tab)}
                    style={[styles.filterOptionRow, isSelected && styles.filterOptionRowSelected]}
                  >
                    <Text
                      style={[
                        styles.filterOptionLabel,
                        isSelected && { color: "#5B13EC", fontWeight: "800" },
                      ]}
                    >
                      {tab} <Text style={{ color: Colors.textSecondary }}>({counts[tab]})</Text>
                    </Text>
                    <Ionicons
                      name={isSelected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={isSelected ? "#5B13EC" : Colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterSheetActions}>
              <TouchableOpacity
                onPress={() => setDraftActiveTab("All")}
                style={styles.filterClearBtn}
              >
                <Text style={styles.filterClearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setActiveTab(draftActiveTab);
                  setIsStatusFilterOpen(false);
                }}
                style={styles.filterApplyBtn}
              >
                <Text style={styles.filterApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>

      {/* View Details Modal with Photos & Carousel */}
      <SampleDetailsModal
        visible={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedSample(null);
        }}
        sample={selectedSample}
        onApprove={handleApprove}
        onAskChanges={handleAskChanges}
      />

      {/* Request Sample Modal */}
      <RequestSampleModal
        visible={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={loadSamples}
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
    paddingTop: 12,
    paddingBottom: 110,
  },
  headerSection: {
    marginBottom: 12,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  successBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
    marginHorizontal: 8,
  },
  pageTitleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    flexDirection: "column",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pageTitleLeft: {
    flex: 1,
  },
  pageMainHeading: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textHeading,
    lineHeight: 30,
  },
  pageMainSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  requestSampleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#5B13EC",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    alignSelf: "flex-start",
  },
  requestSampleBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
  },
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textHeading,
    padding: 0,
  },
  tuneButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tuneButtonActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
  },
  tuneActiveDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5B13EC",
  },
  tabsScroll: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    paddingVertical: 2,
  },
  tabPill: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabPillActive: {
    backgroundColor: "#5B13EC",
    borderColor: "#5B13EC",
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  tabPillTextActive: {
    color: "#FFF",
  },
  tabCount: {
    fontSize: 11,
    opacity: 0.9,
  },
  subFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginRight: 6,
  },
  typeChipActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: "#5B13EC",
    fontWeight: "800",
  },
  sortToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  sampleCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sampleTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  sampleNameText: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
    marginBottom: 4,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  metaTextMono: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeApproved: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  statusBadgeChanges: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  statusBadgeChecking: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  statusBadgeNew: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusTextApproved: {
    color: "#15803D",
  },
  statusTextChanges: {
    color: "#B91C1C",
  },
  statusTextChecking: {
    color: "#1D4ED8",
  },
  statusTextNew: {
    color: "#92400E",
  },
  cardSpecsBand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  specColumn: {
    flex: 1,
    alignItems: "center",
  },
  specDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderLight,
  },
  specLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  specVal: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textHeading,
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  viewDetailsBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  viewDetailsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#5B13EC",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },
  approveBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFF",
  },
  changesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  changesBtnActive: {
    backgroundColor: "#5B13EC",
    borderColor: "#5B13EC",
  },
  changesBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  changesBtnTextActive: {
    color: "#FFF",
  },
  quickModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  quickModalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 18,
  },
  quickModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  quickModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  quickModalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  quickModalInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    color: Colors.textHeading,
    minHeight: 75,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  quickModalActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  quickModalCancel: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  quickModalCancelText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  quickModalSubmit: {
    backgroundColor: "#5B13EC",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  quickModalSubmitText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFF",
  },
  filterModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  filterSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: "65%",
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  filterSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterSheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  filterOptionsList: {
    gap: 8,
    marginBottom: 16,
  },
  filterOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterOptionRowSelected: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
  },
  filterOptionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  filterSheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  filterClearText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  filterApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#5B13EC",
    alignItems: "center",
    justifyContent: "center",
  },
  filterApplyText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
  },
});
