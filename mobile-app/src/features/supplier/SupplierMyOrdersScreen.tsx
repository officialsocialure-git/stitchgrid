import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

type OrderItem = { id: string; name: string; quantity: number; unitPrice?: number | string };
type Milestone = { id: string; title: string; status: string; dueDate?: string | null; completedAt?: string | null };
type PaymentMilestone = { id: string; title: string; sequence: number; percentage: number; amount: number | string; status: string; rejectionReason?: string | null };
type PurchaseOrder = {
  id: string; poNumber: string; status: string; totalAmount: number | string; currency?: string;
  expectedDate?: string | null; createdAt: string; buyerOrgId: string; supplierOrgId: string;
  buyer?: { id: string; name: string; city?: string | null };
  supplier?: { id: string; name: string; city?: string | null };
  items?: OrderItem[]; milestones?: Milestone[]; samples?: { id: string; status: string }[];
  paymentPlan?: { milestones: PaymentMilestone[] } | null;
};
type Membership = { organizationId?: string; organization?: { id?: string }; role?: string };

const FILTERS = [
  { label: 'All Orders', value: 'ALL' },
  { label: 'Pending Acceptance', value: 'PENDING_ACCEPTANCE' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Sample Pending', value: 'SAMPLE_PENDING' },
  { label: 'Sample Approved', value: 'SAMPLE_APPROVED' },
  { label: 'In Production', value: 'IN_PRODUCTION' },
  { label: 'QC Pending', value: 'QC_PENDING' },
  { label: 'Ready to Dispatch', value: 'READY_TO_DISPATCH' },
  { label: 'Dispatched', value: 'DISPATCHED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const money = (value: number | string | null | undefined, currency = 'INR') => {
  const amount = Number(value || 0);
  if (currency === 'INR' && amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount); }
  catch { return `₹${amount.toLocaleString('en-IN')}`; }
};
const dateLabel = (value?: string | null) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not scheduled' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const progressFor = (status: string) => ({
  PO_CREATED: 10, PENDING_ACCEPTANCE: 10, ACCEPTED: 20, SAMPLE_PENDING: 30,
  SAMPLE_APPROVED: 45, PRODUCTION_STARTED: 65, IN_PRODUCTION: 65,
  QC_PENDING: 80, QC: 80, READY_TO_DISPATCH: 90, DISPATCHED: 95,
  DELIVERED: 100, COMPLETED: 100, CANCELLED: 0,
}[status] ?? 10);
const milestoneFor = (order: PurchaseOrder) => {
  const active = order.milestones?.find(item => item.status === 'IN_PROGRESS');
  if (active?.title) return active.title;
  return ({
    COMPLETED: 'Order Fulfilled & Payment Released',
    DELIVERED: 'Delivered at Buyer Warehouse',
    DISPATCHED: 'In Transit (Tracking Active)',
    READY_TO_DISPATCH: 'Packed & Ready for Carrier',
    QC_PENDING: 'Quality Inspection (AQL 2.5)',
    QC: 'Quality Inspection (AQL 2.5)',
    PRODUCTION_STARTED: 'Bulk Production Lines Active',
    IN_PRODUCTION: 'Bulk Production Lines Active',
    SAMPLE_APPROVED: 'Pre-Production Sample Approved',
    SAMPLE_PENDING: 'PP Sample in Review',
    ACCEPTED: 'Order Accepted by Factory',
    CANCELLED: 'Order Cancelled',
  } as Record<string, string>)[order.status] || 'Purchase Order Generated';
};
const readableStatus = (status: string) => status.replaceAll('_', ' ');
const statusColors = (status: string) => status === 'COMPLETED' || status === 'DELIVERED'
  ? { bg: '#E9F8F0', fg: '#087653' }
  : status === 'CANCELLED' ? { bg: '#FEECEC', fg: '#B42318' }
  : { bg: '#F0E7FF', fg: '#5B13B8' };

export default function SupplierMyOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [dispatchOrder, setDispatchOrder] = useState<PurchaseOrder | null>(null);
  const [trackingNumberDraft, setTrackingNumberDraft] = useState('');
  const [sampleOrderIds, setSampleOrderIds] = useState<Set<string>>(new Set());


  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const member = JSON.parse(raw) as Membership;
      const organizationId = member?.organizationId || member?.organization?.id;
      if (member?.role !== 'SUPPLIER' || !organizationId) {
        throw new Error('Active supplier membership not found. Please sign in again.');
      }
      const [response, paymentDashboard, sampleRows] = await Promise.all([
        apiGet<PurchaseOrder[]>('/purchase-orders'),
        apiGet<{ orders?: PurchaseOrder[] }>('/payments/dashboard'),
        apiGet<Array<{ purchaseOrderId: string }>>('/samples').catch(() => [] as Array<{ purchaseOrderId: string }>),
      ]);
      const rows = Array.isArray(response) ? response : [];
      const paymentByOrder = new Map<string, PurchaseOrder>((paymentDashboard.orders || []).map(order => [order.id, order] as const));
      setOrders(rows.filter(order => order.supplierOrgId === organizationId).map(order => ({
        ...order,
        paymentPlan: paymentByOrder.get(order.id)?.paymentPlan || null,
      })));
      setSampleOrderIds(new Set((Array.isArray(sampleRows) ? sampleRows : []).map(sample => sample.purchaseOrderId)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your purchase orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const timer = setInterval(() => { void loadOrders(true); }, 25000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const navigate = (section: string, orderId?: string) => {
    setMenuOpen(false);
    if (section === 'home') {
      router.replace('/workspace?role=SUPPLIER' as any);
      return;
    }
    router.push({ pathname: '/supplier/[section]', params: { section, ...(orderId ? { orderId } : {}) } } as any);
  };

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter(order => {
      const itemNames = (order.items || []).map(item => item.name).join(' ');
      const matchesSearch = !query || [order.poNumber, itemNames, order.buyer?.name || '']
        .some(value => value.toLowerCase().includes(query));
      const matchesFilter = filter === 'ALL' || order.status === filter ||
        (filter === 'IN_PRODUCTION' && order.status === 'PRODUCTION_STARTED') ||
        (filter === 'QC_PENDING' && order.status === 'QC');
      return matchesSearch && matchesFilter;
    });
  }, [orders, search, filter]);

  const updateStatus = (order: PurchaseOrder, nextStatus: string) => {
    if (nextStatus === 'OPEN_SAMPLES') {
      navigate('samples', order.id);
      return;
    }
    if (nextStatus === 'DISPATCHED') {
      void (async () => {
        try {
          setUpdatingId(order.id);
          await apiRequest(`/purchase-orders/${order.id}/status`, {
            method: 'PATCH',
            body: { status: 'DISPATCHED', note: 'Supplier dispatched shipment.' },
          });
          await loadOrders(true);
        } catch (e) {
          Alert.alert('Unable to dispatch shipment', e instanceof Error ? e.message : 'Please try again.');
        } finally {
          setUpdatingId(null);
        }
      })();
      return;
    }
    const actionLabels: Record<string, string> = {
      ACCEPTED: 'accept this purchase order',
      SAMPLE_PENDING: 'mark the PP sample as dispatched for buyer review',
      PRODUCTION_STARTED: 'start bulk production',
      QC_PENDING: 'submit this order for quality inspection',
      READY_TO_DISPATCH: 'mark the quality check as passed',
      DISPATCHED: 'confirm that the shipment has been dispatched',
    };
    Alert.alert('Confirm order update', `Are you sure you want to ${actionLabels[nextStatus] || 'update this order'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        try {
          setUpdatingId(order.id);
          await apiRequest(`/purchase-orders/${order.id}/status`, {
            method: 'PATCH',
            body: {
              status: nextStatus,
              ...(nextStatus === 'QC_PENDING' ? { qcNotes: 'Supplier submitted the completed quality inspection for buyer review.' } : {}),
              note: nextStatus === 'QC_PENDING'
                ? 'Supplier submitted quality inspection. Awaiting buyer review and approval.'
                : `Supplier updated order status to ${nextStatus}`,
            },
          });
          await loadOrders(true);
        } catch (e) {
          Alert.alert('Unable to update order', e instanceof Error ? e.message : 'Please try again.');
        } finally {
          setUpdatingId(null);
        }
      }},
    ]);
  };



  const supplierAction = (order: PurchaseOrder) => {
    if (order.status === 'PO_CREATED' || order.status === 'PENDING_ACCEPTANCE') return { label: 'Accept Order', icon: 'check-decagram', status: 'ACCEPTED', color: '#079669' };

    if (order.status === 'SAMPLE_APPROVED') return { label: 'Start Bulk Production', icon: 'factory', status: 'PRODUCTION_STARTED', color: PURPLE };
    if (order.status === 'PRODUCTION_STARTED' || order.status === 'IN_PRODUCTION') return { label: 'Submit for Quality Inspection', icon: 'clipboard-check', status: 'QC_PENDING', color: PURPLE };
    if (order.status === 'QC_PENDING' || order.status === 'QC') return null;
    if (order.status === 'READY_TO_DISPATCH') return { label: 'Dispatch Shipment', icon: 'truck-delivery', status: 'DISPATCHED', color: PURPLE };
    return null;
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        role="SUPPLIER"
        activeSection="orders"
        onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
      />

      <FlatList
        data={loading || error ? [] : filteredOrders}
        keyExtractor={order => order.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadOrders(true); }} tintColor={PURPLE} />}
        extraData={updatingId}
        ListHeaderComponent={<>
        <Text style={styles.pageTitle}>Purchase Orders (POs)</Text>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={24} color="#68727F" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search by PO ID, product or buyer..." placeholderTextColor={ui.muted} style={styles.searchInput} returnKeyType="search" />
            {!!search && <Pressable onPress={() => setSearch('')}><MaterialCommunityIcons name="close-circle" size={18} color="#9299A3" /></Pressable>}
          </View>
          <Pressable style={styles.filterButton} onPress={() => setFilterOpen(true)}>
            <MaterialCommunityIcons name="filter-variant" size={23} color="#4E5967" />
            <Text style={styles.filterText}>Filter</Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color="#4E5967" />
          </Pressable>
        </View>
        </>}
        ListEmptyComponent=        {loading ? <View style={styles.stateCard}><ActivityIndicator size="large" color={PURPLE} /><Text style={styles.stateText}>Loading purchase orders...</Text></View>
        : error ? <View style={styles.stateCard}><MaterialCommunityIcons name="cloud-alert-outline" size={32} color="#8B929C" /><Text style={styles.stateTitle}>Couldn't load orders</Text><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retryButton} onPress={() => void loadOrders()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
        : <View style={styles.stateCard}><MaterialCommunityIcons name="archive-outline" size={36} color="#A0A6B0" /><Text style={styles.stateTitle}>{orders.length ? 'No matching orders' : 'No purchase orders found'}</Text><Text style={styles.stateText}>{orders.length ? 'Try another search term or status filter.' : 'Purchase orders created when a buyer accepts your quotation will appear here.'}</Text>{(search || filter !== 'ALL') && <Pressable style={styles.retryButton} onPress={() => { setSearch(''); setFilter('ALL'); }}><Text style={styles.retryText}>Clear Search & Filter</Text></Pressable>}</View>}
        renderItem={({ item: order }) => {
          const progress = progressFor(order.status);
          const color = statusColors(order.status);
          const itemText = order.items?.length
            ? order.items.map(item => `${Number(item.quantity || 0).toLocaleString('en-IN')} pcs ${item.name}`).join(', ')
            : 'Garment Production Order';
          const action = supplierAction(order);
          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.metaRow}>
                <Text style={styles.poNumber}>{order.poNumber}</Text>
                <View style={[styles.statusPill, { backgroundColor: color.bg }]}><Text style={[styles.statusText, { color: color.fg }]}>{readableStatus(order.status)}</Text></View>
              </View>
              <Text style={styles.orderTitle}>{itemText}</Text>
              <Text style={styles.buyerLine}>Buyer: <Text style={styles.buyerName}>{order.buyer?.name || 'Buyer'}</Text></Text>
              <View style={styles.amountRow}>
                <Text style={styles.amount}>{money(order.totalAmount, order.currency)}</Text>
                <Text style={styles.targetDate}>Target: {dateLabel(order.expectedDate)}</Text>
              </View>
              <View style={styles.progressPanel}>
                <View style={styles.progressTextRow}>
                  <Text style={styles.currentMilestone}>{milestoneFor(order)}</Text>
                  <Text style={styles.progressPercent}>{progress}%{'\n'}{progress === 100 ? 'Completed' : order.status === 'CANCELLED' ? 'Cancelled' : 'In Progress'}</Text>
                </View>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
              </View>
              {!!order.paymentPlan?.milestones?.length && (() => {
                const paymentMilestones = [...order.paymentPlan.milestones].sort((a, b) => a.sequence - b.sequence);
                const paidCount = paymentMilestones.filter(item => ['PAID', 'RELEASED'].includes(item.status)).length;
                const paymentPercent = Math.round((paidCount / paymentMilestones.length) * 100);
                return <View style={{ backgroundColor: '#F7F2FF', borderRadius: 12, padding: 12, marginBottom: 12, gap: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#5314B8', fontSize: 12, fontWeight: '800' }}>Payment Milestones</Text>
                    <Text style={{ color: '#5314B8', fontSize: 12, fontWeight: '800' }}>{paidCount} of {paymentMilestones.length} paid</Text>
                  </View>
                  <View style={{ height: 7, backgroundColor: '#E2D7F5', borderRadius: 8, overflow: 'hidden' }}><View style={{ height: '100%', width: `${paymentPercent}%`, backgroundColor: PURPLE, borderRadius: 8 }} /></View>
                  <Pressable onPress={() => navigate('payments', order.id)} style={{ alignSelf: 'flex-start', paddingVertical: 5 }}><Text style={{ color: PURPLE, fontSize: 12, fontWeight: '800' }}>View Payment Status & Submit Proof</Text></Pressable>
                </View>;
              })()}
              {order.status === 'ACCEPTED' && !sampleOrderIds.has(order.id) ? <View style={styles.inlineNotice}><MaterialCommunityIcons name="clock-outline" size={18} color="#A66A00" /><Text style={styles.inlineNoticeText}>Awaiting Buyer sample request. You can set the sample price once the request is created.</Text></View> : null}
              {order.status === 'QC_PENDING' || order.status === 'QC' ? <View style={styles.inlineNotice}><MaterialCommunityIcons name="clock-check-outline" size={18} color="#A66A00" /><Text style={styles.inlineNoticeText}>QC report submitted · Awaiting Buyer approval</Text></View> : null}
              {updatingId === order.id ? <View style={styles.updatingRow}><ActivityIndicator color={PURPLE} /><Text style={styles.updatingText}>Updating order...</Text></View>
              : action ? <View style={styles.supplierActionRow}>
                  <Text style={styles.supplierActionLabel}>Supplier Action:</Text>
                  <Pressable style={[styles.acceptButton, { backgroundColor: action.color }]} onPress={() => updateStatus(order, action.status)}>
                    <MaterialCommunityIcons name={action.icon as any} size={21} color="#FFFFFF" />
                    <Text style={styles.acceptButtonText}>{action.label}</Text>
                  </Pressable>
                </View>
              : order.status === 'COMPLETED' ? <View style={styles.completedNotice}><MaterialCommunityIcons name="check-circle" size={18} color="#087653" /><Text style={styles.completedText}>Order completed successfully</Text></View>
              : order.status === 'CANCELLED' ? <View style={styles.cancelledNotice}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.cancelledText}>This purchase order was cancelled</Text></View>
              : null}
              <View style={styles.cardDivider} />
              <View style={styles.actionsRow}>
                <Pressable style={styles.actionItemActive} onPress={() => navigate('tracking', order.id)}>
                  <MaterialCommunityIcons name="factory" size={27} color="#17202D" />
                  <Text style={styles.actionLabel}>Track Milestones</Text>
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => navigate('samples')}>
                  <MaterialCommunityIcons name="hanger" size={27} color="#17202D" />
                  <Text style={styles.actionLabel}>View Samples</Text>
                </Pressable>
                <Pressable style={styles.actionItem} onPress={() => navigate('payments', order.id)}>
                  <MaterialCommunityIcons name="wallet-outline" size={27} color="#17202D" />
                  <Text style={styles.actionLabel}>Secure Payment</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <AppBottomNav role="SUPPLIER" activeSection="orders" onNavigate={(section) => navigate(section)} onLayout={event => setBottomHeight(event.nativeEvent.layout.height)} />



      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.filterSheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Filter Purchase Orders</Text><Pressable onPress={() => setFilterOpen(false)}><MaterialCommunityIcons name="close" size={23} color="#596273" /></Pressable></View>
            <ScrollView style={styles.filterOptions}>
              {FILTERS.map(option => <Pressable key={option.value} style={styles.filterOption} onPress={() => { setFilter(option.value); setFilterOpen(false); }}>
                <Text style={[styles.filterOptionText, filter === option.value && styles.filterOptionActive]}>{option.label}</Text>
                <MaterialCommunityIcons name={filter === option.value ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={filter === option.value ? PURPLE : '#9AA1AA'} />
              </Pressable>)}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={false} transparent animationType="slide" onRequestClose={() => setDispatchOrder(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.filterSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Confirm Shipment Dispatch</Text><Pressable onPress={() => setDispatchOrder(null)}><MaterialCommunityIcons name="close" size={23} color="#596273" /></Pressable></View>
            <Text style={styles.stateText}>Enter the courier or shipment tracking number for PO #{dispatchOrder?.poNumber}. The buyer will receive this update.</Text>
            <View style={styles.searchBox}>
              <TextInput value={trackingNumberDraft} onChangeText={setTrackingNumberDraft} placeholder="Enter tracking number" placeholderTextColor="#8B929C" style={styles.searchInput} autoCapitalize="characters" />
            </View>
            <Pressable style={[styles.acceptButton, { backgroundColor: PURPLE }]} onPress={() => undefined} disabled={!!updatingId}>
              <Text style={styles.acceptButtonText}>{updatingId === dispatchOrder?.id ? 'Updating...' : 'Confirm Dispatch'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  header: { minHeight: 58, backgroundColor: ui.surface, borderBottomWidth: 1, borderBottomColor: '#E9EAF0', paddingHorizontal: 14, paddingBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 37, height: 42, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 142, height: 34, flex: 1, marginHorizontal: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  headerCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3EEFF', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, flexGrow: 1, width: '100%', maxWidth: 840, alignSelf: 'center' },
  pageTitle: { fontSize: 22, lineHeight: 29, fontWeight: '700', color: ui.ink, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: ui.border },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchBox: { flex: 1, minWidth: 0, height: 57, backgroundColor: ui.surface, borderRadius: 12, borderWidth: 1, borderColor: '#E0E3E9', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, elevation: 0 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: ui.ink, paddingVertical: 0 },
  filterButton: { width: 132, height: 57, backgroundColor: ui.surface, borderRadius: 12, borderWidth: 1, borderColor: '#E0E3E9', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 0 },
  filterText: { fontSize: 15, fontWeight: '700', color: ui.ink },
  orderCard: { backgroundColor: ui.surface, borderRadius: 16, borderWidth: 1, borderColor: ui.border, padding: 16, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  poNumber: { color: '#5314B8', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  statusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  orderTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', color: '#142033', marginBottom: 8 },
  buyerLine: { color: '#6C7480', fontSize: 15, marginBottom: 12 },
  buyerName: { color: ui.ink, fontWeight: '700' },
  amountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  amount: { color: '#5314B8', fontSize: 29, fontWeight: '700', letterSpacing: 0.2 },
  targetDate: { color: '#69717D', fontSize: 13, fontWeight: '600', flexShrink: 0 },
  progressPanel: { backgroundColor: '#F6F2FF', borderRadius: 16, padding: 14, marginBottom: 12 },
  progressTextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  currentMilestone: { flex: 1, color: '#5314B8', fontSize: 14, lineHeight: 21, fontWeight: '700' },
  progressPercent: { color: '#68717E', fontSize: 13, lineHeight: 20, textAlign: 'right', fontWeight: '600' },
  progressTrack: { height: 9, backgroundColor: '#DCE8FF', borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#5314B8', borderRadius: 8 },
  inlineNotice: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF7E8', borderColor: '#F4D79B', borderWidth: 1, borderRadius: 11, paddingHorizontal: 11, marginBottom: 13 },
  inlineNoticeText: { flex: 1, color: '#8A5700', fontSize: 12, fontWeight: '700' },
  supplierActionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E9EBEF' },
  supplierActionLabel: { color: '#69717D', fontSize: 13, fontWeight: '600' },
  acceptButton: { minHeight: 47, borderRadius: 13, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 0 },
  acceptButtonText: { color: ui.surface, fontSize: 14, fontWeight: '700' },
  updatingRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E9EBEF' },
  updatingText: { color: '#68717E', fontSize: 13, fontWeight: '700' },
  completedNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E9EBEF' },
  completedText: { color: '#087653', fontSize: 13, fontWeight: '700' },
  cancelledNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E9EBEF' },
  cancelledText: { color: '#B42318', fontSize: 13, fontWeight: '700' },
  cardDivider: { height: 1, backgroundColor: '#E9EBEF', marginVertical: 13 },
  actionsRow: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between', gap: 5 },
  actionItem: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 2 },
  actionItemActive: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: '#D8DCE2', paddingHorizontal: 2 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: ui.ink, textAlign: 'center' },
  stateCard: { backgroundColor: ui.surface, borderRadius: 16, borderWidth: 1, borderColor: ui.border, padding: 24, alignItems: 'center', gap: 9, marginTop: 12 },
  stateTitle: { fontSize: 16, fontWeight: '700', color: ui.ink, textAlign: 'center' },
  stateText: { fontSize: 13, color: '#737B87', textAlign: 'center', lineHeight: 19 },
  retryButton: { backgroundColor: ui.accentSoft, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 11, marginTop: 3 },
  retryText: { fontSize: 13, fontWeight: '700', color: PURPLE },
  bottomNav: { minHeight: 75, backgroundColor: ui.surface, borderTopWidth: 1, borderTopColor: '#E6E8ED', paddingTop: 7, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { minWidth: 57, minHeight: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 4, gap: 2 },
  navItemActive: { backgroundColor: ui.accentSoft },
  navLabel: { fontSize: 10, color: ui.muted, fontWeight: '600' },
  navLabelActive: { color: PURPLE, fontWeight: '700' },
  drawerLayer: { position: 'absolute', left: 0, right: 0, zIndex: 30, flexDirection: 'row' },
  drawer: { width: '68%', maxWidth: 320, backgroundColor: ui.surface, paddingTop: 18, paddingHorizontal: 14, elevation: 0, shadowColor: '#000', shadowOpacity: 0, shadowRadius: 12, shadowOffset: { width: 3, height: 0 } },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(13,10,22,.38)' },
  drawerItem: { minHeight: 49, borderRadius: 12, marginBottom: 3, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  drawerItemActive: { backgroundColor: PURPLE },
  drawerText: { fontSize: 15, fontWeight: '600', color: '#4B515B' },
  drawerTextActive: { color: ui.surface, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(13,10,22,.45)', justifyContent: 'flex-end' },
  filterSheet: { backgroundColor: ui.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: '78%' },
  sheetHandle: { width: 45, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 17 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: ui.ink },
  filterOptions: { flexGrow: 0 },
  filterOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F0F1F3' },
  filterOptionText: { color: '#47505D', fontSize: 14, fontWeight: '600' },
  filterOptionActive: { color: PURPLE, fontWeight: '700' },
});
