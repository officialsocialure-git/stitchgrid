import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from "react-native";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { useAuth } from "../../src/hooks/useAuth";
import { marketplaceService } from "../../src/services/marketplace.service";

export default function SettingsScreen() {
  const { activeMembership, refreshUser } = useAuth();
  const org = activeMembership?.organization;

  const [name, setName] = useState(org?.name || "");
  const [legalName, setLegalName] = useState(org?.legalName || "");
  const [taxId, setTaxId] = useState(org?.taxId || "");
  const [city, setCity] = useState(org?.city || "");
  const [address, setAddress] = useState(org?.address || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Company / Trading name is required.");
      return;
    }

    try {
      setSaving(true);
      await marketplaceService.updateOrganizationProfile({
        organizationId: activeMembership?.organizationId || "",
        name: name.trim(),
        legalName: legalName.trim() || undefined,
        taxId: taxId.trim() || undefined,
        city: city.trim() || undefined,
        address: address.trim() || undefined,
      });
      await refreshUser();
      Alert.alert("Saved", "Organization profile updated successfully.");
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message || "Failed to update profile settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Organization Settings"
        subtitle="Manage business credentials & address"
        showBack
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Business Identification</Text>
          <Text style={styles.sectionSubtitle}>
            These verified details are shared on official Purchase Orders and GST invoices.
          </Text>

          <Input
            label="Trading / Brand Name *"
            placeholder="e.g. Tirupur Knits Export House"
            value={name}
            onChangeText={setName}
            leftIcon="business-outline"
          />

          <Input
            label="Registered Legal Entity Name"
            placeholder="e.g. Tirupur Knits Private Limited"
            value={legalName}
            onChangeText={setLegalName}
            leftIcon="document-text-outline"
          />

          <Input
            label="GSTIN / Corporate Tax ID"
            placeholder="e.g. 33AAAAA0000A1Z5"
            value={taxId}
            onChangeText={setTaxId}
            autoCapitalize="characters"
            leftIcon="shield-checkmark-outline"
          />

          <Input
            label="Manufacturing City / Sourcing Hub"
            placeholder="e.g. Tirupur, Tamil Nadu"
            value={city}
            onChangeText={setCity}
            leftIcon="location-outline"
          />

          <Input
            label="Registered Office Address"
            placeholder="Building, Industrial Estate, Pincode"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={3}
            leftIcon="navigate-outline"
          />

          <Button
            title="Save Organization Changes"
            onPress={handleSave}
            loading={saving}
            size="lg"
            style={{ marginTop: 14 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 18,
    lineHeight: 16,
  },
});
