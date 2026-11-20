import { ui } from '@/theme/ui';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import BuyerDashboard from '@/features/buyer/BuyerDashboard';
import SupplierDashboard from '@/features/supplier/SupplierDashboard';

export default function WorkspaceScreen() {
  const { role } = useLocalSearchParams<{ role?: string }>();

  if (role === 'BUYER') {
    return <BuyerDashboard />;
  }

  if (role === 'SUPPLIER') {
    return <SupplierDashboard />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>STITCHGRID</Text>
      <Text style={styles.title}>Workspace setup</Text>
      <Text style={styles.subtitle}>Authenticated workspace role: {role || 'Not assigned'}</Text>
      <Text style={styles.note}>Your workspace could not be opened because this account does not have an active Buyer or Supplier role.</Text>
      <Text style={styles.note}>Please sign in again using an active organization membership.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: ui.canvas, alignItems: 'center', justifyContent: 'center', padding: 28 },
  brand: { color: ui.accent, fontSize: 21, fontWeight: '700', letterSpacing: 1 },
  title: { marginTop: 22, color: '#24212A', fontSize: 21, fontWeight: '700' },
  subtitle: { marginTop: 10, color: '#6B6472', fontSize: 15 },
  note: { marginTop: 20, color: '#77717D', fontSize: 13, textAlign: 'center', lineHeight: 20 },
});