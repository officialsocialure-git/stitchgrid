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
import { Card } from "../../src/components/common/Card";
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
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Required", "Company name is required.");
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
        <Card>
          <Text style={styles.sectionTitle}>Business Details</Text>
          <Input
            label="Trading Name *"
            placeholder="e.g. Tirupur Knits Export House"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="Registered Legal Entity Name"
            placeholder="e.g. Tirupur Knits Pvt Ltd"
            value={legalName}
            onChangeText={setLegalName}
          />
          <Input
            label="GSTIN / Tax ID"
            placeholder="e.g. 33AAAAA1234Z1Z9"
            value={taxId}
            onChangeText={setTaxId}
          />
          <Input
            label="City"
            placeholder="e.g. Tirupur"
            value={city}
            onChangeText={setCity}
          />
          <Input
            label="Factory / Office Street Address"
            placeholder="e.g. SIDCO Industrial Estate"
            value={address}
            onChangeText={setAddress}
            multiline
          />

          <Button
            title="Save Profile Details"
            onPress={handleSave}
            loading={saving}
            size="lg"
            style={{ marginTop: 8 }}
          />
        </Card>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 16,
  },
});

