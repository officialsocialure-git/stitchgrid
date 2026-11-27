import React, { useEffect, useState } from 'react';
import { DeviceEventEmitter, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { apiGet } from '@/services/api';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ui } from '@/theme/ui';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tab = { section: string; label: string; icon: IconName; selectedIcon: IconName };

const BUYER_TABS: Tab[] = [
  { section: 'home', label: 'Home', icon: 'home-outline', selectedIcon: 'home' },
  { section: 'offers', label: 'Offer', icon: 'tag-outline', selectedIcon: 'tag' },
  { section: 'rfq', label: 'RFQ', icon: 'file-document-outline', selectedIcon: 'file-document' },
  { section: 'orders', label: 'Orders', icon: 'package-variant-closed', selectedIcon: 'package-variant' },
  { section: 'cart', label: 'Cart', icon: 'cart-outline', selectedIcon: 'cart' },
];

const SUPPLIER_TABS: Tab[] = [
  { section: 'home', label: 'Home', icon: 'home-outline', selectedIcon: 'home' },
  { section: 'requests', label: 'Offers', icon: 'file-document-outline', selectedIcon: 'file-document' },
  { section: 'orders', label: 'Orders', icon: 'package-variant-closed', selectedIcon: 'package-variant' },
  { section: 'chat', label: 'Chats', icon: 'message-text-outline', selectedIcon: 'message-text' },
  { section: 'business-profile', label: 'Profile', icon: 'account-outline', selectedIcon: 'account' },
];

type Props = {
  role: 'BUYER' | 'SUPPLIER';
  activeSection: string;
  onNavigate: (section: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function AppBottomNav({ role, activeSection, onNavigate, onLayout }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tabs = role === 'SUPPLIER' ? SUPPLIER_TABS : BUYER_TABS;
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    if (role !== 'BUYER') return;
    let alive = true;
    const refresh = async () => {
      try {
        const raw = await SecureStore.getItemAsync('sg_membership');
        const member = raw ? JSON.parse(raw) : null;
        const orgId = member?.organizationId || member?.organization?.id;
        if (!orgId) return;
        const cart = await apiGet<{ itemCount?: number }>(`/cart?organizationId=${encodeURIComponent(orgId)}`);
        if (alive) setCartCount(Number(cart?.itemCount) || 0);
      } catch {}
    };
    void refresh();
    const subscription = DeviceEventEmitter.addListener('stitchgrid:cart-updated', refresh);
    return () => { alive = false; subscription.remove(); };
  }, [role]);
  const active = role === 'BUYER'
    ? activeSection === 'offers' || activeSection === 'requests' ? 'offers'
      : activeSection === 'rfq' ? 'rfq'
        : activeSection === 'tracking' || activeSection === 'samples' || activeSection === 'payments' ? 'orders'
          : activeSection
    : activeSection === 'offers' ? 'requests'
      : activeSection === 'tracking' || activeSection === 'samples' || activeSection === 'payments' ? 'orders'
        : activeSection === 'profile' || activeSection === 'account-settings' || activeSection === 'organization-settings' ? 'business-profile'
          : activeSection;

  const handleTabPress = (section: string) => {
    if (role === 'BUYER' && section === 'rfq') {
      router.push('/buyer/post-rfq' as any);
      return;
    }
    if (role === 'BUYER' && section === 'cart') {
      router.push('/buyer/cart' as any);
      return;
    }
    onNavigate(section);
  };

  return (
    <View onLayout={onLayout} style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {tabs.map(tab => {
          const selected = tab.section === active;
          return (
            <Pressable
              key={tab.section}
              onPress={() => handleTabPress(tab.section)}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={{ position: 'relative' }}>
                <MaterialCommunityIcons
                  name={selected ? tab.selectedIcon : tab.icon}
                  size={25}
                  color={selected ? ui.accent : '#252B36'}
                  accessible={false}
                />
                {role === 'BUYER' && tab.section === 'cart' && cartCount > 0 ? <View style={{ position: 'absolute', right: -10, top: -8, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: ui.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{cartCount > 99 ? '99+' : cartCount}</Text></View> : null}
              </View>
              <Text numberOfLines={1} style={[styles.label, selected && styles.selectedLabel]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#E8E8EE',
    borderTopWidth: 1,
    width: '100%',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 10,
  },
  bar: {
    flexDirection: 'row',
    paddingTop: 7,
    paddingHorizontal: 5,
    minHeight: 67,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  label: { color: '#303746', fontSize: 12, lineHeight: 16, fontWeight: '500', textAlign: 'center' },
  selectedLabel: { color: ui.accent, fontWeight: '700' },
  pressed: { opacity: 0.62 },
});
