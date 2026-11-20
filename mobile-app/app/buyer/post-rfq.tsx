import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';
import { AppHeader } from '@/components/AppHeader';

export default function PostRfqScreen() {
  const router = useRouter();
  const { supplierName, supplierOrgId } = useLocalSearchParams<{ supplierName?: string; supplierOrgId?: string }>();
  const [modalVisible, setModalVisible] = useState(true);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FC' }}>
      <AppHeader
        isBack
        role="BUYER"
        title={supplierName ? `RFQ for ${supplierName}` : 'Post New Request'}
        showLogo={false}
        onBack={() => router.back()}
      />
      <CreateRfqModal
        visible={modalVisible}
        supplierOrgId={supplierOrgId}
        supplierName={supplierName}
        onClose={() => {
          setModalVisible(false);
          router.back();
        }}
        onSuccess={() => {
          setModalVisible(false);
          router.replace({ pathname: '/buyer/[section]', params: { section: 'requests' } } as any);
        }}
      />
    </View>
  );
}
