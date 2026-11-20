import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import SupplierDashboard from '@/features/supplier/SupplierDashboard';
import SupplierRequestsScreen from '@/features/supplier/SupplierRequestsScreen';
import SupplierMyOffersScreen from '@/features/supplier/SupplierMyOffersScreen';
import SupplierMyOrdersScreen from '@/features/supplier/SupplierMyOrdersScreen';
import BuyerOrderTrackingScreen from '@/features/buyer/BuyerOrderTrackingScreen';
import BuyerSamplesScreen from '@/features/buyer/BuyerSamplesScreen';
import BuyerNotificationsScreen from '@/features/buyer/BuyerNotificationsScreen';
import BuyerChatScreen from '@/features/buyer/BuyerChatScreen';
import OrganizationSettingsScreen from '@/features/shared/OrganizationSettingsScreen';
import SupplierAccountSettingsScreen from '@/features/supplier/SupplierAccountSettingsScreen';
import { AppHeader } from '@/components/AppHeader';

const labels: Record<string, string> = {
  requests: 'Buyer Requests',
  offers: 'My Offers',
  orders: 'My Orders',
  tracking: 'Tracking',
  samples: 'Samples',
  chat: 'Chats',
  payments: 'Payments',
};

export default function SupplierSectionScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  if (section === 'notifications') return <BuyerNotificationsScreen />;
  if (section === 'chat') return <BuyerChatScreen />;
  if (section === 'organization-settings' || section === 'profile') return <OrganizationSettingsScreen />;
  if (section === 'account-settings') return <SupplierAccountSettingsScreen />;
  if (section === 'home' || !section) return <SupplierDashboard />;
  if (section === 'requests') return <SupplierRequestsScreen />;
  if (section === 'offers') return <SupplierMyOffersScreen />;
  if (section === 'orders') return <SupplierMyOrdersScreen />;
  if (section === 'tracking') return <BuyerOrderTrackingScreen />;
  if (section === 'samples') return <BuyerSamplesScreen />;

  const title = labels[section] || 'Supplier Workspace';
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
      <AppHeader isBack role="SUPPLIER" title={title} showLogo={false} />
      <View style={styles.container}>
        <Text style={styles.brand}>STITCHGRID</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>This Supplier screen will be built from your next reference image. Your Home dashboard and existing account data remain available.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FC', alignItems: 'center', justifyContent: 'center', padding: 28 },
  brand: { color: '#5B13EC', fontSize: 24, fontWeight: '900' },
  title: { marginTop: 18, color: '#24212A', fontSize: 20, fontWeight: '800' },
  note: { marginTop: 10, color: '#77717D', fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
