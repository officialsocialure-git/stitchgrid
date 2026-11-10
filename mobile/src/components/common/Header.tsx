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
  ScrollView,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { Colors } from "../../constants/colors";
import { useAuth } from "../../hooks/useAuth";
import { useNotifications } from "../../hooks/useNotifications";
import { APP_NAME } from "../../constants/config";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  showMenuButton?: boolean;
  onMenuPress?: () => void;
  hideProfileButton?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  rightAction,
  showMenuButton,
  onMenuPress,
  hideProfileButton = false,
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, activeMembership, isBuyer, isSupplier, switchRole, logout, memberships } = useAuth();
  const { unreadCount } = useNotifications();

  // Drawers and Modals
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const initial = user?.fullName ? user.fullName[0].toUpperCase() : "S";
  const roleDisplay = isBuyer ? "Buyer / Brand" : "Supplier / Mill";
  const hasAlternativeRole = memberships.length > 1;
  const targetRole = isBuyer ? "SUPPLIER" : "BUYER";

  const handleRoleSwitch = async () => {
    try {
      setProfileMenuOpen(false);
      setDrawerOpen(false);
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
    setDrawerOpen(false);
    await logout();
    router.replace("/(auth)/login");
  };

  const navigateTo = (route: any) => {
    setDrawerOpen(false);
    router.push(route);
  };

  // Buyer Navigation Links (matching Web Topbar Navigation)
  const BUYER_NAV_LINKS = [
    { name: "Home", href: "/(buyer)/dashboard", icon: "home-outline" as const },
    { name: "My Requests (RFQs)", href: "/(buyer)/rfqs", icon: "document-text-outline" as const },
    { name: "My Offers (Quotes)", href: "/(buyer)/offers", icon: "pricetag-outline" as const },
    { name: "My Orders (POs)", href: "/(buyer)/orders", icon: "cube-outline" as const },
    { name: "Order Tracking", href: "/(buyer)/production", icon: "speedometer-outline" as const },
    { name: "Samples Workflow", href: "/(buyer)/samples", icon: "shirt-outline" as const },
    { name: "Chat Messages", href: "/(buyer)/messages", icon: "chatbubble-ellipses-outline" as const },
    { name: "Escrow & Payments", href: "/(buyer)/payments", icon: "card-outline" as const },
    { name: "Verified Mills", href: "/(buyer)/suppliers", icon: "business-outline" as const },
    { name: "My Profile", href: "/(buyer)/profile", icon: "person-outline" as const },
    { name: "Organization Settings", href: "/(shared)/settings", icon: "settings-outline" as const },
    { name: "Notifications", href: "/(shared)/notifications", icon: "notifications-outline" as const },
  ];

  // Supplier Navigation Links (matching Web Topbar Navigation)
  const SUPPLIER_NAV_LINKS = [
    { name: "Home", href: "/(supplier)/dashboard", icon: "home-outline" as const },
    { name: "Buyer Requests", href: "/(supplier)/buyer-requests", icon: "document-text-outline" as const },
    { name: "My Offers", href: "/(supplier)/my-offers", icon: "pricetag-outline" as const },
    { name: "My Orders", href: "/(supplier)/orders", icon: "cube-outline" as const },
    { name: "Production Floor", href: "/(supplier)/production", icon: "hammer-outline" as const },
    { name: "Samples Dispatch", href: "/(supplier)/samples", icon: "shirt-outline" as const },
    { name: "Chat Messages", href: "/(supplier)/messages", icon: "chatbubble-ellipses-outline" as const },
    { name: "Escrow & Settlements", href: "/(supplier)/payments", icon: "card-outline" as const },
    { name: "Factory Profile", href: "/(supplier)/profile", icon: "person-outline" as const },
    { name: "Mill Settings", href: "/(shared)/settings", icon: "settings-outline" as const },
    { name: "Notifications", href: "/(shared)/notifications", icon: "notifications-outline" as const },
  ];

  const currentNavLinks = isSupplier ? SUPPLIER_NAV_LINKS : BUYER_NAV_LINKS;

  return (
    <View style={styles.container}>
      {/* Left Row: Hamburger Button + Back Button + Brand Logo */}
      <View style={styles.leftRow}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.textHeading} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onMenuPress || (() => setDrawerOpen(true))}
            style={styles.hamburgerButton}
            activeOpacity={0.7}
            accessibilityLabel="Open Navigation Menu"
          >
            <Ionicons name="menu" size={24} color={Colors.textHeading} />
          </TouchableOpacity>
        )}

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

      {/* Right Row: Notification Bell + Profile Avatar */}
      <View style={styles.rightRow}>
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
            {!hideProfileButton && (
              <TouchableOpacity
                onPress={() => setProfileMenuOpen(true)}
                style={styles.profileAvatarButton}
                activeOpacity={0.8}
                accessibilityLabel="Profile menu"
              >
                <Text style={styles.avatarInitial}>{initial}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE HAMBURGER NAVIGATION DRAWER (Slide-in from Left)        */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableWithoutFeedback onPress={() => setDrawerOpen(false)}>
            <View style={styles.drawerBackdrop} />
          </TouchableWithoutFeedback>

          <View style={styles.drawerSheet}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <Image
                source={require("../../../assets/stitchgrid-logo.png")}
                style={{ width: 140, height: 32 }}
                resizeMode="contain"
              />
              <TouchableOpacity
                onPress={() => setDrawerOpen(false)}
                style={styles.drawerCloseBtn}
              >
                <Ionicons name="close" size={22} color={Colors.textHeading} />
              </TouchableOpacity>
            </View>

            {/* User Profile Info Card in Drawer */}
            <View style={styles.drawerUserCard}>
              <View style={styles.drawerAvatar}>
                <Text style={styles.drawerAvatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.drawerUserName} numberOfLines={1}>
                  {user?.fullName || "User"}
                </Text>
                <Text style={styles.drawerUserOrg} numberOfLines={1}>
                  {activeMembership?.organization?.name || "Verified Organization"}
                </Text>
                <View style={styles.drawerRoleTag}>
                  <Text style={styles.drawerRoleTagText}>{roleDisplay}</Text>
                </View>
              </View>
            </View>

            {/* Dual Role Workspace Switcher in Drawer */}
            {hasAlternativeRole && (
              <TouchableOpacity
                style={styles.drawerSwitchBtn}
                onPress={handleRoleSwitch}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal" size={16} color={Colors.primary} />
                <Text style={styles.drawerSwitchText}>
                  Switch to {targetRole === "SUPPLIER" ? "Supplier" : "Buyer"} Workspace
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.drawerDivider} />

            {/* Navigation Links Scrollable List */}
            <ScrollView
              style={styles.drawerLinksScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.navSectionLabel}>NAVIGATION MENU</Text>
              {currentNavLinks.map((item) => {
                const isActive = pathname.includes(item.href.replace(/\([^)]+\)\//, ""));
                return (
                  <TouchableOpacity
                    key={item.href}
                    style={[styles.drawerNavItem, isActive && styles.drawerNavItemActive]}
                    onPress={() => navigateTo(item.href)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={isActive ? "#FFFFFF" : Colors.slate500}
                    />
                    <Text
                      style={[
                        styles.drawerNavText,
                        isActive && styles.drawerNavTextActive,
                      ]}
                    >
                      {item.name}
                    </Text>

                    {item.name === "Notifications" && unreadCount > 0 && (
                      <View
                        style={[
                          styles.navUnreadPill,
                          isActive ? { backgroundColor: "#FFFFFF" } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.navUnreadText,
                            isActive ? { color: Colors.primary } : null,
                          ]}
                        >
                          {unreadCount}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}

              <View style={styles.drawerDivider} />

              {/* Logout Button in Drawer */}
              <TouchableOpacity
                style={styles.drawerLogoutBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
                <Text style={styles.drawerLogoutText}>Sign Out</Text>
              </TouchableOpacity>

              <Text style={styles.drawerVersionText}>STITCHGRID Mobile v1.0.0</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* PROFILE DROPDOWN MODAL (From Web Topbar Mobile View)           */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={profileMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileMenuOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setProfileMenuOpen(false)}>
          <View style={styles.profileModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.profileDropdownCard}>
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

                {/* Workspace Switcher */}
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
  hamburgerButton: {
    padding: 6,
    marginRight: 6,
    borderRadius: 8,
  },
  backButton: {
    marginRight: 8,
    padding: 4,
  },
  logoWrap: {
    paddingVertical: 4,
  },
  officialLogo: {
    width: 135,
    height: 30,
  },
  titleContainer: {
    marginLeft: 8,
    flex: 1,
  },
  title: {
    fontSize: 15,
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

  // ---------------- Drawer Styles ----------------
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  drawerBackdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(11, 28, 48, 0.5)",
  },
  drawerSheet: {
    width: Math.min(SCREEN_WIDTH * 0.82, 320),
    backgroundColor: Colors.surface,
    height: "100%",
    paddingTop: Platform.OS === "ios" ? 54 : 32,
    paddingHorizontal: 16,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
  },
  drawerCloseBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: Colors.surfaceSubtle,
  },
  drawerUserCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 16,
    padding: 12,
    marginTop: 4,
  },
  drawerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  drawerAvatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  drawerUserName: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  drawerUserOrg: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  drawerRoleTag: {
    alignSelf: "flex-start",
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 6,
    marginTop: 4,
  },
  drawerRoleTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.primary,
    textTransform: "uppercase",
  },
  drawerSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 8,
  },
  drawerSwitchText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 14,
  },
  navSectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingLeft: 4,
  },
  drawerLinksScroll: {
    flex: 1,
  },
  drawerNavItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerNavItemActive: {
    backgroundColor: Colors.primary,
  },
  drawerNavText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.slate700,
  },
  drawerNavTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  navUnreadPill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  navUnreadText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  drawerLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: Colors.dangerLight,
    marginBottom: 10,
  },
  drawerLogoutText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.danger,
  },
  drawerVersionText: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    paddingVertical: 8,
  },

  // ---------------- Profile Dropdown Styles ----------------
  profileModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11, 28, 48, 0.35)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: Platform.OS === "ios" ? 64 : 56,
    paddingRight: 16,
  },
  profileDropdownCard: {
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
