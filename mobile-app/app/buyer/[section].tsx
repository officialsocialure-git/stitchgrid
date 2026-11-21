import { ui } from '@/theme/ui';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BuyerRequestsScreen from '@/features/buyer/BuyerRequestsScreen';
import BuyerMyOffersScreen from '@/features/buyer/BuyerMyOffersScreen';
import BuyerMyOrdersScreen from '@/features/buyer/BuyerMyOrdersScreen';
import BuyerOrderTrackingScreen from '@/features/buyer/BuyerOrderTrackingScreen';
import BuyerPaymentsScreen from '@/features/buyer/BuyerPaymentsScreen';
import BuyerPaymentHistoryScreen from '@/features/buyer/BuyerPaymentHistoryScreen';
import BuyerSamplesScreen from '@/features/buyer/BuyerSamplesScreen';
import BuyerNotificationsScreen from '@/features/buyer/BuyerNotificationsScreen';
import BuyerChatScreen from '@/features/buyer/BuyerChatScreen';
import OrganizationSettingsScreen from '@/features/shared/OrganizationSettingsScreen';
import { AppHeader } from '@/components/AppHeader';

const SECTIONS: Record<string, { title: string; icon: string; description: string }> = {
  requests: { title: 'My Requests', icon: 'file-document-currency-outline', description: 'View and manage the RFQs you have created.' },
  offers: { title: 'My Offers', icon: 'swap-horizontal', description: 'Compare quotations received from your production partners.' },
  orders: { title: 'My Orders', icon: 'archive-outline', description: 'View your purchase orders and order details.' },
  tracking: { title: 'Order Tracking', icon: 'factory', description: 'Follow production milestones, quality checks and dispatch progress.' },
  samples: { title: 'Samples', icon: 'hanger', description: 'Review samples, supplier updates and approval status.' },
  chat: { title: 'Chat', icon: 'message-text-outline', description: 'Continue conversations with your suppliers.' },
  payments: { title: 'Payments', icon: 'wallet-outline', description: 'View payment milestones and supplier proof approvals.' },
  'payment-history': { title: 'Payment History', icon: 'receipt-text-outline', description: 'View verified payments, failed attempts and refund updates.' },

  'organization-settings': { title: 'Organization Settings', icon: 'cog-outline', description: 'Manage your organization profile and business details.' },
  'account-settings': { title: 'Account Settings', icon: 'account-cog-outline', description: 'Manage your account and organization details.' },
};

export default function BuyerSectionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { section } = useLocalSearchParams<{ section: string }>();
  const page = SECTIONS[String(section)] || { title: 'Buyer Workspace', icon: 'view-dashboard', description: 'Choose a section from the Buyer menu.' };

  if (String(section) === 'requests') return <BuyerRequestsScreen />;
  if (String(section) === 'offers') return <BuyerMyOffersScreen />;
  if (String(section) === 'orders') return <BuyerMyOrdersScreen />;
  if (String(section) === 'tracking') return <BuyerOrderTrackingScreen />;
  if (String(section) === 'payments') return <BuyerPaymentsScreen />;
  if (String(section) === 'payment-history') return <BuyerPaymentHistoryScreen />;
  if (String(section) === 'samples') return <BuyerSamplesScreen />;
  if (String(section) === 'notifications') return <BuyerNotificationsScreen />;
  if (String(section) === 'chat') return <BuyerChatScreen />;
  if (String(section) === 'organization-settings' || String(section) === 'account-settings') return <OrganizationSettingsScreen />;

  return (
    <View style={styles.screen}>
      <AppHeader isBack role="BUYER" title={page.title} showLogo={false} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name={page.icon as any} size={24} color={ui.accent} />
        </View>
        <Text style={styles.title}>{page.title}</Text>
        <Text style={styles.description}>{page.description}</Text>
        <View style={styles.notice}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#6D4AB2" />
          <Text style={styles.noticeText}>This section is not available in the mobile app yet. You can continue managing your orders, requests and messages from your workspace.</Text>
        </View>
        <Pressable style={styles.homeButton} onPress={() => router.replace('/workspace?role=BUYER' as any)}>
          <MaterialCommunityIcons name="home-outline" size={19} color="#FFFFFF" />
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  header:{minHeight:64,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:'#E9EAF0',paddingHorizontal:14,paddingBottom:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  backButton:{width:36,height:36,alignItems:'center',justifyContent:'center'},
  headerTitle:{fontSize:16,fontWeight: '700',color:ui.ink},
  content:{flexGrow:1,alignItems:'center',justifyContent:'center',padding:22},
  iconWrap:{width:66,height:66,borderRadius:20,backgroundColor:ui.accentSoft,alignItems:'center',justifyContent:'center'},
  title:{fontSize:22,fontWeight: '700',color:ui.ink,marginTop:18},
  description:{fontSize:14,color:'#727B88',textAlign:'center',lineHeight:21,marginTop:8,maxWidth:310},
  notice:{flexDirection:'row',alignItems:'flex-start',gap:10,backgroundColor:ui.accentSoft,borderRadius:14,padding:14,marginTop:24,maxWidth:390},
  noticeText:{flex:1,fontSize: 13,color:'#615775',lineHeight:18},
  homeButton:{height:46,backgroundColor:ui.accent,borderRadius:13,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:22},
  homeButtonText:{fontSize:14,fontWeight: '700',color:ui.surface},
});