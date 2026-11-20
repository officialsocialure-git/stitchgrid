import React from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ui } from '@/theme/ui';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tab = { section: string; label: string; icon: IconName; selectedIcon: IconName };

const BUYER_TABS: Tab[] = [
  { section: 'home', label: 'Home', icon: 'home-outline', selectedIcon: 'home' },
  { section: 'requests', label: 'Sourcing', icon: 'file-document-outline', selectedIcon: 'file-document' },
  { section: 'orders', label: 'Orders', icon: 'package-variant-closed', selectedIcon: 'package-variant' },
  { section: 'chat', label: 'Chats', icon: 'message-text-outline', selectedIcon: 'message-text' },
  { section: 'organization-settings', label: 'Settings', icon: 'cog-outline', selectedIcon: 'cog' },
];

const SUPPLIER_TABS: Tab[] = [
  { section: 'home', label: 'Home', icon: 'home-outline', selectedIcon: 'home' },
  { section: 'requests', label: 'Sourcing', icon: 'file-document-outline', selectedIcon: 'file-document' },
  { section: 'orders', label: 'Orders', icon: 'package-variant-closed', selectedIcon: 'package-variant' },
  { section: 'chat', label: 'Chats', icon: 'message-text-outline', selectedIcon: 'message-text' },
  { section: 'organization-settings', label: 'Profile', icon: 'account-outline', selectedIcon: 'account' },
];

type Props = {
  role: 'BUYER' | 'SUPPLIER';
  activeSection: string;
  onNavigate: (section: string) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
};

export function AppBottomNav({ role, activeSection, onNavigate, onLayout }: Props) {
  const insets = useSafeAreaInsets();
  const tabs = role === 'SUPPLIER' ? SUPPLIER_TABS : BUYER_TABS;
  const active = activeSection === 'offers' ? 'requests'
    : activeSection === 'tracking' || activeSection === 'samples' || activeSection === 'payments'
      ? 'orders'
      : activeSection === 'profile' || activeSection === 'account-settings'
        ? 'organization-settings'
        : activeSection;

  return (
    <View onLayout={onLayout} style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map(tab => {
        const selected = tab.section === active;
        return (
          <Pressable
            key={tab.section}
            onPress={() => onNavigate(tab.section)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.indicator, selected && styles.indicatorSelected]} />
            <MaterialCommunityIcons
              name={selected ? tab.selectedIcon : tab.icon}
              size={23}
              color={selected ? ui.accent : ui.muted}
              accessible={false}
            />
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
    backgroundColor: ui.surface,
    borderTopColor: ui.border,
    borderTopWidth: 1,
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    paddingTop: 4,
    paddingHorizontal: 4,
    minHeight: 60,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 55,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  indicator: { width: 32, height: 3, borderRadius: 3, backgroundColor: 'transparent', marginBottom: 4 },
  indicatorSelected: { backgroundColor: ui.accent },
  label: { color: ui.muted, fontSize: 12, lineHeight: 16, fontWeight: '500', textAlign: 'center' },
  selectedLabel: { color: ui.accent, fontWeight: '700' },
  pressed: { opacity: 0.62 },
});
