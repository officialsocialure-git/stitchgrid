import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Button } from "../../src/components/common/Button";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { useRealtimeSync } from "../../src/hooks/useRealtimeSync";
import { useAuth } from "../../src/hooks/useAuth";
import { PurchaseOrder } from "../../src/types";

interface TransactionItem {
  id: string;
  po: string;
  supplier: string;
  amount: string;
  rawAmount: number;
  type: string;
  status: "HELD_IN_ESCROW" | "RELEASED" | "COMPLETED" | "REFUNDED" | "PENDING";
  date: string;
}

export default function PaymentsScreen() {
  const router = useRouter();
  const { isSupplier, user } = useAuth();

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalEscrow, setTotalEscrow] = useState(0);
  const [pendingReleases, setPendingReleases] = useState(0);
  const [settledTotal, setSettledTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Deposit modal state
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Bank details modal for Supplier
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      const data = await marketplaceService.listPayments();
      if (data && data.length > 0) {
        let total = 0;
        let pending = 0;
        let settled = 0;

        const mapped: TransactionItem[] = data.map((t: any) => {
          const amt = Number(t.amount) || 0;
          total += amt;
          if (t.status === "RELEASED" || t.status === "COMPLETED") {
            settled += amt;
          } else {
            pending += amt;
          }

          return {
            id: t.providerRef || (t.id ? t.id.slice(0, 10).toUpperCase() : "TX-NODE"),
            po: t.purchaseOrder?.poNumber || (t.orderId ? `PO-${t.orderId.slice(0, 6)}` : "PO Order"),
            supplier: t.purchaseOrder?.supplier?.name || t.purchaseOrder?.supplierOrg?.name || "Manufacturing Supplier",
            amount: `₹${amt.toLocaleString("en-IN")}`,
            rawAmount: amt,
            type: "Milestone Secure Payment Deposit",
            status: t.status || "HELD_IN_ESCROW",
            date: t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-IN") : "Today",
          };
        });

        setTransactions(mapped);
        setTotalEscrow(total);
        setPendingReleases(pending);
        setSettledTotal(settled);
      } else {
        setTransactions([]);
        setTotalEscrow(0);
        setPendingReleases(0);
        setSettledTotal(0);
      }
    } catch (err) {
      console.warn("Failed to load payments:", err);
      setTransactions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useRealtimeSync({
    topics: ["payment:created", "payment:updated", "order:updated"],
    onSync: loadPayments,
    pollIntervalMs: 25000,
  });

  const openDepositModal = async () => {
    setDepositError(null);
    setDepositAmount("");
    try {
      const fetchedOrders = await marketplaceService.listOrders();
      setOrders(fetchedOrders || []);
      if (fetchedOrders && fetchedOrders.length > 0) {
        setSelectedOrderId(fetchedOrders[0].id);
      }
      setIsDepositModalOpen(true);
    } catch (e: any) {
      Alert.alert("Error", "Could not fetch active purchase orders. Please try again.");
    }
  };

  const handleDepositEscrow = async () => {
    const amt = parseFloat(depositAmount) || 0;
    if (amt <= 0) {
      setDepositError("Please enter a valid deposit amount.");
      return;
    }
    if (!selectedOrderId) {
      setDepositError("Please select an active purchase order to fund.");
      return;
    }

    try {
      setDepositing(true);
      setDepositError(null);
      await marketplaceService.createPayment(selectedOrderId, amt);
      setIsDepositModalOpen(false);
      setDepositAmount("");
      Alert.alert(
        "Deposit Successful",
        `₹${amt.toLocaleString("en-IN")} deposited securely into Escrow. Funds are protected until milestone inspection.`
      );
      await loadPayments();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to record payment deposit.";
      setDepositError(msg);
    } finally {
      setDepositing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={isSupplier ? "Secure Payments & Milestone Releases" : "Payments"}
        subtitle="Secure garment payments backed by milestone-based releases"
        showBack
      />

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPayments();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
            {/* Title & Vault Badge Row */}
            <View style={styles.titleRow}>
              <View style={styles.badgeWrap}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
                <Text style={styles.badgeText}>B2B VAULT PROTECTED</Text>
              </View>

              {!isSupplier ? (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={openDepositModal}
                  activeOpacity={0.8}
                >
                  <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Add Secure Payment</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.outlineActionBtn}
                  onPress={() => setIsBankModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="business-outline" size={14} color={Colors.primary} />
                  <Text style={styles.outlineActionBtnText}>Settlement Accounts</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3 Stats Cards - Matching Web */}
            <View style={styles.statsContainer}>
              {/* Stat 1: Total Secure Balance */}
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  {isSupplier ? "TOTAL VAULT VOLUME" : "TOTAL SECURE BALANCE"}
                </Text>
                <Text style={[styles.statValue, { color: Colors.primary }]}>
                  ₹{(totalEscrow / 100000).toFixed(2)}L
                </Text>
                <Text style={styles.statDesc}>Secured in nodal bank account</Text>
              </View>

              {/* Stat 2: Pending Releases */}
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  {isSupplier ? "RECEIVABLE IN ESCROW" : "PENDING RELEASES"}
                </Text>
                <Text style={[styles.statValue, { color: Colors.warningText }]}>
                  ₹{(pendingReleases / 100000).toFixed(2)}L
                </Text>
                <Text style={styles.statDesc}>Awaiting inspection & milestone pass</Text>
              </View>

              {/* Stat 3: Settled Total */}
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  {isSupplier ? "SETTLED TO BANK" : "SETTLED TOTAL"}
                </Text>
                <Text style={[styles.statValue, { color: Colors.successText }]}>
                  ₹{(settledTotal / 100000).toFixed(2)}L
                </Text>
                <Text style={styles.statDesc}>
                  {isSupplier ? "Disbursed to verified bank account" : "Disbursed to manufacturers"}
                </Text>
              </View>
            </View>

            <View style={styles.ledgerHeaderRow}>
              <Text style={styles.ledgerHeaderTitle}>Payment Ledger</Text>
              <Text style={styles.ledgerCount}>{transactions.length} Records</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isSettled = item.status === "RELEASED" || item.status === "COMPLETED";

          return (
            <View style={styles.transCard}>
              <View style={styles.transTopRow}>
                <View style={styles.transRefGroup}>
                  <Text style={styles.transIdText}>{item.id}</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      isSettled ? styles.statusSuccess : styles.statusWarning,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isSettled ? styles.statusSuccessText : styles.statusWarningText,
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.amountText}>{item.amount}</Text>
              </View>

              <View style={styles.transMidRow}>
                <Text style={styles.transPoText}>{item.po}</Text>
                <Text style={styles.transDateText}>{item.date}</Text>
              </View>

              <View style={styles.transDivider} />

              <View style={styles.transBottomRow}>
                <Ionicons name="business-outline" size={14} color={Colors.textSecondary} />
                <Text style={styles.transSupplierText} numberOfLines={1}>
                  {item.supplier} • {item.type}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No payment transactions found"
              description="Transactions will appear here when purchase order milestones are funded and released."
              icon="wallet-outline"
            />
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Loading ledger transactions...</Text>
            </View>
          )
        }
      />

      {/* Add Secure Payment Modal for Buyer */}
      <Modal
        visible={isDepositModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDepositModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Add Secure Payment</Text>
                <Text style={styles.modalSubtitle}>
                  Transfer funds into the STITCHGRID nodal vault for your active purchase order.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsDepositModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {depositError && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{depositError}</Text>
                </View>
              )}

              {/* Order Selection */}
              <Text style={styles.fieldLabel}>SELECT PURCHASE ORDER *</Text>
              {orders.length === 0 ? (
                <Text style={styles.noOrderWarning}>
                  No active purchase orders found. Issue an order first.
                </Text>
              ) : (
                <View style={styles.orderPickerContainer}>
                  {orders.slice(0, 3).map((o) => (
                    <TouchableOpacity
                      key={o.id}
                      style={[
                        styles.orderChoice,
                        selectedOrderId === o.id && styles.orderChoiceActive,
                      ]}
                      onPress={() => setSelectedOrderId(o.id)}
                    >
                      <Ionicons
                        name={selectedOrderId === o.id ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={selectedOrderId === o.id ? Colors.primary : Colors.textMuted}
                      />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text
                          style={[
                            styles.orderChoicePo,
                            selectedOrderId === o.id && styles.orderChoiceTextActive,
                          ]}
                        >
                          {o.poNumber || `PO-${o.id.slice(0, 6)}`}
                        </Text>
                        <Text style={styles.orderChoiceMeta}>
                          ₹{(o.totalAmount || 0).toLocaleString()} • {o.styleName || "Garment Order"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Amount Input */}
              <Text style={styles.fieldLabel}>DEPOSIT AMOUNT (INR) *</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                placeholder="e.g. 50000"
                placeholderTextColor={Colors.textMuted}
                value={depositAmount}
                onChangeText={setDepositAmount}
              />

              {/* Escrow Guarantee Callout */}
              <View style={styles.guaranteeBox}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.guaranteeTitle}>Secure Payment Protection:</Text>
                  <Text style={styles.guaranteeDesc}>
                    Funds cannot be withdrawn by the manufacturer until cutting, stitching, and AQL 2.5
                    quality certificates are signed off.
                  </Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsDepositModalOpen(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, depositing && { opacity: 0.7 }]}
                  onPress={handleDepositEscrow}
                  disabled={depositing || orders.length === 0}
                >
                  {depositing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="lock-closed" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmBtnText}>Confirm Secure Payment</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settlement Accounts Modal for Supplier */}
      <Modal
        visible={isBankModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsBankModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Bank Settlement Account</Text>
                <Text style={styles.modalSubtitle}>
                  Verified commercial bank account for milestone disbursement payouts.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsBankModalOpen(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.bankStatusCard}>
                <View style={styles.bankBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.successText} />
                  <Text style={styles.bankBadgeText}>VERIFIED ESCROW RECIPIENT</Text>
                </View>

                <Text style={styles.bankName}>HDFC Bank Limited</Text>
                <Text style={styles.bankAcc}>Account: •••• •••• 4092</Text>
                <Text style={styles.bankMeta}>IFSC: HDFC0001234 • Current Commercial</Text>
              </View>

              <View style={styles.guaranteeBox}>
                <Ionicons name="information-circle" size={18} color={Colors.primary} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.guaranteeTitle}>Disbursement Schedule</Text>
                  <Text style={styles.guaranteeDesc}>
                    Milestone funds are automatically transferred within 24 hours of Buyer quality sign-off
                    (AQL 2.5 acceptance).
                  </Text>
                </View>
              </View>

              <Button
                title="Close"
                variant="outline"
                onPress={() => setIsBankModalOpen(false)}
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
  },
  headerContainer: {
    paddingTop: 16,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  outlineActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    gap: 6,
  },
  outlineActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  statsContainer: {
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
    marginBottom: 3,
  },
  statDesc: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  ledgerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  ledgerHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  ledgerCount: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  transCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  transTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  transRefGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transIdText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.successBorder,
  },
  statusWarning: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningBorder,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  statusSuccessText: {
    color: Colors.successText,
  },
  statusWarningText: {
    color: Colors.warningText,
  },
  amountText: {
    fontSize: 15,
    fontWeight: "900",
    color: Colors.textHeading,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  transMidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  transPoText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  transDateText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  transDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 10,
  },
  transBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  transSupplierText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    flex: 1,
  },
  loadingContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    lineHeight: 16,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 12,
  },
  noOrderWarning: {
    fontSize: 12,
    color: Colors.warningText,
    backgroundColor: Colors.warningLight,
    padding: 10,
    borderRadius: 8,
  },
  orderPickerContainer: {
    gap: 8,
  },
  orderChoice: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  orderChoiceActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  orderChoicePo: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  orderChoiceTextActive: {
    color: Colors.primary,
  },
  orderChoiceMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  amountInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textHeading,
    backgroundColor: Colors.surface,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  guaranteeBox: {
    flexDirection: "row",
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 2,
  },
  guaranteeDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  errorText: {
    fontSize: 12,
    color: Colors.dangerText,
    flex: 1,
  },
  bankStatusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
  },
  bankBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    gap: 4,
    marginBottom: 10,
  },
  bankBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.successText,
    letterSpacing: 0.4,
  },
  bankName: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  bankAcc: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginTop: 3,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  bankMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
});
