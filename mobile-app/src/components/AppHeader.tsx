import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  LayoutChangeEvent,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet } from '@/services/api';

export const HEADER_PURPLE = '#5B13EC';
export const HEADER_LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

export type AppHeaderProps = {
  role?: 'BUYER' | 'SUPPLIER';
  activeSection?: string;
  isBack?: boolean;
  onBack?: () => void;
  title?: string;
  showLogo?: boolean;
  unreadCount?: number;
  onNotificationPress?: () => void;
  onProfilePress?: () => void;
  rightAction?: React.ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
  menuOpen?: boolean;
  onMenuToggle?: (isOpen: boolean) => void;
  enableDrawer?: boolean;
};

const BUYER_MENU: [string, string, any][] = [
  ['Home', 'home', 'home-outline'],
  ['My Requests', 'requests', 'file-document-outline'],
  ['My Offers', 'offers', 'swap-horizontal'],
  ['My Orders', 'orders', 'archive-outline'],
  ['Order Tracking', 'tracking', 'factory'],
  ['Samples', 'samples', 'hanger'],
  ['Chats', 'chat', 'message-text-outline'],
  ['Organization Settings', 'organization-settings', 'cog-outline'],
];

const SUPPLIER_MENU: [string, string, any][] = [
  ['Home', 'home', 'home-outline'],
  ['Buyer Requests', 'requests', 'format-list-bulleted'],
  ['My Offers', 'offers', 'tag-outline'],
  ['My Orders', 'orders', 'archive-outline'],
  ['Tracking', 'tracking', 'factory'],
  ['Samples', 'samples', 'hanger'],
  ['Chats', 'chat', 'message-text-outline'],
  ['Settings', 'organization-settings', 'cog-outline'],
];

export function AppHeader({
  role = 'BUYER',
  activeSection = 'home',
  isBack = false,
  onBack,
  title,
  showLogo = true,
  unreadCount: propUnread,
  onNotificationPress,
  onProfilePress,
  rightAction,
  onLayout,
  menuOpen: controlledMenuOpen,
  onMenuToggle,
  enableDrawer = true,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [detectedUnread, setDetectedUnread] = useState(0);

  const isMenuOpen = controlledMenuOpen !== undefined ? controlledMenuOpen : internalMenuOpen;

  const toggleMenu = useCallback(() => {
    const next = !isMenuOpen;
    if (onMenuToggle) {
      onMenuToggle(next);
    } else {
      setInternalMenuOpen(next);
    }
  }, [isMenuOpen, onMenuToggle]);

  const closeMenu = useCallback(() => {
    if (onMenuToggle) {
      onMenuToggle(false);
    } else {
      setInternalMenuOpen(false);
    }
  }, [onMenuToggle]);

  // If unread count is not explicitly supplied, attempt to fetch count silently
  useEffect(() => {
    if (propUnread !== undefined) return;
    let active = true;
    apiGet<any[]>('/notifications')
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const unread = data.filter((item) => !item.readAt).length;
        setDetectedUnread(unread);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [propUnread]);

  const displayUnread = propUnread !== undefined ? propUnread : detectedUnread;

  const handleNotificationPress = () => {
    closeMenu();
    if (onNotificationPress) {
      onNotificationPress();
      return;
    }
    const targetPath = role === 'SUPPLIER' ? '/supplier/[section]' : '/buyer/[section]';
    router.push({ pathname: targetPath, params: { section: 'notifications' } } as any);
  };

  const handleProfilePress = () => {
    closeMenu();
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    setAccountMenuOpen(true);
  };

  const openAccountMenuItem = (section: 'organization-settings' | 'account-settings') => {
    setAccountMenuOpen(false);
    const targetPath = role === 'SUPPLIER' ? '/supplier/[section]' : '/buyer/[section]';
    router.push({ pathname: targetPath, params: { section } } as any);
  };

  const confirmLogout = () => {
    setAccountMenuOpen(false);
    Alert.alert('Logout', 'Are you sure you want to logout from STITCHGRID?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        try {
          await Promise.all([
            SecureStore.deleteItemAsync('sg_token'),
            SecureStore.deleteItemAsync('sg_user'),
            SecureStore.deleteItemAsync('sg_membership'),
          ]);
          router.replace('/' as any);
        } catch {
          Alert.alert('Logout failed', 'Please try again.');
        }
      } },
    ]);
  };

  const handleNavigate = (section: string) => {
    closeMenu();
    if (section === 'home') {
      router.replace(role === 'SUPPLIER' ? '/workspace?role=SUPPLIER' : '/workspace?role=BUYER' as any);
      return;
    }
    const targetPath = role === 'SUPPLIER' ? '/supplier/[section]' : '/buyer/[section]';
    router.push({ pathname: targetPath, params: { section } } as any);
  };

  const menuItems = role === 'SUPPLIER' ? SUPPLIER_MENU : BUYER_MENU;

  return (
    <>
      <View
        onLayout={onLayout}
        style={[
          styles.headerContainer,
          {
            paddingTop: Math.max(insets.top, 8),
          },
        ]}
      >
        {/* Left Action: Back Button OR Menu Toggle */}
        <View style={styles.leftContainer}>
          {isBack ? (
            <Pressable
              onPress={onBack || (() => router.back())}
              hitSlop={8}
              style={styles.iconButton}
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color="#5314E8" />
            </Pressable>
          ) : (
            <Pressable
              onPress={toggleMenu}
              hitSlop={8}
              style={styles.iconButton}
              accessibilityLabel={isMenuOpen ? 'Close Menu' : 'Open Menu'}
            >
              <MaterialCommunityIcons
                name={isMenuOpen ? 'close' : 'menu'}
                size={22}
                color="#68727F"
              />
            </Pressable>
          )}
        </View>

        {/* Center: Brand Logo OR Page Title */}
        <View style={styles.centerContainer}>
          {showLogo ? (
            <Image
              source={{ uri: HEADER_LOGO_URI }}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="STITCHGRID"
            />
          ) : (
            <Text numberOfLines={1} style={styles.titleText}>
              {title || 'STITCHGRID'}
            </Text>
          )}
        </View>

        {/* Right Actions: Notifications & Profile/Settings */}
        <View style={styles.rightContainer}>
          {rightAction ? (
            rightAction
          ) : (
            <>
              {/* Notification Circular Button */}
              <Pressable
                onPress={handleNotificationPress}
                hitSlop={8}
                style={styles.circleButton}
                accessibilityLabel="Notifications"
              >
                <MaterialCommunityIcons name="bell-outline" size={20} color={HEADER_PURPLE} />
                {displayUnread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {displayUnread > 99 ? '99+' : displayUnread}
                    </Text>
                  </View>
                )}
              </Pressable>

              {/* Profile Circular Button */}
              <Pressable
                onPress={handleProfilePress}
                hitSlop={8}
                style={styles.circleButton}
                accessibilityLabel="Profile and Settings"
              >
                <MaterialCommunityIcons name="account-outline" size={20} color={HEADER_PURPLE} />
              </Pressable>
            </>
          )}
        </View>
      </View>

      <Modal visible={accountMenuOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAccountMenuOpen(false)}>
        <View style={styles.accountMenuRoot}>
          <Pressable style={styles.accountMenuBackdrop} onPress={() => setAccountMenuOpen(false)} />
          <View style={[styles.accountMenu, { top: Math.max(insets.top, 8) + 58 }]}>
            <Pressable style={styles.accountMenuItem} onPress={() => openAccountMenuItem('organization-settings')}>
              <MaterialCommunityIcons name="account-outline" size={21} color="#667085" />
              <Text style={styles.accountMenuText}>My Profile</Text>
            </Pressable>
            <View style={styles.accountMenuDivider} />
            <Pressable style={styles.accountMenuItem} onPress={() => openAccountMenuItem('account-settings')}>
              <MaterialCommunityIcons name="cog-outline" size={21} color="#667085" />
              <Text style={styles.accountMenuText}>Account Settings</Text>
            </Pressable>
            <View style={styles.accountMenuDivider} />
            <Pressable style={styles.accountMenuItem} onPress={confirmLogout}>
              <MaterialCommunityIcons name="logout" size={21} color="#DC2626" />
              <Text style={[styles.accountMenuText, styles.accountMenuLogout]}>Logout</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Drawer Overlay Menu */}
      {enableDrawer && isMenuOpen && (
        <Modal
          visible={isMenuOpen}
          transparent
          animationType="fade"
          onRequestClose={closeMenu}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.backdrop} onPress={closeMenu} />
            <View
              style={[
                styles.drawerCard,
                {
                  top: Math.max(insets.top, 8) + 60,
                  maxHeight: '75%',
                },
              ]}
            >
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerRoleTitle}>
                  {role === 'SUPPLIER' ? 'Manufacturer Workspace' : 'Buyer Brand Workspace'}
                </Text>
                <Pressable onPress={closeMenu} hitSlop={10}>
                  <MaterialCommunityIcons name="close" size={20} color="#68727F" />
                </Pressable>
              </View>

              <View style={styles.drawerDivider} />

              {menuItems.map(([label, sectionKey, iconName]) => {
                const isActive = activeSection === sectionKey;
                return (
                  <Pressable
                    key={sectionKey}
                    onPress={() => handleNavigate(sectionKey)}
                    style={[styles.drawerItem, isActive && styles.drawerItemActive]}
                  >
                    <MaterialCommunityIcons
                      name={iconName}
                      size={20}
                      color={isActive ? '#FFFFFF' : '#556170'}
                      style={{ marginRight: 12 }}
                    />
                    <Text
                      style={[
                        styles.drawerItemText,
                        isActive && styles.drawerItemTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                    {isActive && (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color="#FFFFFF"
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    minHeight: 58,
    maxHeight: 64,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#ECEEF2',
    paddingHorizontal: 15,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  leftContainer: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  logo: {
    width: 145,
    height: 35,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1C2430',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#ECE5F9',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#E11D48',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'center',
  },
  accountMenuRoot: { flex: 1 },
  accountMenuBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  accountMenu: {
    position: 'absolute', right: 14, width: 250, backgroundColor: '#FFFFFF',
    borderRadius: 18, borderWidth: 1, borderColor: '#E9EBF0', paddingVertical: 8,
    paddingHorizontal: 8, shadowColor: '#1E1B4B', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16, shadowRadius: 18, elevation: 10,
  },
  accountMenuItem: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 12 },
  accountMenuText: { color: '#202633', fontSize: 15, fontWeight: '600' },
  accountMenuLogout: { color: '#DC2626' },
  accountMenuDivider: { height: 1, backgroundColor: '#EEF0F3', marginHorizontal: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawerCard: {
    position: 'absolute',
    left: 14,
    width: 275,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E9EBF0',
    paddingVertical: 14,
    paddingHorizontal: 10,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  drawerRoleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: HEADER_PURPLE,
    letterSpacing: 0.4,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: '#F0F2F6',
    marginVertical: 6,
    marginHorizontal: 6,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  drawerItemActive: {
    backgroundColor: HEADER_PURPLE,
  },
  drawerItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#384250',
  },
  drawerItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
