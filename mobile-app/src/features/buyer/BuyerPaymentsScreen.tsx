import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import { AppHeader } from '@/components/AppHeader';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, apiGet, apiPost } from '@/services/api';

const PURPLE = ui.accent;

type Refund = { id: string; amount: number | string; status: string; reason?: string | null; createdAt: string };
type Transaction = {
  id: string; amount: number | string; currency: string; status: string; provider: string;
  paymentMilestoneId?: string | null; createdAt: string; capturedAt?: string | null; razorpayPaymentId?: string | null;
  paymentMethod?: string | null; refunds?: Refund[];
};
type PaymentMilestone = {
  id: string; title: string; sequence: number; percentage: number | string; amount: number | string;
  status: string; dueDate?: string | null; proofUrl?: string | null; completionNote?: string | null;
  submittedAt?: string | null; approvedAt?: string | null; rejectionReason?: string | null;
  transactions?: Transaction[];
};
type PaymentPlan = { id: string; totalAmount: number | string; currency: string; status: string; milestones: PaymentMilestone[] };
type PaymentOrder = {
  id: string; poNumber: string; status: string; totalAmount: number | string; currency: string;
  buyerOrgId: string; supplierOrgId: string; expectedDate?: string | null;
  buyer?: { id: string; name: string }; supplier?: { id: string; name: string };
  items?: { id: string; name: string; quantity: number }[];
  paymentPlan?: PaymentPlan | null; paymentTransactions?: Transaction[];
};
type Dashboard = { provider: string; paymentMode?: string; mockPaymentsEnabled?: boolean; orders: PaymentOrder[] };
type Membership = { organizationId?: string; organization?: { id?: string }; role?: string };

const amountNumber = (value: number | string | null | undefined) => Number(value || 0);
const money = (value: number | string | null | undefined, currency = 'INR') => {
  const amount = amountNumber(value);
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₹${amount.toLocaleString('en-IN')}`;
  }
};
const dateLabel = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusStyle = (status: string) => {
  if (['PAID', 'RELEASED', 'PROCESSED', 'APPROVED', 'COMPLETED'].includes(status)) return { bg: '#E8F8F0', fg: '#087653', label: status.replaceAll('_', ' ') };
  if (['FAILED', 'REJECTED', 'DISPUTED', 'REFUNDED'].includes(status)) return { bg: '#FDECEC', fg: '#B42318', label: status.replaceAll('_', ' ') };
  if (['DUE', 'PROOF_SUBMITTED', 'PAYMENT_PENDING', 'PROCESSING', 'REQUESTED', 'REFUND_REQUESTED', 'UNDER_REVIEW'].includes(status)) return { bg: '#FFF3DE', fg: '#9A5B00', label: status.replaceAll('_', ' ') };
  return { bg: '#F0EAFB', fg: '#5B13B8', label: status.replaceAll('_', ' ') };
};

export default function BuyerPaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const requestedOrderId = typeof params.orderId === 'string' ? params.orderId : '';
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [mockPaymentsEnabled, setMockPaymentsEnabled] = useState(false);
  const [provider, setProvider] = useState('Not configured');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewMilestone, setReviewMilestone] = useState<{ order: PaymentOrder; milestone: PaymentMilestone } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [disputeOrder, setDisputeOrder] = useState<PaymentOrder | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [refundTransaction, setRefundTransaction] = useState<{ order: PaymentOrder; transaction: Transaction } | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const promptedProofIds = useRef<Set<string>>(new Set());
  const promptedPaymentIds = useRef<Set<string>>(new Set());

  const loadPayments = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      const member = raw ? JSON.parse(raw) as Membership : null;
      const orgId = member?.organizationId || member?.organization?.id;
      if (!orgId) throw new Error('Buyer organization membership was not found. Please sign in again.');
      if (member?.role && member.role !== 'BUYER') throw new Error('Payment management is available in the Buyer workspace.');

      let dashboard = await apiGet<Dashboard>('/payments/dashboard');
      let visible = (dashboard.orders || []).filter(order => order.buyerOrgId === orgId);
      // Create the backend's configured default plan only when an order does not have one.
      const ordersWithoutPlan = visible.filter(order => !order.paymentPlan);
      for (const order of ordersWithoutPlan) {
        await apiPost(`/payments/orders/${order.id}/plan`, {});
      }
      if (ordersWithoutPlan.length) {
        dashboard = await apiGet<Dashboard>('/payments/dashboard');
        visible = (dashboard.orders || []).filter(order => order.buyerOrgId === orgId);
      }
      setMockPaymentsEnabled(Boolean(dashboard.mockPaymentsEnabled));
      setProvider(dashboard.provider || 'Not configured');
      setOrders(visible);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load payment information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadPayments(); }, [loadPayments]);
  useRealtimeRefresh(loadPayments, ['*']);

  const visibleOrders = useMemo(
    () => requestedOrderId ? orders.filter(order => order.id === requestedOrderId) : orders,
    [orders, requestedOrderId],
  );

  useEffect(() => {
    if (reviewMilestone) return;
    const waiting = visibleOrders
      .flatMap(order => [...(order.paymentPlan?.milestones || [])].sort((a, b) => a.sequence - b.sequence).filter(milestone => milestone.status === 'PROOF_SUBMITTED').map(milestone => ({ order, milestone })))
      .find(item => !promptedProofIds.current.has(item.milestone.id));
    if (waiting) {
      promptedProofIds.current.add(waiting.milestone.id);
      setReviewReason('');
      setReviewMilestone(waiting);
    }
  }, [visibleOrders, reviewMilestone]);

  const navigate = (section: string) => {
    if (section === 'home') router.replace('/workspace?role=BUYER' as any);
    else router.replace({ pathname: '/buyer/[section]', params: { section } } as any);
  };

  const reviewProof = async (decision: 'APPROVE' | 'REJECT') => {
    if (!reviewMilestone) return;
    if (decision === 'REJECT' && reviewReason.trim().length < 5) {
      Alert.alert('Reason required', 'Please enter at least 5 characters explaining why the proof is rejected.');
      return;
    }
    const { milestone } = reviewMilestone;
    try {
      setBusyId(milestone.id);
      await apiPost(`/payments/milestones/${milestone.id}/review`, {
        decision,
        ...(decision === 'REJECT' ? { reason: reviewReason.trim() } : {}),
      });
      setReviewMilestone(null);
      setReviewReason('');
      await loadPayments(true);
      Alert.alert(decision === 'APPROVE' ? 'Proof approved' : 'Proof rejected',
        decision === 'APPROVE'
          ? 'The supplier has been notified. Settlement remains subject to the approved payment-provider arrangement.'
          : 'The supplier can review the rejection reason and submit updated proof.');
    } catch (e) {
      Alert.alert('Unable to review proof', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const raiseDispute = async () => {
    if (!disputeOrder) return;
    if (disputeReason.trim().length < 5) {
      Alert.alert('Reason required', 'Please describe the issue in at least 5 characters.');
      return;
    }
    try {
      setBusyId(disputeOrder.id);
      await apiPost(`/orders/${disputeOrder.id}/disputes`, { reason: disputeReason.trim() });
      const orderNo = disputeOrder.poNumber;
      setDisputeOrder(null);
      setDisputeReason('');
      await loadPayments(true);
      Alert.alert('Dispute submitted', `Your dispute for ${orderNo} has been sent to the STITCHGRID admin team.`);
    } catch (e) {
      Alert.alert('Unable to raise dispute', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const requestRefund = async () => {
    if (!refundTransaction) return;
    if (refundReason.trim().length < 5) {
      Alert.alert('Reason required', 'Please enter at least 5 characters.');
      return;
    }
    try {
      setBusyId(refundTransaction.transaction.id);
      await apiPost(`/payments/transactions/${refundTransaction.transaction.id}/refunds`, { reason: refundReason.trim() });
      setRefundTransaction(null);
      setRefundReason('');
      await loadPayments(true);
      Alert.alert('Refund request submitted', 'Your request is now pending Admin review. This is a request, not a confirmed refund.');
    } catch (e) {
      Alert.alert('Unable to request refund', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const startCheckout = async (order: PaymentOrder, milestone: PaymentMilestone, outcome: 'SUCCESS' | 'FAILED' | 'PENDING') => {
    if (!mockPaymentsEnabled) {
      Alert.alert('Test mode is disabled', 'The STITCHGRID administrator has not enabled the mock payment simulator on the backend. No payment was attempted.');
      return;
    }
    try {
      setBusyId(milestone.id);
      const result = await apiPost<{ message?: string }>(`/payments/milestones/${milestone.id}/test-payment`, { outcome });
      await loadPayments(true);
      Alert.alert(outcome === 'SUCCESS' ? 'Test payment successful' : outcome === 'FAILED' ? 'Test payment failed' : 'Test payment pending', result?.message || 'This was a simulated test only. No money was collected.');
    } catch (e) {
      Alert.alert('Test payment could not be completed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (!mockPaymentsEnabled) return;
    const duePayment = visibleOrders
      .flatMap(order => milestonesFor(order)
        .filter(milestone => milestone.status === 'DUE' && !promptedPaymentIds.current.has(milestone.id))
        .map(milestone => ({ order, milestone })))[0];
    if (!duePayment) return;

    promptedPaymentIds.current.add(duePayment.milestone.id);
    Alert.alert(
      'Payment due',
      `${duePayment.milestone.title} for PO #${duePayment.order.poNumber} is ready for payment (${money(duePayment.milestone.amount, duePayment.order.currency)}). Would you like to test the payment now?`,
      [
        { text: 'Later', style: 'cancel' },
        {
          text: 'Pay now',
          onPress: () => Alert.alert(
            'Test payment',
            'Choose a test result. This simulator does not collect real money.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Success', onPress: () => void startCheckout(duePayment.order, duePayment.milestone, 'SUCCESS') },
              { text: 'Failed', style: 'destructive', onPress: () => void startCheckout(duePayment.order, duePayment.milestone, 'FAILED') },
              { text: 'Leave pending', onPress: () => void startCheckout(duePayment.order, duePayment.milestone, 'PENDING') },
            ],
          ),
        },
      ],
    );
  }, [visibleOrders, mockPaymentsEnabled]);

  const totalFor = (order: PaymentOrder) => amountNumber(order.paymentPlan?.totalAmount ?? order.totalAmount);
  const milestonesFor = (order: PaymentOrder) => [...(order.paymentPlan?.milestones || [])].sort((a, b) => a.sequence - b.sequence);
  const paidFor = (order: PaymentOrder) => milestonesFor(order)
    .filter(item => ['PAID', 'RELEASED'].includes(item.status))
    .reduce((sum, item) => sum + amountNumber(item.amount), 0);
  const orderTitle = (order: PaymentOrder) => order.items?.length
    ? order.items.map(item => `${Number(item.quantity || 0).toLocaleString('en-IN')} pcs ${item.name}`).join(', ')
    : 'Garment Production Order';

  return (
    <View style={styles.screen}>
      <AppHeader role="BUYER" activeSection="orders" isBack onBack={() => router.back()} title="Secure Payments" showLogo />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadPayments(true); }} tintColor={PURPLE} />}
      >
        <View style={styles.heading}>
          <Text style={styles.pageTitle}>Production & Final Payment</Text>
          <Text style={styles.subtitle}>Sample payment is handled in Samples. After sample approval, the supplier sets the production amount. The remaining balance becomes due after production, quality check and dispatch.</Text>
          <Pressable style={styles.historyPageButton} onPress={() => navigate('payment-history')}>
            <MaterialCommunityIcons name="receipt-text-outline" size={18} color={PURPLE} />
            <Text style={styles.historyPageButtonText}>View Payment History</Text>
            <MaterialCommunityIcons name="chevron-right" size={19} color={PURPLE} />
          </Pressable>
        </View>
        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={PURPLE} />
          <Text style={styles.noticeText}>Demo mode: test payments update the order workflow only. No real money is collected or transferred.</Text>
        </View>
        <Text style={styles.checkoutNote}>{mockPaymentsEnabled ? 'TEST PAYMENT MODE ACTIVE · MOCK_TEST simulator only. No real payment method is used and no money is collected.' : 'TEST PAYMENT MODE DISABLED · Ask the administrator to enable MOCK_PAYMENTS_ENABLED on the backend.'}</Text>
        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator color={PURPLE} size="large" /><Text style={styles.stateText}>Loading payment plans...</Text></View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={28} color="#8B929C" />
            <Text style={styles.stateTitle}>Couldn't load payments</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.secondaryButton} onPress={() => void loadPayments()}><Text style={styles.secondaryButtonText}>Try Again</Text></Pressable>
          </View>
        ) : visibleOrders.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="wallet-outline" size={34} color="#A0A6B0" />
            <Text style={styles.stateTitle}>No payment plans found</Text>
            <Text style={styles.stateText}>Payment plans will appear after a purchase order is issued and accepted by its supplier.</Text>
          </View>
        ) : visibleOrders.map(order => {
          const milestones = milestonesFor(order);
          const total = totalFor(order);
          const paid = paidFor(order);
          const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
          const transactions = order.paymentTransactions || [];
          return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.poNumber}>{order.poNumber}</Text>
                  <Text style={styles.orderTitle}>{order.supplier?.name || 'Supplier'} · {orderTitle(order)}</Text>
                </View>
                <View style={styles.orderStatus}><Text style={styles.orderStatusText}>{order.status.replaceAll('_', ' ')}</Text></View>
              </View>
              <View style={styles.amountRow}>
                <View><Text style={styles.metaLabel}>Order value</Text><Text style={styles.totalAmount}>{money(total, order.currency)}</Text></View>
                <View style={{ alignItems: 'flex-end' }}><Text style={styles.metaLabel}>Payment marked successful</Text><Text style={styles.paidAmount}>{money(paid, order.currency)}</Text></View>
              </View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
              <View style={styles.progressMeta}><Text style={styles.metaLabel}>{percent}% of payment milestones successful</Text><Text style={styles.metaLabel}>{milestones.length} payment stages</Text></View>

              <View style={styles.milestones}>
                {milestones.map((milestone, index) => {
                  const visual = statusStyle(milestone.status);
                  const canReview = milestone.status === 'PROOF_SUBMITTED';
                  const canPay = ['DUE', 'APPROVED', 'FAILED', 'PAYMENT_PENDING'].includes(milestone.status) && order.status !== 'PENDING_ACCEPTANCE' && order.status !== 'PO_CREATED';
                  const transaction = [...(milestone.transactions || []), ...transactions.filter(item => item.paymentMilestoneId === milestone.id)]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                  return (
                    <View key={milestone.id} style={styles.milestoneCard}>
                      <View style={styles.milestoneHeader}>
                        <View style={styles.sequence}><Text style={styles.sequenceText}>{milestone.sequence || index + 1}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                          <Text style={styles.milestoneAmount}>{Number(milestone.percentage)}% · {money(milestone.amount, order.currency)}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: visual.bg }]}><Text style={[styles.badgeText, { color: visual.fg }]}>{visual.label}</Text></View>
                      </View>
                      {milestone.proofUrl ? (
                        <View style={styles.proofBox}>
                          <Text style={styles.proofHeading}>Supplier proof submitted</Text>
                          {milestone.proofUrl.match(/\.(png|jpe?g|webp)(\?|$)/i)
                            ? <Image source={{ uri: milestone.proofUrl.startsWith('/') ? `${API_BASE_URL.split('/api')[0]}${milestone.proofUrl}` : milestone.proofUrl }} style={styles.proofImage} resizeMode="cover" />
                            : <Text style={styles.proofUrl}>{milestone.proofUrl}</Text>}
                          {!!milestone.completionNote && <Text style={styles.proofNote}>{milestone.completionNote}</Text>}
                          {!!milestone.rejectionReason && <Text style={styles.rejectionReason}>Previous rejection: {milestone.rejectionReason}</Text>}
                          {canReview && (
                            <View style={styles.proofActions}>
                              <Pressable style={styles.approveButton} disabled={busyId === milestone.id} onPress={() => { setReviewReason(''); setReviewMilestone({ order, milestone }); }}>
                                <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" /><Text style={styles.primaryButtonText}>Review Proof</Text>
                              </Pressable>
                            </View>
                          )}
                        </View>
                      ) : null}
                      {transaction && (
                        <View style={styles.transactionLine}>
                          <MaterialCommunityIcons name="receipt-text-outline" size={17} color={ui.muted} />
                          <Text style={styles.transactionText} numberOfLines={1}>Latest transaction · {transaction.id.slice(0, 12)} · {statusStyle(transaction.status).label}</Text>
                        </View>
                      )}
                      {canPay && (
                        <Pressable style={[styles.payButton, (!mockPaymentsEnabled || busyId === milestone.id) && styles.disabledButton]} disabled={!mockPaymentsEnabled || busyId === milestone.id} onPress={() => Alert.alert('Simulate test payment', 'This is a demo only. No money will be collected. Choose the result to test the workflow.', [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Success', onPress: () => void startCheckout(order, milestone, 'SUCCESS') },
                          { text: 'Failed', style: 'destructive', onPress: () => void startCheckout(order, milestone, 'FAILED') },
                          { text: 'Leave pending', onPress: () => void startCheckout(order, milestone, 'PENDING') },
                        ])}>
                          <MaterialCommunityIcons name="flask-outline" size={19} color="#fff" />
                          <Text style={styles.primaryButtonText}>{busyId === milestone.id ? 'Processing test…' : milestone.status === 'PAYMENT_PENDING' ? 'Complete test payment' : 'Pay with test simulator'}</Text>
                        </Pressable>
                      )}
                      {milestone.status === 'PAYMENT_PENDING' && <Text style={styles.helperText}>Test payment is pending. Tap “Complete test payment” to simulate success or failure.</Text>}
                      {milestone.status === 'REJECTED' && <Text style={styles.rejectionReason}>Supplier proof was rejected: {milestone.rejectionReason || 'See supplier for details.'}</Text>}
                    </View>
                  );
                })}
              </View>

              {transactions.length > 0 && (
                <View style={styles.history}>
                  <Text style={styles.sectionTitle}>Payment History</Text>
                  {transactions.map(transaction => (
                    <View key={transaction.id} style={styles.historyRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyAmount}>{money(transaction.amount, transaction.currency)}</Text>
                        <Text style={styles.historyMeta}>{dateLabel(transaction.capturedAt || transaction.createdAt)} · {transaction.paymentMethod === 'SAMPLE_PAYMENT' ? 'SAMPLE PAYMENT · TEST' : transaction.provider === 'MOCK_TEST' ? 'TEST SIMULATOR' : transaction.paymentMethod || transaction.provider} · {transaction.id.slice(0, 10)}</Text>
                        {(transaction.refunds || []).map(refund => (
                          <Text key={refund.id} style={styles.historyMeta}>Refund {money(refund.amount, transaction.currency)} · {statusStyle(refund.status).label}</Text>
                        ))}
                      </View>
                      <View style={[styles.badge, { backgroundColor: statusStyle(transaction.status).bg }]}><Text style={[styles.badgeText, { color: statusStyle(transaction.status).fg }]}>{statusStyle(transaction.status).label}</Text></View>
                      {transaction.status === 'PAID' && (
                        <Pressable style={styles.refundLink} onPress={() => { setRefundReason(''); setRefundTransaction({ order, transaction }); }}>
                          <Text style={styles.refundLinkText}>Request refund</Text>
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}
              <Pressable style={styles.disputeButton} disabled={busyId === order.id} onPress={() => { setDisputeReason(''); setDisputeOrder(order); }}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#A33B35" />
                <Text style={styles.disputeButtonText}>Raise a payment dispute</Text>
              </Pressable>
              <Text style={styles.footerNote}>Provider: {provider}. Supplier settlement is not guaranteed by Buyer approval; it requires the platform's approved provider settlement setup.</Text>
            </View>
          );
        })}
      </ScrollView>
      <AppBottomNav role="BUYER" activeSection="orders" onNavigate={navigate} />

      <Modal visible={!!reviewMilestone} transparent animationType="slide" onRequestClose={() => setReviewMilestone(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review supplier proof</Text>
            <Text style={styles.modalSubtitle}>{reviewMilestone?.order.poNumber} · {reviewMilestone?.milestone.title}</Text>
            <Text style={styles.helperText}>Approve only if the submitted work and evidence meet the purchase-order requirements.</Text>
            <TextInput value={reviewReason} onChangeText={setReviewReason} placeholder="Rejection reason (required only when rejecting)" placeholderTextColor={ui.muted} multiline style={styles.reasonInput} />
            <Pressable style={styles.approveButton} disabled={!!busyId} onPress={() => void reviewProof('APPROVE')}><Text style={styles.primaryButtonText}>{busyId ? 'Please wait...' : 'Approve Proof'}</Text></Pressable>
            <Pressable style={styles.rejectButton} disabled={!!busyId} onPress={() => void reviewProof('REJECT')}><Text style={styles.rejectButtonText}>Reject with Reason</Text></Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setReviewMilestone(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!disputeOrder} transparent animationType="slide" onRequestClose={() => setDisputeOrder(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Raise payment dispute</Text>
            <Text style={styles.modalSubtitle}>{disputeOrder?.poNumber}</Text>
            <TextInput value={disputeReason} onChangeText={setDisputeReason} placeholder="Describe the payment or milestone issue..." placeholderTextColor={ui.muted} multiline style={styles.reasonInput} />
            <Pressable style={styles.disputeSubmit} disabled={!!busyId} onPress={() => void raiseDispute()}><Text style={styles.primaryButtonText}>{busyId ? 'Submitting...' : 'Submit Dispute'}</Text></Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setDisputeOrder(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!refundTransaction} transparent animationType="slide" onRequestClose={() => setRefundTransaction(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Request refund</Text>
            <Text style={styles.modalSubtitle}>{refundTransaction?.order.poNumber} · {refundTransaction ? money(refundTransaction.transaction.amount, refundTransaction.transaction.currency) : ''}</Text>
            <Text style={styles.helperText}>This submits a request for Admin review. It does not immediately refund the payment.</Text>
            <TextInput value={refundReason} onChangeText={setRefundReason} placeholder="Reason for refund request..." placeholderTextColor={ui.muted} multiline style={styles.reasonInput} />
            <Pressable style={styles.disputeSubmit} disabled={!!busyId} onPress={() => void requestRefund()}><Text style={styles.primaryButtonText}>{busyId ? 'Submitting...' : 'Submit Refund Request'}</Text></Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setRefundTransaction(null)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { padding: 16, paddingBottom: 30, gap: 15, width: '100%', maxWidth: 840, alignSelf: 'center' },
  heading: { gap: 5 },
  pageTitle: { fontSize: 23, fontWeight: '700', color: ui.ink },
  subtitle: { fontSize: 13, lineHeight: 19, color: ui.muted },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 12, borderRadius: 13, backgroundColor: '#F1EAFE', borderWidth: 1, borderColor: '#E4D8FA' },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#51416F' },
  historyPageButton: { minHeight: 42, borderWidth: 1, borderColor: '#D9C7F5', borderRadius: 11, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ui.surface, marginTop: 7 },
  historyPageButtonText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#5314B8' },
  checkoutNote: { fontSize: 11, color: '#7B5C2E', lineHeight: 16, marginTop: -8 },
  orderCard: { backgroundColor: ui.surface, borderWidth: 1, borderColor: '#E3E6ED', borderRadius: 17, padding: 15, gap: 12 },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  poNumber: { fontSize: 13, fontWeight: '700', color: '#5314B8' },
  orderTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: ui.ink, marginTop: 4 },
  orderStatus: { backgroundColor: '#F0EAFB', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 },
  orderStatusText: { fontSize: 10, fontWeight: '700', color: '#5B13B8' },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  metaLabel: { fontSize: 11, color: ui.muted },
  totalAmount: { fontSize: 21, fontWeight: '700', color: '#5314B8', marginTop: 3 },
  paidAmount: { fontSize: 17, fontWeight: '700', color: '#087653', marginTop: 5 },
  progressTrack: { height: 8, borderRadius: 8, overflow: 'hidden', backgroundColor: '#E5E0ED' },
  progressFill: { height: 8, borderRadius: 8, backgroundColor: PURPLE },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: -7 },
  milestones: { gap: 9 },
  milestoneCard: { borderWidth: 1, borderColor: '#E5E1EC', borderRadius: 13, padding: 12, gap: 9, backgroundColor: '#FEFDFF' },
  milestoneHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sequence: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0E8FF', alignItems: 'center', justifyContent: 'center' },
  sequenceText: { color: PURPLE, fontWeight: '700', fontSize: 12 },
  milestoneTitle: { fontSize: 13, fontWeight: '700', color: ui.ink },
  milestoneAmount: { fontSize: 12, color: ui.muted, marginTop: 3 },
  badge: { borderRadius: 16, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  proofBox: { backgroundColor: '#F7F4FC', borderRadius: 11, padding: 10, gap: 7 },
  proofHeading: { fontSize: 12, fontWeight: '700', color: '#5314B8' },
  proofImage: { width: '100%', height: 160, borderRadius: 9, backgroundColor: '#ECE8F2' },
  proofUrl: { fontSize: 12, color: '#5B13B8', textDecorationLine: 'underline' },
  proofNote: { fontSize: 12, color: ui.ink, lineHeight: 17 },
  rejectionReason: { fontSize: 12, color: '#B42318', lineHeight: 17 },
  proofActions: { flexDirection: 'row', gap: 8 },
  approveButton: { minHeight: 42, borderRadius: 11, backgroundColor: '#087653', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  rejectButton: { minHeight: 42, borderRadius: 11, backgroundColor: '#FDECEC', borderWidth: 1, borderColor: '#F2C6C2', alignItems: 'center', justifyContent: 'center' },
  rejectButtonText: { color: '#B42318', fontSize: 13, fontWeight: '700' },
  payButton: { minHeight: 44, borderRadius: 11, backgroundColor: PURPLE, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disabledButton: { backgroundColor: '#8D83A3' },
  transactionLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  transactionText: { flex: 1, fontSize: 11, color: ui.muted },
  helperText: { fontSize: 12, color: ui.muted, lineHeight: 18 },
  history: { borderTopWidth: 1, borderTopColor: '#E8E6EC', paddingTop: 12, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: ui.ink },
  historyRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0EEF3' },
  historyAmount: { fontSize: 13, fontWeight: '700', color: ui.ink },
  historyMeta: { fontSize: 11, color: ui.muted, marginTop: 3 },
  refundLink: { paddingHorizontal: 6, paddingVertical: 6 },
  refundLinkText: { fontSize: 11, fontWeight: '700', color: PURPLE },
  disputeButton: { minHeight: 42, borderRadius: 11, borderWidth: 1, borderColor: '#F1C8C5', backgroundColor: '#FFF8F7', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  disputeButtonText: { fontSize: 12, fontWeight: '700', color: '#A33B35' },
  footerNote: { fontSize: 11, color: ui.muted, lineHeight: 16 },
  stateCard: { backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border, borderRadius: 15, padding: 23, alignItems: 'center', gap: 10 },
  stateTitle: { fontSize: 16, fontWeight: '700', color: ui.ink },
  stateText: { fontSize: 13, color: ui.muted, textAlign: 'center', lineHeight: 19 },
  secondaryButton: { backgroundColor: '#F1EAFE', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  secondaryButtonText: { fontSize: 13, fontWeight: '700', color: PURPLE },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,10,25,.48)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: ui.surface, borderRadius: 20, padding: 18, gap: 11 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: ui.ink },
  modalSubtitle: { fontSize: 12, color: ui.muted },
  reasonInput: { minHeight: 95, maxHeight: 160, textAlignVertical: 'top', borderWidth: 1, borderColor: ui.border, borderRadius: 12, padding: 12, color: ui.ink, fontSize: 14 },
  disputeSubmit: { minHeight: 44, borderRadius: 11, backgroundColor: '#A33B35', alignItems: 'center', justifyContent: 'center' },
  cancelButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, color: ui.muted, fontWeight: '600' },
});
