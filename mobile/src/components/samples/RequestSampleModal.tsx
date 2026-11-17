import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal as RNModal,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { marketplaceService } from "../../services/marketplace.service";
import { PurchaseOrder } from "../../types";

interface RequestSampleModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RequestSampleModal: React.FC<RequestSampleModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [sampleType, setSampleType] = useState("Final Sample");
  const [quantity, setQuantity] = useState("5 pcs");
  const [sampleName, setSampleName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isOrderPickerOpen, setIsOrderPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      loadOrders();
    }
  }, [visible]);

  const loadOrders = async () => {
    try {
      setLoadingOrders(true);
      const data = await marketplaceService.listOrders();
      const validOrders = Array.isArray(data) ? data : [];
      setOrders(validOrders);
      if (validOrders.length > 0) {
        setSelectedOrderId(validOrders[0].id);
        const firstItem = validOrders[0].items?.[0]?.description || "Garment Prototype Sample";
        setSampleName(firstItem);
      }
    } catch (err: any) {
      console.warn("Failed to load orders for sample request:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  const handleSelectOrder = (order: PurchaseOrder) => {
    setSelectedOrderId(order.id);
    const itemDesc = order.items?.[0]?.description || "Sample Garment";
    setSampleName(itemDesc);
    setIsOrderPickerOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedOrderId) {
      Alert.alert("Missing Order", "Please select a purchase order for this sample request.");
      return;
    }
    if (!sampleName.trim()) {
      Alert.alert("Missing Name", "Please enter a sample garment name or description.");
      return;
    }

    try {
      setSubmitting(true);
      const formattedNotes = `${sampleType} (${quantity}) - ${sampleName.trim()}. ${notes.trim()}`;
      await marketplaceService.createSample(selectedOrderId, formattedNotes, sampleType);

      Alert.alert(
        "🎉 Sample Requested!",
        "Physical sample request has been created and sent to the manufacturer. They will prepare and courier the sample lot."
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || err.message || "Failed to create sample request.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentOrder = orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

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

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.sheetTitle}>Request Physical Sample</Text>
              <Text style={styles.sheetSubtitle}>
                Notify factory to produce & courier prototype sample
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Order Selector */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                PURCHASE ORDER <Text style={styles.requiredStar}>*</Text>
              </Text>

              {loadingOrders ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="small" color="#5B13EC" />
                  <Text style={styles.loadingText}>Loading active purchase orders...</Text>
                </View>
              ) : orders.length === 0 ? (
                <View style={styles.emptyOrdersBox}>
                  <Text style={styles.emptyOrdersText}>
                    No active purchase orders found. Samples must be linked to an approved purchase order.
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setIsOrderPickerOpen(true)}
                  style={styles.orderPickerBtn}
                  activeOpacity={0.8}
                >
                  <View style={styles.orderPickerLeft}>
                    <Text style={styles.orderPoNumber}>
                      {currentOrder?.poNumber || `PO-${currentOrder?.id?.slice(0, 8)}`}
                    </Text>
                    <Text style={styles.orderSupplierText} numberOfLines={1}>
                      {currentOrder?.supplier?.name || "Verified Supplier"} • ₹{Number(currentOrder?.totalAmount || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Sample Name / Garment Item */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                SAMPLE NAME / GARMENT ITEM <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={sampleName}
                onChangeText={setSampleName}
                placeholder="e.g. Heavyweight Hoodie, Polo T-Shirt, Joggers"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            {/* Sample Type Picker Chips */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                SAMPLE TYPE <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.chipsWrap}>
                {[
                  { value: "Final Sample", label: "Final Sample (PP)" },
                  { value: "First Sample", label: "First Sample (Proto)" },
                  { value: "Color Sample", label: "Color / Lab Dip" },
                  { value: "Size Set", label: "Size Set (S-XXL)" },
                ].map((typeItem) => (
                  <TouchableOpacity
                    key={typeItem.value}
                    onPress={() => setSampleType(typeItem.value)}
                    style={[
                      styles.chipBtn,
                      sampleType === typeItem.value && styles.chipBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipBtnText,
                        sampleType === typeItem.value && styles.chipBtnTextActive,
                      ]}
                    >
                      {typeItem.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Quantity */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                SAMPLE QUANTITY <Text style={styles.requiredStar}>*</Text>
              </Text>
              <View style={styles.chipsWrap}>
                {["1 pc", "2 pcs", "3 pcs", "5 pcs", "10 pcs"].map((qty) => (
                  <TouchableOpacity
                    key={qty}
                    onPress={() => setQuantity(qty)}
                    style={[
                      styles.qtyChip,
                      quantity === qty && styles.qtyChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.qtyChipText,
                        quantity === qty && styles.qtyChipTextActive,
                      ]}
                    >
                      {qty}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Additional Notes */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ADDITIONAL MEASUREMENTS & NOTES</Text>
              <TextInput
                style={styles.textArea}
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
                placeholder="Include custom fabric wash specs, neck rib width, tolerance instructions..."
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || orders.length === 0}
              style={[styles.submitBtn, (submitting || orders.length === 0) && { opacity: 0.5 }]}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color="#FFF" />
                  <Text style={styles.submitBtnText}>Submit Sample Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Nested Order Selector Sheet */}
      <RNModal
        visible={isOrderPickerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsOrderPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setIsOrderPickerOpen(false)}
          />
          <View style={styles.pickerSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Purchase Order</Text>
              <TouchableOpacity onPress={() => setIsOrderPickerOpen(false)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }}>
              {orders.map((o) => {
                const isSelected = o.id === selectedOrderId;
                return (
                  <TouchableOpacity
                    key={o.id}
                    onPress={() => handleSelectOrder(o)}
                    style={[styles.orderOption, isSelected && styles.orderOptionActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.orderOptionPo, isSelected && { color: "#5B13EC" }]}>
                        {o.poNumber || `PO-${o.id.slice(0, 8)}`}
                      </Text>
                      <Text style={styles.orderOptionSub}>
                        {o.supplier?.name || "Verified Supplier"} • {o.items?.[0]?.description || "Garment"}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color="#5B13EC" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </RNModal>
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
    maxHeight: "90%",
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
    maxHeight: 460,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  requiredStar: {
    color: "#DC2626",
  },
  textInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    fontSize: 13,
    color: Colors.textHeading,
  },
  textArea: {
    minHeight: 70,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingTop: 10,
    fontSize: 13,
    color: Colors.textHeading,
    textAlignVertical: "top",
  },
  orderPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  orderPickerLeft: {
    flex: 1,
  },
  orderPoNumber: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  orderSupplierText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyOrdersBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  emptyOrdersText: {
    fontSize: 12,
    color: "#92400E",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipBtnActive: {
    borderColor: "#5B13EC",
    backgroundColor: "#F3E8FF",
  },
  chipBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  chipBtnTextActive: {
    color: "#5B13EC",
    fontWeight: "700",
  },
  qtyChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  qtyChipActive: {
    borderColor: "#5B13EC",
    backgroundColor: "#F3E8FF",
  },
  qtyChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  qtyChipTextActive: {
    color: "#5B13EC",
    fontWeight: "800",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#5B13EC",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 11,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFF",
  },
  pickerSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: "60%",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  orderOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 8,
  },
  orderOptionActive: {
    backgroundColor: "#F3E8FF",
    borderColor: "#E9D5FF",
  },
  orderOptionPo: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  orderOptionSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
