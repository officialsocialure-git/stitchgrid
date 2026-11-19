import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal as RNModal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { marketplaceService } from "../../services/marketplace.service";

interface PostRfqModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  buyerOrgId: string;
}

export const PostRfqModal: React.FC<PostRfqModalProps> = ({
  visible,
  onClose,
  onSuccess,
  buyerOrgId,
}) => {
  // Section 1: Product Details
  const [title, setTitle] = useState("5,000 Oversized T-Shirts");
  const [productCategory, setProductCategory] = useState("Garment (Apparel)");
  const [productType, setProductType] = useState("T-Shirt");
  const [fabricSpec, setFabricSpec] = useState("240 GSM, 100% Cotton Single Jersey");
  const [colorways, setColorways] = useState<string[]>(["Black", "White", "Navy", "Grey"]);
  const [newColorInput, setNewColorInput] = useState("");
  const [isAddingColor, setIsAddingColor] = useState(false);

  // Section 2: Quantity & Specifications
  const [totalQuantity, setTotalQuantity] = useState("5000");
  const [unit, setUnit] = useState("Pieces");
  const [sizes, setSizes] = useState({
    S: 500,
    M: 1250,
    L: 1500,
    XL: 1000,
    XXL: 750,
  });
  const [requirementDetails, setRequirementDetails] = useState(
    "Sample: Yes (5 pcs) | Quality: AQL 2.5 | Packaging: Individual polybag, size sticker, 20 pcs per carton | Additional: Custom woven label, brand tag, and export quality stitching."
  );

  // Section 3: Delivery & Target
  const [targetDeliveryDate, setTargetDeliveryDate] = useState("2026-05-12");
  const [deliveryLocation, setDeliveryLocation] = useState("Noida, Uttar Pradesh – 201301");
  const [quoteDeadline, setQuoteDeadline] = useState("2026-11-08");

  // Accordion active sections
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    product: true,
    quantity: true,
    delivery: true,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"PUBLISH" | "DRAFT">("PUBLISH");

  const toggleSection = (sec: string) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const sizeSum = useMemo(() => {
    return Object.values(sizes).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  }, [sizes]);

  const handleSizeChange = (key: keyof typeof sizes, val: string) => {
    const num = parseInt(val, 10) || 0;
    setSizes((prev) => ({ ...prev, [key]: num }));
  };

  const handleRemoveColor = (col: string) => {
    setColorways((prev) => prev.filter((c) => c !== col));
  };

  const handleAddColor = () => {
    if (newColorInput.trim() && !colorways.includes(newColorInput.trim())) {
      setColorways((prev) => [...prev, newColorInput.trim()]);
      setNewColorInput("");
      setIsAddingColor(false);
    }
  };

  const handleSubmit = async (mode: "PUBLISH" | "DRAFT") => {
    if (!buyerOrgId) {
      Alert.alert("Account Required", "Please ensure you are signed in as a verified Buyer.");
      return;
    }

    if (title.trim().length < 3) {
      Alert.alert("Missing Field", "Please enter an RFQ title with at least 3 characters.");
      return;
    }
    const quantityValue = Number(totalQuantity);
    if (!Number.isInteger(quantityValue) || quantityValue <= 0) {
      Alert.alert("Invalid Quantity", "Total quantity must be a whole number greater than zero.");
      return;
    }

    if (mode === "PUBLISH") {
      if (!fabricSpec.trim()) {
        Alert.alert("Missing Field", "Please specify the Fabric / Material specification.");
        return;
      }
      if (!requirementDetails.trim() || requirementDetails.length > 500) {
        Alert.alert("Requirement Details Required", "Enter requirement details and packaging information (maximum 500 characters).");
        return;
      }
      if (!targetDeliveryDate || Number.isNaN(new Date(targetDeliveryDate).getTime())) {
        Alert.alert("Missing Delivery Date", "Please select a valid target delivery date.");
        return;
      }
      if (!deliveryLocation.trim()) {
        Alert.alert("Missing Delivery Location", "Please enter the delivery location.");
        return;
      }
      if (!quoteDeadline || Number.isNaN(new Date(quoteDeadline).getTime())) {
        Alert.alert("Missing Quote Deadline", "Please select a valid quote submission deadline.");
        return;
      }
    }

    try {
      setSubmitting(true);
      setSubmitMode(mode);

      const sizesStr = `S:${sizes.S}, M:${sizes.M}, L:${sizes.L}, XL:${sizes.XL}, XXL:${sizes.XXL}`;
      const colorwaysStr = colorways.join(", ");
      const combinedDescription = [
        requirementDetails.trim(),
        `Sizes: ${sizesStr}`,
        `Colorways: ${colorwaysStr}`,
        `Delivery Location: ${deliveryLocation}`,
        `Quote Deadline: ${quoteDeadline}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const parsedTargetDate = targetDeliveryDate ? new Date(targetDeliveryDate) : null;
      const targetDateIso = parsedTargetDate && !Number.isNaN(parsedTargetDate.getTime())
        ? parsedTargetDate.toISOString()
        : undefined;

      const qty = Number(totalQuantity);

      await marketplaceService.createRfq({
        buyerOrgId,
        title: title.trim(),
        garmentType: productType || productCategory,
        fabricSpec: fabricSpec.trim(),
        targetQuantity: qty,
        targetDate: targetDateIso,
        status: mode === "DRAFT" ? "DRAFT" : "OPEN",
        description: combinedDescription,
        items: [
          {
            name: `${productType} - ${title.trim()}`,
            description: `Fabric: ${fabricSpec}. Colors: ${colorwaysStr}. Sizes: ${sizesStr}. Location: ${deliveryLocation}`,
            quantity: qty,
            unit: unit.toLowerCase(),
          },
        ],
      });

      Alert.alert(
        "Request Created",
        mode === "DRAFT"
          ? "Your request has been saved as a draft."
          : "Your RFQ has been broadcast to verified textile mills!",
        [
          {
            text: "OK",
            onPress: () => {
              onClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || err.message || "Failed to create RFQ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalCard}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.modalTitle}>Post New Request</Text>
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>Buyer RFQ</Text>
                </View>
              </View>
              <Text style={styles.modalSubtitle}>
                Broadcast specs to verified manufacturers to receive competitive quotes.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Form Body ScrollView */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ---------------- SECTION 1: PRODUCT DETAILS ---------------- */}
            <View style={styles.sectionCard}>
              <TouchableOpacity
                onPress={() => toggleSection("product")}
                style={styles.sectionHeader}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionNumberCircle}>
                    <Text style={styles.sectionNumberText}>1</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Product Details</Text>
                </View>
                <Ionicons
                  name={openSections.product ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>

              {openSections.product && (
                <View style={styles.sectionBody}>
                  <Text style={styles.inputLabel}>RFQ Title / Requirement *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. 5,000 Oversized T-Shirts"
                    placeholderTextColor={Colors.textMuted}
                  />

                  <View style={styles.rowTwoCols}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Category</Text>
                      <TextInput
                        style={styles.textInput}
                        value={productCategory}
                        onChangeText={setProductCategory}
                        placeholder="Garment (Apparel)"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Product Type</Text>
                      <TextInput
                        style={styles.textInput}
                        value={productType}
                        onChangeText={setProductType}
                        placeholder="T-Shirt, Hoodie..."
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Fabric & Material Spec *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={fabricSpec}
                    onChangeText={setFabricSpec}
                    placeholder="e.g. 240 GSM, 100% Cotton Single Jersey"
                    placeholderTextColor={Colors.textMuted}
                  />

                  <Text style={styles.inputLabel}>Colorways</Text>
                  <View style={styles.tagWrap}>
                    {colorways.map((c) => (
                      <View key={c} style={styles.colorTag}>
                        <Text style={styles.colorTagText}>{c}</Text>
                        <TouchableOpacity onPress={() => handleRemoveColor(c)} style={styles.colorTagClose}>
                          <Ionicons name="close" size={13} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {isAddingColor ? (
                      <View style={styles.addColorInputWrap}>
                        <TextInput
                          style={styles.addColorInput}
                          value={newColorInput}
                          onChangeText={setNewColorInput}
                          placeholder="Color"
                          placeholderTextColor={Colors.textMuted}
                          autoFocus
                          onSubmitEditing={handleAddColor}
                        />
                        <TouchableOpacity onPress={handleAddColor} style={styles.addColorOk}>
                          <Ionicons name="checkmark" size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => setIsAddingColor(true)}
                        style={styles.addColorBtn}
                      >
                        <Ionicons name="add" size={14} color={Colors.primary} />
                        <Text style={styles.addColorText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            {/* ---------------- SECTION 2: QUANTITY & SPECS ---------------- */}
            <View style={styles.sectionCard}>
              <TouchableOpacity
                onPress={() => toggleSection("quantity")}
                style={styles.sectionHeader}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionNumberCircle}>
                    <Text style={styles.sectionNumberText}>2</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Quantity & Specifications</Text>
                </View>
                <Ionicons
                  name={openSections.quantity ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>

              {openSections.quantity && (
                <View style={styles.sectionBody}>
                  <View style={styles.rowTwoCols}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Total Quantity *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={totalQuantity}
                        onChangeText={setTotalQuantity}
                        keyboardType="numeric"
                        placeholder="5000"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Unit *</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {["Pieces", "Meters", "Kg", "Sets"].map((option) => (
                          <TouchableOpacity
                            key={option}
                            onPress={() => setUnit(option)}
                            style={{
                              paddingHorizontal: 9,
                              paddingVertical: 9,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: unit === option ? Colors.primary : Colors.border,
                              backgroundColor: unit === option ? Colors.primaryLight : "#FFFFFF",
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "700", color: unit === option ? Colors.primary : Colors.textSecondary }}>{option}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>

                  <View style={styles.sizeSectionHeader}>
                    <Text style={styles.inputLabel}>Size-wise Quantity (Optional)</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[styles.sizeSumText, sizeSum === Number(totalQuantity) && styles.sizeSumMatch]}>
                        Total: {sizeSum.toLocaleString()} / {Number(totalQuantity || 0).toLocaleString()}
                      </Text>
                      {sizeSum > 0 && sizeSum !== Number(totalQuantity) && (
                        <TouchableOpacity onPress={() => setTotalQuantity(String(sizeSum))}>
                          <Text style={{ color: Colors.primary, fontSize: 10, fontWeight: "800", marginTop: 3 }}>Set Total to {sizeSum.toLocaleString()}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  <View style={styles.sizeGrid}>
                    {(["S", "M", "L", "XL", "XXL"] as const).map((sz) => (
                      <View key={sz} style={styles.sizeCol}>
                        <Text style={styles.sizeColLabel}>{sz}</Text>
                        <TextInput
                          style={styles.sizeInput}
                          value={String(sizes[sz] || 0)}
                          onChangeText={(v) => handleSizeChange(sz, v)}
                          keyboardType="numeric"
                        />
                      </View>
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Requirement Details & Packaging</Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={requirementDetails}
                    onChangeText={setRequirementDetails}
                    maxLength={500}
                    multiline
                    numberOfLines={3}
                    placeholder="Quality AQL, Polybag packaging, tags..."
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              )}
            </View>

            {/* ---------------- SECTION 3: DELIVERY & TARGET ---------------- */}
            <View style={styles.sectionCard}>
              <TouchableOpacity
                onPress={() => toggleSection("delivery")}
                style={styles.sectionHeader}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <View style={styles.sectionNumberCircle}>
                    <Text style={styles.sectionNumberText}>3</Text>
                  </View>
                  <Text style={styles.sectionTitle}>Delivery & Publish</Text>
                </View>
                <Ionicons
                  name={openSections.delivery ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>

              {openSections.delivery && (
                <View style={styles.sectionBody}>
                  <View style={styles.rowTwoCols}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Target Delivery Date *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={targetDeliveryDate}
                        onChangeText={setTargetDeliveryDate}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Delivery Location *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={deliveryLocation}
                        onChangeText={setDeliveryLocation}
                        placeholder="City, State, PIN"
                        placeholderTextColor={Colors.textMuted}
                      />
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Quote Submission Deadline *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={quoteDeadline}
                    onChangeText={setQuoteDeadline}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              )}
            </View>
          </ScrollView>

          {/* Modal Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              onPress={() => handleSubmit("DRAFT")}
              disabled={submitting}
              style={styles.draftBtn}
            >
              {submitting && submitMode === "DRAFT" ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Text style={styles.draftBtnText}>Save Draft</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleSubmit("PUBLISH")}
              disabled={submitting}
              style={styles.publishBtn}
            >
              {submitting && submitMode === "PUBLISH" ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane-outline" size={16} color="#FFF" />
                  <Text style={styles.publishBtnText}>Publish Request</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
    maxHeight: "92%",
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  badgePill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
    marginLeft: 8,
  },
  formScroll: {
    maxHeight: 520,
  },
  formContent: {
    padding: 16,
    gap: 12,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionNumberCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionNumberText: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textBody,
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
  },
  textArea: {
    height: 70,
    textAlignVertical: "top",
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  colorTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
  },
  colorTagText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
    marginRight: 6,
  },
  colorTagClose: {
    padding: 1,
  },
  addColorBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  addColorText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  addColorInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  addColorInput: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    color: Colors.text,
    width: 80,
  },
  addColorOk: {
    backgroundColor: Colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sizeSumText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  sizeSumMatch: {
    color: Colors.successText,
    fontWeight: "700",
  },
  sizeGrid: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  sizeCol: {
    flex: 1,
    alignItems: "center",
  },
  sizeColLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  sizeInput: {
    width: "100%",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: Colors.text,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  draftBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  draftBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textBody,
  },
  publishBtn: {
    flex: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  publishBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});

