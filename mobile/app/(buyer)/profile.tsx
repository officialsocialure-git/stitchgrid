import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Button } from "../../src/components/common/Button";
import { useAuth } from "../../src/hooks/useAuth";
import { authService } from "../../src/services/auth.service";

export default function BuyerProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, memberships, switchRole, logout, refreshUser } = useAuth();
  const [switching, setSwitching] = useState(false);

  // Edit Profile Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(user?.fullName || "");
  const [editPhone, setEditPhone] = useState(user?.phone || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const org = activeMembership?.organization;
  const hasSupplierRole = memberships.some((m) => m.role === "SUPPLIER");
  const initial = user?.fullName ? user.fullName[0].toUpperCase() : "B";

  const handleOpenEdit = () => {
    setEditName(user?.fullName || "");
    setEditPhone(user?.phone || "");
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation", "Please enter your full name.");
      return;
    }
    try {
      setSavingProfile(true);
      await authService.updateProfile({ fullName: editName.trim(), phone: editPhone.trim() || undefined });
      await refreshUser();
      setIsEditModalOpen(false);
      Alert.alert("Profile Updated", "Your profile details have been saved successfully.");
    } catch (e: any) {
      Alert.alert("Update Error", e.response?.data?.message || e.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSwitchToSupplier = async () => {
    try {
      setSwitching(true);
      await switchRole("SUPPLIER");
      router.replace("/(supplier)/dashboard");
    } catch (e: any) {
      Alert.alert("Switch Failed", e.message || "Could not switch to supplier role.");
    } finally {
      setSwitching(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of STITCHGRID?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <View style={styles.safeArea}>
      <Header title="Brand Profile" subtitle="Account & sourcing settings" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Buyer Brand Profile Header Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.userName}>{user?.fullName || "Name not provided"}</Text>
                {org?.verificationStatus === "APPROVED" && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  </View>
                )}
              </View>
              <Text style={styles.userEmail}>{user?.email || "Email not provided"}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>BUYER / BRAND</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Brand Organization Details */}
        <Text style={styles.sectionHeading}>Company & Sourcing Info</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Brand / Company</Text>
            <Text style={styles.infoValue}>{org?.name || "Organization not added"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Location / Hub</Text>
            <Text style={styles.infoValue}>{org?.city || "Location not provided"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <Text style={styles.infoValue}>{org?.businessType || "Not specified"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GSTIN / Business ID</Text>
            <Text style={styles.infoValue}>{org?.taxId || "Not provided"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Verification Status</Text>
            <Text style={styles.infoValue}>{org?.verificationStatus || "PENDING"}</Text>
          </View>
        </View>

        <Button
          title="Edit Profile Information"
          variant="outline"
          onPress={handleOpenEdit}
          style={{ marginTop: 14 }}
        />

        {/* Sourcing Shortcuts */}
        <Text style={styles.sectionHeading}>Sourcing Shortcuts</Text>
        <View style={styles.menuCard}>
          {[
            { label: "My Requests (RFQs)", icon: "document-text-outline" as const, route: "/(buyer)/rfqs" },
            { label: "Quotation Comparison", icon: "pricetag-outline" as const, route: "/(buyer)/offers" },
            { label: "Purchase Orders (POs)", icon: "cube-outline" as const, route: "/(buyer)/orders" },
            { label: "Prototype Samples", icon: "shirt-outline" as const, route: "/(buyer)/samples" },
            { label: "Escrow & Payments", icon: "card-outline" as const, route: "/(buyer)/payments" },
          ].map((item, idx, arr) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                idx === arr.length - 1 && { borderBottomWidth: 0 },
              ]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color="#5B13EC" style={{ marginRight: 12 }} />
              <Text style={styles.menuItemText}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Role Switcher if multi-tenant */}
        {hasSupplierRole && (
          <View style={{ marginTop: 14 }}>
            <View style={styles.switchCard}>
              <View style={styles.switchRow}>
                <View style={styles.switchIconBox}>
                  <Ionicons name="swap-horizontal" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Switch to Factory Workspace</Text>
                  <Text style={styles.switchDesc}>Receive RFQs and produce garment orders</Text>
                </View>
              </View>
              <Button
                title="Switch to Supplier Role"
                variant="outline"
                loading={switching}
                onPress={handleSwitchToSupplier}
                style={{ marginTop: 12 }}
              />
            </View>
          </View>
        )}

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleLogout}
          size="lg"
          style={{ marginTop: 22, marginBottom: 20 }}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile Information</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={22} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.textInput}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor={Colors.textMuted}
            />

            <Text style={styles.inputLabel}>Mobile Phone</Text>
            <TextInput
              style={styles.textInput}
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="e.g. +91 98765 43210"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setIsEditModalOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Changes"
                loading={savingProfile}
                onPress={handleSaveProfile}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "900",
    color: Colors.primary,
  },
  userName: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  verifiedBadge: {},
  userEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleTag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: 0.6,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
    marginTop: 10,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.successText,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuItemText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textHeading,
  },
  switchCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  switchDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  textInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: Colors.textHeading,
    backgroundColor: Colors.surfaceSubtle,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
});
