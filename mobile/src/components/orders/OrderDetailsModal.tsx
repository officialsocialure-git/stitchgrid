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
import { PurchaseOrder } from "../../types";

interface OrderDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  order: PurchaseOrder | null;
  onTrackProduction?: (orderId: string) => void;
  onSecurePayment?: (orderId: string) => void;
  onStatusChange?: (orderId: string, nextStatus: string) => void;
  updating?: boolean;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  visible,
  onClose,
  order,
  onTrackProduction,
  onSecurePayment,
  onStatusChange,
  updating,
}) => {
  if (!order) return null;

  const isDelivered = order.status === "DELIVERED";
  const isCompleted = order.status === "COMPLETED";
  const isQc = order.status === "QC" || order.status === "QC_PENDING";
  const isDispatched = order.status === "DISPATCHED";

  const badgeTheme =
    isCompleted || isDelivered
      ? { bg: Colors.successLight, text: Colors.successText, border: Colors.successBorder }
      : isQc
      ? { bg: Colors.warningLight, text: Colors.warningText, border: Colors.warningBorder }
      : isDispatched
      ? { bg: Colors.infoLight, text: Colors.infoText, border: Colors.infoBorder }
      : { bg: Colors.primaryLight, text: Colors.primary, border: Colors.borderPrimary };

  let progress = 30;
  if (order.status === "PO_CREATED" || order.status === "PENDING_ACCEPTANCE") progress = 10;
  else if (order.status === "ACCEPTED") progress = 20;
  else if (order.status === "SAMPLE_PENDING") progress = 30;
  else if (order.status === "SAMPLE_APPROVED") progress = 45;
  else if (order.status === "PRODUCTION_STARTED" || order.status === "IN_PRODUCTION") progress = 65;
  else if (order.status === "QC_PENDING" || order.status === "QC") progress = 80;
  else if (order.status === "READY_TO_DISPATCH") progress = 90;
  else if (order.status === "DISPATCHED") progress = 95;
  else if (order.status === "DELIVERED" || order.status === "COMPLETED") progress = 100;

  const currentMilestoneTitle =
    order.milestones?.find((m) => m.status === "IN_PROGRESS")?.title ||
    (isCompleted
      ? "Order Fulfilled & Escrow Released"
      : isDelivered
      ? "Delivered at Buyer Warehouse"
      : isDispatched
      ? "In Transit (Tracking Active)"
      : order.status === "READY_TO_DISPATCH"
      ? "Packed & Ready for Carrier"
      : isQc
      ? "Quality Inspection (AQL 2.5)"
      : order.status === "PRODUCTION_STARTED" || order.status === "IN_PRODUCTION"
      ? "Bulk Production Lines Active"
      : order.status === "SAMPLE_APPROVED"
      ? "Pre-Production Sample Approved"
      : order.status === "SAMPLE_PENDING"
      ? "PP Sample in Review"
      : order.status === "ACCEPTED"
      ? "Order Accepted by Factory"
      : "Purchase Order Generated");

  const supplierName = order.supplierOrg?.name || order.supplier?.name || "Verified Mill";
  const supplierCity = order.supplierOrg?.city || order.supplier?.city || "India";
  const buyerName = order.buyerOrg?.name || order.buyer?.name || "Buyer Organization";
  const deliveryFormatted = order.expectedDate
    ? new Date(order.expectedDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Flexible";

  const totalQty = (order.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const formattedAmount = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: order.currency || "INR",
    maximumFractionDigits: 0,
  }).format(Number(order.totalAmount || 0));

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={styles.idRow}>
                <Text style={styles.poNumberText}>{order.poNumber}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: badgeTheme.bg, borderColor: badgeTheme.border },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: badgeTheme.text }]}>
                    {order.status.replace(/_/g, " ")}
                  </Text>
                </View>
              </View>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                Supplier: {supplierName} • {supplierCity}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Core Specs Grid */}
            <View style={styles.specsGrid}>
              <View style={styles.specBox}>
                <Text style={styles.specLabel}>ORDER VALUE</Text>
                <Text style={[styles.specValue, { color: Colors.primary }]}>{formattedAmount}</Text>
              </View>

              <View style={styles.specBox}>
                <Text style={styles.specLabel}>TOTAL QUANTITY</Text>
                <Text style={styles.specValue}>{totalQty.toLocaleString()} pcs</Text>
              </View>

              <View style={[styles.specBox, { flexBasis: "100%" }]}>
                <Text style={styles.specLabel}>TARGET DELIVERY DATE</Text>
                <Text style={styles.specValue}>{deliveryFormatted}</Text>
              </View>
            </View>

            {/* Progress & Milestone Card */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.milestoneTitle} numberOfLines={1}>
                  {currentMilestoneTitle}
                </Text>
                <Text style={styles.progressPercentText}>{progress}% Completed</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
            </View>

            {/* Buyer Action Banner */}
            {order.status === "SAMPLE_PENDING" && (
              <View style={styles.actionBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionBannerTitle}>Pre-Production Sample Ready</Text>
                  <Text style={styles.actionBannerDesc}>
                    Supplier has dispatched the PP sample for inspection. Approve sample to initiate bulk manufacturing.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onStatusChange?.(order.id, "SAMPLE_APPROVED")}
                  disabled={updating}
                  style={styles.actionBannerBtn}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBannerBtnText}>Approve Sample</Text>
                </TouchableOpacity>
              </View>
            )}

            {order.status === "DISPATCHED" && (
              <View style={styles.actionBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionBannerTitle}>Shipment in Transit</Text>
                  <Text style={styles.actionBannerDesc}>
                    Goods have been dispatched from factory. Confirm once warehouse delivery is received.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onStatusChange?.(order.id, "DELIVERED")}
                  disabled={updating}
                  style={styles.actionBannerBtn}
                >
                  <Ionicons name="cube-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBannerBtnText}>Confirm Delivery</Text>
                </TouchableOpacity>
              </View>
            )}

            {order.status === "DELIVERED" && (
              <View style={styles.actionBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionBannerTitle}>Delivery Received</Text>
                  <Text style={styles.actionBannerDesc}>
                    Inspect goods and release final milestone payment to complete contract.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onStatusChange?.(order.id, "COMPLETED")}
                  disabled={updating}
                  style={styles.actionBannerBtn}
                >
                  <Ionicons name="wallet-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBannerBtnText}>Release & Complete</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Milestone Breakdown List */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>PRODUCTION MILESTONE SCHEDULE</Text>
              <View style={styles.milestonesList}>
                {[
                  { title: "Order Confirmation & Tech Pack Lock", pct: 10, isDone: progress >= 20 },
                  { title: "PP Sample Submission & Approval", pct: 30, isDone: progress >= 45 },
                  { title: "Bulk Cutting & Sewing Lines Active", pct: 65, isDone: progress >= 65 },
                  { title: "Quality Inspection (AQL 2.5 Standard)", pct: 80, isDone: progress >= 80 },
                  { title: "Final Packaging & Dispatch Shipment", pct: 95, isDone: progress >= 95 },
                  { title: "Warehouse Delivery & Final Settlement", pct: 100, isDone: progress >= 100 },
                ].map((m, idx) => (
                  <View key={idx} style={styles.milestoneRow}>
                    <View style={[styles.milestoneCheck, m.isDone && styles.milestoneCheckDone]}>
                      <Ionicons
                        name={m.isDone ? "checkmark" : "time-outline"}
                        size={12}
                        color={m.isDone ? "#FFF" : Colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.milestoneName, m.isDone && styles.milestoneNameDone]}>
                      {m.title}
                    </Text>
                    <Text style={styles.milestonePct}>{m.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Items Ordered List */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>ORDER ITEMS ({order.items?.length || 0})</Text>
              <View style={styles.itemsList}>
                {(order.items || []).map((it, idx) => (
                  <View key={it.id || idx} style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{it.description || "Apparel Production Lot"}</Text>
                      <Text style={styles.itemMeta}>
                        Quantity: {Number(it.quantity || 0).toLocaleString()} pcs
                      </Text>
                    </View>
                    {Boolean(it.unitPrice) && (
                      <Text style={styles.itemPrice}>
                        ₹{Number(it.unitPrice).toFixed(0)} / pc
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              onPress={() => {
                onClose();
                onTrackProduction?.(order.id);
              }}
              style={styles.footerTrackBtn}
            >
              <Ionicons name="construct-outline" size={15} color={Colors.primary} />
              <Text style={styles.footerTrackBtnText}>Track Milestones</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                onClose();
                onSecurePayment?.(order.id);
              }}
              style={styles.footerPayBtn}
            >
              <Ionicons name="card-outline" size={15} color="#FFF" />
              <Text style={styles.footerPayBtnText}>Secure Payment</Text>
            </TouchableOpacity>
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
  idRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  poNumberText: {
    fontSize: 16,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
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
  progressCard: {
    backgroundColor: "#f7f2ff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ede5fc",
    padding: 14,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  milestoneTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
    flex: 1,
    marginRight: 8,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 7,
    backgroundColor: "#e9ddff",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  actionBanner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
    padding: 14,
    gap: 10,
  },
  actionBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  actionBannerDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  actionBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
  },
  actionBannerBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  milestonesList: {
    gap: 8,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  milestoneCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneCheckDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  milestoneName: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  milestoneNameDone: {
    color: Colors.textHeading,
    fontWeight: "600",
  },
  milestonePct: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  itemsList: {
    gap: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  footerTrackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    backgroundColor: Colors.primaryLight,
  },
  footerTrackBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  footerPayBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  footerPayBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFF",
  },
});

