import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPost, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

type Milestone = { id: string; title: string; status: string; dueDate?: string | null; completedAt?: string | null };
type OrderItem = { id: string; name: string; quantity: number; unitPrice?: number | string };
type SamplePaymentInfo = {
  id: string; status: string; sampleName?: string; sampleType?: string;
  parsedMeta?: { samplePrice?: number | string; samplePaymentStatus?: string };
};
type QcReport = { id: string; status: string; totalQuantity: number; inspectedQuantity: number; passedQuantity: number; defectiveQuantity: number; checklist: Record<string, boolean>; photos: string[]; defectivePhotos?: string[] | null; remarks?: string | null; buyerFeedback?: string | null; submittedAt: string };
type Order = {
  id: string; poNumber: string; status: string; totalAmount: number | string; currency?: string; qcNotes?: string | null;
  expectedDate?: string | null; createdAt: string; buyerOrgId: string; supplierOrgId: string;
  buyer?: { id: string; name: string; city?: string | null };
  supplier?: { id: string; name: string; city?: string | null };
  items?: OrderItem[]; milestones?: Milestone[]; samples?: { id: string; status: string }[]; qcReports?: QcReport[];
};
type Membership = { organizationId?: string; organization?: { id?: string }; role?: string };
type PaymentSummary = {
  id: string;
  buyerOrgId: string;
  paymentPlan?: { totalAmount: number | string; currency: string; milestones: { id: string; title: string; sequence: number; percentage: number | string; amount: number | string; status: string }[] } | null;
};

const money = (value: number | string | null | undefined, currency = 'INR') => {
  const amount = Number(value || 0);
  if (currency === 'INR' && amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
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
const milestoneFor = (order: Order) => {
  const active = order.milestones?.find(m => m.status === 'IN_PROGRESS');
  if (active?.title) return active.title;
  const status = order.status;
  if (status === 'COMPLETED') return 'Order Fulfilled & Payment Released';
  if (status === 'DELIVERED') return 'Delivered at Buyer Warehouse';
  if (status === 'DISPATCHED') return 'In Transit (Tracking Active)';
  if (status === 'READY_TO_DISPATCH') return 'Packed & Ready for Carrier';
  if (status === 'QC_PENDING' || status === 'QC') return 'Quality Inspection (AQL 2.5)';
  if (status === 'PRODUCTION_STARTED' || status === 'IN_PRODUCTION') return 'Bulk Production Lines Active';
  if (status === 'SAMPLE_APPROVED') return 'Pre-Production Sample Approved';
  if (status === 'SAMPLE_PENDING') return 'PP Sample in Review';
  if (status === 'ACCEPTED') return 'Order Accepted by Factory';
  if (status === 'CANCELLED') return 'Order Cancelled';
  return 'Purchase Order Generated';
};
const statusLabel = (status: string) => status.replaceAll('_', ' ');
const statusColor = (status: string) => status === 'COMPLETED' || status === 'DELIVERED'
  ? { bg: '#F1E6FF', fg: '#5B13B8' }
  : status === 'CANCELLED' ? { bg: '#FEECEC', fg: '#B42318' }
    : { bg: '#F1E6FF', fg: '#5B13B8' };

export default function BuyerMyOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [milestoneOrder, setMilestoneOrder] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([]);
  const [paymentSummaries, setPaymentSummaries] = useState<Record<string, PaymentSummary['paymentPlan']>>({});
  const [samplesByOrder, setSamplesByOrder] = useState<Record<string, SamplePaymentInfo[]>>({});
  const [samplePaymentOpen, setSamplePaymentOpen] = useState<{ order: Order; sample: SamplePaymentInfo } | null>(null);
  const [samplePaymentBusy, setSamplePaymentBusy] = useState(false);
  const [qcReviewOrder, setQcReviewOrder] = useState<Order | null>(null);
  const [qcFeedback, setQcFeedback] = useState('');


  const loadOrders = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      const member = raw ? JSON.parse(raw) as Membership : null;
      setMembership(member);
      const orgId = member?.organizationId || member?.organization?.id;
      if (!orgId) throw new Error('Buyer organization membership was not found. Please sign in again.');
      const [data, sampleData] = await Promise.all([apiGet<Order[]>('/purchase-orders'), apiGet<SamplePaymentInfo[]>('/samples').catch(() => [] as SamplePaymentInfo[])]);
      const list = Array.isArray(data) ? data : [];
      // The shared endpoint returns orders for every active organization membership.
      // My Orders must show only POs where the signed-in organization is the buyer.
      const buyerOrders = list.filter(order => order.buyerOrgId === orgId);
      setOrders(buyerOrders);
      const sampleMap: Record<string, SamplePaymentInfo[]> = {};
      (Array.isArray(sampleData) ? sampleData : []).forEach(sample => {
        const sampleOrderId = (sample as SamplePaymentInfo & { purchaseOrderId?: string }).purchaseOrderId;
        if (sampleOrderId) sampleMap[sampleOrderId] = [...(sampleMap[sampleOrderId] || []), sample];
      });
      setSamplesByOrder(sampleMap);
      try {
        let paymentDashboard = await apiGet<{ orders: PaymentSummary[] }>('/payments/dashboard');
        let paymentOrders = (paymentDashboard.orders || []).filter(order => order.buyerOrgId === orgId);
        const missingPlans = paymentOrders.filter(order => !order.paymentPlan);
        await Promise.all(missingPlans.map(order => apiPost(`/payments/orders/${order.id}/plan`, {})));
        if (missingPlans.length) {
          paymentDashboard = await apiGet<{ orders: PaymentSummary[] }>('/payments/dashboard');
          paymentOrders = (paymentDashboard.orders || []).filter(order => order.buyerOrgId === orgId);
        }
        setPaymentSummaries(Object.fromEntries(paymentOrders.map(order => [order.id, order.paymentPlan || null])));
      } catch {
        // Keep order tracking available if payment services are temporarily unavailable.
        setPaymentSummaries({});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your purchase orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    const interval = setInterval(() => { void loadOrders(true); }, 25000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const navigate = (section: string) => {
    setDrawerOpen(false);
    if (section === 'home') router.replace('/workspace?role=BUYER' as any);
    else router.replace({ pathname: '/buyer/[section]', params: { section } } as any);
  };

  const updateOrderStatus = async (order: Order, status: string) => {
    const label = status === 'SAMPLE_APPROVED' ? 'approve the pre-production sample' :
      status === 'DELIVERED' ? 'confirm delivery received' : 'mark the order completed';
    Alert.alert('Confirm order update', `Are you sure you want to ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm', onPress: async () => {
          try {
            setUpdatingOrderId(order.id);
            await apiRequest(`/purchase-orders/${order.id}/status`, { method: 'PATCH', body: { status, note: `Buyer updated order status to ${status}` } });
            await loadOrders(true);
          } catch (e) {
            Alert.alert('Unable to update order', e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setUpdatingOrderId(null);
          }
        }
      },
    ]);
  };

  const reviewQualityCheck = async (decision: 'APPROVE' | 'REJECT') => {
    if (!qcReviewOrder) return;
    if (decision === 'REJECT' && qcFeedback.trim().length < 5) {
      Alert.alert('Reason required', 'Please explain the QC issue in at least 5 characters.');
      return;
    }
    const order = qcReviewOrder;
    try {
      setUpdatingOrderId(order.id);
      const report = order.qcReports?.find(item => item.status === 'SUBMITTED');
      if (!report) throw new Error('The supplier QC report could not be found. Please refresh the order and try again.');
      await apiRequest(`/quality-checks/${report.id}/review`, {
        method: 'PATCH',
        body: { decision: decision === 'APPROVE' ? 'APPROVE' : 'RECHECK', feedback: qcFeedback.trim() || undefined },
      });
      setQcReviewOrder(null);
      setQcFeedback('');
      await loadOrders(true);
      Alert.alert(decision === 'APPROVE' ? 'Quality check approved' : 'Recheck requested',
        decision === 'APPROVE' ? 'Supplier can now proceed to dispatch.' : 'Supplier has been asked to correct the QC issues and resubmit for buyer review.');
    } catch (e) {
      Alert.alert('Unable to update quality check', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const runSamplePayment = async (outcome: 'SUCCESS' | 'FAILED' | 'PENDING') => {
    if (!samplePaymentOpen) return;
    try {
      setSamplePaymentBusy(true);
      const result = await apiPost<{ message?: string }>(`/payments/samples/${samplePaymentOpen.sample.id}/test-payment`, { outcome });
      setSamplePaymentOpen(null);
      await loadOrders(true);
      Alert.alert(
        outcome === 'SUCCESS' ? 'Sample payment successful' : outcome === 'FAILED' ? 'Sample payment failed' : 'Sample payment pending',
        result?.message || 'This is a simulated test payment. No real money was collected.',
      );
    } catch (e) {
      Alert.alert('Sample payment could not be completed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSamplePaymentBusy(false);
    }
  };

  const submitReview = async () => {
    if (!reviewOrder || !membership) return;
    const orgId = membership.organizationId || membership.organization?.id;
    if (!orgId) {
      Alert.alert('Organization not found', 'Please sign in again and retry.');
      return;
    }
    try {
      setReviewBusy(true);
      await apiPost(`/orders/${reviewOrder.id}/reviews`, {
        reviewerOrgId: orgId,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setReviewedOrderIds(ids => [...ids, reviewOrder.id]);
      setReviewOrder(null);
      setComment('');
      setRating(5);
      Alert.alert('Review submitted', 'Thank you for reviewing your supplier.');
    } catch (e) {
      Alert.alert('Unable to submit review', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        role="BUYER"
        activeSection="orders"
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadOrders(true); }} tintColor={PURPLE} />}
      >
        <Text style={styles.pageTitle}>My Orders</Text>
        <Pressable style={styles.issueButton} onPress={() => navigate('requests')}>
          <MaterialCommunityIcons name="plus" size={27} color="#fff" />
          <Text style={styles.issueButtonText}>Issue New Purchase Order</Text>
        </Pressable>

        <View style={styles.topDivider} />

        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator color={PURPLE} /><Text style={styles.stateText}>Loading purchase orders...</Text></View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={30} color="#8B929C" />
            <Text style={styles.stateTitle}>Couldn't load orders</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadOrders()}><Text style={styles.retryText}>Try Again</Text></Pressable>
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="archive-outline" size={34} color="#A0A6B0" />
            <Text style={styles.stateTitle}>No purchase orders found</Text>
            <Text style={styles.stateText}>Accept a supplier quotation from My Offers to issue your first purchase order.</Text>
            <Pressable style={styles.emptyButton} onPress={() => navigate('offers')}><Text style={styles.emptyButtonText}>View My Offers</Text></Pressable>
          </View>
        ) : (
          orders.map(order => {
            const progress = progressFor(order.status);
            const currentMilestone = milestoneFor(order);
            const color = statusColor(order.status);
            const itemText = order.items?.length
              ? order.items.map(item => `${Number(item.quantity || 0).toLocaleString('en-IN')} pcs ${item.name}`).join(', ')
              : 'Garment Production Order';
            const buyerName = order.buyer?.name || 'Your Organization';
            const canReview = ['DELIVERED', 'COMPLETED'].includes(order.status) && !reviewedOrderIds.includes(order.id);
            const paymentPlan = paymentSummaries[order.id];
            const paymentMilestones = [...(paymentPlan?.milestones || [])].sort((a, b) => a.sequence - b.sequence);
            const paymentPaid = paymentMilestones.filter(item => ['PAID', 'RELEASED'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
            const paymentTotal = Number(paymentPlan?.totalAmount || order.totalAmount || 0);
            const paymentPercent = paymentTotal > 0 ? Math.min(100, Math.round(paymentPaid / paymentTotal * 100)) : 0;
            const paidCount = paymentMilestones.filter(item => ['PAID', 'RELEASED'].includes(item.status)).length;
            const orderPendingSampleCount = (samplesByOrder[order.id] || []).filter(sample => String((sample as any).status).toUpperCase() === 'DISPATCHED').length;
            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderMeta}>
                  <Text style={styles.poNumber}>{order.poNumber}</Text>
                  <View style={[styles.statusPill, { backgroundColor: color.bg }]}><Text style={[styles.statusText, { color: color.fg }]}>{statusLabel(order.status)}</Text></View>
                </View>
                <Text style={styles.orderTitle}>{itemText}</Text>
                <Text style={styles.buyerLine}>Buyer: <Text style={styles.buyerName}>{buyerName}</Text></Text>
                <View style={styles.amountRow}>
                  <Text style={styles.amount}>{money(order.totalAmount, order.currency)}</Text>
                  <Text style={styles.targetDate}>Target: {dateLabel(order.expectedDate)}</Text>
                </View>
                <View style={styles.progressPanel}>
                  <View style={styles.progressTextRow}>
                    <Text style={styles.currentMilestone}>{currentMilestone}</Text>
                    <Text style={styles.progressPercent}>{progress}%{'\n'}{progress === 100 ? 'Completed' : order.status === 'CANCELLED' ? 'Cancelled' : 'In Progress'}</Text>
                  </View>
                  <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
                {!!paymentMilestones.length && (
                    <View style={styles.paymentProgressPanel}>
                      <View style={styles.paymentProgressHeader}>
                        <Text style={styles.paymentProgressTitle}>Payment Milestones</Text>
                        <Text style={styles.paymentProgressCount}>{paidCount} of {paymentMilestones.length} paid</Text>
                      </View>
                      <View style={styles.paymentSegments}>
                        {paymentMilestones.map(item => <View key={item.id} style={[styles.paymentSegment, ['PAID', 'RELEASED'].includes(item.status) && styles.paymentSegmentPaid]} />)}
                      </View>
                      <View style={styles.paymentProgressFooter}>
                        <View><Text style={styles.paymentCaption}>Verified payment</Text><Text style={styles.paymentValue}>{money(paymentPaid, paymentPlan?.currency || order.currency)}</Text></View>
                        <View style={{ alignItems: 'flex-end' }}><Text style={styles.paymentCaption}>Payment progress</Text><Text style={styles.paymentValue}>{paymentPercent}%</Text></View>
                      </View>
                      <Pressable style={styles.paymentDetailsButton} onPress={() => router.push({ pathname: '/buyer/[section]', params: { section: 'payments', orderId: order.id } } as any)}>
                        <MaterialCommunityIcons name="wallet-outline" size={18} color={PURPLE} />
                        <Text style={styles.paymentDetailsText}>View {paymentMilestones.length} payment milestones</Text>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={PURPLE} />
                      </Pressable>
                    </View>
                  )}
                </View>
                {updatingOrderId === order.id ? (
                  <View style={styles.inlineStatus}><ActivityIndicator color={PURPLE} /><Text style={styles.inlineStatusText}>Updating order...</Text></View>
                ) : order.status === 'PO_CREATED' || order.status === 'PENDING_ACCEPTANCE' ? (
                  <View style={[styles.inlineStatus, { backgroundColor: '#FFF7E8', borderColor: '#F4D79B' }]}><MaterialCommunityIcons name="sync" size={17} color="#A66A00" /><Text style={[styles.inlineStatusText, { color: '#8A5700' }]}>PO Issued • Awaiting Factory Order Acceptance</Text></View>
                ) : order.status === 'ACCEPTED' ? (
                  <View style={[styles.inlineStatus, { backgroundColor: '#E9FBF2', borderColor: '#B7EED4' }]}><MaterialCommunityIcons name="check-circle" size={17} color="#087653" /><Text style={[styles.inlineStatusText, { color: '#087653' }]}>Order Accepted by Supplier • PP Sample in Progress</Text></View>
                ) : order.status === 'SAMPLE_PENDING' ? (
                  <Pressable style={styles.buyerActionButton} onPress={() => updateOrderStatus(order, 'SAMPLE_APPROVED')}><MaterialCommunityIcons name="check-circle" size={19} color="#fff" /><Text style={styles.buyerActionText}>Approve PP Sample</Text></Pressable>
                ) : order.status === 'QC_PENDING' || order.status === 'QC' ? (
                  <Pressable style={styles.buyerActionButton} onPress={() => { setQcReviewOrder(order); setQcFeedback(''); }}>
                    <MaterialCommunityIcons name="clipboard-check-outline" size={19} color="#fff" />
                    <Text style={styles.buyerActionText}>Review Quality Check</Text>
                  </Pressable>
                ) : order.status === 'DISPATCHED' ? (
                  <Pressable style={styles.buyerActionButton} onPress={() => updateOrderStatus(order, 'DELIVERED')}><MaterialCommunityIcons name="package-variant-closed-check" size={19} color="#fff" /><Text style={styles.buyerActionText}>Confirm Delivery Received</Text></Pressable>
                ) : order.status === 'DELIVERED' ? (
                  <Pressable style={styles.buyerActionButton} onPress={() => updateOrderStatus(order, 'COMPLETED')}><MaterialCommunityIcons name="cash-check" size={19} color="#fff" /><Text style={styles.buyerActionText}>Release Payment & Complete</Text></Pressable>
                ) : null}
                {(samplesByOrder[order.id] || []).filter(sample => Number(sample.parsedMeta?.samplePrice || 0) > 0).slice(0, 1).map(sample => {
                  const samplePaid = sample.parsedMeta?.samplePaymentStatus === 'PAID';
                  return <Pressable key={sample.id} style={[styles.samplePaymentButton, samplePaid && styles.samplePaymentPaidButton]} onPress={() => setSamplePaymentOpen({ order, sample })}>
                    <MaterialCommunityIcons name={samplePaid ? 'check-circle' : 'hanger'} size={19} color={samplePaid ? '#087653' : '#fff'} />
                    <Text style={[styles.samplePaymentButtonText, samplePaid && styles.samplePaymentPaidText]}>{samplePaid ? 'Sample Paid · View Details' : 'Pay Sample Amount'}</Text>
                    <Text style={[styles.samplePaymentAmount, samplePaid && styles.samplePaymentPaidText]}>{money(sample.parsedMeta?.samplePrice, order.currency)}</Text>
                  </Pressable>;
                })}
                <View style={styles.cardDivider} />
                {canReview && (
                  <Pressable style={styles.reviewButton} onPress={() => { setReviewOrder(order); setRating(5); setComment(''); }}>
                    <MaterialCommunityIcons name="star-outline" size={24} color="#152033" />
                    <Text style={styles.reviewButtonText}>Submit Supplier Review</Text>
                  </Pressable>
                )}
                {reviewedOrderIds.includes(order.id) && <View style={styles.reviewedTag}><MaterialCommunityIcons name="check-circle" size={17} color="#087653" /><Text style={styles.reviewedText}>Review Submitted</Text></View>}
                <View style={styles.actionsRow}>
                  <Pressable style={styles.actionItemActive} onPress={() => router.push({ pathname: '/buyer/[section]', params: { section: 'tracking', orderId: order.id } } as any)}>
                    <MaterialCommunityIcons name="factory" size={27} color="#17202D" />
                    <Text style={styles.actionLabel}>Track Milestones</Text>
                  </Pressable>
                  <Pressable style={styles.actionItem} onPress={() => navigate('samples')}>
                    <View style={styles.sampleActionIconWrap}><MaterialCommunityIcons name="hanger" size={27} color="#17202D" />{orderPendingSampleCount > 0 && <View style={styles.sampleActionBadge}><Text style={styles.sampleActionBadgeText}>{orderPendingSampleCount > 99 ? "99+" : orderPendingSampleCount}</Text></View>}</View>
                    <Text style={styles.actionLabel}>View Samples</Text>
                  </Pressable>
                  <Pressable style={styles.actionItem} onPress={() => navigate('payments')}>
                    <MaterialCommunityIcons name="wallet-outline" size={27} color="#17202D" />
                    <Text style={styles.actionLabel}>Secure Payment</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <AppBottomNav role="BUYER" activeSection="orders" onNavigate={navigate} onLayout={e => setBottomHeight(e.nativeEvent.layout.height)} />

      {drawerOpen && <View style={[styles.drawerLayer, { top: headerHeight, bottom: bottomHeight }]}>
        <View style={styles.drawer}>
          {[
            { label: 'Home', icon: 'view-dashboard', section: 'home' },
            { label: 'My Requests', icon: 'file-document-currency-outline', section: 'requests' },
            { label: 'My Offers', icon: 'swap-horizontal', section: 'offers' },
            { label: 'My Orders', icon: 'archive-outline', section: 'orders' },
            { label: 'Order Tracking', icon: 'factory', section: 'tracking' },
            { label: 'Samples', icon: 'hanger', section: 'samples' },
            { label: 'Chat', icon: 'message-text-outline', section: 'chat' },
            { label: 'Payments', icon: 'wallet-outline', section: 'payments' },
            { label: 'Organization Settings', icon: 'cog-outline', section: 'organization-settings' },
          ].map(item => <Pressable key={item.section} style={[styles.drawerItem, item.section === 'orders' && styles.drawerItemActive]} onPress={() => navigate(item.section)}><MaterialCommunityIcons name={item.icon as any} size={21} color={item.section === 'orders' ? '#fff' : '#9AA1AA'} /><Text style={[styles.drawerText, item.section === 'orders' && styles.drawerTextActive]}>{item.label}</Text></Pressable>)}
        </View>
        <Pressable style={styles.drawerBackdrop} onPress={() => setDrawerOpen(false)} />
      </View>}

      <Modal visible={!!milestoneOrder} transparent animationType="slide" onRequestClose={() => setMilestoneOrder(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMilestoneOrder(null)}>
          <Pressable style={styles.milestoneSheet} onPress={() => { }}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}><View style={{ flex: 1 }}><Text style={styles.sheetTitle}>Order Milestones</Text><Text style={styles.sheetSubtitle}>{milestoneOrder?.poNumber}</Text></View><Pressable onPress={() => setMilestoneOrder(null)}><MaterialCommunityIcons name="close" size={24} color="#737B87" /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(milestoneOrder?.milestones || []).map((milestone, index) => {
                const done = milestone.status === 'COMPLETED';
                const active = milestone.status === 'IN_PROGRESS';
                return <View key={milestone.id} style={styles.milestoneRow}>
                  <View style={[styles.milestoneIcon, { backgroundColor: done ? '#E9FBF2' : active ? '#F0E9FF' : '#F3F4F6' }]}><MaterialCommunityIcons name={done ? 'check' : active ? 'progress-clock' : 'circle-outline'} size={19} color={done ? '#087653' : active ? PURPLE : '#9AA1AA'} /></View>
                  <View style={{ flex: 1 }}><Text style={styles.milestoneTitle}>{index + 1}. {milestone.title}</Text><Text style={styles.milestoneMeta}>{statusLabel(milestone.status)}{milestone.dueDate ? ` · Due ${dateLabel(milestone.dueDate)}` : ''}</Text></View>
                </View>;
              })}
              {(!milestoneOrder?.milestones || milestoneOrder.milestones.length === 0) && <Text style={styles.stateText}>Milestone details are not available yet.</Text>}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!samplePaymentOpen} transparent animationType="slide" onRequestClose={() => setSamplePaymentOpen(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSamplePaymentOpen(null)}>
          <Pressable style={styles.samplePaymentSheet} onPress={() => { }}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Sample Payment</Text>
                <Text style={styles.sheetSubtitle}>{samplePaymentOpen?.order.poNumber}</Text>
              </View>
              <Pressable onPress={() => setSamplePaymentOpen(null)}><MaterialCommunityIcons name="close" size={24} color="#737B87" /></Pressable>
            </View>
            <Text style={styles.samplePaymentName}>{samplePaymentOpen?.sample.sampleName || samplePaymentOpen?.sample.sampleType || 'Order Sample'}</Text>
            <View style={styles.samplePaymentInfoRow}>
              <Text style={styles.samplePaymentLabel}>Sample amount</Text>
              <Text style={styles.samplePaymentValue}>{money(samplePaymentOpen?.sample.parsedMeta?.samplePrice, samplePaymentOpen?.order.currency)}</Text>
            </View>
            <View style={styles.samplePaymentInfoRow}>
              <Text style={styles.samplePaymentLabel}>Payment status</Text>
              <Text style={[styles.samplePaymentValue, { color: samplePaymentOpen?.sample.parsedMeta?.samplePaymentStatus === 'PAID' ? '#087653' : '#9A5B00' }]}>
                {samplePaymentOpen?.sample.parsedMeta?.samplePaymentStatus === 'PAID' ? 'PAID' : samplePaymentOpen?.sample.parsedMeta?.samplePaymentStatus || 'NOT PAID'}
              </Text>
            </View>
            {samplePaymentOpen?.sample.parsedMeta?.samplePaymentStatus === 'PAID' ? (
              <View style={styles.samplePaidNotice}><MaterialCommunityIcons name="check-circle" size={20} color="#087653" /><Text style={styles.samplePaidNoticeText}>Sample payment is already completed. You do not need to pay again.</Text></View>
            ) : (
              <>
                <Text style={styles.samplePaymentHint}>This payment is only for the sample. Production and final payments will be handled separately after sample approval.</Text>
                <Pressable disabled={samplePaymentBusy} style={[styles.samplePayNowButton, samplePaymentBusy && { opacity: 0.6 }]} onPress={() => Alert.alert('Choose test result', 'Select a test outcome. This simulator does not collect real money.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Success', onPress: () => void runSamplePayment('SUCCESS') },
                  { text: 'Failed', style: 'destructive', onPress: () => void runSamplePayment('FAILED') },
                  { text: 'Pending', onPress: () => void runSamplePayment('PENDING') },
                ])}>
                  {samplePaymentBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.samplePayNowText}>Pay Sample Amount</Text>}
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!qcReviewOrder} transparent animationType="slide" onRequestClose={() => setQcReviewOrder(null)}>
        <KeyboardAvoidingView style={styles.reviewBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.reviewScroll} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.reviewSheet}>
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}><Text style={styles.sheetTitle}>Quality Check Review</Text><Text style={styles.sheetSubtitle}>{qcReviewOrder?.poNumber}</Text></View>
                <Pressable style={styles.reviewClose} onPress={() => setQcReviewOrder(null)}><MaterialCommunityIcons name="close" size={24} color={ui.muted} /></Pressable>
              </View>
              <Text style={styles.ratingPrompt}>Supplier QC report</Text>
              {(() => {
                const report = qcReviewOrder?.qcReports?.find(item => item.status === 'SUBMITTED') || qcReviewOrder?.qcReports?.[0];
                if (!report) return <Text style={styles.qcReportText}>No detailed QC report is available yet. Please refresh the order.</Text>;
                const checks: Record<string, string> = { fabricQuality: 'Fabric quality', stitching: 'Stitching and seams', measurements: 'Measurements', colorAndFinishing: 'Color and finishing', buttonsZippersAccessories: 'Buttons, zippers and accessories', defectsInspected: 'Defects inspection' };
                return <View style={{ backgroundColor: '#F8F7FC', borderRadius: 12, padding: 12, gap: 10 }}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {[['Total produced', report.totalQuantity], ['Inspected', report.inspectedQuantity], ['Passed', report.passedQuantity], ['Defective', report.defectiveQuantity]].map(([label, value]) => <View key={String(label)} style={{ width: '47%', backgroundColor: '#fff', borderRadius: 9, padding: 9 }}><Text style={{ color: '#667085', fontSize: 11 }}>{label}</Text><Text style={{ color: '#172033', fontSize: 18, fontWeight: '800' }}>{value}</Text></View>)}
                  </View>
                  <Text style={styles.ratingPrompt}>Quality checklist</Text>
                  {Object.entries(checks).map(([key, label]) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><MaterialCommunityIcons name={report.checklist?.[key] ? 'check-circle' : 'close-circle'} size={17} color={report.checklist?.[key] ? '#087653' : '#B42318'} /><Text style={{ color: '#344054', fontSize: 12 }}>{label}</Text></View>)}
                  <Text style={styles.ratingPrompt}>QC inspection photos</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{(report.photos || []).map((url, index) => <Image key={url + index} source={{ uri: url }} style={{ width: 88, height: 88, borderRadius: 9, backgroundColor: '#EAECF0' }} />)}</View>
                  {!!report.defectivePhotos?.length && <><Text style={styles.ratingPrompt}>Defective-item photos</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{report.defectivePhotos.map((url, index) => <Image key={url + index} source={{ uri: url }} style={{ width: 88, height: 88, borderRadius: 9 }} />)}</View></>}
                  {!!report.remarks && <Text style={styles.qcReportText}>Supplier remarks: {report.remarks}</Text>}
                </View>;
              })()}
              <Text style={styles.ratingPrompt}>Your review note (optional for approval, required for recheck)</Text>
              <TextInput value={qcFeedback} onChangeText={setQcFeedback} placeholder="Add your QC observations..." placeholderTextColor={ui.muted} multiline style={styles.commentInput} />
              <Pressable disabled={!!updatingOrderId} onPress={() => Alert.alert('Approve quality check?', 'This will allow the supplier to proceed to dispatch.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Approve QC', onPress: () => void reviewQualityCheck('APPROVE') }])} style={[styles.submitReviewButton, !!updatingOrderId && { opacity: .6 }]}>
                {updatingOrderId === qcReviewOrder?.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitReviewText}>Approve QC</Text>}
              </Pressable>
              <Pressable disabled={!!updatingOrderId} onPress={() => void reviewQualityCheck('REJECT')} style={styles.qcRejectButton}><Text style={styles.qcRejectText}>Reject / Request Recheck</Text></Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!reviewOrder} transparent animationType="fade" onRequestClose={() => setReviewOrder(null)}>
        <KeyboardAvoidingView style={styles.reviewBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.reviewScroll} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.reviewSheet}>
              <View style={styles.sheetHeader}><View style={{ flex: 1 }}><Text style={styles.sheetTitle}>Review Supplier</Text><Text style={styles.sheetSubtitle}>{reviewOrder?.poNumber}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Close review" style={styles.reviewClose} onPress={() => setReviewOrder(null)}><MaterialCommunityIcons name="close" size={24} color={ui.muted} /></Pressable></View>
              <Text style={styles.ratingPrompt}>How was your experience?</Text>
              <View style={styles.starsRow}>{[1, 2, 3, 4, 5].map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} out of 5 stars`} accessibilityState={{ checked: rating === value }} style={styles.starButton} onPress={() => setRating(value)}><MaterialCommunityIcons name={value <= rating ? 'star' : 'star-outline'} size={32} color="#B67806" /></Pressable>)}</View>
              <TextInput accessibilityLabel="Review comment" value={comment} onChangeText={setComment} placeholder="Share your feedback (optional)" placeholderTextColor={ui.muted} multiline style={styles.commentInput} />
              <Pressable disabled={reviewBusy} onPress={submitReview} style={[styles.submitReviewButton, reviewBusy && { opacity: .6 }]}>{reviewBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitReviewText}>Submit Review</Text>}</Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  header: { minHeight: 58, backgroundColor: ui.surface, borderBottomWidth: 1, borderBottomColor: '#E9EAF0', paddingHorizontal: 14, paddingBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 142, height: 34, flex: 1, marginHorizontal: 5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: ui.accentSoft, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, paddingBottom: 24, gap: 16, width: '100%', maxWidth: 840, alignSelf: 'center' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: ui.ink, marginBottom: 1 },
  issueButton: { minHeight: 58, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: '#4B00B8', borderRadius: 13, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, elevation: 0 },
  issueButtonText: { fontSize: 16, fontWeight: '700', color: ui.surface },
  topDivider: { height: 1, backgroundColor: '#E7E9EF', marginTop: -7, marginBottom: 1 },
  orderCard: { backgroundColor: ui.surface, borderRadius: 16, borderWidth: 1, borderColor: '#E4E6EB', padding: 16, gap: 0, elevation: 0, shadowColor: '#1D2433', shadowOpacity: 0, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, marginTop: 0, marginBottom: 2 },
  orderMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  poNumber: { fontSize: 13, fontWeight: '700', color: '#5314B8' },
  statusPill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 18 },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderTitle: { fontSize: 19, fontWeight: '700', color: ui.ink, lineHeight: 25 },
  buyerLine: { fontSize: 14, color: ui.muted, marginTop: 8 },
  buyerName: { fontWeight: '700', color: ui.ink },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 21, marginBottom: 17 },
  amount: { fontSize: 27, fontWeight: '700', color: '#5314B8' },
  targetDate: { fontSize: 13, color: ui.muted, textAlign: 'right', flexShrink: 0 },
  progressPanel: { backgroundColor: '#F5F0FC', borderRadius: 16, padding: 14, marginBottom: 14 },
  progressTextRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
  currentMilestone: { fontSize: 13, fontWeight: '700', color: '#5314B8', lineHeight: 20, flex: 1 },
  progressPercent: { fontSize: 13, color: ui.muted, lineHeight: 18, textAlign: 'left', minWidth: 76 },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: '#E4DDF1', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 8, backgroundColor: '#4B00B8' },
  paymentProgressPanel: { backgroundColor: '#F7F2FE', borderRadius: 14, padding: 12, marginTop: 2, marginBottom: 12, borderWidth: 1, borderColor: '#E9DDFB' },
  paymentProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 9 },
  paymentProgressTitle: { fontSize: 13, fontWeight: '700', color: '#5314B8' },
  paymentProgressCount: { fontSize: 12, fontWeight: '700', color: '#5314B8' },
  paymentSegments: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  paymentSegment: { flex: 1, height: 7, borderRadius: 6, backgroundColor: '#DED8E8' },
  paymentSegmentPaid: { backgroundColor: '#4B00B8' },
  paymentProgressFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  paymentCaption: { fontSize: 11, color: '#6D6679' },
  paymentValue: { fontSize: 14, fontWeight: '700', color: '#5314B8', marginTop: 2 },
  paymentDetailsButton: { minHeight: 40, borderWidth: 1, borderColor: '#D9C7F5', borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FFFFFF' },
  paymentDetailsText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#5314B8' },
  inlineStatus: { minHeight: 42, backgroundColor: '#F5F0FC', borderWidth: 1, borderColor: '#E7DDF8', borderRadius: 12, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  inlineStatusText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#5314B8', lineHeight: 16 },
  buyerActionButton: { minHeight: 44, alignSelf: 'flex-start', backgroundColor: PURPLE, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  buyerActionText: { fontSize: 13, fontWeight: '700', color: ui.surface },
  cardDivider: { height: 1, backgroundColor: '#E9EBEF', marginVertical: 13 },
  reviewButton: { alignSelf: 'flex-start', minHeight: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#D8DCE2', backgroundColor: ui.surface, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 13 },
  reviewButtonText: { fontSize: 14, fontWeight: '700', color: ui.ink },
  reviewedTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  reviewedText: { fontSize: 13, fontWeight: '700', color: '#087653' },
  actionsRow: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between', gap: 5 },
  sampleActionIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  sampleActionBadge: { position: 'absolute', top: -7, right: -12, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, backgroundColor: '#E11D48', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: ui.surface },
  sampleActionBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  actionItem: { flex: 1, minHeight: 74, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 2 },
  actionItemActive: { flex: 1, minHeight: 74, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: '#D8DCE2', paddingHorizontal: 2 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: ui.ink, textAlign: 'center' },
  stateCard: { backgroundColor: ui.surface, borderRadius: 16, borderWidth: 1, borderColor: ui.border, padding: 24, alignItems: 'center', gap: 9, marginTop: 12 },
  stateTitle: { fontSize: 16, fontWeight: '700', color: ui.ink },
  stateText: { fontSize: 13, color: '#737B87', textAlign: 'center', lineHeight: 19 },
  retryButton: { backgroundColor: ui.accentSoft, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 11, marginTop: 3 },
  retryText: { fontSize: 13, fontWeight: '700', color: PURPLE },
  emptyButton: { marginTop: 7, backgroundColor: PURPLE, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  emptyButtonText: { fontSize: 13, fontWeight: '700', color: ui.surface },
  bottomNav: { minHeight: 75, backgroundColor: ui.surface, borderTopWidth: 1, borderTopColor: '#E6E8ED', paddingTop: 7, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { minWidth: 57, minHeight: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4, gap: 2 },
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
  milestoneSheet: { backgroundColor: ui.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, maxHeight: '78%' },
  dragHandle: { width: 45, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 17 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: ui.ink },
  sheetSubtitle: { fontSize: 13, color: '#737B87', marginTop: 3 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F1F3' },
  milestoneIcon: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  milestoneTitle: { fontSize: 13, fontWeight: '700', color: '#303744' },
  milestoneMeta: { fontSize: 12, color: ui.muted, marginTop: 4 },
  samplePaymentButton: { minHeight: 48, backgroundColor: PURPLE, borderRadius: 12, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  samplePaymentButtonText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#fff' },
  samplePaymentAmount: { fontSize: 13, fontWeight: '800', color: '#fff' },
  samplePaymentPaidButton: { backgroundColor: '#E8F8F0', borderWidth: 1, borderColor: '#BDEBD2' },
  samplePaymentPaidText: { color: '#087653' },
  samplePaymentSheet: { backgroundColor: ui.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  samplePaymentName: { fontSize: 16, fontWeight: '700', color: ui.ink, marginBottom: 14 },
  samplePaymentInfoRow: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  samplePaymentLabel: { fontSize: 13, color: ui.muted },
  samplePaymentValue: { fontSize: 14, fontWeight: '700', color: ui.ink },
  samplePaymentHint: { fontSize: 12, lineHeight: 18, color: ui.muted, marginTop: 14 },
  samplePaidNotice: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#E8F8F0', borderRadius: 12, padding: 12, marginTop: 15 },
  samplePaidNoticeText: { flex: 1, fontSize: 12, color: '#087653', lineHeight: 18, fontWeight: '600' },
  samplePayNowButton: { minHeight: 49, backgroundColor: PURPLE, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  samplePayNowText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  qcReportText: { fontSize: 13, color: ui.ink, lineHeight: 20, backgroundColor: '#F6F4F9', borderRadius: 12, padding: 12, marginTop: 8 },
  qcRejectButton: { minHeight: 46, borderWidth: 1, borderColor: '#E6B8B4', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  qcRejectText: { color: '#B42318', fontSize: 13, fontWeight: '700' },
  reviewBackdrop: { flex: 1, backgroundColor: 'rgba(13,10,22,.48)', justifyContent: 'center', padding: 18 },
  reviewSheet: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: ui.surface, borderRadius: 20, padding: 20 },
  reviewScroll: { flexGrow: 1, justifyContent: 'center' },
  reviewClose: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  starButton: { flex: 1, minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  ratingPrompt: { fontSize: 14, fontWeight: '700', color: '#303744', marginTop: 7 },
  starsRow: { flexDirection: 'row', gap: 2, marginTop: 10, marginBottom: 12 },
  commentInput: { minHeight: 100, maxHeight: 190, borderWidth: 1, borderColor: '#DDE0E6', borderRadius: 13, padding: 12, textAlignVertical: 'top', fontSize: 14, color: ui.ink },
  submitReviewButton: { height: 49, borderRadius: 13, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  submitReviewText: { fontSize: 14, fontWeight: '700', color: ui.surface },
});
