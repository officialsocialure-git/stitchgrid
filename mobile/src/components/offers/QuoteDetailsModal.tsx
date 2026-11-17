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
import { Quotation } from "../../types";

interface QuoteDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  quote: Quotation | null;
  rfq: any;
  onAcceptQuote: (quote: Quotation) => void;
  onRejectQuote?: (quote: Quotation) => void;
  onMessageSupplier?: (supplierOrgId: string, supplierName: string) => void;
  isRfqAwarded: boolean;
  accepting?: boolean;
  rejecting?: boolean;
}

export const QuoteDetailsModal: React.FC<QuoteDetailsModalProps> = ({
  visible,
  onClose,
  quote,
  rfq,
  onAcceptQuote,
  onRejectQuote,
  onMessageSupplier,
  isRfqAwarded,
  accepting = false,
  rejecting = false,
}) => {
  if (!quote) return null;

  const isAccepted = quote.status === "ACCEPTED";
  const isRejected = quote.status === "REJECTED";
  const targetQty = rfq?.targetQuantity || 1;
  const unitPrice =
    quote.items?.[0]?.unitPrice ||
    Math.round(Number(quote.totalAmount) / targetQty);
  const supplierName =
    quote.supplierOrg?.name || quote.supplier?.name || "Verified Factory Partner";
  const supplierCity =
    quote.supplierOrg?.city || quote.supplier?.city || "India";

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheetContainer}>
          {/* Header Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Modal Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.quotePillRow}>
                <Text style={styles.quoteCode}>
                  QUOTE #{quote.id.slice(0, 10).toUpperCase()}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    isAccepted
                      ? styles.statusAccepted
                      : isRejected
                      ? styles.statusRejected
                      : styles.statusSubmitted,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      isAccepted
                        ? styles.statusDotAccepted
                        : isRejected
                        ? styles.statusDotRejected
                        : styles.statusDotSubmitted,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      isAccepted
                        ? styles.statusTextAccepted
                        : isRejected
                        ? styles.statusTextRejected
                        : styles.statusTextSubmitted,
                    ]}
                  >
                    {quote.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {supplierName}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.locationText}>{supplierCity}, India</Text>
                <Text style={styles.ratingBadge}>★ 5.0 Verified Mill</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Main Pricing Box */}
            <View style={styles.priceContainer}>
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>UNIT BID PRICE</Text>
                  <View style={styles.unitPriceWrap}>
                    <Text style={styles.unitPriceCurrency}>₹</Text>
                    <Text style={styles.unitPriceValue}>{unitPrice}</Text>
                    <Text style={styles.perPieceText}> / piece</Text>
                  </View>
                </View>
                <View style={styles.totalAmountWrap}>
                  <Text style={styles.priceLabelRight}>TOTAL CONTRACT VALUE</Text>
                  <Text style={styles.totalAmountValue}>
                    ₹{Number(quote.totalAmount).toLocaleString("en-IN")}
                  </Text>
                  <Text style={styles.lakhSubtext}>
                    (₹{(Number(quote.totalAmount) / 100000).toFixed(2)} Lakhs)
                  </Text>
                </View>
              </View>
            </View>

            {/* Contract Specs Grid */}
            <View style={styles.specsSection}>
              <Text style={styles.sectionHeading}>Production & Delivery Specifications</Text>
              <View style={styles.specsGrid}>
                <View style={styles.specBox}>
                  <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                  <Text style={styles.specBoxLabel}>Bulk Turnaround</Text>
                  <Text style={styles.specBoxValue}>{quote.leadTimeDays} Days</Text>
                  <Text style={styles.specBoxSub}>Guaranteed SLA</Text>
                </View>

                <View style={styles.specBox}>
                  <Ionicons name="cube-outline" size={18} color="#D97706" />
                  <Text style={styles.specBoxLabel}>PP Sample Time</Text>
                  <Text style={styles.specBoxValue}>{quote.sampleLeadDays || 7} Days</Text>
                  <Text style={styles.specBoxSub}>Pre-Production</Text>
                </View>

                <View style={styles.specBox}>
                  <Ionicons name="pricetag-outline" size={18} color="#059669" />
                  <Text style={styles.specBoxLabel}>Sample Cost</Text>
                  <Text style={styles.specBoxValue}>
                    {Number(quote.sampleCost || 0) > 0
                      ? `₹${quote.sampleCost}`
                      : "Free Sample"}
                  </Text>
                  <Text style={styles.specBoxSub}>Prototype Cost</Text>
                </View>

                <View style={styles.specBox}>
                  <Ionicons name="layers-outline" size={18} color="#2563EB" />
                  <Text style={styles.specBoxLabel}>Minimum MOQ</Text>
                  <Text style={styles.specBoxValue}>
                    {quote.moq ? `${quote.moq} pcs` : `${targetQty} pcs`}
                  </Text>
                  <Text style={styles.specBoxSub}>Order Minimum</Text>
                </View>
              </View>
            </View>

            {/* Technical & Commercial Terms */}
            <View style={styles.termsSection}>
              <Text style={styles.sectionHeading}>Commercial Terms & Buyer Protection</Text>

              <View style={styles.termsCard}>
                <View style={styles.termRow}>
                  <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                  <View style={styles.termContent}>
                    <Text style={styles.termTitle}>Milestone Escrow Guarantee</Text>
                    <Text style={styles.termBody}>
                      100% of your payment is held safely in escrow. Supplier receives milestone payouts only when you inspect and approve each stage.
                    </Text>
                  </View>
                </View>

                <View style={styles.termDivider} />

                <View style={styles.termRow}>
                  <Ionicons name="card-outline" size={18} color={Colors.textSecondary} />
                  <View style={styles.termContent}>
                    <Text style={styles.termTitle}>Payment Terms</Text>
                    <Text style={styles.termBody}>
                      {quote.terms || "Standard STITCHGRID Protected Escrow (20% Advance, 40% QC, 40% Dispatch)"}
                    </Text>
                  </View>
                </View>

                <View style={styles.termDivider} />

                <View style={styles.termRow}>
                  <Ionicons name="document-text-outline" size={18} color={Colors.textSecondary} />
                  <View style={styles.termContent}>
                    <Text style={styles.termTitle}>Garment Specifications</Text>
                    <Text style={styles.termBody}>
                      {rfq?.fabricSpec || rfq?.title || "Garment Specification complying with buyer tech pack."}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Line Items Breakdown */}
            {quote.items && quote.items.length > 0 && (
              <View style={styles.itemsSection}>
                <Text style={styles.sectionHeading}>Line Items Breakdown</Text>
                <View style={styles.itemsCard}>
                  {quote.items.map((it, idx) => (
                    <View key={it.id || idx} style={styles.itemRow}>
                      <View style={styles.itemLeft}>
                        <Text style={styles.itemDesc} numberOfLines={2}>
                          {it.description || rfq?.title || "Apparel Order Item"}
                        </Text>
                        <Text style={styles.itemQty}>
                          Qty: {Number(it.quantity || targetQty).toLocaleString()} pcs @ ₹{it.unitPrice}/pc
                        </Text>
                      </View>
                      <Text style={styles.itemTotal}>
                        ₹{Number(it.quantity * it.unitPrice || quote.totalAmount).toLocaleString("en-IN")}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Supplier Direct Chat Option */}
            {onMessageSupplier && (
              <TouchableOpacity
                style={styles.chatButton}
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  onMessageSupplier(
                    quote.supplierOrgId || quote.supplier?.id || "",
                    supplierName
                  );
                }}
              >
                <Ionicons name="chatbubbles-outline" size={18} color={Colors.primary} />
                <Text style={styles.chatButtonText}>Chat with {supplierName}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footerContainer}>
            {isAccepted ? (
              <View style={styles.awardedFooterBanner}>
                <Ionicons name="checkmark-circle" size={20} color="#059669" />
                <Text style={styles.awardedFooterText}>
                  This quotation was accepted and PO has been issued.
                </Text>
              </View>
            ) : isRfqAwarded ? (
              <View style={styles.notAwardedFooterBanner}>
                <Ionicons name="alert-circle-outline" size={20} color={Colors.textMuted} />
                <Text style={styles.notAwardedFooterText}>
                  This RFQ has already been awarded to another quotation.
                </Text>
              </View>
            ) : isRejected ? (
              <View style={styles.rejectedFooterBanner}>
                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                <Text style={styles.rejectedFooterText}>
                  This quotation has been rejected.
                </Text>
              </View>
            ) : (
              <View style={styles.actionButtonsRow}>
                {onRejectQuote && (
                  <TouchableOpacity
                    style={styles.rejectButton}
                    activeOpacity={0.85}
                    disabled={rejecting || accepting}
                    onPress={() => onRejectQuote(quote)}
                  >
                    <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                    <Text style={styles.rejectButtonText}>
                      {rejecting ? "Rejecting..." : "Reject Offer"}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.acceptButton,
                    (!onRejectQuote || isRfqAwarded) && { flex: 1 },
                  ]}
                  activeOpacity={0.85}
                  disabled={accepting || rejecting}
                  onPress={() => onAcceptQuote(quote)}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                  <Text style={styles.acceptButtonText}>
                    {accepting ? "Issuing Purchase Order..." : "Accept This Quote & Issue PO"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
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
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  quotePillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  quoteCode: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.primary,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusAccepted: {
    backgroundColor: "#DCFCE7",
  },
  statusRejected: {
    backgroundColor: "#FEE2E2",
  },
  statusSubmitted: {
    backgroundColor: "#FEF3C7",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotAccepted: {
    backgroundColor: "#16A34A",
  },
  statusDotRejected: {
    backgroundColor: "#DC2626",
  },
  statusDotSubmitted: {
    backgroundColor: "#D97706",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  statusTextAccepted: {
    color: "#15803D",
  },
  statusTextRejected: {
    color: "#B91C1C",
  },
  statusTextSubmitted: {
    color: "#B45309",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textHeading,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  ratingBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    marginLeft: 8,
  },
  closeButton: {
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  priceContainer: {
    backgroundColor: "#F7F2FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  unitPriceWrap: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  unitPriceCurrency: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  unitPriceValue: {
    fontSize: 28,
    fontWeight: "900",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  perPieceText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
    marginLeft: 2,
  },
  totalAmountWrap: {
    alignItems: "flex-end",
  },
  priceLabelRight: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  totalAmountValue: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.textHeading,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  lakhSubtext: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
    marginTop: 2,
  },
  specsSection: {
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textHeading,
    marginBottom: 10,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  specBox: {
    width: "48%",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
  },
  specBoxLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
    fontWeight: "600",
  },
  specBoxValue: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  specBoxSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  termsSection: {
    marginBottom: 16,
  },
  termsCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
  },
  termRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  termContent: {
    flex: 1,
  },
  termTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
    marginBottom: 2,
  },
  termBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  termDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 10,
  },
  itemsSection: {
    marginBottom: 16,
  },
  itemsCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  itemLeft: {
    flex: 1,
    marginRight: 10,
  },
  itemDesc: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  itemQty: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Colors.textHeading,
  },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  chatButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surface,
  },
  actionButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rejectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  rejectButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
  },
  awardedFooterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: "#DCFCE7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  awardedFooterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D",
  },
  notAwardedFooterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
  },
  notAwardedFooterText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  rejectedFooterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
  },
  rejectedFooterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#B91C1C",
  },
});
