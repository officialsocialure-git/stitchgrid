import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import { AppHeader } from '@/components/AppHeader';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet } from '@/services/api';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

type Refund = { id: string; amount: number | string; status: string; reason?: string | null; createdAt: string };
type Transaction = {
  id: string; amount: number | string; currency: string; status: string; provider: string;
  paymentMilestoneId?: string | null; paymentMethod?: string | null; razorpayPaymentId?: string | null;
  createdAt: string; capturedAt?: string | null; refunds?: Refund[];
};
type PaymentOrder = {
  id: string; poNumber: string; buyerOrgId: string; supplier?: { name: string };
  paymentPlan?: { milestones: { id: string; title: string }[] } | null;
  paymentTransactions?: Transaction[];
};
type Dashboard = { orders: PaymentOrder[] };
type Membership = { organizationId?: string; organization?: { id?: string } };

const money = (value: number | string, currency = 'INR') => {
  const amount = Number(value || 0);
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `₹${amount.toLocaleString('en-IN')}`; }
};
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const statusStyle = (status: string) => {
  if (['PAID', 'RELEASED', 'PROCESSED'].includes(status)) return { bg: '#E8F8F0', fg: '#087653' };
  if (['FAILED', 'REFUNDED', 'REJECTED'].includes(status)) return { bg: '#FDECEC', fg: '#B42318' };
  return { bg: '#FFF3DE', fg: '#9A5B00' };
};

export default function BuyerPaymentHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const [items, setItems] = useState<{ order: PaymentOrder; transaction: Transaction; milestoneTitle: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      const member = raw ? JSON.parse(raw) as Membership : null;
      const orgId = member?.organizationId || member?.organization?.id;
      if (!orgId) throw new Error('Buyer organization membership was not found. Please sign in again.');
      const dashboard = await apiGet<Dashboard>('/payments/dashboard');
      const orders = (dashboard.orders || []).filter(order => order.buyerOrgId === orgId && (!orderId || order.id === orderId));
      const rows = orders.flatMap(order => (order.paymentTransactions || []).map(transaction => ({
        order,
        transaction,
        milestoneTitle: transaction.paymentMethod === 'SAMPLE_PAYMENT' ? 'Sample Payment' : order.paymentPlan?.milestones.find(milestone => milestone.id === transaction.paymentMilestoneId)?.title || 'Order payment',
      })));
      rows.sort((a, b) => new Date(b.transaction.createdAt).getTime() - new Date(a.transaction.createdAt).getTime());
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load payment history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefresh(load, ['*']);

  const navigate = (section: string) => {
    if (section === 'home') router.replace('/workspace?role=BUYER' as any);
    else router.replace({ pathname: '/buyer/[section]', params: { section } } as any);
  };

  return (
    <View style={styles.screen}>
      <AppHeader role="BUYER" activeSection="orders" isBack onBack={() => router.back()} title="Payment History" showLogo={false} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={ui.accent} />}>
        <View style={styles.heading}>
          <Text style={styles.title}>Transactions</Text>
          <Text style={styles.subtitle}>Verified payments, failed attempts and refund request updates for your orders.</Text>
        </View>
        {loading ? (
          <View style={styles.state}><ActivityIndicator color={ui.accent} /><Text style={styles.subtitle}>Loading transactions...</Text></View>
        ) : error ? (
          <View style={styles.state}><MaterialCommunityIcons name="cloud-alert-outline" size={28} color={ui.muted} /><Text style={styles.stateTitle}>Couldn't load payment history</Text><Text style={styles.subtitle}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
        ) : items.length === 0 ? (
          <View style={styles.state}><MaterialCommunityIcons name="receipt-text-outline" size={32} color={ui.muted} /><Text style={styles.stateTitle}>No transactions yet</Text><Text style={styles.subtitle}>Test payment attempts and their simulated results will appear here.</Text></View>
        ) : items.map(({ order, transaction, milestoneTitle }) => {
          const visual = statusStyle(transaction.status);
          return (
            <View key={transaction.id} style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.amount}>{money(transaction.amount, transaction.currency)}</Text>
                  <Text style={styles.po}>{order.poNumber} · {milestoneTitle}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: visual.bg }]}><Text style={[styles.badgeText, { color: visual.fg }]}>{transaction.status.replaceAll('_', ' ')}</Text></View>
              </View>
              <View style={styles.divider} />
              <Info label="Supplier" value={order.supplier?.name || 'Supplier'} />
              <Info label="Date" value={dateLabel(transaction.capturedAt || transaction.createdAt)} />
              <Info label="Payment type" value={transaction.provider === 'MOCK_TEST' ? 'TEST SIMULATOR · NO REAL MONEY' : [transaction.provider, transaction.paymentMethod].filter(Boolean).join(' · ')} />
              <Info label="Transaction ID" value={transaction.razorpayPaymentId || transaction.id} />
              {(transaction.refunds || []).map(refund => (
                <View key={refund.id} style={styles.refund}>
                  <Text style={styles.refundTitle}>Refund · {money(refund.amount, transaction.currency)}</Text>
                  <Text style={styles.refundStatus}>{refund.status.replaceAll('_', ' ')}{refund.reason ? ` · ${refund.reason}` : ''}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>
      <AppBottomNav role="BUYER" activeSection="orders" onNavigate={navigate} />
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { padding: 16, paddingBottom: 30, gap: 14, width: '100%', maxWidth: 840, alignSelf: 'center' },
  heading: { gap: 5 },
  title: { fontSize: 23, fontWeight: '700', color: ui.ink },
  subtitle: { fontSize: 13, lineHeight: 19, color: ui.muted },
  card: { backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, borderRadius: 16, padding: 15, gap: 9 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  amount: { fontSize: 20, fontWeight: '700', color: '#5314B8' },
  po: { fontSize: 12, color: ui.muted, marginTop: 4, lineHeight: 17 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 18 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#ECEEF2' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { fontSize: 12, color: ui.muted },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 12, color: ui.ink, fontWeight: '600' },
  refund: { backgroundColor: '#F8F5FC', borderRadius: 10, padding: 10, gap: 4 },
  refundTitle: { fontSize: 12, fontWeight: '700', color: ui.ink },
  refundStatus: { fontSize: 11, color: ui.muted, lineHeight: 16 },
  state: { backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, borderRadius: 15, padding: 22, alignItems: 'center', gap: 9 },
  stateTitle: { fontSize: 15, fontWeight: '700', color: ui.ink },
  retry: { backgroundColor: '#F1EAFE', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { fontSize: 13, fontWeight: '700', color: ui.accent },
});
