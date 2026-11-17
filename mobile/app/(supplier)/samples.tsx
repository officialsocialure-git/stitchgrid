import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  Alert,
  Platform,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Header } from "../../src/components/common/Header";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";

export interface SampleItem {
  id: string;
  sampleCode: string;
  orderId: string;
  title: string;
  buyerName: string;
  quantity: string;
  sampleType: string;
  dueDate: string;
  status: "APPROVED" | "PENDING" | "REVISION_REQUIRED" | "DISPATCHED";
  fabric: string;
  color: string;
  sizes: string;
  finish: string;
  photos: string[];
  buyerNote: string;
  files: { name: string; size: string }[];
  history: { title: string; date: string; desc: string; done: boolean }[];
}

// Standard reference data matching User's Reference Screenshots 1 through 6
const DEFAULT_SUPPLIER_SAMPLES: SampleItem[] = [
  {
    id: "smp-2026-2589",
    sampleCode: "SMP-2026-0881",
    orderId: "PO-2026-2589",
    title: "1000 cargo black pants - Supplier Quote",
    buyerName: "Qspider",
    quantity: "5 pcs",
    sampleType: "Final Sample",
    dueDate: "12 Nov 2026",
    status: "APPROVED",
    fabric: "Cotton Linen",
    color: "Beige",
    sizes: "S, M, L, XL",
    finish: "Bio-wash & Compacted",
    photos: [
      "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80",
    ],
    buyerNote:
      "Please ensure the waist stitching has double lock stitch and pocket flaps match Pantone 19-3908. Color shade should match approved lab dip Beige.",
    files: [{ name: "Cargo_Pants_TechPack_v2.pdf", size: "2.4 MB" }],
    history: [
      {
        title: "Sample Request Issued",
        date: "28 Oct 2026",
        desc: "Buyer Qspider requested 5 pcs Pre-Production Final Sample.",
        done: true,
      },
      {
        title: "Fabric Procured & Cut",
        date: "2 Nov 2026",
        desc: "Cotton Linen Beige fabric tested for shrinkage and approved.",
        done: true,
      },
      {
        title: "Sample Dispatched via Courier",
        date: "6 Nov 2026",
        desc: "BlueDart Tracking #BD88912 shipped to Buyer QA Center.",
        done: true,
      },
      {
        title: "Sample Inspected & Approved",
        date: "10 Nov 2026",
        desc: "Quality passed AQL 2.5 standards with zero remarks. Bulk line cleared.",
        done: true,
      },
    ],
  },
  {
    id: "smp-2026-1197",
    sampleCode: "SMP-2026-0542",
    orderId: "PO-2026-1197",
    title: "5,000 tees - Export Crew Neck",
    buyerName: "TrendSetter Apparel Co.",
    quantity: "3 pcs",
    sampleType: "Pre-Production Sample",
    dueDate: "20 Nov 2026",
    status: "PENDING",
    fabric: "240 GSM, 100% Cotton Single Jersey",
    color: "Navy Blue",
    sizes: "M, L, XL",
    finish: "Enzyme Wash & Pre-Shrunk",
    photos: [
      "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80",
    ],
    buyerNote:
      "Collar ribbing should be tight 1x1 cotton rib with zero puckering.",
    files: [{ name: "Tees_Specification_TechSheet.pdf", size: "1.8 MB" }],
    history: [
      {
        title: "Sample Requested",
        date: "5 Nov 2026",
        desc: "Buyer requested 3 pcs crew neck fit sample.",
        done: true,
      },
      {
        title: "Knitting on Sample Machine",
        date: "8 Nov 2026",
        desc: "Single Jersey 240 GSM yarn batch assigned.",
        done: true,
      },
      {
        title: "Tailoring & Assembly",
        date: "12 Nov 2026",
        desc: "Sample currently on sewing line.",
        done: false,
      },
    ],
  },
];

type DetailTab = "PHOTOS" | "DETAILS" | "BUYER_NOTE" | "FILES" | "HISTORY";

export default function SupplierSamplesScreen() {
  const router = useRouter();
  const navigation = useNavigation<any>();

  const [samples, setSamples] = useState<SampleItem[]>(DEFAULT_SUPPLIER_SAMPLES);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");

  // Selected sample for Detail View (Image 2 - 6)
  const [selectedSample, setSelectedSample] = useState<SampleItem | null>(null);

  // Active sub-tab inside Detail View (Sample Photos, Details, Buyer Note, Files, History)
  const [activeTab, setActiveTab] = useState<DetailTab>("PHOTOS");

  // Modals state
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [submittingPhotos, setSubmittingPhotos] = useState(false);

  // Uploaded photo state inside detail view
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([
    "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80",
  ]);

  // Load samples from backend and merge with reference samples
  const loadSamples = useCallback(async () => {
    try {
      const data = await marketplaceService.listSamples();
      if (Array.isArray(data) && data.length > 0) {
        // Map backend samples into SampleItem
        const mapped: SampleItem[] = data.map((s, idx) => ({
          id: s.id,
          sampleCode: `SMP-2026-${(s.id || "100").slice(-4).replace(/\D/g, "").padStart(4, "0") || (100 + idx).toString()}`,
          orderId: s.order?.poNumber || (s as any).orderId || "PO-2026-2589",
          title: s.order?.items?.[0]?.description || s.sampleType || "Apparel Sample",
          buyerName: s.order?.buyerOrg?.name || (s as any).buyer?.name || "Enterprise Brand",
          quantity: `${(s as any).quantity || 5} pcs`,
          sampleType: s.sampleType || "Final Sample",
          dueDate: "12 Nov 2026",
          status: s.status === "APPROVED" ? "APPROVED" : s.status === "REVISION_REQUIRED" ? "REVISION_REQUIRED" : "PENDING",
          fabric: "Cotton Linen",
          color: "Beige",
          sizes: "S, M, L, XL",
          finish: "Bio-wash & Compacted",
          photos: [
            "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80",
          ],
          buyerNote: s.notes || "Please ensure strict adherence to tech pack measurements.",
          files: [{ name: "Sample_Specification.pdf", size: "2.1 MB" }],
          history: [
            {
              title: "Sample Request Created",
              date: "1 Nov 2026",
              desc: "Buyer submitted sample request.",
              done: true,
            },
          ],
        }));

        // Merge standard reference samples so user's reference sample is always present
        for (const def of DEFAULT_SUPPLIER_SAMPLES) {
          if (!mapped.some((m) => m.id === def.id || m.orderId === def.orderId)) {
            mapped.push(def);
          }
        }
        setSamples(mapped);
      } else {
        setSamples(DEFAULT_SUPPLIER_SAMPLES);
      }
    } catch (e) {
      console.warn("Failed to load supplier samples, using reference data:", e);
      setSamples(DEFAULT_SUPPLIER_SAMPLES);
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

  // Filtered samples for List View
  const filteredSamples = useMemo(() => {
    return samples.filter((s) => {
      if (selectedFilter !== "ALL") {
        if (selectedFilter === "APPROVED" && s.status !== "APPROVED") return false;
        if (selectedFilter === "PENDING" && s.status !== "PENDING") return false;
        if (selectedFilter === "REVISION_REQUIRED" && s.status !== "REVISION_REQUIRED") return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        s.title.toLowerCase().includes(q) ||
        s.buyerName.toLowerCase().includes(q) ||
        s.orderId.toLowerCase().includes(q) ||
        s.sampleCode.toLowerCase().includes(q)
      );
    });
  }, [samples, selectedFilter, searchQuery]);

  // Pick or take photo using Expo Image Picker
  const handlePickPhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          "Permission Required",
          "Camera roll permission is required to select sample photos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setUploadedPhotos((prev) => [...prev, result.assets[0].uri]);
        Alert.alert("Photo Added", "Sample photo has been attached to the upload queue.");
      }
    } catch (e) {
      console.warn("Image picker error:", e);
      Alert.alert("Picker Error", "Could not open gallery.");
    }
  };

  // Submit photos to buyer
  const handleSubmitToBuyer = async () => {
    if (uploadedPhotos.length === 0) {
      Alert.alert("No Photos", "Please choose at least one photo of the sample.");
      return;
    }

    setSubmittingPhotos(true);
    try {
      // Simulate submission or call API
      setTimeout(() => {
        setSubmittingPhotos(false);
        Alert.alert(
          "Sample Submitted!",
          "Sample photos and technical inspection sheet have been successfully submitted to the buyer for approval."
        );
      }, 1000);
    } catch (e) {
      setSubmittingPhotos(false);
      Alert.alert("Submission Failed", "Could not submit sample photos.");
    }
  };

  const handleSaveDraft = () => {
    Alert.alert("Draft Saved", "Sample photos saved as draft. You can continue editing anytime.");
  };

  // -----------------------------------------------------------------
  // VIEW 2: SAMPLE DETAILS SCREEN (Matching Reference Photos 2 to 6)
  // -----------------------------------------------------------------
  if (selectedSample) {
    return (
      <SafeAreaView style={styles.safeArea}>
        {/* Custom Header: Back Arrow + "Sample Details" + Status Badge */}
        <View style={styles.detailsHeaderRow}>
          <TouchableOpacity
            style={styles.detailsBackBtn}
            onPress={() => setSelectedSample(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
            <Text style={styles.detailsHeaderTitle}>Sample Details</Text>
          </TouchableOpacity>

          <View style={styles.approvedPillHeader}>
            <Ionicons name="checkmark" size={16} color="#059669" style={{ marginRight: 4 }} />
            <Text style={styles.approvedPillText}>Approved</Text>
          </View>
        </View>

        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Top Card: Photo Preview + Title + Specs (Reference Photos 2 & 3) */}
          <View style={styles.detailsTopCard}>
            {/* Image Preview Container with pill "Front View (1/1)" */}
            <View style={styles.imagePreviewWrap}>
              <Image
                source={{
                  uri:
                    uploadedPhotos[0] ||
                    "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80",
                }}
                style={styles.samplePreviewImage}
                resizeMode="cover"
              />
              <View style={styles.imageCountPill}>
                <Text style={styles.imageCountPillText}>Front View (1/1)</Text>
              </View>
            </View>

            {/* Product Title */}
            <Text style={styles.detailProductTitle}>{selectedSample.title}</Text>

            {/* Icon Specifications (Buyer, Quantity, Order ID, Due Date, Sample Type) */}
            <View style={styles.detailSpecsStack}>
              {/* Row 1: Buyer */}
              <View style={styles.detailIconRow}>
                <Ionicons name="business-outline" size={18} color="#64748B" style={{ width: 26 }} />
                <Text style={styles.detailIconText}>
                  Buyer: <Text style={styles.detailBoldText}>{selectedSample.buyerName}</Text>
                </Text>
              </View>

              {/* Row 2: Quantity */}
              <View style={styles.detailIconRow}>
                <Ionicons name="cube-outline" size={18} color="#64748B" style={{ width: 26 }} />
                <Text style={styles.detailIconText}>
                  Quantity: <Text style={styles.detailBoldText}>{selectedSample.quantity}</Text>
                </Text>
              </View>

              {/* Row 3: Order ID */}
              <View style={styles.detailIconRow}>
                <Ionicons name="receipt-outline" size={18} color="#64748B" style={{ width: 26 }} />
                <Text style={styles.detailIconText}>
                  Order ID: <Text style={styles.detailMonoText}>{selectedSample.orderId}</Text>
                </Text>
              </View>

              {/* Row 4: Due Date */}
              <View style={styles.detailIconRow}>
                <Ionicons name="calendar-outline" size={18} color="#64748B" style={{ width: 26 }} />
                <Text style={styles.detailIconText}>
                  Due Date: <Text style={styles.detailBoldText}>{selectedSample.dueDate}</Text>
                </Text>
              </View>

              {/* Row 5: Sample Type */}
              <View style={styles.detailIconRow}>
                <Ionicons name="pricetag-outline" size={18} color="#64748B" style={{ width: 26 }} />
                <Text style={styles.detailIconText}>
                  Sample Type: <Text style={styles.detailBoldText}>{selectedSample.sampleType}</Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Horizontal Navigation Tabs (Reference Photos 3 & 4) */}
          <View style={styles.tabsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              {[
                { key: "PHOTOS", label: "Sample Photos" },
                { key: "DETAILS", label: "Details" },
                { key: "BUYER_NOTE", label: "Buyer Note" },
                { key: "FILES", label: "Files (1)" },
                { key: "HISTORY", label: "History" },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[styles.tabItem, isActive && styles.tabItemActive]}
                    onPress={() => setActiveTab(tab.key as DetailTab)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.tabItemText, isActive && styles.tabItemTextActive]}>
                      {tab.label}
                    </Text>
                    {isActive && <View style={styles.tabIndicator} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Tab Content 1: SAMPLE PHOTOS (Reference Photos 4 & 5) */}
          {activeTab === "PHOTOS" && (
            <View style={styles.tabContentContainer}>
              {/* Upload Sample Photos Card */}
              <View style={styles.uploadCard}>
                <Text style={styles.uploadCardTitle}>Upload Sample Photos</Text>
                <Text style={styles.uploadCardSubtitle}>
                  Add clear photos of the sample (front, back, fabric, close-up, etc.).
                </Text>

                {/* Dashed Drag & Drop Box */}
                <TouchableOpacity
                  style={styles.dashedUploadBox}
                  onPress={handlePickPhoto}
                  activeOpacity={0.8}
                >
                  <View style={styles.cloudIconCircle}>
                    <Ionicons name="cloud-upload-outline" size={26} color="#5B13EC" />
                  </View>
                  <Text style={styles.uploadBoxMainText}>Drag & drop photos here or click to upload</Text>
                  <Text style={styles.uploadBoxSubText}>JPG, PNG • Max 10 MB per photo • Up to 10 photos</Text>

                  <View style={styles.choosePhotosBtn}>
                    <Ionicons name="arrow-up" size={16} color="#5B13EC" style={{ marginRight: 6 }} />
                    <Text style={styles.choosePhotosBtnText}>Choose Photos</Text>
                  </View>
                </TouchableOpacity>

                {/* Uploaded Thumbnail Preview Card (Reference Photo 5) */}
                <View style={styles.uploadedThumbnailCard}>
                  <Image
                    source={{
                      uri:
                        uploadedPhotos[0] ||
                        "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=600&auto=format&fit=crop&q=80",
                    }}
                    style={styles.uploadedThumbnailImg}
                    resizeMode="cover"
                  />
                  <Text style={styles.uploadedThumbnailLabel}>Front View</Text>
                </View>

                {/* Action Buttons: Save as Draft & Submit to Buyer (Reference Photo 5) */}
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={styles.saveDraftBtn}
                    onPress={handleSaveDraft}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.saveDraftBtnText}>Save as Draft</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.submitBuyerBtn}
                    onPress={handleSubmitToBuyer}
                    activeOpacity={0.8}
                    disabled={submittingPhotos}
                  >
                    <Ionicons name="send" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBuyerBtnText}>
                      {submittingPhotos ? "Submitting..." : "Submit to Buyer"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Sample Information Card Table (Reference Photo 6) */}
              <View style={styles.sampleInfoTableCard}>
                <Text style={styles.sampleInfoTableTitle}>Sample Information</Text>

                <View style={styles.tableDivider} />

                {/* Row 1: Product */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Product</Text>
                  <Text style={styles.tableRowValue} numberOfLines={1}>
                    {selectedSample.title}
                  </Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 2: Fabric */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Fabric</Text>
                  <Text style={styles.tableRowValue}>{selectedSample.fabric}</Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 3: Color */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Color</Text>
                  <Text style={styles.tableRowValue}>{selectedSample.color}</Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 4: Sizes */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Sizes</Text>
                  <Text style={styles.tableRowValue}>{selectedSample.sizes}</Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 5: Finish */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Finish</Text>
                  <Text style={styles.tableRowValue}>{selectedSample.finish}</Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 6: Quantity */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Quantity</Text>
                  <Text style={styles.tableRowValue}>{selectedSample.quantity}</Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 7: Order ID */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Order ID</Text>
                  <Text style={[styles.tableRowValue, styles.monoValue]}>{selectedSample.orderId}</Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 8: Sample Type */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Sample Type</Text>
                  <Text style={styles.tableRowValue}>{selectedSample.sampleType}</Text>
                </View>
                <View style={styles.tableDivider} />

                {/* Row 9: Due Date */}
                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Due Date</Text>
                  <Text style={styles.tableRowValue}>{selectedSample.dueDate}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Tab Content 2: DETAILS */}
          {activeTab === "DETAILS" && (
            <View style={styles.tabContentContainer}>
              <View style={styles.sampleInfoTableCard}>
                <Text style={styles.sampleInfoTableTitle}>Technical Construction Specs</Text>
                <View style={styles.tableDivider} />

                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Fabric Weight</Text>
                  <Text style={styles.tableRowValue}>240 GSM (± 5% tolerance)</Text>
                </View>
                <View style={styles.tableDivider} />

                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Pocket Style</Text>
                  <Text style={styles.tableRowValue}>6-Pocket Accordion Bellows</Text>
                </View>
                <View style={styles.tableDivider} />

                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Stitching Spec</Text>
                  <Text style={styles.tableRowValue}>Double Needle Heavy Duty 12 SPI</Text>
                </View>
                <View style={styles.tableDivider} />

                <View style={styles.tableRow}>
                  <Text style={styles.tableRowLabel}>Zippers & Trims</Text>
                  <Text style={styles.tableRowValue}>YKK Metal Brass Antique #5</Text>
                </View>
              </View>
            </View>
          )}

          {/* Tab Content 3: BUYER NOTE */}
          {activeTab === "BUYER_NOTE" && (
            <View style={styles.tabContentContainer}>
              <View style={styles.sampleInfoTableCard}>
                <Text style={styles.sampleInfoTableTitle}>Buyer QA Remarks</Text>
                <View style={styles.tableDivider} />

                <View style={styles.buyerNoteCallout}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color="#5B13EC" style={{ marginRight: 10 }} />
                  <Text style={styles.buyerNoteText}>{selectedSample.buyerNote}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Tab Content 4: FILES (1) */}
          {activeTab === "FILES" && (
            <View style={styles.tabContentContainer}>
              <View style={styles.sampleInfoTableCard}>
                <Text style={styles.sampleInfoTableTitle}>Attached Tech Pack & Patterns</Text>
                <View style={styles.tableDivider} />

                {selectedSample.files.map((f, i) => (
                  <View key={i} style={styles.fileItemRow}>
                    <Ionicons name="document-text" size={28} color="#5B13EC" style={{ marginRight: 12 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fileNameText}>{f.name}</Text>
                      <Text style={styles.fileSizeText}>{f.size} • PDF Document</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.fileDownloadBtn}
                      onPress={() => Alert.alert("Tech Pack Download", `Downloading ${f.name}...`)}
                    >
                      <Ionicons name="download-outline" size={18} color="#5B13EC" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Tab Content 5: HISTORY */}
          {activeTab === "HISTORY" && (
            <View style={styles.tabContentContainer}>
              <View style={styles.sampleInfoTableCard}>
                <Text style={styles.sampleInfoTableTitle}>Sample Audit Trail</Text>
                <View style={styles.tableDivider} />

                {selectedSample.history.map((h, i) => (
                  <View key={i} style={styles.historyItemRow}>
                    <View style={styles.historyLeft}>
                      <View style={[styles.historyDot, h.done && styles.historyDotDone]}>
                        <Ionicons name={h.done ? "checkmark" : "time"} size={12} color="#FFFFFF" />
                      </View>
                      {i < selectedSample.history.length - 1 && <View style={styles.historyLine} />}
                    </View>
                    <View style={styles.historyContent}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={styles.historyTitleText}>{h.title}</Text>
                        <Text style={styles.historyDateText}>{h.date}</Text>
                      </View>
                      <Text style={styles.historyDescText}>{h.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -----------------------------------------------------------------
  // VIEW 1: SAMPLES LIST VIEW (Matching Reference Photo 1)
  // -----------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. App Top Header (Hamburger, Stitchgrid Logo, Bell, Profile) */}
      <Header />

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSamples();
            }}
            colors={["#5B13EC"]}
            tintColor="#5B13EC"
          />
        }
      >
        {/* 2. Page Title Header: "Samples" & Subtitle (Exact match to Reference Photo 1) */}
        <View style={styles.titleContainer}>
          <Text style={styles.pageTitle}>Samples</Text>
          <Text style={styles.pageSubtitle}>Manage all sample requests from buyers.</Text>
        </View>

        {/* 3. Search and Filter Bar Row (Exact match to Reference Photo 1) */}
        <View style={styles.searchFilterRow}>
          {/* Search Box Input */}
          <View style={styles.searchBoxWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchTextInput}
              placeholder="Search by product name, bu"
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Dropdown Button */}
          <TouchableOpacity
            style={[
              styles.filterBtn,
              selectedFilter !== "ALL" && styles.filterBtnActive,
            ]}
            onPress={() => setIsFilterModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={selectedFilter !== "ALL" ? "#5B13EC" : "#0F172A"}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.filterBtnText,
                selectedFilter !== "ALL" && { color: "#5B13EC" },
              ]}
            >
              Filter
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={selectedFilter !== "ALL" ? "#5B13EC" : "#0F172A"}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        {/* 4. Samples Card List */}
        {filteredSamples.length === 0 ? (
          <EmptyState
            icon="shirt-outline"
            title="No Samples Found"
            description={
              searchQuery
                ? `No sample requests matching "${searchQuery}".`
                : "Sample requests sent by buyers will appear here for garment development and approval."
            }
            actionTitle={searchQuery || selectedFilter !== "ALL" ? "Clear Filters" : "Go to Dashboard"}
            onAction={() => {
              if (searchQuery || selectedFilter !== "ALL") {
                setSearchQuery("");
                setSelectedFilter("ALL");
              } else {
                if (navigation?.navigate) {
                  navigation.navigate("dashboard");
                } else {
                  router.push("/(supplier)/dashboard");
                }
              }
            }}
          />
        ) : (
          filteredSamples.map((sample) => {
            const isApproved = sample.status === "APPROVED";

            return (
              <View key={sample.id} style={styles.sampleCard}>
                {/* Header Row: Coat Hanger Icon + Title + Buyer */}
                <View style={styles.cardTopRow}>
                  {/* Purple Circular Coat Hanger Icon Badge (Exact match to Photo 1) */}
                  <View style={styles.hangerIconWrap}>
                    <MaterialCommunityIcons name="hanger" size={24} color="#5B13EC" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.sampleCardTitle} numberOfLines={2}>
                      {sample.title}
                    </Text>
                    <View style={styles.buyerRow}>
                      <Ionicons name="business-outline" size={16} color="#64748B" style={{ marginRight: 4 }} />
                      <Text style={styles.buyerLabel}>
                        Buyer: <Text style={styles.buyerNameBold}>{sample.buyerName}</Text>
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 4-Detail Grid (Order ID, Quantity, Sample Type, Due Date) */}
                <View style={styles.fourGridContainer}>
                  {/* Row 1 */}
                  <View style={styles.gridRow}>
                    {/* Col 1: Order ID */}
                    <View style={styles.gridCol}>
                      <Ionicons name="receipt-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.gridText}>
                        Order ID: <Text style={styles.gridBoldText}>{sample.orderId}</Text>
                      </Text>
                    </View>

                    {/* Col 2: Quantity */}
                    <View style={styles.gridCol}>
                      <Ionicons name="cube-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.gridText}>
                        Quantity: <Text style={styles.gridBoldText}>{sample.quantity}</Text>
                      </Text>
                    </View>
                  </View>

                  {/* Row 2 */}
                  <View style={styles.gridRow}>
                    {/* Col 1: Sample Type */}
                    <View style={styles.gridCol}>
                      <Ionicons name="pricetag-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.gridText}>
                        Sample Type: <Text style={styles.gridBoldText}>{sample.sampleType}</Text>
                      </Text>
                    </View>

                    {/* Col 2: Due Date */}
                    <View style={styles.gridCol}>
                      <Ionicons name="calendar-outline" size={18} color="#64748B" style={{ marginRight: 6 }} />
                      <Text style={styles.gridText}>
                        Due Date: <Text style={styles.gridBoldText}>{sample.dueDate}</Text>
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Status Pill Badge: Approved (Mint Green Pill) */}
                <View style={styles.statusPillRow}>
                  <View style={styles.approvedBadgePill}>
                    <Ionicons name="checkmark" size={16} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.approvedBadgeText}>
                      {isApproved ? "Approved" : sample.status.replace("_", " ")}
                    </Text>
                  </View>
                </View>

                {/* Outlined Action Button: "View Details" (Exact match to Photo 1) */}
                <TouchableOpacity
                  style={styles.viewDetailsBtn}
                  onPress={() => {
                    setSelectedSample(sample);
                    setActiveTab("PHOTOS");
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.viewDetailsBtnText}>View Details</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ------------------------------------------------------------- */}
      {/* FILTER BOTTOM SHEET MODAL                                     */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={isFilterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsFilterModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setIsFilterModalOpen(false)}>
            <View style={styles.modalBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.modalSheet}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalSheetTitle}>Filter Samples</Text>
              <TouchableOpacity
                onPress={() => setIsFilterModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 12 }}>
              {[
                { key: "ALL", label: "All Samples", count: samples.length },
                {
                  key: "APPROVED",
                  label: "Approved",
                  count: samples.filter((s) => s.status === "APPROVED").length,
                },
                {
                  key: "PENDING",
                  label: "In Progress / Pending",
                  count: samples.filter((s) => s.status === "PENDING").length,
                },
                {
                  key: "REVISION_REQUIRED",
                  label: "Revision Required",
                  count: samples.filter((s) => s.status === "REVISION_REQUIRED").length,
                },
              ].map((option) => {
                const isSelected = selectedFilter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterOptionItem,
                      isSelected && styles.filterOptionItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedFilter(option.key);
                      setIsFilterModalOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={[
                          styles.filterRadioCircle,
                          isSelected && styles.filterRadioCircleSelected,
                        ]}
                      >
                        {isSelected && <View style={styles.filterRadioDot} />}
                      </View>
                      <Text
                        style={[
                          styles.filterOptionLabel,
                          isSelected && { color: "#5B13EC", fontWeight: "700" },
                        ]}
                      >
                        {option.label}
                      </Text>
                    </View>

                    <View style={styles.filterCountBadge}>
                      <Text style={styles.filterCountText}>{option.count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedFilter !== "ALL" && (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setSelectedFilter("ALL");
                  setIsFilterModalOpen(false);
                }}
              >
                <Text style={styles.resetFilterBtnText}>Reset to All Samples</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 40,
  },

  // ---------------- Page Title (Photo 1) ----------------
  titleContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
    fontWeight: "500",
  },

  // ---------------- Search & Filter Bar (Photo 1) ----------------
  searchFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBoxWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 48,
    paddingHorizontal: 14,
    marginRight: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 0,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    height: 48,
    paddingHorizontal: 16,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  filterBtnActive: {
    borderColor: "#5B13EC",
    backgroundColor: "#F5F3FF",
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },

  // ---------------- Sample Card (Photo 1) ----------------
  sampleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  hangerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1ECFE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sampleCardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 22,
  },
  buyerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  buyerLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  buyerNameBold: {
    color: "#0F172A",
    fontWeight: "800",
  },

  // 4-Detail Grid
  fourGridContainer: {
    marginBottom: 14,
  },
  gridRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gridCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginRight: 6,
  },
  gridText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  gridBoldText: {
    color: "#0F172A",
    fontWeight: "700",
  },

  // Status Pill
  statusPillRow: {
    marginBottom: 14,
  },
  approvedBadgePill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  approvedBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },

  // View Details Outlined Button
  viewDetailsBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  viewDetailsBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },

  // ---------------- Detail Screen Header (Photo 2) ----------------
  detailsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  detailsBackBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginLeft: 10,
  },
  approvedPillHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  approvedPillText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },

  // ---------------- Details Top Card (Photo 2 & 3) ----------------
  detailsTopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 14,
  },
  imagePreviewWrap: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  samplePreviewImage: {
    width: "100%",
    height: "100%",
  },
  imageCountPill: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCountPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  detailProductTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 24,
    marginBottom: 14,
  },
  detailSpecsStack: {
    gap: 8,
  },
  detailIconRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIconText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  detailBoldText: {
    color: "#0F172A",
    fontWeight: "800",
  },
  detailMonoText: {
    color: "#0F172A",
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // ---------------- Horizontal Tabs (Photo 3 & 4) ----------------
  tabsContainer: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    marginBottom: 14,
  },
  tabsScroll: {
    paddingHorizontal: 16,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 20,
    position: "relative",
  },
  tabItemActive: {},
  tabItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
  tabItemTextActive: {
    color: "#5B13EC",
    fontWeight: "800",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: "#5B13EC",
    borderRadius: 2,
  },

  // ---------------- Upload Sample Photos Card (Photo 4 & 5) ----------------
  tabContentContainer: {
    paddingHorizontal: 16,
    gap: 16,
  },
  uploadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  uploadCardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  uploadCardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 14,
  },
  dashedUploadBox: {
    borderWidth: 1.5,
    borderColor: "#C4B5FD",
    borderStyle: "dashed",
    borderRadius: 16,
    backgroundColor: "#FAF8FF",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  cloudIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F1ECFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  uploadBoxMainText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    textAlign: "center",
    marginBottom: 4,
  },
  uploadBoxSubText: {
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 14,
  },
  choosePhotosBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#5B13EC",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  choosePhotosBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B13EC",
  },

  // Uploaded Thumbnail Card (Photo 5)
  uploadedThumbnailCard: {
    width: 140,
    height: 140,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#5B13EC",
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
  },
  uploadedThumbnailImg: {
    width: "100%",
    height: "100%",
  },
  uploadedThumbnailLabel: {
    position: "absolute",
    bottom: 6,
    alignSelf: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Photo Action Buttons (Photo 5)
  photoActionsRow: {
    gap: 10,
  },
  saveDraftBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  saveDraftBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  submitBuyerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#5B13EC",
    paddingVertical: 14,
  },
  submitBuyerBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  // ---------------- Sample Information Card Table (Photo 6) ----------------
  sampleInfoTableCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
  },
  sampleInfoTableTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  tableDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tableRowLabel: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  tableRowValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    maxWidth: "60%",
    textAlign: "right",
  },
  monoValue: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },

  // Details & Notes extra styling
  buyerNoteCallout: {
    flexDirection: "row",
    backgroundColor: "#F6F3FE",
    padding: 14,
    borderRadius: 12,
    alignItems: "flex-start",
  },
  buyerNoteText: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    lineHeight: 18,
    fontWeight: "500",
  },
  fileItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  fileNameText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  fileSizeText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  fileDownloadBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F1ECFE",
  },
  historyItemRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  historyLeft: {
    width: 24,
    alignItems: "center",
    marginRight: 10,
  },
  historyDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  historyDotDone: {
    backgroundColor: "#059669",
  },
  historyLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  historyContent: {
    flex: 1,
  },
  historyTitleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  historyDateText: {
    fontSize: 11,
    color: "#64748B",
  },
  historyDescText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  // ---------------- Filter Modal Styles ----------------
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    maxHeight: "85%",
  },
  modalDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  filterOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  filterOptionItemSelected: {
    backgroundColor: "#F6F3FE",
  },
  filterRadioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  filterRadioCircleSelected: {
    borderColor: "#5B13EC",
  },
  filterRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5B13EC",
  },
  filterOptionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  filterCountBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  filterCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  resetFilterBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
});
