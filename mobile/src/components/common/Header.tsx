import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/colors";
import { useAuth } from "../../hooks/useAuth";
import { useNotifications } from "../../hooks/useNotifications";
import { APP_NAME } from "../../constants/config";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  showMenuButton?: boolean;
  hideActions?: boolean;
  onMenuPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  rightAction,
  showMenuButton = false,
  hideActions = false,
  onMenuPress,
}) => {
  const router = useRouter();
  const { user, activeMembership, isBuyer, isSupplier, switchRole, logout, memberships } = useAuth();
  const { unreadCount } = useNotifications();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const initial = user?.fullName ? user.fullName[0].toUpperCase() : "S";
  const displayName = isBuyer
    ? user?.fullName || "Buyer"
    : activeMembership?.organization?.name || user?.fullName || "Supplier Mill";
  const roleDisplay = isBuyer ? "Buyer" : "Supplier";
  const hasAlternativeRole = memberships.length > 1;
  const targetRole = isBuyer ? "SUPPLIER" : "BUYER";

  const handleRoleSwitch = async () => {
    try {
      setProfileMenuOpen(false);
      await switchRole(targetRole);
      if (targetRole === "SUPPLIER") {
        router.replace("/(supplier)/dashboard");
      } else {
        router.replace("/(buyer)/dashboard");
      }
    } catch (e) {
      console.warn("Failed to switch workspace:", e);
    }
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      {/* Left Section: Logo or Back Button */}
      <View style={styles.leftRow}>
        {showMenuButton && !showBack && (
          <TouchableOpacity
            onPress={onMenuPress}
            style={styles.menuButton}
            activeOpacity={0.75}
            accessibilityLabel="Open navigation menu"
          >
            <Ionicons name="menu" size={27} color={Colors.slate600} />
          </TouchableOpacity>
        )}
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push(isSupplier ? "/(supplier)/dashboard" : "/(buyer)/dashboard")}
            activeOpacity={0.8}
            style={styles.logoWrap}
          >
            <Image
              source={require("../../../assets/stitchgrid-logo.png")}
              style={styles.officialLogo}
              resizeMode="contain"
            />
          </TouchableOpacity>
        )}

        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      {/* Right Section: Notification & Profile Button */}
      {!hideActions && <View style={styles.rightRow}>
        {rightAction ? (
          rightAction
        ) : (
          <>
            {/* Notification Bell Button */}
            <TouchableOpacity
              onPress={() => router.push("/(shared)/notifications")}
              style={styles.iconCircleButton}
              activeOpacity={0.8}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={19} color={Colors.primary} />
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Profile Avatar Button */}
            <TouchableOpacity
              onPress={() => setProfileMenuOpen(true)}
              style={styles.profileAvatarButton}
              activeOpacity={0.8}
              accessibilityLabel="Profile menu"
            >
              <Text style={styles.avatarInitial}>{initial}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>}

      {/* Profile Dropdown Modal (Matching Web Topbar Mobile Menu) */}
      <Modal
        visible={profileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setProfileMenuOpen(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.dropdownCard}>
                {/* User Summary Header */}
                <View style={styles.userSummaryHeader}>
                  <View style={styles.largeAvatarCircle}>
                    <Text style={styles.largeAvatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.userNameText} numberOfLines={1}>
                      {user?.fullName || "User"}
                    </Text>
                    <Text style={styles.userOrgText} numberOfLines={1}>
                      {activeMembership?.organization?.name || "Independent"}
                    </Text>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>{roleDisplay}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.dropdownDivider} />

                {/* Workspace Switcher if dual membership */}
                {hasAlternativeRole && (
                  <>
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={handleRoleSwitch}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.itemIconWrap, { backgroundColor: "#f0f7ff" }]}>
                        <Ionicons name="swap-horizontal" size={18} color="#2563eb" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>
                          Switch to {targetRole === "SUPPLIER" ? "Supplier" : "Buyer"}
                        </Text>
                        <Text style={styles.itemSubtitle}>Change active workspace</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.dropdownDivider} />
                  </>
                )}

                {/* My Profile */}
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    router.push(isSupplier ? "/(supplier)/profile" : "/(buyer)/profile");
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIconWrap}>
                    <Ionicons name="person-outline" size={18} color={Colors.primary} />
                  </View>
                  <Text style={styles.itemTitle}>My Profile</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                {/* Account Settings */}
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => {
                    setProfileMenuOpen(false);
                    router.push("/(shared)/settings");
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemIconWrap}>
                    <Ionicons name="settings-outline" size={18} color={Colors.slate600} />
                  </View>
                  <Text style={styles.itemTitle}>Account Settings</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                <View style={styles.dropdownDivider} />

                {/* Logout */}
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={handleLogout}
                  activeOpacity={0.7}
                >
                  <View style={[styles.itemIconWrap, { backgroundColor: Colors.dangerLight }]}>
                    <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
                  </View>
                  <Text style={[styles.itemTitle, { color: Colors.danger }]}>Logout</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuButton: {
    width: 36,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
    marginRight: 10,
  },
  logoWrap: {
    paddingVertical: 4,
  },
  officialLogo: {
    width: 140,
    height: 32,
  },
  backButton: {
    marginRight: 10,
    padding: 4,
  },
  titleContainer: {
    marginLeft: 8,
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  subtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(91, 19, 236, 0.12)",
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  unreadText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  profileAvatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(91, 19, 236, 0.18)",
  },
  avatarInitial: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
  },

  // Dropdown Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 28, 48, 0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: Platform.OS === "ios" ? 64 : 56,
    paddingRight: 16,
  },
  dropdownCard: {
    width: 280,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
  },
  userSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 12,
  },
  largeAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  largeAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.primary,
  },
  userNameText: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  userOrgText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  roleTag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
    textTransform: "uppercase",
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 6,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textHeading,
  },
  itemSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
