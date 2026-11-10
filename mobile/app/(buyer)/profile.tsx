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
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
import { useAuth } from "../../src/hooks/useAuth";

export default function BuyerProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, memberships, switchRole, logout } = useAuth();
  const [switching, setSwitching] = useState(false);

  const org = activeMembership?.organization;
  const hasSupplierRole = memberships.some((m) => m.role === "SUPPLIER");

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
    Alert.alert("Sign Out", "Are you sure you want to sign out of STITCHGUARD?", [
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
        {/* User Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.fullName?.slice(0, 2).toUpperCase() || "BY"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.fullName || "Buyer Account"}</Text>
              <Text style={styles.userEmail}>{user?.email || user?.phone || "No contact info"}</Text>
              <View style={{ marginTop: 6 }}>
                <Badge label="BUYER WORKSPACE" size="sm" variant="primary" />
              </View>
            </View>
          </View>
        </Card>

        {/* Company Organization Card */}
        <Text style={styles.sectionHeading}>Company Organization</Text>
        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Company Name</Text>
            <Text style={styles.infoValue}>{org?.name || "Not Specified"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>City & Hub</Text>
            <Text style={styles.infoValue}>{org?.city || "Tirupur / Mumbai"}, India</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GST / Tax ID</Text>
            <Text style={styles.infoValue}>{org?.taxId || "33AAAAA0000A1Z5"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Verification</Text>
            <Badge label="GST Verified" size="sm" variant="success" />
          </View>
        </Card>

        {/* Role Switcher if multi-tenant */}
        {hasSupplierRole && (
          <View style={{ marginTop: 12 }}>
            <Card style={styles.switchCard}>
              <View style={styles.switchRow}>
                <Ionicons name="swap-horizontal" size={24} color={Colors.primary} />
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
            </Card>
          </View>
        )}

        {/* Navigation Links */}
        <Text style={styles.sectionHeading}>Preferences</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(shared)/notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.text} />
            <Text style={styles.menuText}>Notifications & Alerts</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(shared)/settings")}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.text} />
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
          style={{ marginTop: 20, marginBottom: 20 }}
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
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.text,
  },
  userEmail: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 10,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
  switchCard: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.borderPrimary,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
  },
  switchDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  menuCard: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  menuText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
  },
});

