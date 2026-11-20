import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ui } from '@/theme/ui';

type Role = 'BUYER' | 'SUPPLIER';
type Section = 'requests' | 'offers';

export function SourcingTabs({ role, active }: { role: Role; active: Section }) {
  const router = useRouter();
  const open = (section: Section) => {
    if (section === active) return;
    router.replace({
      pathname: role === 'SUPPLIER' ? '/supplier/[section]' : '/buyer/[section]',
      params: { section },
    } as any);
  };
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {(['requests', 'offers'] as const).map(section => (
        <Pressable
          key={section}
          accessibilityRole="tab"
          accessibilityLabel={section === 'requests' ? (role === 'SUPPLIER' ? 'Buyer requests' : 'My requests') : 'My offers'}
          accessibilityState={{ selected: section === active }}
          onPress={() => open(section)}
          style={({ pressed }) => [styles.tab, section === active && styles.active, pressed && styles.pressed]}
        >
          <Text style={[styles.text, section === active && styles.activeText]}>
            {section === 'requests' ? 'Requests' : 'Offers'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', backgroundColor: ui.surfaceMuted, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: ui.border, gap: 4 },
  tab: { flex: 1, minHeight: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.borderStrong },
  text: { fontSize: 14, fontWeight: '600', color: ui.body },
  activeText: { color: ui.accent, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
