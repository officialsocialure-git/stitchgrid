import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Header } from "../common/Header";
import { Button } from "../common/Button";
import { Colors } from "../../constants/colors";
import { useAuth } from "../../hooks/useAuth";
import { marketplaceService } from "../../services/marketplace.service";

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
}) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textMuted}
      keyboardType={keyboardType}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      style={[styles.input, multiline && styles.multilineInput]}
    />
  </View>
);

export default function OrganizationSettingsScreen() {
  const router = useRouter();
  const { activeMembership, refreshUser, isSupplier } = useAuth();
  const organization = activeMembership?.organization;

  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [productionCapacity, setProductionCapacity] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryInput, setCategoryInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization) return;
    setName(organization.name || "");
    setTaxId(organization.taxId || "");
    setCity(organization.city || "");
    setAddress(organization.address || "");
    const profile = organization.supplierProfile;
    setDescription(profile?.description || "");
    setYearsInBusiness(profile?.yearsInBusiness != null ? String(profile.yearsInBusiness) : "");
    setProductionCapacity(profile?.productionCapacity != null ? String(profile.productionCapacity) : "");
    setCategories(
      Array.isArray(profile?.categories)
        ? profile.categories.map((item: any) => typeof item === "string" ? item : item.category).filter(Boolean)
        : []
    );
  }, [organization]);

  const addCategory = () => {
    const value = categoryInput.trim();
    if (!value) return;
    if (categories.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setCategoryInput("");
      return;
    }
    setCategories((current) => [...current, value]);
    setCategoryInput("");
  };

  const handleSave = async () => {
    const organizationId = activeMembership?.organizationId;
    if (!organizationId) {
      Alert.alert("Organization Required", "Your active organization could not be identified. Please sign in again.");
      return;
    }
    if (name.trim().length < 2) {
      Alert.alert("Invalid Company Name", "Enter a company name with at least 2 characters.");
      return;
    }
    const years = yearsInBusiness.trim() ? Number(yearsInBusiness) : undefined;
    const capacity = productionCapacity.trim() ? Number(productionCapacity) : undefined;
    if (years !== undefined && (!Number.isInteger(years) || years < 0)) {
      Alert.alert("Invalid Experience", "Years in business must be a whole number greater than or equal to zero.");
      return;
    }
    if (capacity !== undefined && (!Number.isInteger(capacity) || capacity < 0)) {
      Alert.alert("Invalid Capacity", "Monthly production capacity must be a whole number greater than or equal to zero.");
      return;
    }

    try {
      setSaving(true);
      await marketplaceService.updateOrganizationProfile({
        organizationId,
        name: name.trim(),
        taxId: taxId.trim(),
        city: city.trim(),
        address: address.trim(),
        description: isSupplier ? description.trim() : undefined,
        yearsInBusiness: isSupplier ? years : undefined,
        productionCapacity: isSupplier ? capacity : undefined,
        categories: isSupplier ? categories : undefined,
      });
      await refreshUser();
      Alert.alert("Profile Saved", "Your organization details have been updated successfully.");
    } catch (error: any) {
      Alert.alert(
        "Unable to Save Profile",
        error?.response?.data?.message || error?.message || "Your profile could not be saved. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const verificationStatus = organization?.verificationStatus || "PENDING";

  return (
    <View style={styles.container}>
      <Header title="Company Settings" subtitle={isSupplier ? "Factory profile & manufacturing capabilities" : "Organization profile & business details"} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.statusCard}>
            <View style={styles.statusIcon}>
              <Ionicons name={verificationStatus === "APPROVED" ? "shield-checkmark" : "time-outline"} size={22} color={verificationStatus === "APPROVED" ? Colors.success : Colors.warningText} />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusTitle}>Verification Status</Text>
              <Text style={styles.statusSubtitle}>{verificationStatus === "APPROVED" ? "Your organization has been verified." : "Your organization verification is pending or requires review."}</Text>
            </View>
            <Text style={[styles.statusValue, verificationStatus === "APPROVED" && styles.approvedValue]}>{verificationStatus}</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Organization Details</Text>
            <Field label="Organization / Company Name *" value={name} onChangeText={setName} placeholder="Enter company name" />
            <Field label="GSTIN / Tax Identification" value={taxId} onChangeText={setTaxId} placeholder="Enter GSTIN / Tax ID" />
            <Field label="Primary Operating City" value={city} onChangeText={setCity} placeholder="Enter city" />
            <Field label="Registered Address / Factory Location" value={address} onChangeText={setAddress} placeholder="Enter registered address" multiline />
          </View>

          {isSupplier && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Manufacturing Capabilities</Text>
              <Field label="Years in Business" value={yearsInBusiness} onChangeText={setYearsInBusiness} placeholder="e.g. 12" keyboardType="numeric" />
              <Field label="Monthly Production Capacity (pcs)" value={productionCapacity} onChangeText={setProductionCapacity} placeholder="e.g. 50000" keyboardType="numeric" />
              <Field label="Factory Bio / Equipment & Specializations" value={description} onChangeText={setDescription} placeholder="Describe machinery, processes and specializations" multiline />
              <Text style={styles.fieldLabel}>Garment Categories & Capabilities</Text>
              <View style={styles.categoryInputRow}>
                <TextInput value={categoryInput} onChangeText={setCategoryInput} onSubmitEditing={addCategory} placeholder="Add a category" placeholderTextColor={Colors.textMuted} style={[styles.input, styles.categoryInput]} returnKeyType="done" />
                <TouchableOpacity style={styles.addButton} onPress={addCategory} accessibilityLabel="Add category">
                  <Ionicons name="add" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <View style={styles.chips}>
                {categories.map((category) => (
                  <TouchableOpacity key={category} style={styles.chip} onPress={() => setCategories((current) => current.filter((item) => item !== category))}>
                    <Text style={styles.chipText}>{category}</Text>
                    <Ionicons name="close-circle" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <Button title="Save Company Profile" onPress={handleSave} loading={saving} disabled={saving} size="lg" style={styles.saveButton} />
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Back to Profile</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 44, gap: 14 },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 14 },
  statusIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: Colors.primaryLight, alignItems: "center", justifyContent: "center" },
  statusCopy: { flex: 1 },
  statusTitle: { fontSize: 14, fontWeight: "800", color: Colors.textHeading },
  statusSubtitle: { fontSize: 11, lineHeight: 16, color: Colors.textSecondary, marginTop: 3 },
  statusValue: { fontSize: 10, fontWeight: "800", color: Colors.textSecondary },
  approvedValue: { color: Colors.success },
  sectionCard: { backgroundColor: Colors.surface, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: Colors.textHeading, marginBottom: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: "800", color: Colors.textSecondary, marginBottom: 7, textTransform: "uppercase" },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: "#FFFFFF", paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.text },
  multilineInput: { minHeight: 92, paddingTop: 12 },
  categoryInputRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  categoryInput: { flex: 1 },
  addButton: { width: 46, height: 46, borderRadius: 12, backgroundColor: Colors.primary, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primaryLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  saveButton: { marginTop: 4 },
  cancelButton: { alignItems: "center", paddingVertical: 10 },
  cancelText: { color: Colors.textSecondary, fontSize: 13, fontWeight: "700" },
});
