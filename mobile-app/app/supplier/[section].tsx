import { ui } from '@/theme/ui';
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
import SupplierBusinessProfileScreen from '@/features/supplier/SupplierBusinessProfileScreen';
import SupplierBusinessGalleryScreen from '@/features/supplier/SupplierBusinessGalleryScreen';
import SupplierProductsPortfolioScreen from '@/features/supplier/SupplierProductsPortfolioScreen';
import SupplierCertificationsScreen from '@/features/supplier/SupplierCertificationsScreen';
import SupplierCompanyInformationScreen from '@/features/supplier/SupplierCompanyInformationScreen';
import SupplierManufacturingCapabilitiesScreen from '@/features/supplier/SupplierManufacturingCapabilitiesScreen';
import SupplierPaymentsScreen from '@/features/supplier/SupplierPaymentsScreen';
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
  if (section === 'business-profile') return <SupplierBusinessProfileScreen />;
  if (section === 'business-gallery') return <SupplierBusinessGalleryScreen />;
  if (section === 'catalog') return <SupplierProductsPortfolioScreen />;
  if (section === 'business-certifications') return <SupplierCertificationsScreen />;
  if (section === 'company-information') return <SupplierCompanyInformationScreen />;
  if (section === 'manufacturing-capabilities') return <SupplierManufacturingCapabilitiesScreen />;
  if (section === 'organization-settings' || section === 'profile') return <OrganizationSettingsScreen />;
  if (section === 'account-settings') return <SupplierAccountSettingsScreen />;
  if (section === 'home' || !section) return <SupplierDashboard />;
  if (section === 'requests') return <SupplierRequestsScreen />;
  if (section === 'offers') return <SupplierMyOffersScreen />;
  if (section === 'orders') return <SupplierMyOrdersScreen />;
  if (section === 'tracking') return <BuyerOrderTrackingScreen />;
  if (section === 'samples') return <BuyerSamplesScreen />;
  if (section === 'payments' || section === 'payment-history') return <SupplierPaymentsScreen />;

  const title = labels[section] || 'Supplier Workspace';
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
      <AppHeader isBack role="SUPPLIER" title={title} showLogo={false} />
      <View style={styles.container}>
        <Text style={styles.brand}>STITCHGRID</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.note}>This section is not available in the mobile app yet. Your requests, offers and orders are still available from the workspace.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.canvas, alignItems: 'center', justifyContent: 'center', padding: 28 },
  brand: { color: ui.accent, fontSize: 24, fontWeight: '700' },
  title: { marginTop: 18, color: '#24212A', fontSize: 20, fontWeight: '700' },
  note: { marginTop: 10, color: '#77717D', fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
