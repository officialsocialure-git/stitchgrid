import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = '#5B13EC';
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';
const BG = '#F7F8FC';

type Membership = { organizationId?: string; organization?: { id?: string; name?: string }; role?: string };
type Rfq = {
  id: string; title?: string; description?: string; garmentType?: string; fabricSpec?: string;
  targetQuantity?: number; targetDate?: string; targetPrice?: number; status?: string;
  createdAt?: string; buyer?: { name?: string; city?: string };
  items?: { id?: string; name?: string; description?: string; quantity?: number; unit?: string }[];
  quotations?: { id: string; totalAmount?: number; currency?: string; leadTimeDays?: number; status?: string; items?: any[] }[];
};
type OrgProfile = {
  id: string; name?: string; legalName?: string | null; taxId?: string | null;
  city?: string | null; address?: string | null; businessType?: string | null;
  verificationStatus?: string; supplierProfile?: {
    description?: string | null; yearsInBusiness?: number | null;
    productionCapacity?: number | null; categories?: { category: string }[];
  } | null;
};
type Order = { id: string; status?: string; createdAt?: string };
type Sample = { id: string; status?: string; createdAt?: string };

const money = (value?: number, currency = 'INR') => {
  if (value == null) return '—';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `₹${Number(value).toLocaleString('en-IN')}`; }
};
const dateLabel = (value?: string) => value
  ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  : 'Flexible';
const rfqCode = (id: string) => `RFQ-${id.slice(-4).toUpperCase()}`;

function statusFor(rfq: Rfq) {
  if (rfq.status === 'AWARDED') return { label: 'Awarded', color: '#16804A', bg: '#EAF9F1' };
  if ((rfq.quotations?.length || 0) > 0) return { label: 'In Review', color: '#2563B8', bg: '#EDF5FF' };
  if (rfq.status === 'OPEN') return { label: 'New RFQ', color: PURPLE, bg: '#F2EAFF' };
  return { label: rfq.status || 'Open', color: '#68727F', bg: '#F1F3F6' };
}

function matchesRange(value: string | undefined, range: string) {
  if (range === 'All Time' || !value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'This Week') {
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  }
  return date >= start && date <= now;
}

function StatCard({ icon, value, label, tone }: { icon: any; value: number | string; label: string; tone: 'purple' | 'amber' | 'green' | 'blue' }) {
  const toneStyle = tone === 'purple' ? styles.stat_purple : tone === 'amber' ? styles.stat_amber : tone === 'green' ? styles.stat_green : styles.stat_blue;
  const iconStyle = tone === 'purple' ? styles.statIcon_purple : tone === 'amber' ? styles.statIcon_amber : tone === 'green' ? styles.statIcon_green : styles.statIcon_blue;
  return (
    <View style={[styles.statCard, toneStyle]}>
      <View style={[styles.statIcon, iconStyle]}><MaterialCommunityIcons name={icon} size={25} color={tone === 'purple' ? PURPLE : tone === 'amber' ? '#C47A12' : tone === 'green' ? '#16845A' : '#3976C8'} /></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function SupplierDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [range, setRange] = useState('This Month');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [selectedRfq, setSelectedRfq] = useState<Rfq | null>(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [leadDays, setLeadDays] = useState('21');
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogName, setCatalogName] = useState('');
  const [catalogType, setCatalogType] = useState('');
  const [catalogMoq, setCatalogMoq] = useState('');
  const [catalogPrice, setCatalogPrice] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogItems, setCatalogItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);

  const orgId = membership?.organizationId || membership?.organization?.id || '';

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const currentMembership = JSON.parse(raw) as Membership;
      const currentOrgId = currentMembership.organizationId || currentMembership.organization?.id;
      if (!currentOrgId || currentMembership.role !== 'SUPPLIER') throw new Error('Active supplier organization was not found. Please sign in again.');
      setMembership(currentMembership);

      const requests = await Promise.allSettled([
        apiGet<Rfq[]>(`/rfqs?organizationId=${encodeURIComponent(currentOrgId)}`),
        apiGet<Order[]>('/purchase-orders'),
        apiGet<Sample[]>('/samples'),
        apiGet<OrgProfile>(`/organization-profile?organizationId=${encodeURIComponent(currentOrgId)}`),
        apiGet<any[]>(`/catalog-items?organizationId=${encodeURIComponent(currentOrgId)}`),
        apiGet<any[]>('/notifications'),
      ]);
      const names = ['RFQs', 'Purchase Orders', 'Samples', 'Organization Profile', 'Catalogue', 'Notifications'];
      const warnings = requests.flatMap((result, index) => result.status === 'rejected'
        ? [`${names[index]}: ${result.reason instanceof Error ? result.reason.message : 'Request failed'}`]
        : []);
      setLoadWarnings(warnings);
      const valueAt = <T,>(index: number, fallback: T): T => {
        const result = requests[index];
        return result.status === 'fulfilled' ? result.value as T : fallback;
      };
      const rfqResult = valueAt<Rfq[]>(0, []);
      const orderResult = valueAt<Order[]>(1, []);
      const sampleResult = valueAt<Sample[]>(2, []);
      const profileResult = valueAt<OrgProfile | null>(3, null);
      const catalogResult = valueAt<any[]>(4, []);
      const notificationResult = valueAt<any[]>(5, []);
      setRfqs(Array.isArray(rfqResult) ? rfqResult : []);
      setOrders(Array.isArray(orderResult) ? orderResult : []);
      setSamples(Array.isArray(sampleResult) ? sampleResult : []);
      setProfile(profileResult || null);
      setCatalogItems(Array.isArray(catalogResult) ? catalogResult : []);
      setUnreadCount(Array.isArray(notificationResult) ? notificationResult.filter((item: any) => !item.readAt).length : 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Supplier Dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const timer = setInterval(() => { void loadDashboard(true); }, 30000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const rfqsInRange = useMemo(() => rfqs.filter(r => matchesRange(r.createdAt, range)), [rfqs, range]);
  const ordersInRange = useMemo(() => orders.filter(o => matchesRange(o.createdAt, range)), [orders, range]);
  const samplesInRange = useMemo(() => samples.filter(s => matchesRange(s.createdAt, range)), [samples, range]);
  const newRfqs = useMemo(
    () => rfqsInRange.filter(r => r.status === 'OPEN' && !(r.quotations?.length)),
    [rfqsInRange],
  );
  const quotesPending = useMemo(
    () => rfqsInRange.reduce((total, rfq) => total + (rfq.quotations || []).filter(
      quote => ['SUBMITTED', 'REVISED'].includes(String(quote.status)),
    ).length, 0),
    [rfqsInRange],
  );
  const activeOrders = useMemo(
    () => ordersInRange.filter(o => [
      'PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PRODUCTION', 'QC', 'QC_PENDING',
      'DISPATCHED', 'READY_TO_DISPATCH', 'SAMPLE_PENDING', 'SAMPLE_APPROVED',
      'PRODUCTION_STARTED',
    ].includes(String(o.status))),
    [ordersInRange],
  );
  const pendingSamples = useMemo(() => samplesInRange.filter(s => ['REQUESTED', 'IN_PROGRESS', 'REVISION_REQUIRED', 'DISPATCHED'].includes(String(s.status))).length, [samplesInRange]);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    const fields = [
      profile.name, profile.legalName, profile.taxId, profile.city, profile.address,
      profile.supplierProfile?.description, profile.supplierProfile?.yearsInBusiness,
      profile.supplierProfile?.productionCapacity, (profile.supplierProfile?.categories || []).length,
    ];
    return Math.round(fields.filter(v => v !== null && v !== undefined && String(v).trim() !== '').length / fields.length * 100);
  }, [profile]);

  const confirmLogout = () => {
    setProfileMenuOpen(false);
    Alert.alert('Logout', 'Are you sure you want to logout from STITCHGRID?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        try {
          await Promise.all([
            SecureStore.deleteItemAsync('sg_token'),
            SecureStore.deleteItemAsync('sg_user'),
            SecureStore.deleteItemAsync('sg_membership'),
          ]);
          router.replace('/' as any);
        } catch {
          Alert.alert('Logout failed', 'Please try again.');
        }
      } },
    ]);
  };

  const openAccountMenuItem = (item: 'profile' | 'account-settings') => {
    setProfileMenuOpen(false);
    router.push({ pathname: '/supplier/[section]', params: { section: item === 'profile' ? 'organization-settings' : 'account-settings' } } as any);
  };

  const navigate = (section: string) => {
    setMenuOpen(false);
    if (section === 'home') return;
    if (section === 'profile') {
      router.push({ pathname: '/supplier/[section]', params: { section: 'organization-settings' } } as any);
      return;
    }
    router.push({ pathname: '/supplier/[section]', params: { section } } as any);
  };

  const openQuote = (rfq: Rfq) => {
    setSelectedRfq(rfq);
    setQuoteAmount('');
    setLeadDays('21');
    setQuoteOpen(true);
  };

  const submitQuote = async () => {
    if (!selectedRfq || !orgId) return;
    const amount = Number(quoteAmount);
    const days = Number(leadDays);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(days) || days <= 0) {
      Alert.alert('Check quote details', 'Enter a valid total quote amount and lead time in days.');
      return;
    }
    const sourceItems = selectedRfq.items || [];
    const totalQuantity = sourceItems.length
      ? sourceItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity || selectedRfq.targetQuantity || 1)), 0)
      : Math.max(1, Number(selectedRfq.targetQuantity || 1));
    const items = sourceItems.length
      ? sourceItems.map(item => ({
          description: item.name || item.description || selectedRfq.title || 'Garment order',
          quantity: Math.max(1, Number(item.quantity || selectedRfq.targetQuantity || 1)),
          unitPrice: amount / totalQuantity,
          ...(item.id ? { rfqItemId: item.id } : {}),
        }))
      : [{
          description: selectedRfq.title || 'Garment order',
          quantity: totalQuantity,
          unitPrice: amount / totalQuantity,
        }];
    setQuoteBusy(true);
    try {
      await apiRequest('/quotations', {
        method: 'POST', body: {
          rfqId: selectedRfq.id, supplierOrgId: orgId, totalAmount: amount,
          currency: 'INR', leadTimeDays: days, items,
        }
      });
      setQuoteOpen(false);
      setSelectedRfq(null);
      Alert.alert('Quote submitted', 'Your quotation has been submitted successfully.');
      await loadDashboard(true);
    } catch (e) {
      Alert.alert('Unable to submit quote', e instanceof Error ? e.message : 'Please try again.');
    } finally { setQuoteBusy(false); }
  };

  const createCatalogItem = async () => {
    if (!orgId) return;
    if (catalogName.trim().length < 2 || catalogType.trim().length < 2) {
      Alert.alert('Required details', 'Enter a product name and category (item type).');
      return;
    }
    setCatalogBusy(true);
    try {
      const payload = {
        organizationId: orgId, name: catalogName.trim(), itemType: catalogType.trim(),
        ...(catalogMoq.trim() ? { moq: Number(catalogMoq) } : {}),
        ...(catalogPrice.trim() ? { unitPrice: Number(catalogPrice) } : {}),
      };
      if ((payload.moq !== undefined && (!Number.isInteger(payload.moq) || payload.moq <= 0)) ||
        (payload.unitPrice !== undefined && (!Number.isFinite(payload.unitPrice) || payload.unitPrice <= 0))) {
        throw new Error('MOQ and unit price must be positive numbers.');
      }
      await apiRequest('/catalog-items', { method: 'POST', body: payload });
      setCatalogName(''); setCatalogType(''); setCatalogMoq(''); setCatalogPrice('');
      Alert.alert('Catalogue updated', 'Your item has been submitted for moderation.');
      const rows = await apiGet<any[]>(`/catalog-items?organizationId=${encodeURIComponent(orgId)}`);
      setCatalogItems(Array.isArray(rows) ? rows : []);
      setCatalogOpen(false);
    } catch (e) {
      Alert.alert('Unable to update catalogue', e instanceof Error ? e.message : 'Please try again.');
    } finally { setCatalogBusy(false); }
  };

  const displayRfqs = rfqs.slice(0, 5);
  const menuItems = [
    { label: 'Home', icon: 'view-dashboard-outline', section: 'home' },
    { label: 'Buyer Requests', icon: 'file-document-currency-outline', section: 'requests' },
    { label: 'My Offers', icon: 'file-document-outline', section: 'offers' },
    { label: 'My Orders', icon: 'archive-outline', section: 'orders' },
    { label: 'Tracking', icon: 'factory', section: 'tracking' },
    { label: 'Samples', icon: 'hanger', section: 'samples' },
    { label: 'Chats', icon: 'message-text-outline', section: 'chat' },
    { label: 'Payments', icon: 'wallet-outline', section: 'payments' },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader
        role="SUPPLIER"
        activeSection="home"
        unreadCount={unreadCount}
        onProfilePress={() => setProfileMenuOpen(true)}
      />

      <Modal visible={profileMenuOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setProfileMenuOpen(false)}>
        <View style={styles.accountMenuRoot}>
          <Pressable style={styles.accountMenuBackdrop} onPress={() => setProfileMenuOpen(false)} />
          <View style={[styles.accountMenu, { top: Math.max(insets.top, 8) + 58 }]}>
            <Pressable style={styles.accountMenuItem} onPress={() => openAccountMenuItem('profile')}>
              <MaterialCommunityIcons name="account-outline" size={20} color="#667085" />
              <Text style={styles.accountMenuText}>My Profile</Text>
            </Pressable>
            <View style={styles.accountMenuDivider} />
            <Pressable style={styles.accountMenuItem} onPress={() => openAccountMenuItem('account-settings')}>
              <MaterialCommunityIcons name="cog-outline" size={20} color="#667085" />
              <Text style={styles.accountMenuText}>Account Settings</Text>
            </Pressable>
            <View style={styles.accountMenuDivider} />
            <Pressable style={styles.accountMenuItem} onPress={confirmLogout}>
              <MaterialCommunityIcons name="logout" size={20} color="#DC2626" />
              <Text style={[styles.accountMenuText, styles.accountMenuLogout]}>Logout</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadDashboard(true); }} tintColor={PURPLE} />}
      >
        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator size="large" color={PURPLE} /><Text style={styles.stateText}>Loading your supplier dashboard...</Text></View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={34} color="#8B929C" />
            <Text style={styles.stateTitle}>Couldn't load dashboard</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadDashboard()}><Text style={styles.retryText}>Try Again</Text></Pressable>
          </View>
        ) : (
          <>
            {loadWarnings.length > 0 && <View style={styles.warningCard}><MaterialCommunityIcons name="alert-circle-outline" size={22} color="#B7791F" /><View style={{ flex: 1 }}><Text style={styles.warningTitle}>Some dashboard data could not load</Text>{loadWarnings.map((warning, index) => <Text key={`${index}-${warning}`} style={styles.warningText}>{warning}</Text>)}</View></View>}
            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>SUPPLIER DASHBOARD</Text>
                <Text style={styles.heroTitle}>Your Factory,{'\n'}More Opportunities.</Text>
                <Text style={styles.heroSubtitle}>Get RFQs, send quotes, manage orders and samples in one place.</Text>
                <Pressable style={styles.catalogButton} onPress={() => setCatalogOpen(true)}>
                  <MaterialCommunityIcons name="plus" size={25} color="#FFFFFF" />
                  <Text style={styles.catalogButtonText}>Update Catalogue</Text>
                </Pressable>
              </View>
              <View style={styles.heroArt}><MaterialCommunityIcons name="factory" size={48} color="#FFFFFF" /></View>
            </View>

            <Pressable style={styles.profileCard} onPress={() => navigate('profile')}>
              <View style={styles.progressOuter}><View style={styles.progressInner}><Text style={styles.progressText}>{profileCompletion}%</Text></View></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.profileTitle}>Profile Completion</Text>
                <Text style={styles.profileSubtitle}>Complete your business profile to get more RFQs and orders.</Text>
                <View style={styles.profileLink}><Text style={styles.profileLinkText}>Complete Profile</Text><MaterialCommunityIcons name="arrow-right" size={23} color={PURPLE} /></View>
              </View>
            </Pressable>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Business Overview</Text>
              <Pressable style={styles.rangeButton} onPress={() => setRangeOpen(true)}><Text style={styles.rangeText}>{range}</Text><MaterialCommunityIcons name="chevron-down" size={20} color="#7B8490" /></Pressable>
            </View>
            <View style={styles.statsGrid}>
              <StatCard icon="file-document-outline" value={newRfqs.length} label="New RFQs" tone="purple" />
              <StatCard icon="tag-outline" value={quotesPending} label="Quotes Pending" tone="amber" />
              <StatCard icon="archive-outline" value={activeOrders.length} label="Active Orders" tone="green" />
              <StatCard icon="layers-outline" value={pendingSamples} label="Samples Pending" tone="blue" />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent RFQs</Text>
              <Pressable onPress={() => navigate('requests')} style={styles.viewAll}><Text style={styles.viewAllText}>View All RFQs</Text><MaterialCommunityIcons name="arrow-right" size={21} color={PURPLE} /></Pressable>
            </View>
            {displayRfqs.length === 0 ? (
              <View style={styles.emptyCard}><MaterialCommunityIcons name="inbox-outline" size={32} color="#A1A1AA" /><Text style={styles.emptyTitle}>No Buyer Requests Found</Text><Text style={styles.emptyText}>New RFQs shared with your supplier network will appear here.</Text></View>
            ) : displayRfqs.map(rfq => {
              const status = statusFor(rfq);
              const alreadyQuoted = (rfq.quotations?.length || 0) > 0;
              return (
                <View key={rfq.id} style={styles.rfqCard}>
                  <View style={styles.rfqTop}><Text style={styles.rfqCode}>{rfqCode(rfq.id)}</Text><View style={[styles.statusPill, { backgroundColor: status.bg }]}><Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text></View></View>
                  <Text style={styles.rfqTitle}>{rfq.title || rfq.garmentType || 'Garment Order'}</Text>
                  <Text style={styles.buyerText}>Buyer: <Text style={styles.buyerName}>{rfq.buyer?.name || 'Enterprise Buyer'}</Text></Text>
                  <View style={styles.rfqMeta}><Text style={styles.metaText}>Quantity: <Text style={styles.metaStrong}>{Number(rfq.targetQuantity || rfq.items?.[0]?.quantity || 0).toLocaleString('en-IN')} {rfq.items?.[0]?.unit || 'pcs'}</Text></Text><Text style={styles.metaText}>Delivery: <Text style={styles.metaStrong}>{dateLabel(rfq.targetDate)}</Text></Text></View>
                  <Pressable style={[styles.detailsButton, !alreadyQuoted && rfq.status === 'OPEN' && styles.sendQuoteButton]} onPress={() => { setSelectedRfq(rfq); alreadyQuoted || rfq.status !== 'OPEN' ? setQuoteOpen(false) : openQuote(rfq); }}>
                    <Text style={[styles.detailsButtonText, !alreadyQuoted && rfq.status === 'OPEN' && styles.sendQuoteText]}>{alreadyQuoted || rfq.status !== 'OPEN' ? 'View Details' : 'Send Quote'}</Text>
                  </Pressable>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 7) }]}>
        {[
          { label: 'Home', icon: 'home', section: 'home' },
          { label: 'Buyer Requests', icon: 'format-list-bulleted', section: 'requests' },
          { label: 'My Orders', icon: 'archive-outline', section: 'orders' },
          { label: 'Messages', icon: 'message-text-outline', section: 'chat' },
          { label: 'Profile', icon: 'account-outline', section: 'profile' },
        ].map((item, index) => (
          <Pressable key={item.label} style={[styles.tabItem, index === 0 && styles.tabActive]} onPress={() => navigate(item.section)}>
            <MaterialCommunityIcons name={item.icon as any} size={25} color={index === 0 ? PURPLE : '#75808D'} />
            <Text numberOfLines={1} style={[styles.tabLabel, index === 0 && styles.tabLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {menuOpen && (
        <View style={[styles.drawerLayer, { top: 78 + insets.top, bottom: 76 + insets.bottom }]}>
          <View style={styles.drawer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {menuItems.map((item, index) => (
                <Pressable key={item.label} style={[styles.drawerItem, index === 0 && styles.drawerItemActive]} onPress={() => navigate(item.section)}>
                  <MaterialCommunityIcons name={item.icon as any} size={23} color={index === 0 ? '#FFFFFF' : '#9AA1AA'} />
                  <Text style={[styles.drawerText, index === 0 && styles.drawerTextActive]}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Pressable style={styles.drawerBackdrop} onPress={() => setMenuOpen(false)} />
        </View>
      )}

      <Modal visible={!!selectedRfq && !quoteOpen} transparent animationType="slide" onRequestClose={() => setSelectedRfq(null)}>
        <View style={styles.modalBackdrop}><View style={styles.detailsSheet}>
          <View style={styles.modalHeader}><View style={{ flex: 1 }}><Text style={styles.modalTitle}>{selectedRfq?.title || selectedRfq?.garmentType || 'RFQ Details'}</Text><Text style={styles.modalSub}>Request ID: #{selectedRfq ? rfqCode(selectedRfq.id) : ''} · Created {dateLabel(selectedRfq?.createdAt)}</Text></View><Pressable onPress={() => setSelectedRfq(null)}><MaterialCommunityIcons name="close" size={26} color="#68727F" /></Pressable></View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.detailBanner}><Text style={styles.rfqCode}>#{selectedRfq ? rfqCode(selectedRfq.id) : ''}</Text><Text style={styles.statusText}>{statusFor(selectedRfq || { id: '' }).label}</Text><Text style={styles.detailCategory}>Category: {selectedRfq?.garmentType || 'Garment'}</Text></View>
            <View style={styles.detailGrid}>
              <View style={styles.detailBox}><Text style={styles.detailLabel}>TARGET QUANTITY</Text><Text style={styles.detailValue}>{Number(selectedRfq?.targetQuantity || 0).toLocaleString('en-IN')} pcs</Text></View>
              <View style={styles.detailBox}><Text style={styles.detailLabel}>TARGET DELIVERY</Text><Text style={styles.detailValue}>{dateLabel(selectedRfq?.targetDate)}</Text></View>
            </View>
            <View style={styles.detailBox}><Text style={styles.detailLabel}>TARGET UNIT PRICE</Text><Text style={styles.detailPrice}>{selectedRfq?.targetPrice ? money(selectedRfq.targetPrice) : 'Competitive bidding'}</Text></View>
            {!!(selectedRfq?.description || selectedRfq?.fabricSpec) && <><Text style={styles.detailHeading}>PRODUCTION SPECIFICATIONS & NOTES</Text><Text style={styles.description}>{[selectedRfq?.fabricSpec, selectedRfq?.description].filter(Boolean).join('\n\n')}</Text></>}
            <Text style={styles.detailHeading}>YOUR SUBMITTED QUOTATION</Text>
            {(selectedRfq?.quotations || []).length === 0 ? <Text style={styles.description}>You have not submitted a quotation for this request yet.</Text> : (selectedRfq?.quotations || []).map(q => <View key={q.id} style={styles.quoteRow}><View><Text style={styles.quoteName}>Your quotation</Text><Text style={styles.quoteMeta}>Lead time: {q.leadTimeDays || '—'} days</Text></View><View><Text style={styles.quoteAmount}>{money(q.totalAmount, q.currency || 'INR')}</Text><Text style={styles.quoteStatus}>{q.status || 'Submitted'}</Text></View></View>)}
          </ScrollView>
          <View style={styles.modalFooter}><Pressable style={styles.closeButton} onPress={() => setSelectedRfq(null)}><Text style={styles.closeText}>Close</Text></Pressable>{selectedRfq?.status === 'OPEN' && !(selectedRfq?.quotations?.length) && <Pressable style={styles.modalPrimary} onPress={() => { const row = selectedRfq; setSelectedRfq(null); openQuote(row); }}><Text style={styles.modalPrimaryText}>Send Quote</Text></Pressable>}</View>
        </View></View>
      </Modal>

      <Modal visible={quoteOpen} transparent animationType="slide" onRequestClose={() => { setQuoteOpen(false); setSelectedRfq(null); }}>
        <View style={styles.modalBackdrop}><View style={styles.formSheet}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Submit Quotation</Text><Pressable onPress={() => { setQuoteOpen(false); setSelectedRfq(null); }}><MaterialCommunityIcons name="close" size={26} color="#68727F" /></Pressable></View>
          <Text style={styles.formHint}>{selectedRfq?.title || 'RFQ'} · {Number(selectedRfq?.targetQuantity || 0).toLocaleString('en-IN')} pcs</Text>
          <Text style={styles.inputLabel}>TOTAL QUOTE AMOUNT (INR)</Text><TextInput value={quoteAmount} onChangeText={setQuoteAmount} keyboardType="decimal-pad" placeholder="e.g. 185000" placeholderTextColor="#9AA1AA" style={styles.input} />
          <Text style={styles.inputLabel}>LEAD TIME (DAYS)</Text><TextInput value={leadDays} onChangeText={setLeadDays} keyboardType="number-pad" placeholder="e.g. 21" placeholderTextColor="#9AA1AA" style={styles.input} />
          <Pressable disabled={quoteBusy} style={[styles.modalPrimary, { minHeight: 52, opacity: quoteBusy ? .65 : 1 }]} onPress={() => void submitQuote()}>{quoteBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>Submit Quote</Text>}</Pressable>
        </View></View>
      </Modal>

      <Modal visible={catalogOpen} transparent animationType="slide" onRequestClose={() => setCatalogOpen(false)}>
        <View style={styles.modalBackdrop}><View style={styles.formSheet}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Update Catalogue</Text><Pressable onPress={() => setCatalogOpen(false)}><MaterialCommunityIcons name="close" size={26} color="#68727F" /></Pressable></View>
          <Text style={styles.formHint}>{catalogItems.length} catalogue item(s) currently listed</Text>
          <Text style={styles.inputLabel}>PRODUCT / ITEM NAME</Text><TextInput value={catalogName} onChangeText={setCatalogName} placeholder="e.g. Cotton T-Shirt" placeholderTextColor="#9AA1AA" style={styles.input} />
          <Text style={styles.inputLabel}>CATEGORY / ITEM TYPE</Text><TextInput value={catalogType} onChangeText={setCatalogType} placeholder="e.g. T-Shirts" placeholderTextColor="#9AA1AA" style={styles.input} />
          <Text style={styles.inputLabel}>MINIMUM ORDER QUANTITY (OPTIONAL)</Text><TextInput value={catalogMoq} onChangeText={setCatalogMoq} keyboardType="number-pad" placeholder="e.g. 500" placeholderTextColor="#9AA1AA" style={styles.input} />
          <Text style={styles.inputLabel}>UNIT PRICE IN INR (OPTIONAL)</Text><TextInput value={catalogPrice} onChangeText={setCatalogPrice} keyboardType="decimal-pad" placeholder="e.g. 185" placeholderTextColor="#9AA1AA" style={styles.input} />
          <Pressable disabled={catalogBusy} style={[styles.modalPrimary, { minHeight: 52, opacity: catalogBusy ? .65 : 1 }]} onPress={() => void createCatalogItem()}>{catalogBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalPrimaryText}>Add Catalogue Item</Text>}</Pressable>
        </View></View>
      </Modal>

      <Modal visible={rangeOpen} transparent animationType="fade" onRequestClose={() => setRangeOpen(false)}>
        <Pressable style={styles.rangeBackdrop} onPress={() => setRangeOpen(false)}><View style={styles.rangeSheet}><Text style={styles.modalTitle}>Business Overview</Text>{['This Month', 'This Week', 'All Time'].map(option => <Pressable key={option} style={styles.rangeOption} onPress={() => { setRange(option); setRangeOpen(false); }}><Text style={styles.rangeOptionText}>{option}</Text>{range === option && <MaterialCommunityIcons name="check" size={20} color={PURPLE} />}</Pressable>)}</View></Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: { minHeight: 62, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECEEF2', paddingHorizontal: 14, paddingBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5, zIndex: 3 },
  menuButton: { width: 28, alignItems: 'flex-start', justifyContent: 'center' },
  logo: { height: 36, flexShrink: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F0FC', alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', right: -2, top: -4, minWidth: 21, height: 21, borderRadius: 11, backgroundColor: '#D62828', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1, borderColor: '#FFFFFF' },
  notificationBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  content: { paddingHorizontal: 15, paddingTop: 17, paddingBottom: 22, gap: 17 },
  hero: { minHeight: 275, borderRadius: 27, paddingHorizontal: 21, paddingVertical: 24, backgroundColor: '#F0E7FF', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  heroCopy: { flex: 1, maxWidth: '76%', zIndex: 1 },
  eyebrow: { color: '#5B13EC', fontSize: 12, fontWeight: '900', letterSpacing: 2.2, marginBottom: 13 },
  heroTitle: { color: '#0D1020', fontSize: 22, lineHeight: 29, fontWeight: '900', letterSpacing: -.8 },
  heroSubtitle: { color: '#626B79', fontSize: 14, lineHeight: 21, marginTop: 11 },
  heroArt: { position: 'absolute', right: 17, top: '39%', width: 100, height: 100, borderRadius: 29, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '6deg' }], elevation: 7 },
  catalogButton: { alignSelf: 'flex-start', minHeight: 51, paddingHorizontal: 17, borderRadius: 14, backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 19, elevation: 2 },
  catalogButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  profileCard: { minHeight: 148, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5F2', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 15, elevation: 1 },
  progressOuter: { width: 91, height: 91, borderRadius: 46, borderWidth: 8, borderColor: '#E9DFFF', borderTopColor: PURPLE, borderRightColor: PURPLE, borderBottomColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  progressInner: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  progressText: { color: '#111827', fontSize: 22, fontWeight: '900' },
  profileTitle: { color: '#111827', fontSize: 16, fontWeight: '900' },
  profileSubtitle: { color: '#7B8490', fontSize: 12, lineHeight: 19, marginTop: 5 },
  profileLink: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  profileLinkText: { color: PURPLE, fontSize: 14, fontWeight: '900' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  sectionTitle: { color: '#17202D', fontSize: 18, fontWeight: '900' },
  rangeButton: { minHeight: 43, paddingHorizontal: 13, borderRadius: 15, borderWidth: 1, borderColor: '#E0E3E9', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 5 },
  rangeText: { color: '#515B67', fontSize: 13, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48.5%', minHeight: 108, borderRadius: 20, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stat_purple: { backgroundColor: '#F8F5FE', borderColor: '#EFE6FF' },
  stat_amber: { backgroundColor: '#FFFCF0', borderColor: '#F8EDC7' },
  stat_green: { backgroundColor: '#F0FBF4', borderColor: '#D8F2E2' },
  stat_blue: { backgroundColor: '#F1F7FF', borderColor: '#DDEBFA' },
  statIcon_purple: { backgroundColor: '#F0E5FF' },
  statIcon_amber: { backgroundColor: '#FFF1C8' },
  statIcon_green: { backgroundColor: '#DDF8E9' },
  statIcon_blue: { backgroundColor: '#E0EEFF' },
  statIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: '#111827', fontSize: 25, fontWeight: '900' },
  statLabel: { color: '#596273', fontSize: 12, lineHeight: 17, marginTop: 2 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  viewAllText: { color: PURPLE, fontSize: 13, fontWeight: '900' },
  rfqCard: { backgroundColor: '#FFFFFF', borderRadius: 21, borderWidth: 1, borderColor: '#E4E7EC', padding: 16, gap: 11 },
  rfqTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rfqCode: { color: PURPLE, fontSize: 13, fontWeight: '900' },
  statusPill: { borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6 },
  statusText: { fontSize: 12, fontWeight: '800' },
  rfqTitle: { color: '#17202D', fontSize: 17, fontWeight: '900' },
  buyerText: { color: '#7B8490', fontSize: 13 },
  buyerName: { color: '#222B38', fontWeight: '900' },
  rfqMeta: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EFF0F3', paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  metaText: { color: '#68727F', fontSize: 11, flexShrink: 1 },
  metaStrong: { color: '#202633', fontWeight: '900' },
  detailsButton: { minHeight: 47, borderRadius: 14, borderWidth: 1, borderColor: '#E1E3E8', alignItems: 'center', justifyContent: 'center' },
  detailsButtonText: { color: '#4B5563', fontSize: 14, fontWeight: '900' },
  sendQuoteButton: { backgroundColor: PURPLE, borderColor: PURPLE },
  sendQuoteText: { color: '#FFFFFF' },
  secondaryDetails: { alignItems: 'center', paddingVertical: 4 },
  secondaryDetailsText: { color: PURPLE, fontSize: 13, fontWeight: '800' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', padding: 25, alignItems: 'center', gap: 9 },
  emptyTitle: { color: '#202633', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#7B8490', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  stateCard: { minHeight: 230, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  stateTitle: { color: '#202633', fontSize: 17, fontWeight: '900' },
  stateText: { color: '#7B8490', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  warningCard: { backgroundColor: '#FFF8E8', borderWidth: 1, borderColor: '#F4D9A3', borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  warningTitle: { color: '#8A5A12', fontSize: 13, fontWeight: '900', marginBottom: 5 },
  warningText: { color: '#8A5A12', fontSize: 12, lineHeight: 18, marginTop: 2 },
  retryButton: { backgroundColor: '#F0E9FF', borderRadius: 12, paddingHorizontal: 19, paddingVertical: 11 },
  retryText: { color: PURPLE, fontSize: 13, fontWeight: '900' },
  bottomNav: { minHeight: 75, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E6E8ED', paddingTop: 6, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  tabItem: { flex: 1, minHeight: 61, borderRadius: 17, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 2 },
  tabActive: { backgroundColor: '#F1EBFB', marginHorizontal: 3 },
  tabLabel: { color: '#687687', fontSize: 10, fontWeight: '600' },
  tabLabelActive: { color: PURPLE, fontWeight: '900' },
  drawerLayer: { position: 'absolute', left: 0, right: 0, zIndex: 10, flexDirection: 'row' },
  drawer: { width: '66%', maxWidth: 320, backgroundColor: '#FFFFFF', paddingTop: 18, paddingHorizontal: 14, elevation: 14 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(13,10,22,.38)' },
  drawerItem: { minHeight: 52, borderRadius: 13, marginBottom: 4, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  drawerItemActive: { backgroundColor: PURPLE },
  drawerText: { color: '#4B515B', fontSize: 15, fontWeight: '600' },
  drawerTextActive: { color: '#FFFFFF', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(13,10,22,.52)', justifyContent: 'flex-end' },
  detailsSheet: { maxHeight: '92%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 25, gap: 13 },
  formSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { flex: 1, color: '#17202D', fontSize: 21, fontWeight: '900' },
  modalSub: { color: '#68727F', fontSize: 13, lineHeight: 20, marginTop: 4 },
  detailBanner: { backgroundColor: '#F8F4FF', borderWidth: 1, borderColor: '#E9DDFB', borderRadius: 16, padding: 14, gap: 7 },
  detailCategory: { color: '#4B5563', fontSize: 14, fontWeight: '700' },
  detailGrid: { flexDirection: 'row', gap: 10 },
  detailBox: { flex: 1, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 15, padding: 13, marginTop: 3 },
  detailLabel: { color: '#7B8490', fontSize: 11, fontWeight: '900', letterSpacing: .6 },
  detailValue: { color: '#17202D', fontSize: 16, fontWeight: '900', marginTop: 5 },
  detailPrice: { color: PURPLE, fontSize: 17, fontWeight: '900', marginTop: 5 },
  detailHeading: { color: '#7B8490', fontSize: 12, fontWeight: '900', letterSpacing: .5, marginTop: 7 },
  description: { color: '#4B5563', fontSize: 14, lineHeight: 21, backgroundColor: '#F8F9FB', borderRadius: 13, padding: 13 },
  quoteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 14, padding: 13 },
  quoteName: { color: '#202633', fontSize: 14, fontWeight: '900' },
  quoteMeta: { color: '#68727F', fontSize: 12, marginTop: 5 },
  quoteAmount: { color: PURPLE, fontSize: 15, fontWeight: '900', textAlign: 'right' },
  quoteStatus: { color: '#16804A', fontSize: 11, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  modalFooter: { flexDirection: 'row', gap: 10, paddingTop: 10, borderTopWidth: 1, borderColor: '#ECEEF2' },
  closeButton: { flex: 1, minHeight: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  closeText: { color: '#596273', fontSize: 14, fontWeight: '800' },
  modalPrimary: { flex: 1, minHeight: 50, borderRadius: 13, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  modalPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  formHint: { color: '#68727F', fontSize: 13, lineHeight: 20 },
  inputLabel: { color: '#596273', fontSize: 11, fontWeight: '900', letterSpacing: .5, marginTop: 5 },
  input: { minHeight: 51, borderWidth: 1, borderColor: '#E1E4EA', borderRadius: 13, paddingHorizontal: 14, fontSize: 15, color: '#202633', backgroundColor: '#FFFFFF' },
  accountMenuRoot: { flex: 1 },
  accountMenuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.08)' },
  accountMenu: { position: 'absolute', right: 16, width: 238, backgroundColor: '#FFFFFF', borderRadius: 15, paddingVertical: 5, paddingHorizontal: 7, elevation: 12, shadowColor: '#111827', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, borderWidth: 1, borderColor: '#EEF0F4' },
  accountMenuItem: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 10 },
  accountMenuText: { color: '#303846', fontSize: 13, fontWeight: '600' },
  accountMenuLogout: { color: '#DC2626' },
  accountMenuDivider: { height: 1, backgroundColor: '#F0F1F4', marginHorizontal: 8 },
  rangeBackdrop: { flex: 1, backgroundColor: 'rgba(13,10,22,.38)', justifyContent: 'center', padding: 25 },
  rangeSheet: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, gap: 8 },
  rangeOption: { minHeight: 49, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F0F1F3' },
  rangeOptionText: { color: '#3F4854', fontSize: 15, fontWeight: '700' },
});
