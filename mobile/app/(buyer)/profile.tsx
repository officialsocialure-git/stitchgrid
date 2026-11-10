import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Button } from "../../src/components/common/Button";
import { useAuth } from "../../src/hooks/useAuth";

export default function BuyerProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, memberships, switchRole, logout } = useAuth();
  const [switching, setSwitching] = useState(false);

  const org = activeMembership?.organization;
  const hasSupplierRole = memberships.some((m) => m.role === "SUPPLIER");
  const initial = user?.fullName ? user.fullName[0].toUpperCase() : "B";

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
    <SafeAreaView style={styles.safeArea}>
      <Header title="My Profile" subtitle="Account & organization settings" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Profile Card (Matching Web) */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.userName}>{user?.fullName || "Buyer Account"}</Text>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                </View>
              </View>
              <Text style={styles.userEmail}>{user?.email || "buyer@stitchgrid.com"}</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>BUYER / BRAND</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Company Organization Card */}
        <Text style={styles.sectionHeading}>Company Organization</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company Name</Text>
            <Text style={styles.infoValue}>{org?.name || "Apparel Brand"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>City & Hub</Text>
            <Text style={styles.infoValue}>{org?.city || "Mumbai, Maharashtra"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GSTIN / Tax ID</Text>
            <Text style={styles.infoValue}>{org?.taxId || "27AABCS1429B1Z8"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Verification Status</Text>
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark" size={12} color={Colors.successText} />
              <Text style={styles.verifiedText}>GST Verified</Text>
            </View>
          </View>
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
                  <Text style={styles.switchTitle}>Switch to Factory Portal</Text>
                  <Text style={styles.switchDesc}>Manage manufacturing lines as Supplier</Text>
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

        {/* Preferences & Quick Links */}
        <Text style={styles.sectionHeading}>Preferences</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(shared)/notifications")}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name="notifications-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.menuText}>Notifications & Alerts</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(shared)/settings")}
          >
            <View style={styles.menuIconWrap}>
              <Ionicons name="settings-outline" size={18} color={Colors.slate600} />
            </View>
            <Text style={styles.menuText}>Organization Settings</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>
        </View>

        {/* Sign Out Button */}
        <Button
          title="Sign Out"
          variant="danger"
          onPress={handleLogout}
          size="lg"
          style={{ marginTop: 22, marginBottom: 20 }}
        />
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
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 12,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  menuText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textHeading,
  },
  menuDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 8,
  },
});
