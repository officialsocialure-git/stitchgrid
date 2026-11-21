import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import { AppHeader } from '@/components/AppHeader';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { apiGet, apiPost, apiRequest } from '@/services/api';

const PURPLE = ui.accent;
type Attachment = { uri: string; base64?: string | null; fileName?: string | null; mimeType?: string | null };
type Milestone = {
  id: string; title: string; sequence: number; percentage: number; amount: number | string; status: string;
  dueDate?: string | null; proofUrl?: string | null; completionNote?: string | null; submittedAt?: string | null;
  approvedAt?: string | null; rejectionReason?: string | null;
  transactions?: Transaction[];
};
type Transaction = {
  id: string; amount: number | string; currency: string; status: string; provider: string;
  paymentMilestoneId?: string | null; paymentMethod?: string | null; razorpayPaymentId?: string | null;
  createdAt: string; capturedAt?: string | null;
};
type PaymentOrder = {
  id: string; poNumber: string; buyerOrgId: string; supplierOrgId: string; status: string;
  totalAmount: number | string; currency?: string; expectedDate?: string | null;
  buyer?: { name?: string }; items?: { name: string; quantity: number }[];
  paymentPlan?: { totalAmount: number | string; milestones: Milestone[] } | null;
  paymentTransactions?: Transaction[];
};
type Setup = {
  status?: string; kycStatus?: string; settlementStatus?: string; accountHolderName?: string;
  bankName?: string; bankAccountLast4?: string; ifscMasked?: string; rejectionReason?: string | null;
};
type Dashboard = { provider?: string; supplierSetup?: Setup; orders: PaymentOrder[] };
type Membership = { organizationId?: string; organization?: { id?: string }; role?: string };
type HistoryRow = { order: PaymentOrder; transaction: Transaction; milestoneTitle: string };

const amount = (value: number | string | undefined, currency = 'INR') => {
  const n = Number(value || 0);
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
  catch { return `₹${n.toLocaleString('en-IN')}`; }
};
const dateLabel = (value?: string | null) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const statusVisual = (status: string) => {
  if (['PAID', 'RELEASED', 'PROCESSED', 'APPROVED'].includes(status)) return { bg: '#E8F8F0', fg: '#087653', label: status.replaceAll('_', ' ') };
  if (['FAILED', 'REJECTED', 'CANCELLED'].includes(status)) return { bg: '#FDECEC', fg: '#B42318', label: status.replaceAll('_', ' ') };
  if (['UPCOMING', 'LOCKED'].includes(status)) return { bg: '#F1F3F6', fg: '#687385', label: status.replaceAll('_', ' ') };
  return { bg: '#FFF3DE', fg: '#9A5B00', label: status.replaceAll('_', ' ') };
};
const milestoneProgress = (status: string) => ['PAID', 'RELEASED'].includes(status) ? 1 : 0;
const currencyTotals = (entries: { currency?: string; amount: number }[]) => {
  const totals = new Map<string, number>();
  entries.forEach(entry => {
    const currency = entry.currency || 'INR';
    totals.set(currency, (totals.get(currency) || 0) + entry.amount);
  });
  return [...totals.entries()].map(([currency, value]) => amount(value, currency)).join(' · ') || amount(0, 'INR');
};

export default function SupplierPaymentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; section?: string }>();
  const requestedOrderId = typeof params.orderId === 'string' ? params.orderId : '';
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [setup, setSetup] = useState<Setup>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'status' | 'history'>(params.section === 'payment-history' ? 'history' : 'status');
  const [proofMilestone, setProofMilestone] = useState<{ order: PaymentOrder; milestone: Milestone } | null>(null);
  const [proofNote, setProofNote] = useState('');
  const [proofFile, setProofFile] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [productionAmountDrafts, setProductionAmountDrafts] = useState<Record<string, string>>({});
  const [holder, setHolder] = useState('');
  const [bank, setBank] = useState('');
  const [last4, setLast4] = useState('');
  const [ifsc, setIfsc] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      const member = raw ? JSON.parse(raw) as Membership : null;
      const orgId = member?.organizationId || member?.organization?.id;
      if (member?.role !== 'SUPPLIER' || !orgId) throw new Error('Active supplier membership not found. Please sign in again.');
      const [data, purchaseOrders] = await Promise.all([
        apiGet<Dashboard>('/payments/dashboard'),
        apiGet<PaymentOrder[]>('/purchase-orders'),
      ]);
      const orderDetails = new Map<string, PaymentOrder>((Array.isArray(purchaseOrders) ? purchaseOrders : []).map(order => [order.id, order] as const));
      const supplierOrders = (data.orders || [])
        .filter(order => order.supplierOrgId === orgId && (!requestedOrderId || order.id === requestedOrderId))
        .map(order => ({ ...orderDetails.get(order.id), ...order, items: orderDetails.get(order.id)?.items || order.items, expectedDate: orderDetails.get(order.id)?.expectedDate }));
      setOrders(supplierOrders);
      const profile = data.supplierSetup || {};
      setSetup(profile);
      setHolder(profile.accountHolderName || '');
      setBank(profile.bankName || '');
      setLast4(profile.bankAccountLast4 || '');
      setIfsc(profile.ifscMasked || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load supplier payments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestedOrderId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(true); }, 25000);
    return () => clearInterval(timer);
  }, [load]);

  const visibleOrders = useMemo(() => [...orders].sort((a, b) => (b.poNumber || '').localeCompare(a.poNumber || '')), [orders]);
  const allMilestones = useMemo(() => visibleOrders.flatMap(order =>
    [...(order.paymentPlan?.milestones || [])].sort((a, b) => a.sequence - b.sequence).map(milestone => ({ order, milestone }))
  ), [visibleOrders]);
  const received = useMemo(() => currencyTotals(allMilestones
    .filter(item => ['PAID', 'RELEASED'].includes(item.milestone.status))
    .map(item => ({ currency: item.order.currency, amount: Number(item.milestone.amount || 0) }))), [allMilestones]);
  const pending = useMemo(() => currencyTotals(visibleOrders.map(order => {
    const milestones = order.paymentPlan?.milestones || [];
    const verified = milestones.filter(item => ['PAID', 'RELEASED'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return { currency: order.currency, amount: Math.max(0, Number(order.paymentPlan?.totalAmount ?? order.totalAmount ?? 0) - verified) };
  })), [visibleOrders]);
  const history = useMemo<HistoryRow[]>(() => visibleOrders.flatMap(order =>
    (order.paymentTransactions || []).map(transaction => ({
      order, transaction,
      milestoneTitle: transaction.paymentMethod === 'SAMPLE_PAYMENT' ? 'Sample Payment' : order.paymentPlan?.milestones.find(item => item.id === transaction.paymentMilestoneId)?.title || 'Order payment',
    }))
  ).sort((a, b) => new Date(b.transaction.createdAt).getTime() - new Date(a.transaction.createdAt).getTime()), [visibleOrders]);

  const navigate = (section: string) => {
    if (section === 'home') router.replace('/workspace?role=SUPPLIER' as any);
    else router.replace({ pathname: '/supplier/[section]', params: { section } } as any);
  };

  const saveProductionAmount = async (order: PaymentOrder) => {
    const amountValue = Number(productionAmountDrafts[order.id]);
    if (!Number.isFinite(amountValue) || amountValue <= 0 || amountValue >= Number(order.totalAmount)) {
      Alert.alert('Check production amount', 'Enter an amount greater than zero and less than the total order value. The balance will be due after QC and dispatch.');
      return;
    }
    try {
      setSaving(true);
      await apiPost(`/payments/orders/${order.id}/production-amount`, { amount: amountValue });
      await load(true);
      Alert.alert('Production amount submitted', 'The buyer has been notified. The remaining balance will become due after production, QC and dispatch.');
    } catch (e) {
      Alert.alert('Unable to set production amount', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const chooseProof = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Allow photo library access to attach milestone proof.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, base64: true, quality: 0.75 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Unable to read image', 'Please select another image and try again.');
      return;
    }
    if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
      Alert.alert('File too large', 'Choose an image smaller than 10 MB.');
      return;
    }
    setProofFile({ uri: asset.uri, base64: asset.base64, fileName: asset.fileName || 'milestone-proof.jpg', mimeType: asset.mimeType || 'image/jpeg' });
  };

  const submitProof = async () => {
    if (!proofMilestone || !proofFile?.base64) {
      Alert.alert('Proof required', 'Please attach a photo before submitting this milestone.');
      return;
    }
    if (!proofNote.trim()) {
      Alert.alert('Description required', 'Add a short description of the completed milestone.');
      return;
    }
    try {
      setUploading(true);
      const uploaded = await apiPost<{ url: string }>('/upload', {
        filename: proofFile.fileName || 'milestone-proof.jpg',
        data: `data:${proofFile.mimeType || 'image/jpeg'};base64,${proofFile.base64}`,
        label: 'Payment milestone proof',
      });
      setSaving(true);
      await apiPost(`/payments/milestones/${proofMilestone.milestone.id}/proof`, {
        proofUrl: uploaded.url,
        note: proofNote.trim(),
      });
      const po = proofMilestone.order.poNumber;
      setProofMilestone(null);
      setProofFile(null);
      setProofNote('');
      await load(true);
      Alert.alert('Proof submitted', `Your proof for ${po} has been sent to the buyer for review.`);
    } catch (e) {
      Alert.alert('Unable to submit proof', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
      setSaving(false);
    }
  };

  const saveSetup = async () => {
    if (holder.trim().length < 2 || bank.trim().length < 2 || !/^\d{4}$/.test(last4.trim()) || ifsc.trim().length < 4) {
      Alert.alert('Check settlement details', 'Enter account holder name, bank name, last 4 account digits and IFSC.');
      return;
    }
    try {
      setSaving(true);
      const updated = await apiRequest<Setup>('/payments/supplier/setup', {
        method: 'PUT',
        body: { accountHolderName: holder.trim(), bankName: bank.trim(), bankAccountLast4: last4.trim(), ifscMasked: ifsc.trim().toUpperCase() },
      });
      setSetup(updated);
      setSetupOpen(false);
      Alert.alert('Settlement details submitted', 'Your settlement details are pending verification. This does not mean payouts are active yet.');
      await load(true);
    } catch (e) {
      Alert.alert('Unable to save settlement details', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const openProof = (order: PaymentOrder, milestone: Milestone) => {
    setProofMilestone({ order, milestone });
    setProofNote(milestone.completionNote || '');
    setProofFile(null);
  };

  const renderOrder = (order: PaymentOrder) => {
    const milestones = [...(order.paymentPlan?.milestones || [])].sort((a, b) => a.sequence - b.sequence);
    const paid = milestones.filter(m => ['PAID', 'RELEASED'].includes(m.status)).reduce((sum, m) => sum + Number(m.amount || 0), 0);
    const orderTotal = Number(order.paymentPlan?.totalAmount ?? order.totalAmount ?? 0);
    const completed = milestones.filter(m => milestoneProgress(m.status)).length;
    const product = order.items?.length ? order.items.map(item => `${Number(item.quantity || 0).toLocaleString('en-IN')} pcs ${item.name}`).join(', ') : 'Garment Production Order';
    return (
      <View key={order.id} style={s.orderCard}>
        <View style={s.orderTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.po}>{order.poNumber}</Text>
            <Text style={s.product}>{product}</Text>
            <Text style={s.buyer}>Buyer: {order.buyer?.name || 'Buyer'}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: statusVisual(order.status).bg }]}><Text style={[s.badgeText, { color: statusVisual(order.status).fg }]}>{order.status.replaceAll('_', ' ')}</Text></View>
        </View>
        <View style={s.summaryRow}>
          <View style={s.summaryCell}><Text style={s.summaryLabel}>Order value</Text><Text style={s.summaryValue}>{amount(orderTotal, order.currency)}</Text></View>
          <View style={s.summaryCell}><Text style={s.summaryLabel}>Buyer payment successful</Text><Text style={[s.summaryValue, { color: '#087653' }]}>{amount(paid, order.currency)}</Text></View>
          <View style={s.summaryCell}><Text style={s.summaryLabel}>Unpaid balance</Text><Text style={s.summaryValue}>{amount(Math.max(0, orderTotal - paid), order.currency)}</Text></View>
        </View>
        {order.status === 'SAMPLE_APPROVED' && (!milestones.find(item => item.title === 'Production Payment') || Number(milestones.find(item => item.title === 'Production Payment')?.amount || 0) <= 0) && (
          <View style={{ gap: 9, padding: 13, borderWidth: 1, borderColor: ui.border, borderRadius: 12 }}>
            <Text style={s.sectionTitle}>Set Production Payment</Text>
            <Text style={s.muted}>Sample approved. Enter the agreed production advance. The remaining order balance becomes due after QC and dispatch.</Text>
            <TextInput value={productionAmountDrafts[order.id] || ''} onChangeText={value => setProductionAmountDrafts(current => ({ ...current, [order.id]: value }))} keyboardType="decimal-pad" style={s.input} placeholder="Production payment amount (INR)" />
            <Pressable style={[s.primaryButton, saving && { opacity: 0.65 }]} onPress={() => void saveProductionAmount(order)} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />}
              <Text style={s.primaryButtonText}>{saving ? 'Saving...' : 'Submit Production Amount'}</Text>
            </Pressable>
          </View>
        )}
                <View style={s.progressHeading}><Text style={s.sectionTitle}>Payment milestones</Text><Text style={s.progressCount}>{completed} of {milestones.length} successful</Text></View>
        {milestones.length === 0 ? <Text style={s.muted}>Payment milestones will appear once the buyer creates the payment schedule.</Text> : milestones.map(milestone => {
          const visual = statusVisual(milestone.status);
          const previousMilestone = milestones.find(item => item.sequence === milestone.sequence - 1);
          const canSubmit = ['UPCOMING', 'REJECTED', 'PROOF_SUBMITTED'].includes(milestone.status) && milestone.sequence !== 1 && previousMilestone?.status === 'PAID';
          return (
            <View key={milestone.id} style={s.milestoneCard}>
              <View style={s.milestoneIcon}>
                <MaterialCommunityIcons name={['PAID', 'RELEASED'].includes(milestone.status) ? 'check-circle' : milestone.status === 'PROOF_SUBMITTED' ? 'clock-outline' : 'lock-outline'} size={22} color={['PAID', 'RELEASED'].includes(milestone.status) ? '#079669' : PURPLE} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.milestoneTitle}>{milestone.sequence}. {milestone.title}</Text>
                <Text style={s.muted}>{Number(milestone.percentage || 0)}% · {amount(milestone.amount, order.currency)}</Text>
                {milestone.rejectionReason ? <Text style={s.rejection}>Buyer feedback: {milestone.rejectionReason}</Text> : null}
                {milestone.proofUrl ? <Pressable onPress={() => Alert.alert('Proof submitted', milestone.proofUrl || '')}><Text style={s.linkText}>View submitted proof details</Text></Pressable> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 7 }}>
                <View style={[s.badge, { backgroundColor: visual.bg }]}><Text style={[s.badgeText, { color: visual.fg }]}>{visual.label}</Text></View>
                {canSubmit && <Pressable style={s.proofButton} onPress={() => openProof(order, milestone)}><Text style={s.proofButtonText}>{milestone.status === 'PROOF_SUBMITTED' ? 'Update Proof' : 'Submit Proof'}</Text></Pressable>}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={s.screen}>
      <AppHeader role="SUPPLIER" activeSection="orders" isBack title="Payments & Earnings" showLogo={false} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={PURPLE} />}>
        <View style={s.heading}>
          <Text style={s.title}>Payments & Earnings</Text>
          <Text style={s.subtitle}>Track simulated buyer payment results and milestone progress for your purchase orders.</Text>
        </View>
        <View style={s.earningsCard}>
          <View style={s.earningsCell}><Text style={s.earningsLabel}>Buyer Payments Marked Successful (TEST)</Text><Text style={s.earningsValue}>{received}</Text></View>
          <View style={s.earningsDivider} />
          <View style={s.earningsCell}><Text style={s.earningsLabel}>Unpaid Order Balance</Text><Text style={s.earningsValue}>{pending}</Text></View>
        </View>
        <View style={s.notice}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={PURPLE} />
          <Text style={s.noticeText}>TEST PAYMENT MODE: buyer payments shown here are simulated only. No real money is collected, and supplier payouts are not active. A successful test updates your order progress.</Text>
        </View>
        <View style={s.setupCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.sectionTitle}>Supplier payouts are paused</Text>
            <Text style={s.muted}>This test version tracks buyer payment milestones only. Bank settlement setup will be enabled when a payout provider is selected.</Text>
            {!!setup.bankName && <Text style={s.muted}>{setup.bankName} · •••• {setup.bankAccountLast4 || '—'}</Text>}
            {!!setup.rejectionReason && <Text style={s.rejection}>{setup.rejectionReason}</Text>}
          </View>
          <Text style={s.muted}>Not required for testing</Text>
        </View>
        <View style={s.tabs}>
          <Pressable style={[s.tab, tab === 'status' && s.tabActive]} onPress={() => setTab('status')}><Text style={[s.tabText, tab === 'status' && s.tabTextActive]}>Payment Status</Text></Pressable>
          <Pressable style={[s.tab, tab === 'history' && s.tabActive]} onPress={() => setTab('history')}><Text style={[s.tabText, tab === 'history' && s.tabTextActive]}>Payment History</Text></Pressable>
        </View>
        {loading ? <View style={s.state}><ActivityIndicator color={PURPLE} /><Text style={s.muted}>Loading payment information...</Text></View>
          : error ? <View style={s.state}><MaterialCommunityIcons name="cloud-alert-outline" size={28} color={ui.muted} /><Text style={s.stateTitle}>Couldn't load payments</Text><Text style={s.muted}>{error}</Text><Pressable style={s.outlineButton} onPress={() => void load()}><Text style={s.outlineButtonText}>Try Again</Text></Pressable></View>
          : tab === 'status' ? (visibleOrders.length ? visibleOrders.map(renderOrder) : <View style={s.state}><MaterialCommunityIcons name="wallet-outline" size={32} color={ui.muted} /><Text style={s.stateTitle}>No supplier payments yet</Text><Text style={s.muted}>Payment schedules for your purchase orders will appear here.</Text></View>)
          : (history.length ? history.map(({ order, transaction, milestoneTitle }) => {
            const visual = statusVisual(transaction.status);
            return <View key={transaction.id} style={s.historyCard}>
              <View style={s.orderTop}><View style={{ flex: 1 }}><Text style={s.historyAmount}>{amount(transaction.amount, transaction.currency)}</Text><Text style={s.muted}>{order.poNumber} · {milestoneTitle}</Text></View><View style={[s.badge, { backgroundColor: visual.bg }]}><Text style={[s.badgeText, { color: visual.fg }]}>{visual.label}</Text></View></View>
              <View style={s.historyLine}><Text style={s.muted}>Buyer</Text><Text style={s.historyValue}>{order.buyer?.name || 'Buyer'}</Text></View>
              <View style={s.historyLine}><Text style={s.muted}>Date</Text><Text style={s.historyValue}>{dateLabel(transaction.capturedAt || transaction.createdAt)}</Text></View>
              <View style={s.historyLine}><Text style={s.muted}>Payment type</Text><Text style={s.historyValue}>{transaction.provider === 'MOCK_TEST' ? 'TEST SIMULATOR · NO REAL MONEY' : [transaction.provider, transaction.paymentMethod].filter(Boolean).join(' · ') || '—'}</Text></View>
              <View style={s.historyLine}><Text style={s.muted}>Transaction ID</Text><Text style={s.historyValue}>{transaction.razorpayPaymentId || transaction.id}</Text></View>
            </View>;
          }) : <View style={s.state}><MaterialCommunityIcons name="receipt-text-outline" size={32} color={ui.muted} /><Text style={s.stateTitle}>No transactions yet</Text><Text style={s.muted}>Verified and attempted transactions for your purchase orders will appear here.</Text></View>)}
      </ScrollView>
      <AppBottomNav role="SUPPLIER" activeSection="orders" onNavigate={navigate} />

      <Modal visible={!!proofMilestone} transparent animationType="slide" onRequestClose={() => setProofMilestone(null)}>
        <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}><Text style={s.modalTitle}>Submit Milestone Proof</Text><Pressable onPress={() => setProofMilestone(null)}><MaterialCommunityIcons name="close" size={23} color={ui.ink} /></Pressable></View>
            <Text style={s.muted}>{proofMilestone?.order.poNumber} · {proofMilestone?.milestone.title}</Text>
            <Pressable style={s.uploadBox} onPress={() => void chooseProof()}>
              {proofFile ? <><Image source={{ uri: proofFile.uri }} style={s.preview} /><Text style={s.proofButtonText}>Change Photo</Text></> : <><MaterialCommunityIcons name="cloud-upload-outline" size={34} color={PURPLE} /><Text style={s.uploadTitle}>Upload proof photo</Text><Text style={s.muted}>JPG, PNG or WEBP · Max 10 MB</Text></>}
            </Pressable>
            <Text style={s.fieldLabel}>Description *</Text>
            <TextInput value={proofNote} onChangeText={setProofNote} placeholder="Describe the completed milestone for buyer review..." multiline textAlignVertical="top" style={s.textArea} maxLength={4000} />
            <Pressable style={[s.primaryButton, (uploading || saving) && { opacity: 0.65 }]} disabled={uploading || saving} onPress={() => void submitProof()}>
              {(uploading || saving) ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="send" size={18} color="#fff" />}
              <Text style={s.primaryButtonText}>{uploading ? 'Uploading proof...' : saving ? 'Submitting...' : 'Submit for Approval'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={setupOpen} transparent animationType="slide" onRequestClose={() => setSetupOpen(false)}>
        <KeyboardAvoidingView style={s.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.setupModalWrap} keyboardShouldPersistTaps="handled">
            <View style={s.modalCard}>
              <View style={s.modalHeader}><Text style={s.modalTitle}>Settlement Setup</Text><Pressable onPress={() => setSetupOpen(false)}><MaterialCommunityIcons name="close" size={23} color={ui.ink} /></Pressable></View>
              <Text style={s.muted}>Provide the settlement details requested by STITCHGRID. Only the last four account digits are collected here.</Text>
              <Text style={s.fieldLabel}>Account Holder Name</Text><TextInput value={holder} onChangeText={setHolder} style={s.input} placeholder="Name as per bank account" />
              <Text style={s.fieldLabel}>Bank Name</Text><TextInput value={bank} onChangeText={setBank} style={s.input} placeholder="Bank name" />
              <Text style={s.fieldLabel}>Account Last 4 Digits</Text><TextInput value={last4} onChangeText={v => setLast4(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" style={s.input} placeholder="1234" maxLength={4} />
              <Text style={s.fieldLabel}>IFSC</Text><TextInput value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" style={s.input} placeholder="IFSC code" maxLength={20} />
              <Pressable style={s.primaryButton} disabled={saving} onPress={() => void saveSetup()}>{saving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="content-save-outline" size={18} color="#fff" />}<Text style={s.primaryButtonText}>{saving ? 'Saving...' : 'Submit Settlement Details'}</Text></Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { padding: 16, paddingBottom: 30, gap: 14, width: '100%', maxWidth: 840, alignSelf: 'center' },
  heading: { gap: 5 }, title: { fontSize: 23, fontWeight: '800', color: ui.ink }, subtitle: { fontSize: 13, lineHeight: 19, color: ui.muted },
  earningsCard: { backgroundColor: '#F1E8FF', borderRadius: 16, padding: 17, flexDirection: 'row', alignItems: 'center' },
  earningsCell: { flex: 1, gap: 7 }, earningsLabel: { color: '#4F287E', fontSize: 12, fontWeight: '700' }, earningsValue: { color: '#40108C', fontSize: 20, fontWeight: '800' }, earningsDivider: { width: 1, height: 43, backgroundColor: '#D1B9F4', marginHorizontal: 12 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 13, borderRadius: 13, backgroundColor: '#F2ECFF' }, noticeText: { flex: 1, color: '#4C2B7D', fontSize: 12, lineHeight: 18 },
  setupCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, borderRadius: 15, backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border },
  sectionTitle: { color: ui.ink, fontSize: 15, fontWeight: '800' }, muted: { color: ui.muted, fontSize: 12, lineHeight: 18 }, outlineButton: { minHeight: 40, paddingHorizontal: 13, borderRadius: 10, borderWidth: 1, borderColor: '#D9C8F4', alignItems: 'center', justifyContent: 'center' }, outlineButtonText: { color: PURPLE, fontSize: 12, fontWeight: '800' },
  tabs: { flexDirection: 'row', backgroundColor: ui.surface, borderRadius: 24, padding: 4, borderWidth: 1, borderColor: ui.border }, tab: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 22 }, tabActive: { backgroundColor: PURPLE }, tabText: { fontSize: 12, fontWeight: '700', color: ui.ink }, tabTextActive: { color: '#fff' },
  orderCard: { backgroundColor: ui.surface, borderRadius: 16, borderWidth: 1, borderColor: ui.border, padding: 14, gap: 12 }, orderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, po: { color: PURPLE, fontSize: 14, fontWeight: '800' }, product: { color: ui.ink, fontSize: 15, lineHeight: 21, fontWeight: '800', marginTop: 4 }, buyer: { color: ui.muted, fontSize: 12, marginTop: 4 },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 }, badgeText: { fontSize: 10, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 8, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEF0F4' }, summaryCell: { flex: 1, gap: 4 }, summaryLabel: { color: ui.muted, fontSize: 10 }, summaryValue: { color: ui.ink, fontSize: 12, fontWeight: '800' },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressCount: { color: PURPLE, fontSize: 12, fontWeight: '800' },
  milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E9EAF0', backgroundColor: '#fff' }, milestoneIcon: { width: 30, alignItems: 'center' }, milestoneTitle: { color: ui.ink, fontSize: 12, fontWeight: '800' }, rejection: { color: '#B42318', fontSize: 11, lineHeight: 16 }, linkText: { color: PURPLE, fontSize: 11, fontWeight: '700' }, proofButton: { backgroundColor: '#F0E7FF', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }, proofButtonText: { color: PURPLE, fontSize: 10, fontWeight: '800' },
  historyCard: { backgroundColor: ui.surface, borderRadius: 15, borderWidth: 1, borderColor: ui.border, padding: 14, gap: 9 }, historyAmount: { color: PURPLE, fontSize: 19, fontWeight: '800' }, historyLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 }, historyValue: { color: ui.ink, fontSize: 11, fontWeight: '700', textAlign: 'right', flex: 1 },
  state: { minHeight: 170, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: ui.surface, borderRadius: 15, borderWidth: 1, borderColor: ui.border }, stateTitle: { color: ui.ink, fontSize: 15, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(12,10,20,.5)', padding: 14 }, modalCard: { backgroundColor: ui.surface, borderRadius: 20, padding: 18, gap: 12, maxHeight: '95%' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalTitle: { color: ui.ink, fontSize: 19, fontWeight: '800' },
  uploadBox: { minHeight: 145, borderRadius: 15, borderWidth: 1, borderColor: '#CDB8F5', borderStyle: 'dashed', backgroundColor: '#FAF7FF', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12 }, uploadTitle: { color: PURPLE, fontSize: 14, fontWeight: '800' }, preview: { width: 115, height: 90, borderRadius: 10, resizeMode: 'cover' },
  fieldLabel: { color: '#596273', fontSize: 12, fontWeight: '800', marginTop: 4 }, textArea: { minHeight: 105, borderWidth: 1, borderColor: ui.border, borderRadius: 12, padding: 12, color: ui.ink, fontSize: 14 }, input: { minHeight: 47, borderWidth: 1, borderColor: ui.border, borderRadius: 11, paddingHorizontal: 12, color: ui.ink, fontSize: 14 }, primaryButton: { minHeight: 49, borderRadius: 12, backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14 }, primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' }, setupModalWrap: { flexGrow: 1, justifyContent: 'center', paddingVertical: 18 },
});