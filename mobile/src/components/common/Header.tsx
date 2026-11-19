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
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  StatusBar as RNStatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../constants/colors";
import { useAuth } from "../../hooks/useAuth";
import { useNotifications } from "../../hooks/useNotifications";
import { authService } from "../../services/auth.service";
import { marketplaceService } from "../../services/marketplace.service";
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

const formatTimeAgo = (dateStr?: string) => {
  if (!dateStr) return "Recent";
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "Recent";
  }
};

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
  const { user, activeMembership, isBuyer, isSupplier, switchRole, logout, memberships, refreshUser } = useAuth();
  const { notifications, unreadCount, refresh, markRead } = useNotifications();
  const insets = useSafeAreaInsets();

  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? (RNStatusBar.currentHeight || 24) : 0
  );

  // Drawers and Modals
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Edit Profile Form State
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOrgName, setEditOrgName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");

  const initial = user?.fullName ? user.fullName[0].toUpperCase() : "S";
  const roleDisplay = isBuyer ? "Buyer / Brand" : "Supplier / Mill";
  const hasAlternativeRole = memberships.length > 1;
  const targetRole = isBuyer ? "SUPPLIER" : "BUYER";

  const openProfileModal = () => {
    setEditFullName(user?.fullName || "");
    setEditPhone(user?.phone || "");
    setEditOrgName(activeMembership?.organization?.name || "");
    setEditCity(activeMembership?.organization?.city || "");
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      Alert.alert("Validation Error", "Full Name cannot be empty.");
      return;
    }
    setSavingProfile(true);
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
    try {
      // 1. Update personal info (fullName, phone)
      await authService.updateProfile({
        fullName: editFullName.trim(),
        phone: editPhone.trim() || undefined,
      });

      // 2. If organization exists and org name or city provided, update org profile
      if (activeMembership?.organizationId) {
        await marketplaceService.updateOrganizationProfile({
          organizationId: activeMembership.organizationId,
          name: editOrgName.trim() || activeMembership.organization?.name,
          city: editCity.trim() || activeMembership.organization?.city,
        });
      }

      // 3. Refresh user state across the app
      await refreshUser();
      setSaveSuccessMsg("Profile details updated successfully!");
      setTimeout(() => setSaveSuccessMsg(""), 3500);
    } catch (error: any) {
      console.error("Save profile error:", error);
      setSaveErrorMsg(error?.response?.data?.error?.message || error?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleConfirmLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            setProfileModalOpen(false);
            setDrawerOpen(false);
            await logout();
            router.replace("/(auth)/login");
          },
        },
      ]
    );
  };

  const handleRoleSwitch = async () => {
    try {
      setProfileModalOpen(false);
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
    setProfileModalOpen(false);
    setDrawerOpen(false);
    await logout();
    router.replace("/(auth)/login");
  };

  const navigateTo = (route: any) => {
    // Always navigate using the complete Expo Router href. Navigating by the
    // last segment (e.g. "orders") can resolve against the wrong navigator
    // and repeatedly reopen the dashboard.
    setDrawerOpen(false);
    router.push(route);
  };

  // Buyer Navigation Links (matching Web Topbar Navigation)
  const BUYER_NAV_LINKS = [
    { name: "Home", href: "/(buyer)/dashboard", icon: "home-outline" as const },
    { name: "My Requests (RFQs)", href: "/(buyer)/rfqs", icon: "document-text-outline" as const },
    { name: "My Offers (Quotes)", href: "/(buyer)/offers", icon: "pricetag-outline" as const },
    { name: "My Orders (POs)", href: "/(buyer)/orders", icon: "cube-outline" as const },
    { name: "Samples Workflow", href: "/(buyer)/samples", icon: "shirt-outline" as const },
    { name: "Chat Messages", href: "/(buyer)/messages", icon: "chatbubble-ellipses-outline" as const },
    { name: "Escrow & Payments", href: "/(buyer)/payments", icon: "card-outline" as const },
    { name: "Verified Mills", href: "/(buyer)/suppliers", icon: "business-outline" as const },
  ];

  // Supplier Navigation Links (matching Web Topbar Navigation)
  const SUPPLIER_NAV_LINKS = [
    { name: "Home", href: "/(supplier)/dashboard", icon: "home-outline" as const },
    { name: "Buyer Requests", href: "/(supplier)/buyer-requests", icon: "document-text-outline" as const },
    { name: "My Offers", href: "/(supplier)/my-offers", icon: "pricetag-outline" as const },
    { name: "My Orders", href: "/(supplier)/orders", icon: "cube-outline" as const },
    { name: "Samples Dispatch", href: "/(supplier)/samples", icon: "shirt-outline" as const },
    { name: "Production Tracking", href: "/(supplier)/production", icon: "construct-outline" as const },
    { name: "Chat Messages", href: "/(supplier)/messages", icon: "chatbubble-ellipses-outline" as const },
    { name: "Escrow & Settlements", href: "/(supplier)/payments", icon: "card-outline" as const },
    { name: "Profile", href: "/(supplier)/profile", icon: "person-outline" as const },
  ];

  const currentNavLinks = isSupplier ? SUPPLIER_NAV_LINKS : BUYER_NAV_LINKS;

  return (
    <View style={[styles.headerOuterWrap, { paddingTop: topInset }]}>
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

      {/* Right Row: Notification Bell Button & User Profile Avatar Button */}
      <View style={styles.rightRow}>
        {rightAction ? (
          rightAction
        ) : (
          <>
            <TouchableOpacity
              onPress={() => {
                refresh();
                setNotificationsOpen(true);
              }}
              style={styles.iconCircleButton}
              activeOpacity={0.8}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {!hideProfileButton && (
              <TouchableOpacity
                onPress={openProfileModal}
                style={styles.profileAvatarButton}
                activeOpacity={0.8}
                accessibilityLabel="User Profile and Settings"
              >
                <Text style={styles.avatarInitial}>{initial}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
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

          <View style={[styles.drawerSheet, { paddingTop: topInset + 12, paddingBottom: Math.max(insets.bottom, 24) }]}>
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
      {/* USER PROFILE & ACCOUNT MANAGEMENT MODAL / BOTTOM SHEET         */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={profileModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProfileModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.profileModalOverlay}
        >
          <TouchableWithoutFeedback onPress={() => setProfileModalOpen(false)}>
            <View style={styles.profileBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.profileSheet, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 34 : 20) }]}>
            {/* Drag Handle */}
            <View style={styles.notifDragHandle} />

            {/* Header */}
            <View style={styles.profileModalHeader}>
              <View>
                <Text style={styles.profileModalTitle}>My Profile</Text>
                <Text style={styles.profileModalSubtitle}>View & update your account details</Text>
              </View>
              <TouchableOpacity
                onPress={() => setProfileModalOpen(false)}
                style={styles.notifCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.profileScroll}
              contentContainerStyle={{ paddingBottom: 28 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* User Identity Card */}
              <View style={styles.profileHeroCard}>
                <View style={styles.profileHeroAvatar}>
                  <Text style={styles.profileHeroAvatarText}>{initial}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.profileHeroName} numberOfLines={1}>
                    {user?.fullName || "User"}
                  </Text>
                  <Text style={styles.profileHeroEmail} numberOfLines={1}>
                    {user?.email || "No email"}
                  </Text>
                  <View style={styles.profileHeroBadgeRow}>
                    <View style={styles.profileRoleBadge}>
                      <Ionicons
                        name={isBuyer ? "briefcase-outline" : "construct-outline"}
                        size={12}
                        color={Colors.primary}
                      />
                      <Text style={styles.profileRoleBadgeText}>{roleDisplay}</Text>
                    </View>
                    <View style={styles.profileVerifiedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                      <Text style={styles.profileVerifiedBadgeText}>Verified</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Feedback banners */}
              {saveSuccessMsg ? (
                <View style={styles.successBanner}>
                  <Ionicons name="checkmark-circle" size={18} color="#166534" />
                  <Text style={styles.successBannerText}>{saveSuccessMsg}</Text>
                </View>
              ) : null}

              {saveErrorMsg ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={18} color="#991B1B" />
                  <Text style={styles.errorBannerText}>{saveErrorMsg}</Text>
                </View>
              ) : null}

              {/* Edit Details Section */}
              <View style={styles.sectionHeaderWrap}>
                <Ionicons name="person-circle-outline" size={18} color={Colors.primary} />
                <Text style={styles.sectionHeaderTitle}>PERSONAL INFORMATION</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <View style={styles.inputFieldWrap}>
                  <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editFullName}
                    onChangeText={setEditFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputFieldWrap}>
                  <Ionicons name="call-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editPhone}
                    onChangeText={setEditPhone}
                    placeholder="+91 98765 43210"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Organization & Location Section */}
              <View style={[styles.sectionHeaderWrap, { marginTop: 14 }]}>
                <Ionicons name="business-outline" size={18} color={Colors.primary} />
                <Text style={styles.sectionHeaderTitle}>ORGANIZATION & LOCATION</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Company / Brand Name</Text>
                <View style={styles.inputFieldWrap}>
                  <Ionicons name="business-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editOrgName}
                    onChangeText={setEditOrgName}
                    placeholder="e.g. Qspider Brand"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>City / Location</Text>
                <View style={styles.inputFieldWrap}>
                  <Ionicons name="location-outline" size={18} color={Colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    value={editCity}
                    onChangeText={setEditCity}
                    placeholder="e.g. Mumbai, Noida, Tirupur"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              {/* Readonly Account Details */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Registered Email (Account ID)</Text>
                <View style={[styles.inputFieldWrap, styles.inputFieldDisabled]}>
                  <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                  <Text style={styles.textInputDisabled}>{user?.email || "N/A"}</Text>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveProfileBtn, savingProfile && styles.btnDisabled]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                activeOpacity={0.8}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                    <Text style={styles.saveProfileBtnText}>Save Profile Changes</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Workspace Switcher if multi-role */}
              {hasAlternativeRole && (
                <View style={styles.workspaceSwitchCard}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.switchCardTitle}>Active Workspace</Text>
                    <Text style={styles.switchCardSub}>
                      Switch to {targetRole === "SUPPLIER" ? "Supplier / Mill" : "Buyer / Brand"} portal
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.switchRoleActionBtn}
                    onPress={handleRoleSwitch}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                    <Text style={styles.switchRoleActionText}>Switch</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.sheetDivider} />

              {/* Sign Out / Logout Button at the bottom */}
              <TouchableOpacity
                style={styles.profileLogoutBtn}
                onPress={handleConfirmLogout}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
                <Text style={styles.profileLogoutBtnText}>Sign Out from Account</Text>
              </TouchableOpacity>

              <Text style={styles.sheetFooterVersion}>STITCHGRID Mobile • App v1.0.0</Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* NOTIFICATIONS CENTER MODAL / BOTTOM SHEET                      */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={notificationsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setNotificationsOpen(false)}
      >
        <View style={styles.notifModalOverlay}>
          <TouchableWithoutFeedback onPress={() => setNotificationsOpen(false)}>
            <View style={styles.notifBackdrop} />
          </TouchableWithoutFeedback>

          <View style={[styles.notifSheet, { paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 34 : 20) }]}>
            {/* Drag Handle */}
            <View style={styles.notifDragHandle} />

            {/* Header */}
            <View style={styles.notifHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={styles.notifSheetTitle}>Notifications</Text>
                {unreadCount > 0 && (
                  <View style={styles.notifCountPill}>
                    <Text style={styles.notifCountPillText}>{unreadCount} new</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {unreadCount > 0 && (
                  <TouchableOpacity
                    onPress={async () => {
                      for (const n of notifications) {
                        if (!n.readAt) await markRead(n.id);
                      }
                    }}
                    style={styles.markAllReadBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.markAllReadBtnText}>Mark all read</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => setNotificationsOpen(false)}
                  style={styles.notifCloseBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Notifications List */}
            <ScrollView
              style={styles.notifListScroll}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
            >
              {notifications.length === 0 ? (
                <View style={styles.notifEmptyWrap}>
                  <View style={styles.notifEmptyIconBox}>
                    <Ionicons name="notifications-off-outline" size={32} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.notifEmptyTitle}>No notifications yet</Text>
                  <Text style={styles.notifEmptySub}>
                    When you receive quotations, order updates, sample reviews, or messages, they will appear here.
                  </Text>
                </View>
              ) : (
                notifications.map((item) => {
                  const isUnread = !item.readAt;
                  const titleLower = (item.title || "").toLowerCase();
                  const iconName = titleLower.includes("quote") || titleLower.includes("offer")
                    ? "pricetag"
                    : titleLower.includes("order") || titleLower.includes("po")
                    ? "cube"
                    : titleLower.includes("sample")
                    ? "shirt"
                    : titleLower.includes("message") || titleLower.includes("chat")
                    ? "chatbubble"
                    : titleLower.includes("payment")
                    ? "card"
                    : "notifications";

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.notifItemCard, isUnread && styles.notifItemUnread]}
                      activeOpacity={0.75}
                      onPress={async () => {
                        if (isUnread) await markRead(item.id);
                        setNotificationsOpen(false);
                        // Smart Routing based on notification subject
                        if (titleLower.includes("quote") || titleLower.includes("offer")) {
                          router.push(isSupplier ? "/(supplier)/my-offers" : "/(buyer)/offers");
                        } else if (titleLower.includes("order") || titleLower.includes("po")) {
                          router.push(isSupplier ? "/(supplier)/orders" : "/(buyer)/orders");
                        } else if (titleLower.includes("sample")) {
                          router.push(isSupplier ? "/(supplier)/samples" : "/(buyer)/samples");
                        } else if (titleLower.includes("message") || titleLower.includes("chat")) {
                          router.push(isSupplier ? "/(supplier)/messages" : "/(buyer)/messages");
                        } else if (titleLower.includes("payment")) {
                          router.push(isSupplier ? "/(supplier)/payments" : "/(buyer)/payments");
                        } else if (titleLower.includes("rfq") || titleLower.includes("request")) {
                          router.push(isSupplier ? "/(supplier)/buyer-requests" : "/(buyer)/rfqs");
                        }
                      }}
                    >
                      <View style={[styles.notifItemIconWrap, isUnread && styles.notifItemIconWrapUnread]}>
                        <Ionicons name={iconName as any} size={18} color={isUnread ? "#5B13EC" : Colors.textSecondary} />
                      </View>

                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                          <Text style={[styles.notifItemTitle, isUnread && styles.notifItemTitleBold]} numberOfLines={1}>
                            {item.title}
                          </Text>
                          {isUnread && <View style={styles.unreadDot} />}
                        </View>

                        {item.content ? (
                          <Text style={styles.notifItemContent} numberOfLines={2}>
                            {item.content}
                          </Text>
                        ) : null}

                        <Text style={styles.notifItemTime}>
                          {formatTimeAgo(item.createdAt)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  headerOuterWrap: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    zIndex: 10,
  },
  container: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
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

  // ---------------- Profile Bottom Sheet Modal Styles ----------------
  profileModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  profileBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  profileSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    minHeight: 400,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  profileModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  profileModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  profileModalSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  profileScroll: {
    marginTop: 12,
  },
  profileHeroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  profileHeroAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#5B13EC",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  profileHeroAvatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  profileHeroName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  profileHeroEmail: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  profileHeroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  profileRoleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  profileRoleBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#5B13EC",
    textTransform: "uppercase",
  },
  profileVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  profileVerifiedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#DCFCE7",
    borderWidth: 1,
    borderColor: "#86EFAC",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  successBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorBannerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#991B1B",
    flex: 1,
  },
  sectionHeaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingLeft: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    letterSpacing: 0.6,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  inputFieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  inputFieldDisabled: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    color: "#0F172A",
    fontWeight: "500",
    paddingVertical: 0,
  },
  textInputDisabled: {
    flex: 1,
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  saveProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5B13EC",
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 12,
    shadowColor: "#5B13EC",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  saveProfileBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  workspaceSwitchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FAF5FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  switchCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5B13EC",
  },
  switchCardSub: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  switchRoleActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#5B13EC",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  switchRoleActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  profileLogoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginBottom: 10,
  },
  profileLogoutBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#DC2626",
  },
  sheetFooterVersion: {
    fontSize: 10,
    color: "#94A3B8",
    textAlign: "center",
    paddingVertical: 6,
  },

  // ---------------- Notification Modal Styles ----------------
  notifModalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  notifBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  notifSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: 320,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  notifDragHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    alignSelf: "center",
    marginBottom: 12,
  },
  notifHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  notifSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
  },
  notifCountPill: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  notifCountPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5B13EC",
  },
  markAllReadBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  markAllReadBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#5B13EC",
  },
  notifCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  notifListScroll: {
    marginTop: 10,
  },
  notifEmptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  notifEmptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  notifEmptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  notifEmptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  notifItemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  notifItemUnread: {
    backgroundColor: "#FAF5FF",
    borderColor: "#E9D5FF",
  },
  notifItemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  notifItemIconWrapUnread: {
    backgroundColor: "#F3E8FF",
  },
  notifItemTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  notifItemTitleBold: {
    fontWeight: "800",
    color: "#0F172A",
  },
  notifItemContent: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    lineHeight: 16,
  },
  notifItemTime: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
    fontWeight: "600",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5B13EC",
    marginLeft: 6,
  },
});
