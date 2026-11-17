import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal as RNModal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Rfq } from "../../types";

interface RfqDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  rfq: Rfq | null;
  onOpenInvite?: (rfq: Rfq) => void;
  onDelete?: (rfqId: string, title?: string) => void;
  onCompareQuotes?: (rfqId: string) => void;
}

export const RfqDetailsModal: React.FC<RfqDetailsModalProps> = ({
  visible,
  onClose,
  rfq,
  onOpenInvite,
  onDelete,
  onCompareQuotes,
}) => {
  if (!rfq) return null;

  const quoteCount = rfq.quotations?.length || 0;
  const isAwarded = rfq.status === "AWARDED";
  const isDraft = rfq.status === "DRAFT";
  const isOpenStatus = rfq.status === "OPEN";

  const displayStatus = isAwarded
    ? "Awarded"
    : isOpenStatus && quoteCount > 0
    ? "Quotes Received"
    : isOpenStatus
    ? "Open"
    : isDraft
    ? "Draft"
    : rfq.status;

  const badgeTheme =
    isAwarded || displayStatus === "Quotes Received"
      ? { bg: Colors.successLight, text: Colors.successText, border: Colors.successBorder }
      : displayStatus === "Open"
      ? { bg: Colors.warningLight, text: Colors.warningText, border: Colors.warningBorder }
      : { bg: Colors.surfaceSubtle, text: Colors.textSecondary, border: Colors.border };

  const formattedDelivery = rfq.targetDate
    ? new Date(rfq.targetDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Flexible";

  const createdFormatted = rfq.createdAt
    ? new Date(rfq.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Recent";

  const rfqIdDisplay = `#RFQ-${(rfq.id || "0000").slice(-4).toUpperCase()}`;

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {rfq.title || "RFQ Details"}
              </Text>
              <Text style={styles.modalSubtitle}>
                Request ID: {rfqIdDisplay} • Created {createdFormatted}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Status & Category Bar */}
            <View style={styles.statusCategoryBar}>
              <View style={styles.idStatusRow}>
                <View style={styles.idTag}>
                  <Text style={styles.idTagText}>{rfqIdDisplay}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border }]}>
                  <Text style={[styles.statusBadgeText, { color: badgeTheme.text }]}>
                    {displayStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.categoryText}>
                Category: <Text style={{ color: Colors.primary, fontWeight: "700" }}>{rfq.garmentType || "Garment"}</Text>
              </Text>
            </View>

            {/* Core Specs Grid */}
            <View style={styles.specsGrid}>
              <View style={styles.specBox}>
                <Text style={styles.specLabel}>TARGET QUANTITY</Text>
                <Text style={styles.specValue}>
                  {rfq.targetQuantity?.toLocaleString()} {rfq.items?.[0]?.unit || "pcs"}
                </Text>
              </View>

              <View style={styles.specBox}>
                <Text style={styles.specLabel}>TARGET DELIVERY</Text>
                <Text style={styles.specValue}>{formattedDelivery}</Text>
              </View>

              <View style={[styles.specBox, { flexBasis: "100%" }]}>
                <Text style={styles.specLabel}>TARGET UNIT PRICE</Text>
                <Text style={[styles.specValue, { color: Colors.primary }]}>
                  {rfq.targetPrice ? `₹${Number(rfq.targetPrice).toFixed(0)} / pc` : "Competitive Bidding"}
                </Text>
              </View>
            </View>

            {/* Fabric & Material Spec */}
            {Boolean(rfq.fabricSpec) && (
              <View style={styles.infoCard}>
                <Text style={styles.infoSectionTitle}>FABRIC & MATERIAL SPEC</Text>
                <Text style={styles.infoSectionBody}>{rfq.fabricSpec}</Text>
              </View>
            )}

            {/* Detailed Requirements Description */}
            {Boolean(rfq.description) && (
              <View style={styles.infoCard}>
                <Text style={styles.infoSectionTitle}>PRODUCTION SPECIFICATIONS & NOTES</Text>
                <Text style={styles.infoSectionBody}>{rfq.description}</Text>
              </View>
            )}

            {/* Received Quotes Section */}
            {Boolean(rfq.quotations && rfq.quotations.length > 0) && (
              <View style={styles.quotesSection}>
                <View style={styles.quotesSectionHeader}>
                  <Text style={styles.quotesSectionTitle}>
                    RECEIVED SUPPLIER QUOTES ({rfq.quotations?.length})
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      onClose();
                      onCompareQuotes?.(rfq.id);
                    }}
                    style={styles.compareAllQuotesLink}
                  >
                    <Text style={styles.compareAllQuotesText}>Compare All</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.quotesList}>
                  {rfq.quotations?.map((q) => (
                    <View key={q.id} style={styles.quoteCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.quoteSupplierName}>
                          {q.supplier?.name || "Verified Mill"}
                        </Text>
                        <Text style={styles.quoteSupplierMeta}>
                          Lead time: {q.leadTimeDays || 15} days • {q.supplier?.city || "India"}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={styles.quoteAmount}>
                          ₹{Number(q.totalAmount || 0).toLocaleString("en-IN")}
                        </Text>
                        <Text
                          style={[
                            styles.quoteStatus,
                            q.status === "ACCEPTED" ? { color: Colors.successText } : { color: Colors.textSecondary },
                          ]}
                        >
                          {q.status === "ACCEPTED" ? "✓ Accepted" : "Ready to Review"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            <View style={styles.footerLeftButtons}>
              <TouchableOpacity onPress={onClose} style={styles.closeActionBtn}>
                <Text style={styles.closeActionText}>Close</Text>
              </TouchableOpacity>

              {Boolean(onDelete) && (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onDelete?.(rfq.id, rfq.title);
                  }}
                  style={styles.deleteActionBtn}
                >
                  <Ionicons name="trash-outline" size={15} color={Colors.danger} />
                  <Text style={styles.deleteActionText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.footerRightButtons}>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onOpenInvite?.(rfq);
                }}
                style={styles.inviteActionBtn}
              >
                <Ionicons name="person-add-outline" size={15} color={Colors.primary} />
                <Text style={styles.inviteActionText}>Invite</Text>
              </TouchableOpacity>

              {quoteCount > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    onCompareQuotes?.(rfq.id);
                  }}
                  style={styles.compareActionBtn}
                >
                  <Ionicons name="git-compare-outline" size={15} color="#FFF" />
                  <Text style={styles.compareActionText}>Compare Quotes</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalContent: {
    padding: 16,
    gap: 12,
  },
  statusCategoryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  idStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  idTag: {
    backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  idTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  categoryText: {
    fontSize: 12,
    color: Colors.textBody,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  specBox: {
    flex: 1,
    minWidth: 140,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  specValue: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoSectionBody: {
    fontSize: 13,
    color: Colors.textBody,
    lineHeight: 19,
  },
  quotesSection: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quotesSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  quotesSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  compareAllQuotesLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compareAllQuotesText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  quotesList: {
    gap: 8,
  },
  quoteCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quoteSupplierName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  quoteSupplierMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quoteAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
  },
  quoteStatus: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  footerLeftButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
  },
  closeActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textBody,
  },
  deleteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  deleteActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.danger,
  },
  footerRightButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inviteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    backgroundColor: Colors.primaryLight,
  },
  inviteActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  compareActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  compareActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
});

