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

export default function SupplierProfileScreen() {
  const router = useRouter();
  const { user, activeMembership, memberships, switchRole, logout } = useAuth();
  const [switching, setSwitching] = useState(false);

  const org = activeMembership?.organization;
  const hasBuyerRole = memberships.some((m) => m.role === "BUYER");

  const handleSwitchToBuyer = async () => {
    try {
      setSwitching(true);
      await switchRole("BUYER");
      router.replace("/(buyer)/dashboard");
    } catch (e: any) {
      Alert.alert("Switch Failed", e.message || "Could not switch to buyer role.");
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
      <Header title="Factory Profile" subtitle="Mill credentials & manufacturing specs" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {org?.name?.slice(0, 2).toUpperCase() || "MF"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{org?.name || "Apparel Manufacturer"}</Text>
              <Text style={styles.userEmail}>{user?.fullName} • {user?.email || user?.phone}</Text>
              <View style={{ marginTop: 6 }}>
                <Badge label="VERIFIED SUPPLIER" size="sm" variant="success" />
              </View>
            </View>
          </View>
        </Card>

        {/* Manufacturing Credentials */}
        <Text style={styles.sectionHeading}>Factory Specification</Text>
        <Card>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Industrial Cluster</Text>
            <Text style={styles.infoValue}>{org?.city || "Tirupur"}, Tamil Nadu</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Monthly Capacity</Text>
            <Text style={styles.infoValue}>150,000 pcs</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GST Registration</Text>
            <Text style={styles.infoValue}>{org?.taxId || "33AAAAA1234Z1Z9"}</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Quality Audit</Text>
            <Badge label="AQL 2.5 Passed" size="sm" variant="primary" />
          </View>
        </Card>

        {/* Role Switcher if multi-tenant */}
        {hasBuyerRole && (
          <View style={{ marginTop: 12 }}>
            <Card style={styles.switchCard}>
              <View style={styles.switchRow}>
                <Ionicons name="swap-horizontal" size={24} color={Colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Switch to Buyer Workspace</Text>
                  <Text style={styles.switchDesc}>Post RFQs and source apparel from mills</Text>
                </View>
              </View>
              <Button
                title="Switch to Buyer Role"
                variant="outline"
                loading={switching}
                onPress={handleSwitchToBuyer}
                style={{ marginTop: 12 }}
              />
            </Card>
          </View>
        )}

        {/* Preferences & Settings */}
        <Text style={styles.sectionHeading}>Preferences</Text>
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(shared)/notifications")}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.text} />
            <Text style={styles.menuText}>Notifications & Inquiries</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginLeft: "auto" }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/(shared)/settings")}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.text} />
            <Text style={styles.menuText}>Factory Settings</Text>
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

