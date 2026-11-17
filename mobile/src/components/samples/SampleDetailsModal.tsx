import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal as RNModal,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";

interface SampleDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  sample: any;
  onApprove: (sampleId: string) => Promise<void>;
  onAskChanges: (sampleId: string, feedback: string) => Promise<void>;
}

export const SampleDetailsModal: React.FC<SampleDetailsModalProps> = ({
  visible,
  onClose,
  sample,
  onApprove,
  onAskChanges,
}) => {
  const [activeTab, setActiveTab] = useState<"details" | "notes" | "files" | "history">("details");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!sample) return null;

  const po = sample.purchaseOrder || {};
  const supplier = po.supplier || {};
  const item = po.items?.[0] || {};

  // Extract clean name matching web
  let sampleName = item.name || "Apparel Sample";
  if (sampleName.includes("(Cut, Sew")) {
    sampleName = sampleName.split("(")[0].trim();
  }
  if (!sampleName || sampleName === "Apparel Sample" || sampleName === "Apparel Production Lot") {
    if (sample.notes?.includes("Hoodie")) sampleName = "Heavyweight Hoodie";
    else if (sample.notes?.includes("T-Shirt") || sample.notes?.includes("Polo")) sampleName = "Polo T-Shirt";
    else if (sample.notes?.includes("Jogger")) sampleName = "Cotton Joggers";
    else sampleName = "Apparel Production Sample";
  }

  const orderId = po.poNumber
    ? po.poNumber.replace("SG-", "")
    : `PO-${sample.purchaseOrderId?.slice(-4) || "6479"}`;
  const supplierName = supplier.name || "Verified Mill Partner";

  // Derive sample type
  const rawNotes = sample.notes || "";
  let sampleType = sample.parsedMeta?.sampleType || "Final Sample";
  if (rawNotes.toLowerCase().includes("first")) sampleType = "First Sample";
  else if (rawNotes.toLowerCase().includes("color") || rawNotes.toLowerCase().includes("swatch")) sampleType = "Color Sample";
  else if (rawNotes.toLowerCase().includes("lab dip")) sampleType = "Lab Dip";
  else if (rawNotes.toLowerCase().includes("size set")) sampleType = "Size Set";
  else if (rawNotes.toLowerCase().includes("pp") || rawNotes.toLowerCase().includes("pre-production")) sampleType = "Final Sample";

  const quantity = "5 pcs";
  const sentDate = sample.createdAt
    ? new Date(sample.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Recently";

  // Status mapping
  const status = sample.status;
  const isApproved = status === "APPROVED";
  const isChangesNeeded = status === "REVISION_REQUIRED" || status === "REJECTED";
  const isChecking = status === "IN_PROGRESS";

  const statusLabel = isApproved
    ? "Approved"
    : isChangesNeeded
    ? "Changes Needed"
    : isChecking
    ? "Checking"
    : "New Sample";

  // Real photos uploaded by supplier or parsed from meta
  const rawPhotos: { url: string; label: string }[] =
    Array.isArray(sample.photos) && sample.photos.length > 0
      ? sample.photos
      : sample.parsedMeta?.photos && Array.isArray(sample.parsedMeta.photos) && sample.parsedMeta.photos.length > 0
      ? sample.parsedMeta.photos
      : [];

  const photosList = rawPhotos.map((p) => ({
    ...p,
    url: typeof p.url === "string" ? p.url.replace(/^https?:\/\/localhost:\d+/, "") : p.url,
  }));

  const currentPhoto = photosList[activeImageIndex] || photosList[0] || null;

  const handleNextImage = () => {
    if (photosList.length === 0) return;
    setActiveImageIndex((prev) => (prev + 1) % photosList.length);
  };

  const handlePrevImage = () => {
    if (photosList.length === 0) return;
    setActiveImageIndex((prev) => (prev - 1 + photosList.length) % photosList.length);
  };

  const handleApproveClick = async () => {
    try {
      setSubmitting(true);
      await onApprove(sample.id);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangesSubmit = async () => {
    if (!feedbackText.trim()) return;
    try {
      setSubmitting(true);
      await onAskChanges(sample.id, feedbackText.trim());
      setIsFeedbackOpen(false);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.sheetTitle}>Sample Details</Text>
              <Text style={styles.sheetSubtitle}>Inspection specifications & photos</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Top Carousel Card */}
            <View style={styles.carouselContainer}>
              {currentPhoto ? (
                <View style={styles.imageWrap}>
                  <Image source={{ uri: currentPhoto.url }} style={styles.mainImage} resizeMode="cover" />
                  <View style={styles.photoTag}>
                    <Ionicons name="camera-outline" size={13} color="#FFF" />
                    <Text style={styles.photoTagText}>{currentPhoto.label || "Sample Photo"}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="shirt-outline" size={44} color="#A78BFA" />
                  <Text style={styles.placeholderTitle}>Prototype Sample</Text>
                  <Text style={styles.placeholderSub}>High-res photos pending from supplier</Text>
                </View>
              )}

              {/* Prev / Next Controls */}
              {photosList.length > 1 && (
                <>
                  <TouchableOpacity onPress={handlePrevImage} style={styles.carouselPrev}>
                    <Ionicons name="chevron-back" size={18} color="#1E293B" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleNextImage} style={styles.carouselNext}>
                    <Ionicons name="chevron-forward" size={18} color="#1E293B" />
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Thumbnails strip */}
            {photosList.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailsRow}>
                {photosList.map((photo, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setActiveImageIndex(idx)}
                    style={[
                      styles.thumbBtn,
                      activeImageIndex === idx && styles.thumbBtnActive,
                    ]}
                  >
                    <Image source={{ uri: photo.url }} style={styles.thumbImage} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Sample Header & Status Banner */}
            <View style={styles.infoSection}>
              <View style={styles.titleRow}>
                <Text style={styles.sampleNameText}>{sampleName}</Text>
                <View
                  style={[
                    styles.statusPill,
                    isApproved
                      ? styles.statusApproved
                      : isChangesNeeded
                      ? styles.statusChanges
                      : isChecking
                      ? styles.statusChecking
                      : styles.statusNew,
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
                      styles.statusPillText,
                      isApproved
                        ? styles.statusTextApproved
                        : isChangesNeeded
                        ? styles.statusTextChanges
                        : isChecking
                        ? styles.statusTextChecking
                        : styles.statusTextNew,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>

              {/* Metadata rows */}
              <View style={styles.metaList}>
                <View style={styles.metaRow}>
                  <Ionicons name="business-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.metaLabel}>Supplier: </Text>
                  <Text style={styles.metaValue}>{supplierName}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="receipt-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.metaLabel}>Order ID: </Text>
                  <Text style={styles.metaValueMono}>{orderId}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="pricetag-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.metaLabel}>Sample Type: </Text>
                  <Text style={styles.metaValue}>{sampleType}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="layers-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.metaLabel}>Quantity: </Text>
                  <Text style={styles.metaValue}>{quantity}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.metaLabel}>Sent on: </Text>
                  <Text style={styles.metaValue}>{sentDate}</Text>
                </View>
              </View>
            </View>

            {/* Tab navigation pills matching Web */}
            <View style={styles.tabsRow}>
              {[
                { key: "details", label: "Details" },
                { key: "notes", label: "Supplier Note" },
                { key: "files", label: "Files" },
                { key: "history", label: "History" },
              ].map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key as any)}
                  style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
                >
                  <Text style={[styles.tabBtnText, activeTab === tab.key && styles.tabBtnTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tab 1: Details */}
            {activeTab === "details" && (
              <View style={styles.tabContent}>
                <View style={styles.specsCard}>
                  <View style={styles.specItem}>
                    <Text style={styles.specItemLabel}>Fabric:</Text>
                    <Text style={styles.specItemValue}>100% Combed Cotton Single Jersey</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specItemLabel}>Color:</Text>
                    <Text style={styles.specItemValue}>Beige</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specItemLabel}>Sizes:</Text>
                    <Text style={styles.specItemValue}>S, M, L, XL</Text>
                  </View>
                  <View style={styles.specItem}>
                    <Text style={styles.specItemLabel}>Finish:</Text>
                    <Text style={styles.specItemValue}>Bio-wash & Pre-shrunk</Text>
                  </View>
                </View>

                {/* Tech Pack Box */}
                <View style={styles.techPackCard}>
                  <View style={styles.techPackLeft}>
                    <Ionicons name="document-text" size={24} color="#5B13EC" />
                    <View style={styles.techPackText}>
                      <Text style={styles.techPackTitle} numberOfLines={1}>
                        {sampleName.replace(/\s+/g, "_")}_TechPack.pdf
                      </Text>
                      <Text style={styles.techPackSize}>2.4 MB • Complete specs</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert("Download", `Downloading Tech Pack for ${sampleName}...`)}
                    style={styles.downloadIconBtn}
                  >
                    <Ionicons name="download-outline" size={20} color="#5B13EC" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Tab 2: Supplier Note */}
            {activeTab === "notes" && (
              <View style={styles.tabContent}>
                <Text style={styles.notesSectionLabel}>MANUFACTURER & FACTORY NOTES</Text>
                <View style={styles.notesBox}>
                  <Text style={styles.notesBoxText}>
                    {sample.description || sample.notes || "No additional notes provided by the manufacturer."}
                  </Text>
                </View>

                {sample.buyerFeedback ? (
                  <View style={styles.buyerFeedbackBox}>
                    <Text style={styles.buyerFeedbackTitle}>BUYER CHANGES REQUESTED:</Text>
                    <Text style={styles.buyerFeedbackText}>{sample.buyerFeedback}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Tab 3: Files */}
            {activeTab === "files" && (
              <View style={styles.tabContent}>
                <TouchableOpacity
                  onPress={() => Alert.alert("Download", "Downloading TechPack_Specification_v2.pdf...")}
                  style={styles.fileRow}
                >
                  <Ionicons name="document-text-outline" size={22} color="#5B13EC" />
                  <View style={styles.fileText}>
                    <Text style={styles.fileTitle}>TechPack_Specification_v2.pdf</Text>
                    <Text style={styles.fileSub}>2.4 MB • Complete measurements</Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => Alert.alert("Download", "Downloading Factory_QC_Inspection_Sheet.pdf...")}
                  style={styles.fileRow}
                >
                  <Ionicons name="checkbox-outline" size={22} color="#5B13EC" />
                  <View style={styles.fileText}>
                    <Text style={styles.fileTitle}>Factory_QC_Inspection_Sheet.pdf</Text>
                    <Text style={styles.fileSub}>1.1 MB • Factory signoff before dispatch</Text>
                  </View>
                  <Ionicons name="download-outline" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Tab 4: History */}
            {activeTab === "history" && (
              <View style={styles.tabContent}>
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineBadge, { backgroundColor: "#DCFCE7" }]}>
                    <Text style={[styles.timelineBadgeText, { color: "#15803D" }]}>1</Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Sample Requested by Buyer</Text>
                    <Text style={styles.timelineSub}>{sentDate}</Text>
                  </View>
                </View>

                <View style={styles.timelineItem}>
                  <View style={[styles.timelineBadge, { backgroundColor: "#F3E8FF" }]}>
                    <Text style={[styles.timelineBadgeText, { color: "#5B13EC" }]}>2</Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>Produced & Dispatched by {supplierName}</Text>
                    <Text style={styles.timelineSub}>Photos uploaded and submitted for buyer signoff</Text>
                  </View>
                </View>

                <View style={styles.timelineItem}>
                  <View
                    style={[
                      styles.timelineBadge,
                      {
                        backgroundColor: isApproved
                          ? "#DCFCE7"
                          : isChangesNeeded
                          ? "#FEE2E2"
                          : "#DBEAFE",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timelineBadgeText,
                        {
                          color: isApproved
                            ? "#15803D"
                            : isChangesNeeded
                            ? "#B91C1C"
                            : "#1D4ED8",
                        },
                      ]}
                    >
                      3
                    </Text>
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTitle}>
                      {isApproved
                        ? "Approved by Buyer"
                        : isChangesNeeded
                        ? "Changes Requested by Buyer"
                        : "Awaiting Buyer Review"}
                    </Text>
                    <Text style={styles.timelineSub}>
                      {isApproved
                        ? "Bulk cutting unlocked"
                        : isChangesNeeded
                        ? "Revision in progress"
                        : "Under inspection"}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Ask for Changes Inline Feedback Card */}
            {isFeedbackOpen && (
              <View style={styles.feedbackCard}>
                <View style={styles.feedbackHeader}>
                  <Ionicons name="sync" size={16} color="#DC2626" />
                  <Text style={styles.feedbackTitle}>Specify Required Changes for Manufacturer</Text>
                </View>
                <TextInput
                  style={styles.feedbackInput}
                  multiline
                  numberOfLines={3}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder="e.g. Neck rib width should be adjusted by 0.5 cm, tone down beige shade slightly..."
                  placeholderTextColor={Colors.textMuted}
                />
                <View style={styles.feedbackActions}>
                  <TouchableOpacity
                    onPress={() => setIsFeedbackOpen(false)}
                    style={styles.feedbackCancelBtn}
                  >
                    <Text style={styles.feedbackCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleChangesSubmit}
                    disabled={submitting || !feedbackText.trim()}
                    style={[
                      styles.feedbackSubmitBtn,
                      (!feedbackText.trim() || submitting) && { opacity: 0.5 },
                    ]}
                  >
                    <Text style={styles.feedbackSubmitText}>
                      {submitting ? "Sending..." : "Submit Revision Request"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerLabel}>YOUR ACTION</Text>
            <View style={styles.footerButtons}>
              <TouchableOpacity
                onPress={handleApproveClick}
                disabled={isApproved || submitting}
                activeOpacity={0.85}
                style={[
                  styles.approveBtn,
                  isApproved && styles.approveBtnDone,
                  submitting && { opacity: 0.6 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                    <Text style={styles.approveBtnText}>
                      {isApproved ? "Approved" : "Approve Sample"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {!isApproved && (
                <TouchableOpacity
                  onPress={() => setIsFeedbackOpen(!isFeedbackOpen)}
                  activeOpacity={0.85}
                  style={styles.askChangesBtn}
                >
                  <Ionicons name="sync" size={16} color={Colors.textHeading} />
                  <Text style={styles.askChangesBtnText}>Ask for Changes</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 24,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollArea: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  carouselContainer: {
    position: "relative",
    width: "100%",
    height: 200,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    marginBottom: 10,
  },
  imageWrap: {
    width: "100%",
    height: "100%",
  },
  mainImage: {
    width: "100%",
    height: "100%",
  },
  photoTag: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1E1B4B",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#E0E7FF",
    marginTop: 8,
  },
  placeholderSub: {
    fontSize: 11,
    color: "#A5B4FC",
    marginTop: 2,
  },
  carouselPrev: {
    position: "absolute",
    left: 8,
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  carouselNext: {
    position: "absolute",
    right: 8,
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailsRow: {
    flexDirection: "row",
    marginBottom: 14,
  },
  thumbBtn: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    overflow: "hidden",
    marginRight: 8,
  },
  thumbBtnActive: {
    borderColor: "#5B13EC",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  infoSection: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sampleNameText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textHeading,
    marginRight: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  statusApproved: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  statusChanges: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  statusChecking: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  statusNew: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
  },
  statusPillText: {
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
  metaList: {
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  metaValueMono: {
    fontSize: 12,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.textHeading,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: 12,
  },
  tabBtn: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
  },
  tabBtnActive: {
    backgroundColor: "#5B13EC",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  tabBtnTextActive: {
    color: "#FFF",
  },
  tabContent: {
    marginBottom: 14,
  },
  specsCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
    marginBottom: 10,
  },
  specItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  specItemLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  specItemValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  techPackCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F7F2FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    padding: 12,
  },
  techPackLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginRight: 10,
  },
  techPackText: {
    flex: 1,
  },
  techPackTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  techPackSize: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  downloadIconBtn: {
    padding: 6,
  },
  notesSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  notesBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
    marginBottom: 10,
  },
  notesBoxText: {
    fontSize: 12,
    color: Colors.textHeading,
    lineHeight: 18,
  },
  buyerFeedbackBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 12,
  },
  buyerFeedbackTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#B91C1C",
    marginBottom: 4,
  },
  buyerFeedbackText: {
    fontSize: 12,
    color: "#7F1D1D",
    lineHeight: 18,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
    marginBottom: 8,
  },
  fileText: {
    flex: 1,
    marginHorizontal: 10,
  },
  fileTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  fileSub: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  timelineBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  timelineSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  feedbackCard: {
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 12,
    marginTop: 8,
  },
  feedbackHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#991B1B",
  },
  feedbackInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    color: Colors.textHeading,
    minHeight: 60,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  feedbackActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  feedbackCancelBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  feedbackCancelText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  feedbackSubmitBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  feedbackSubmitText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFF",
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  footerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  footerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#5B13EC",
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  approveBtnDone: {
    backgroundColor: "#059669",
  },
  approveBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
  },
  askChangesBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: 12,
  },
  askChangesBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
});
