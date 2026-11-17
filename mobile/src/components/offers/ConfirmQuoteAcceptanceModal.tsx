import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal as RNModal,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { Quotation } from "../../types";

interface ConfirmQuoteAcceptanceModalProps {
  visible: boolean;
  onClose: () => void;
  quote: Quotation | null;
  rfq: any;
  onConfirm: () => void;
  loading: boolean;
}

export const ConfirmQuoteAcceptanceModal: React.FC<ConfirmQuoteAcceptanceModalProps> = ({
  visible,
  onClose,
  quote,
  rfq,
  onConfirm,
  loading,
}) => {
  if (!quote) return null;

  const targetQty = rfq?.targetQuantity || 1;
  const unitPrice =
    quote.items?.[0]?.unitPrice ||
    Math.round(Number(quote.totalAmount) / targetQty);
  const supplierName =
    quote.supplierOrg?.name || quote.supplier?.name || "Verified Supplier";
  const supplierCity =
    quote.supplierOrg?.city || quote.supplier?.city || "India";

  return (
    <RNModal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => {
        if (!loading) onClose();
      }}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => {
            if (!loading) onClose();
          }}
        />

        <View style={styles.dialogCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="document-text" size={24} color={Colors.primary} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.dialogTitle}>Confirm Quote Acceptance</Text>
              <Text style={styles.dialogDescription}>
                Award contract to this manufacturer and generate an official Purchase Order.
              </Text>
            </View>
          </View>

          {/* Supplier & Specs Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.supplierRow}>
              <View>
                <Text style={styles.labelMuted}>SELECTED MANUFACTURER</Text>
                <Text style={styles.supplierName}>{supplierName}</Text>
                <Text style={styles.supplierCity}>{supplierCity}, India</Text>
              </View>
              <View style={styles.unitBadge}>
                <Text style={styles.unitBadgeText}>₹{unitPrice} / pc</Text>
              </View>
            </View>

            {/* 2x2 Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Order Quantity</Text>
                <Text style={styles.metricValue}>
                  {Number(targetQty).toLocaleString()} pcs
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Total Contract Value</Text>
                <Text style={styles.metricValuePrimary}>
                  ₹{Number(quote.totalAmount).toLocaleString("en-IN")}
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Bulk Production</Text>
                <Text style={styles.metricValue}>
                  {quote.leadTimeDays} Days
                </Text>
              </View>

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Pre-Prod Sample SLA</Text>
                <Text style={styles.metricValue}>
                  {quote.sampleLeadDays || 7} Days
                </Text>
              </View>
            </View>

            {/* Payment Terms */}
            <View style={styles.termsRow}>
              <Text style={styles.metricLabel}>Payment Terms</Text>
              <Text style={styles.termsValue} numberOfLines={2}>
                {quote.terms || "Secure Milestone Escrow Protected"}
              </Text>
            </View>
          </View>

          {/* Amber Notice - Separate Acceptance Workflow */}
          <View style={styles.alertNotice}>
            <Ionicons name="information-circle" size={20} color="#B45309" style={styles.alertIcon} />
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Separate Acceptance Workflow:</Text>
              <Text style={styles.alertBody}>
                Confirming will generate Purchase Order in status <Text style={styles.boldText}>Pending Acceptance</Text>.
                Supplier <Text style={styles.boldText}>{supplierName}</Text> will be immediately notified and must click <Text style={styles.boldText}>&quot;Accept Order&quot;</Text> in their dashboard before production begins.
              </Text>
            </View>
          </View>

          {/* Dialog Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, loading && styles.btnDisabled]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.confirmBtnText}>Issuing PO...</Text>
                </View>
              ) : (
                <View style={styles.btnContentRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Text style={styles.confirmBtnText}>Confirm & Issue PO</Text>
                </View>
              )}
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
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    paddingHorizontal: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  dialogDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  summaryCard: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    marginBottom: 14,
  },
  supplierRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  labelMuted: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
    marginTop: 2,
  },
  supplierCity: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  unitBadge: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  unitBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  metricItem: {
    width: "50%",
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textHeading,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  metricValuePrimary: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  termsRow: {
    paddingTop: 10,
  },
  termsValue: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textHeading,
    marginTop: 2,
  },
  alertNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  alertIcon: {
    marginTop: 2,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400E",
    marginBottom: 2,
  },
  alertBody: {
    fontSize: 11,
    color: "#B45309",
    lineHeight: 16,
  },
  boldText: {
    fontWeight: "700",
    color: "#78350F",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  cancelBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnContentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
  },
});
