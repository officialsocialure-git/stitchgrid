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

  // Search & Filter state matching Web & Screenshot
  const [activeTab, setActiveTab] = useState<FilterTab>("All");
  const [draftActiveTab, setDraftActiveTab] = useState<FilterTab>("All");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [isSortPickerOpen, setIsSortPickerOpen] = useState(false);
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

          // Clean sample name matching Web & Reference Photo
          let name = item.name || item.description || po.styleName || "1000 cargo black pants - Supplier Quote";
          if (name.includes("(Cut, Sew")) {
            name = name.split("(")[0].trim();
          }
          if (!name.includes("Supplier Quote") && !name.includes("Sample")) {
            name = `${name} - Supplier Quote`;
          }

          const orderNum = po.poNumber
            ? po.poNumber.replace("SG-", "")
            : "PO-2026-2589";
          const supplierName = supplier.name || "meldima comfort";

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
            supplierName: supplierName,
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
    <View style={styles.safeArea}>
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
              <Text style={styles.pageMainHeading}>Samples</Text>
              <Text style={styles.pageMainSub}>
                Check product samples and approve them before making bulk order.
              </Text>

              <TouchableOpacity
                style={styles.requestSampleBtnFull}
                activeOpacity={0.85}
                onPress={() => setIsRequestModalOpen(true)}
              >
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={styles.requestSampleBtnFullText}>Request Sample</Text>
              </TouchableOpacity>
            </View>

            {/* Search and Status Filter trigger row matching Web & Screenshot */}
            <View style={styles.searchFilterRow}>
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by sample name, supplier or order ID."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
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
                  color={activeTab !== "All" ? "#FFFFFF" : "#5B13EC"}
                />
                {activeTab !== "All" && <View style={styles.tuneActiveDot} />}
              </TouchableOpacity>
            </View>

            {/* Two Dropdowns Row matching Reference Photo (media_1794886067776_fa1c4045.jpg) */}
            <View style={styles.dropdownsRow}>
              {/* Left Dropdown: Sample Type */}
              <TouchableOpacity
                style={styles.dropdownBtn}
                activeOpacity={0.8}
                onPress={() => setIsTypePickerOpen(true)}
              >
                <Text style={styles.dropdownBtnText} numberOfLines={1}>
                  {typeFilter === "All" ? "Sample Type (All)" : typeFilter}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#94A3B8" />
              </TouchableOpacity>

              {/* Right Dropdown: Newest First */}
              <TouchableOpacity
                style={styles.dropdownBtn}
                activeOpacity={0.8}
                onPress={() => setIsSortPickerOpen(true)}
              >
                <View style={styles.sortInner}>
                  <Ionicons name="swap-vertical" size={16} color="#94A3B8" />
                  <Text style={styles.dropdownBtnText}>
                    {sortBy === "newest" ? "Newest First" : "Oldest First"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Active Status Filter Pill (shown only when a filter is applied, with 1-tap clear) */}
            {activeTab !== "All" && (
              <View style={styles.activeFilterChipRow}>
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterChipText}>
                    Status: <Text style={styles.activeFilterChipBold}>{activeTab}</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setActiveTab("All")}
                    style={styles.activeFilterChipClose}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Ionicons name="close-circle" size={16} color="#5B13EC" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setActiveTab("All")}>
                  <Text style={styles.clearFilterLink}>Clear Filter</Text>
                </TouchableOpacity>
              </View>
            )}
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
              {/* Title */}
              <Text style={styles.sampleCardTitle}>{item.sampleName}</Text>

              {/* Supplier Row */}
              <View style={styles.cardDetailRow}>
                <Ionicons name="business-outline" size={15} color="#94A3B8" />
                <Text style={styles.cardDetailText}>{item.supplierName}</Text>
              </View>

              {/* Order ID Row */}
              <View style={styles.cardDetailRow}>
                <Ionicons name="receipt-outline" size={15} color="#94A3B8" />
                <Text style={styles.cardDetailTextMono}>Order ID: {item.orderId}</Text>
              </View>

              {/* Type & Quantity Row */}
              <View style={styles.metaRowInline}>
                <Text style={styles.metaLabelInline}>
                  Sample Type: <Text style={styles.metaValueInline}>{item.sampleType}</Text>
                </Text>
                <Text style={styles.metaLabelInline}>
                  Quantity: <Text style={styles.metaValueInline}>{item.quantity}</Text>
                </Text>
              </View>

              {/* Sent on Row */}
              <View style={styles.sentOnRow}>
                <Text style={styles.metaLabelInline}>
                  Sent on: <Text style={styles.metaValueInline}>{item.sentDate}</Text>
                </Text>
              </View>

              {/* Bottom Row: Status Badge on Left + View Details on Right */}
              <View style={styles.cardBottomRow}>
                {/* Status Pill Badge */}
                <View
                  style={[
                    styles.statusPillBadge,
                    isApproved
                      ? styles.statusApprovedBadge
                      : isChangesNeeded
                      ? styles.statusChangesBadge
                      : isChecking
                      ? styles.statusCheckingBadge
                      : styles.statusNewBadge,
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
                    size={14}
                    color={
                      isApproved
                        ? "#15803D"
                        : isChangesNeeded
                        ? "#DC2626"
                        : isChecking
                        ? "#2563EB"
                        : "#D97706"
                    }
                  />
                  <Text
                    style={[
                      styles.statusPillText,
                      isApproved
                        ? styles.statusApprovedText
                        : isChangesNeeded
                        ? styles.statusChangesText
                        : isChecking
                        ? styles.statusCheckingText
                        : styles.statusNewText,
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

                {/* View Details Button */}
                <TouchableOpacity
                  style={styles.viewDetailsButton}
                  activeOpacity={0.8}
                  onPress={() => handleOpenDetails(item)}
                >
                  <Text style={styles.viewDetailsButtonText}>View Details</Text>
                </TouchableOpacity>
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

      {/* Sample Type Picker Modal */}
      <RNModal
        visible={isTypePickerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTypePickerOpen(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setIsTypePickerOpen(false)}
          />
          <View style={styles.filterSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Select Sample Type</Text>
              <TouchableOpacity onPress={() => setIsTypePickerOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              {["All", "Final Sample", "First Sample", "Color Sample", "Lab Dip", "Size Set"].map((t) => {
                const isSelected = typeFilter === t;
                return (
                  <TouchableOpacity
                    key={t}
                    onPress={() => {
                      setTypeFilter(t);
                      setIsTypePickerOpen(false);
                    }}
                    style={[styles.filterOptionRow, isSelected && styles.filterOptionRowSelected]}
                  >
                    <Text
                      style={[
                        styles.filterOptionLabel,
                        isSelected && { color: "#5B13EC", fontWeight: "800" },
                      ]}
                    >
                      {t === "All" ? "Sample Type (All)" : t}
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
          </View>
        </View>
      </RNModal>

      {/* Sort By Picker Modal */}
      <RNModal
        visible={isSortPickerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSortPickerOpen(false)}
      >
        <View style={styles.filterModalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setIsSortPickerOpen(false)}
          />
          <View style={styles.filterSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.filterSheetHeader}>
              <Text style={styles.filterSheetTitle}>Sort Samples</Text>
              <TouchableOpacity onPress={() => setIsSortPickerOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.filterOptionsList}>
              {[
                { key: "newest", label: "Newest First" },
                { key: "oldest", label: "Oldest First" },
              ].map((s) => {
                const isSelected = sortBy === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => {
                      setSortBy(s.key as any);
                      setIsSortPickerOpen(false);
                    }}
                    style={[styles.filterOptionRow, isSelected && styles.filterOptionRowSelected]}
                  >
                    <Text
                      style={[
                        styles.filterOptionLabel,
                        isSelected && { color: "#5B13EC", fontWeight: "800" },
                      ]}
                    >
                      {s.label}
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
    </View>
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pageMainHeading: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.textHeading,
    lineHeight: 32,
  },
  pageMainSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 19,
  },
  requestSampleBtnFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5B13EC",
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 14,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 3,
  },
  requestSampleBtnFullText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFF",
  },
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textHeading,
    padding: 0,
  },
  tuneButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tuneButtonActive: {
    backgroundColor: "#5B13EC",
    borderColor: "#5B13EC",
  },
  tuneActiveDot: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: "#FFF",
  },
  dropdownsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  dropdownBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
  },
  dropdownBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textHeading,
  },
  sortInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  activeFilterChipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  activeFilterChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  activeFilterChipBold: {
    fontWeight: "800",
    color: "#5B13EC",
  },
  activeFilterChipClose: {
    marginLeft: 2,
  },
  clearFilterLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5B13EC",
  },
  sampleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sampleCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
    marginBottom: 8,
  },
  cardDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  cardDetailText: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  cardDetailTextMono: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  metaRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
    marginBottom: 4,
  },
  sentOnRow: {
    marginBottom: 14,
  },
  metaLabelInline: {
    fontSize: 13.5,
    color: "#94A3B8",
    fontWeight: "500",
  },
  metaValueInline: {
    color: Colors.textHeading,
    fontWeight: "700",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  statusPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusApprovedBadge: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  statusChangesBadge: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  statusCheckingBadge: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  statusNewBadge: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusApprovedText: {
    color: "#15803D",
  },
  statusChangesText: {
    color: "#DC2626",
  },
  statusCheckingText: {
    color: "#2563EB",
  },
  statusNewText: {
    color: "#D97706",
  },
  viewDetailsButton: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  viewDetailsButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
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
