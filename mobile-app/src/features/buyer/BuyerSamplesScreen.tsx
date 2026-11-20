import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Linking, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { apiGet, apiPatch, apiPost, API_BASE_URL } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = '#5314E8';
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';
const SAMPLE_TYPES = ['Final Sample', 'First Sample', 'Color Sample', 'Size Set', 'Lab Dip'];
const BUYER_TABS = ['All', 'New Samples', 'Checking', 'Approved', 'Changes Needed'];
const SUPPLIER_TABS = ['All', 'To Make', 'Sent', 'Waiting for Buyer', 'Approved'];

type Attachment = { url: string; label?: string; filename?: string; size?: number; mimeType?: string };
type SampleHistory = { action?: string; status?: string; note?: string; createdAt?: string; actorRole?: string };
type Sample = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  purchaseOrderId: string;
  notes?: string | null;
  description?: string;
  sampleType?: string;
  sampleName?: string;
  quantity?: string;
  photos?: Attachment[];
  files?: Attachment[];
  buyerFeedback?: string | null;
  supplierNote?: string | null;
  history?: SampleHistory[];
  parsedMeta?: Record<string, any>;
  purchaseOrder?: {
    poNumber?: string;
    expectedDate?: string | null;
    buyer?: { id?: string; name?: string };
    supplier?: { id?: string; name?: string; city?: string };
    items?: { id: string; name: string; quantity: number }[];
  };
};
type Order = {
  id: string;
  poNumber: string;
  status: string;
  supplier?: { name?: string };
  buyer?: { name?: string };
  items?: { name: string; quantity: number }[];
  expectedDate?: string | null;
};
type Membership = { organizationId?: string; role?: string; organization?: { id?: string; name?: string } };
type NotificationItem = { id: string; title: string; body: string; readAt?: string | null; createdAt: string };

const dateLabel = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const absoluteUrl = (url?: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${API_BASE_URL.replace(/\/api\/?$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
};
const statusLabel = (status: string, supplier: boolean) => {
  if (status === 'APPROVED') return 'Approved';
  if (status === 'REVISION_REQUIRED' || status === 'REJECTED') return supplier ? 'To Make' : 'Changes Needed';
  if (status === 'IN_PROGRESS') return supplier ? 'Sent' : 'Checking';
  if (status === 'DISPATCHED') return supplier ? 'Waiting for Buyer' : 'Checking';
  return supplier ? 'To Make' : 'New Sample';
};
const statusColors = (status: string) => {
  if (status === 'APPROVED') return { bg: '#E8F8F0', text: '#087653', border: '#BDEBD2' };
  if (status === 'REVISION_REQUIRED' || status === 'REJECTED') return { bg: '#FDECEC', text: '#B42318', border: '#F2C6C2' };
  if (status === 'IN_PROGRESS') return { bg: '#EAF2FF', text: '#2457A6', border: '#C9D9F0' };
  if (status === 'DISPATCHED') return { bg: '#F0E9FF', text: PURPLE, border: '#D8C3F7' };
  return { bg: '#FFF8E7', text: '#8B5A00', border: '#F1E1A5' };
};

export default function BuyerSamplesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sampleTypeFilter, setSampleTypeFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [draftStatus, setDraftStatus] = useState('All');
  const [draftType, setDraftType] = useState('All');
  const [draftSort, setDraftSort] = useState<'newest' | 'oldest'>('newest');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);
  const [selected, setSelected] = useState<Sample | null>(null);
  const [detailsTab, setDetailsTab] = useState<'Sample Photos' | 'Details' | 'Supplier Note' | 'Buyer Note' | 'Files' | 'History'>('Sample Photos');
  const [localPhotos, setLocalPhotos] = useState<Attachment[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [requestType, setRequestType] = useState('Final Sample');
  const [requestName, setRequestName] = useState('');
  const [requestQuantity, setRequestQuantity] = useState('5 pcs');
  const [requestNotes, setRequestNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supplierNoteDraft, setSupplierNoteDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const isSupplier = membership?.role === 'SUPPLIER';
  const unreadCount = notifications.filter(item => !item.readAt).length;

  const loadData = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [sampleData, orderData, notificationData] = await Promise.all([
        apiGet<Sample[]>('/samples'),
        apiGet<Order[]>('/purchase-orders'),
        apiGet<NotificationItem[]>('/notifications'),
      ]);
      setSamples(Array.isArray(sampleData) ? sampleData : []);
      setOrders(Array.isArray(orderData) ? orderData : []);
      setNotifications(Array.isArray(notificationData) ? notificationData : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load samples.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setInterval(() => { if (active) void loadData(true); }, 25000);
    SecureStore.getItemAsync('sg_membership').then(raw => {
      if (active && raw) setMembership(JSON.parse(raw) as Membership);
    }).catch(() => { }).finally(() => {
      if (active) void loadData();
    });
    return () => { active = false; clearInterval(timer); };
  }, [loadData]);

  const visibleSamples = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...samples]
      .filter(sample => {
        const po = sample.purchaseOrder?.poNumber || sample.purchaseOrderId;
        const partner = isSupplier ? sample.purchaseOrder?.buyer?.name : sample.purchaseOrder?.supplier?.name;
        const name = sample.sampleName || sample.purchaseOrder?.items?.[0]?.name || 'Apparel Sample';
        const matchesSearch = !query || [name, partner || '', po, sample.sampleType || '', sample.quantity || '', sample.parsedMeta?.specifications?.fabric || ''].some(value => String(value).toLowerCase().includes(query));
        if (!matchesSearch) return false;
        if (sampleTypeFilter !== 'All' && !(sample.sampleType || '').toLowerCase().includes(sampleTypeFilter.toLowerCase())) return false;
        if (statusFilter !== 'All') {
          const label = statusLabel(sample.status, !!isSupplier);
          if (label !== statusFilter) return false;
        }
        return true;
      })
      .sort((a, b) => sortBy === 'newest'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [samples, search, sampleTypeFilter, statusFilter, sortBy, isSupplier]);

  const openDetails = (sample: Sample) => {
    setSelected(sample);
    setDetailsTab(isSupplier ? 'Sample Photos' : 'Details');
    setLocalPhotos([...(sample.photos || [])]);
    setActivePhotoIndex(0);
    setFeedback('');
    setFeedbackOpen(false);
    setSupplierNoteDraft(sample.supplierNote || '');
  };

  const performSampleAction = async (sample: Sample, status: string, extra: Record<string, unknown> = {}) => {
    try {
      setSubmitting(true);
      await apiPatch(`/samples/${sample.id}`, { status, ...extra });
      await loadData(true);
      const refreshed = await apiGet<Sample[]>('/samples');
      const updated = refreshed.find(item => item.id === sample.id);
      setSamples(refreshed);
      if (updated) setSelected(updated);
      else setSelected(null);
      setFeedbackOpen(false);
      setFeedback('');
      Alert.alert('Updated', status === 'APPROVED' ? 'Sample approved successfully.' : status === 'REVISION_REQUIRED' ? 'Revision request sent to supplier.' : 'Sample status updated.');
    } catch (e) {
      Alert.alert('Unable to update sample', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveSupplierNote = async () => {
    if (!selected) return;
    try {
      setSubmitting(true);
      await apiPatch(`/samples/${selected.id}`, { supplierNote: supplierNoteDraft.trim() });
      await loadData(true);
      const refreshed = await apiGet<Sample[]>('/samples');
      setSamples(refreshed);
      setSelected(refreshed.find(item => item.id === selected.id) || null);
      Alert.alert('Note saved', 'Your supplier note has been saved for the buyer.');
    } catch (e) {
      Alert.alert('Unable to save note', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRequest = async () => {
    if (!selectedOrderId) {
      Alert.alert('Purchase order required', 'Select a purchase order for this sample request.');
      return;
    }
    if (!requestName.trim() || !requestQuantity.trim()) {
      Alert.alert('Missing details', 'Enter sample name and quantity.');
      return;
    }
    try {
      setSubmitting(true);
      await apiPost(`/orders/${selectedOrderId}/samples`, {
        sampleType: requestType,
        sampleName: requestName.trim(),
        quantity: requestQuantity.trim(),
        notes: requestNotes.trim(),
      });
      setRequestOpen(false);
      setRequestName('');
      setRequestQuantity('5 pcs');
      setRequestNotes('');
      await loadData(true);
      Alert.alert('Request sent', 'Your supplier has been notified about the sample request.');
    } catch (e) {
      Alert.alert('Request failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadSamplePhoto = async () => {
    if (!selected) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Allow photo library access to upload sample photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        base64: true,
        quality: 0.75,
        selectionLimit: Math.max(1, 10 - localPhotos.length),
      });
      if (result.canceled) return;
      setUploading(true);
      const uploaded: Attachment[] = [];
      for (const [index, asset] of result.assets.entries()) {
        if (!asset.base64) continue;
        const mime = asset.mimeType || 'image/jpeg';
        const filename = asset.fileName || `sample-photo-${Date.now()}-${index}.jpg`;
        const upload = await apiPost<Attachment & { url: string }>('/upload', {
          filename,
          data: `data:${mime};base64,${asset.base64}`,
          label: ['Front View', 'Back View', 'Fabric Texture', 'Stitching Detail', 'Close-up', 'Label'][index % 6],
        });
        uploaded.push({ ...upload, url: absoluteUrl(upload.url) });
      }
      setLocalPhotos(current => [...current, ...uploaded].slice(0, 10));
      if (uploaded.length) setActivePhotoIndex(Math.min(9, localPhotos.length + uploaded.length - 1));
      Alert.alert('Photos added', `${uploaded.length} photo(s) added. Select Save as Draft or Submit to Buyer to save them to this sample.`);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unable to upload photos.');
    } finally {
      setUploading(false);
    }
  };

  const saveSampleDraft = async () => {
    if (!selected) return;
    try {
      setSubmitting(true);
      await apiPatch(`/samples/${selected.id}`, { photos: localPhotos });
      const refreshed = await apiGet<Sample[]>('/samples');
      setSamples(refreshed);
      setSelected(refreshed.find(item => item.id === selected.id) || null);
      Alert.alert('Draft saved', 'Sample photos have been saved. They are not yet submitted to the buyer.');
    } catch (e) {
      Alert.alert('Unable to save draft', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitSampleToBuyer = async () => {
    if (!selected) return;
    if (!localPhotos.length) {
      Alert.alert('Sample photos required', 'Upload at least one sample photo before submitting to the buyer.');
      return;
    }
    await performSampleAction(selected, 'DISPATCHED', {
      photos: localPhotos,
      supplierNote: 'Sample photos submitted to buyer for review.',
    });
  };

  const markNotificationRead = async (item: NotificationItem) => {
    try {
      if (!item.readAt) {
        await apiPatch(`/notifications/${item.id}/read`, {});
        setNotifications(current => current.map(n => n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n));
      }
      setNotificationsOpen(false);
    } catch (e) {
      Alert.alert('Notification error', e instanceof Error ? e.message : 'Unable to open notification.');
    }
  };

  const navigate = (section: string) => {
    setDrawerOpen(false);
    if (section === 'home') router.replace(`/workspace?role=${isSupplier ? 'SUPPLIER' : 'BUYER'}` as any);
    else if (isSupplier) router.replace({ pathname: '/supplier/[section]', params: { section } } as any);
    else router.replace({ pathname: '/buyer/[section]', params: { section } } as any);
  };

  const partnerName = (sample: Sample) => isSupplier
    ? sample.purchaseOrder?.buyer?.name || 'Buyer'
    : sample.purchaseOrder?.supplier?.name || 'Supplier';
  const productName = (sample: Sample) => sample.sampleName || sample.purchaseOrder?.items?.[0]?.name || 'Apparel Sample';
  const orderNumber = (sample: Sample) => (sample.purchaseOrder?.poNumber || sample.purchaseOrderId || '—').replace(/^SG-/, '');

  const header = (
    <AppHeader
      role={isSupplier ? 'SUPPLIER' : 'BUYER'}
      activeSection="samples"
      unreadCount={unreadCount}
      onNotificationPress={() => setNotificationsOpen(true)}
      onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
    />
  );

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} tintColor={PURPLE} />}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.pageTitle}>Samples</Text>
          <Text style={styles.subtitle}>{isSupplier
            ? 'Review prototype specifications, inspect buyer feedback, and dispatch physical samples.'
            : 'Check product samples and approve them before making bulk order.'}</Text>
        </View>

        {!isSupplier && (
          <Pressable style={styles.primaryButton} onPress={() => {
            const buyerOrders = orders.filter(order => order.status !== 'CANCELLED');
            if (!buyerOrders.length) {
              Alert.alert('No purchase orders', 'Samples must be linked to an active purchase order.');
              return;
            }
            setSelectedOrderId(buyerOrders[0].id);
            setRequestName(buyerOrders[0].items?.[0]?.name || 'Apparel Sample');
            setRequestOpen(true);
          }}>
            <MaterialCommunityIcons name="plus" size={21} color="#fff" />
            <Text style={styles.primaryButtonText}>Request Sample</Text>
          </Pressable>
        )}

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={24} color="#929BA6" />
            <TextInput value={search} onChangeText={setSearch} placeholder={isSupplier ? 'Search by sample, buyer or order...' : 'Search by sample name, supplier or order...'} placeholderTextColor="#9AA1AA" style={styles.searchInput} />
            {search.length > 0 && <Pressable onPress={() => setSearch('')}><MaterialCommunityIcons name="close-circle" size={20} color="#9AA1AA" /></Pressable>}
          </View>
          <Pressable style={styles.filterButton} onPress={() => {
            setDraftStatus(statusFilter); setDraftType(sampleTypeFilter); setDraftSort(sortBy); setFilterOpen(true);
          }}>
            <MaterialCommunityIcons name="tune-variant" size={21} color={PURPLE} />
          </Pressable>
        </View>

        <View style={styles.dropdownRow}>
          <Pressable style={styles.dropdown} onPress={() => { setDraftType(sampleTypeFilter); setFilterOpen(true); }}>
            <Text numberOfLines={1} style={styles.dropdownText}>Sample Type ({sampleTypeFilter})</Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color="#8C98A7" />
          </Pressable>
          <Pressable style={styles.dropdown} onPress={() => { setDraftSort(sortBy); setFilterOpen(true); }}>
            <MaterialCommunityIcons name="sort" size={20} color="#8793A2" />
            <Text style={styles.dropdownText}>{sortBy === 'newest' ? 'Newest First' : 'Oldest First'}</Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color="#8C98A7" />
          </Pressable>
        </View>

        <View style={styles.statusTabs}>
          {(isSupplier ? SUPPLIER_TABS : BUYER_TABS).map(tab => (
            <Pressable key={tab} onPress={() => setStatusFilter(tab)} style={[styles.statusTab, statusFilter === tab && styles.statusTabActive]}>
              <Text style={[styles.statusTabText, statusFilter === tab && styles.statusTabTextActive]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator color={PURPLE} size="large" /><Text style={styles.stateText}>Loading samples...</Text></View>
        ) : error ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={26} color="#8B929C" />
            <Text style={styles.stateTitle}>Couldn't load samples</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void loadData()}><Text style={styles.retryText}>Try Again</Text></Pressable>
          </View>
        ) : visibleSamples.length === 0 ? (
          <View style={styles.stateCard}>
            <MaterialCommunityIcons name="hanger" size={34} color="#A0A6B0" />
            <Text style={styles.stateTitle}>No samples found</Text>
            <Text style={styles.stateText}>{search || statusFilter !== 'All' || sampleTypeFilter !== 'All' ? 'Try changing your search or filters.' : isSupplier ? 'Sample requests from buyers will appear here.' : 'Request a sample from one of your active purchase orders.'}</Text>
            {(search || statusFilter !== 'All' || sampleTypeFilter !== 'All') && <Pressable style={styles.retryButton} onPress={() => { setSearch(''); setStatusFilter('All'); setSampleTypeFilter('All'); }}><Text style={styles.retryText}>Clear Filters</Text></Pressable>}
          </View>
        ) : visibleSamples.map(sample => {
          const colors = statusColors(sample.status);
          return (
            <View key={sample.id} style={styles.sampleCard}>
              <View style={styles.sampleCardHeading}>
                <View style={styles.sampleIcon}><MaterialCommunityIcons name="hanger" size={21} color={PURPLE} /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={styles.sampleTitle}>{productName(sample)} - {isSupplier ? 'Buyer Request' : 'Supplier Quote'}</Text>
                  <View style={styles.metaLine}><MaterialCommunityIcons name="domain" size={20} color="#8B9AAE" /><Text style={styles.metaText}>{isSupplier ? 'Buyer' : 'Supplier'}: <Text style={styles.strong}>{partnerName(sample)}</Text></Text></View>
                </View>
              </View>
              <View style={styles.sampleInfoGrid}>
                <View style={styles.sampleInfoCell}><MaterialCommunityIcons name="receipt-text-outline" size={22} color="#8B9AAE" /><Text style={styles.sampleInfoText}>Order ID: <Text style={styles.strong}>{orderNumber(sample)}</Text></Text></View>
                <View style={styles.sampleInfoCell}><MaterialCommunityIcons name="archive-outline" size={22} color="#8B9AAE" /><Text style={styles.sampleInfoText}>Quantity: <Text style={styles.strong}>{sample.quantity || '5 pcs'}</Text></Text></View>
                <View style={styles.sampleInfoCell}><MaterialCommunityIcons name="tag-outline" size={22} color="#8B9AAE" /><Text style={styles.sampleInfoText}>Sample Type: <Text style={styles.strong}>{sample.sampleType || 'Final Sample'}</Text></Text></View>
                <View style={styles.sampleInfoCell}><MaterialCommunityIcons name="calendar-month-outline" size={22} color="#8B9AAE" /><Text style={styles.sampleInfoText}>Due Date: <Text style={styles.strong}>{dateLabel(sample.parsedMeta?.dueDate || sample.purchaseOrder?.expectedDate)}</Text></Text></View>
              </View>
              <View style={styles.cardFooter}>
                <View style={[styles.statusBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}><Text style={[styles.statusBadgeText, { color: colors.text }]}>{statusLabel(sample.status, !!isSupplier)}</Text></View>
              </View>
              <View style={styles.actionRow}>
                <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => openDetails(sample)}><Text style={styles.secondaryButtonText}>View Details</Text></Pressable>
                {!isSupplier && sample.status !== 'APPROVED' && (
                  <Pressable style={[styles.approveButton, { flex: 1 }]} onPress={() => performSampleAction(sample, 'APPROVED', { feedback: 'Sample approved by buyer.' })} disabled={submitting}>
                    <Text style={styles.approveButtonText}>Approve</Text>
                  </Pressable>
                )}
                {isSupplier && (sample.status === 'REQUESTED' || sample.status === 'IN_PROGRESS' || sample.status === 'REVISION_REQUIRED') && (
                  <Pressable style={[styles.approveButton, { flex: 1 }]} onPress={() => {
                    if (!(sample.photos || []).length) {
                      openDetails(sample);
                      setDetailsTab('Sample Photos');
                      Alert.alert('Sample photos required', 'Upload at least one sample photo, save the draft, then mark it ready for the buyer.');
                      return;
                    }
                    void performSampleAction(sample, 'DISPATCHED', { supplierNote: 'Sample marked as ready and submitted to buyer.' });
                  }} disabled={submitting}>
                    <Text style={styles.approveButtonText}>Mark Ready</Text>
                  </Pressable>
                )}
              </View>
              {!isSupplier && sample.status !== 'APPROVED' && (
                <Pressable style={styles.changesButton} onPress={() => { openDetails(sample); setFeedbackOpen(true); }}>
                  <Text style={styles.secondaryButtonText}>Ask for Changes</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <View style={{ height: 10 }} />
      </ScrollView>

      <View onLayout={event => setBottomHeight(event.nativeEvent.layout.height)} style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 7) }]}>
        {[
          { label: 'Dashboard', icon: 'view-dashboard', section: 'home' },
          { label: 'Requests', icon: 'file-document-outline', section: 'requests' },
          { label: 'Orders', icon: 'archive-outline', section: 'orders' },
          { label: 'Chat', icon: 'message-text-outline', section: 'chat' },
          { label: 'Settings', icon: 'cog-outline', section: 'organization-settings' },
        ].map(item => <Pressable key={item.label} onPress={() => navigate(item.section)} style={styles.navItem}><MaterialCommunityIcons name={item.icon as any} size={21} color="#687687" /><Text style={styles.navLabel}>{item.label}</Text></Pressable>)}
      </View>



      <Modal visible={filterOpen} transparent animationType="fade" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => { }}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Filter Samples</Text><Pressable onPress={() => setFilterOpen(false)}><MaterialCommunityIcons name="close" size={24} color="#68727F" /></Pressable></View>
            <Text style={styles.sectionLabel}>FILTER BY STATUS</Text>
            <View style={styles.chipWrap}>
              {(isSupplier ? SUPPLIER_TABS : BUYER_TABS).map(tab => <Pressable key={tab} onPress={() => setDraftStatus(tab)} style={[styles.choiceChip, draftStatus === tab && styles.choiceChipActive]}><Text style={[styles.choiceText, draftStatus === tab && styles.choiceTextActive]}>{tab}</Text></Pressable>)}
            </View>
            <Text style={styles.sectionLabel}>SAMPLE TYPE</Text>
            <View style={styles.chipWrap}>
              {['All', ...SAMPLE_TYPES].map(type => <Pressable key={type} onPress={() => setDraftType(type)} style={[styles.choiceChip, draftType === type && styles.choiceChipActive]}><Text style={[styles.choiceText, draftType === type && styles.choiceTextActive]}>{type}</Text></Pressable>)}
            </View>
            <Text style={styles.sectionLabel}>SORT BY</Text>
            <View style={styles.chipWrap}>
              {[{ label: 'Newest First', value: 'newest' }, { label: 'Oldest First', value: 'oldest' }].map(item => <Pressable key={item.value} onPress={() => setDraftSort(item.value as 'newest' | 'oldest')} style={[styles.choiceChip, draftSort === item.value && styles.choiceChipActive]}><Text style={[styles.choiceText, draftSort === item.value && styles.choiceTextActive]}>{item.label}</Text></Pressable>)}
            </View>
            <View style={styles.sheetActions}>
              <Pressable style={styles.secondaryButton} onPress={() => { setDraftStatus('All'); setDraftType('All'); setDraftSort('newest'); }}><Text style={styles.secondaryButtonText}>Reset</Text></Pressable>
              <Pressable style={styles.approveButton} onPress={() => { setStatusFilter(draftStatus); setSampleTypeFilter(draftType); setSortBy(draftSort); setFilterOpen(false); }}><Text style={styles.approveButtonText}>Apply Filters</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={notificationsOpen} transparent animationType="fade" onRequestClose={() => setNotificationsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setNotificationsOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => { }}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Notifications</Text><Pressable onPress={() => setNotificationsOpen(false)}><MaterialCommunityIcons name="close" size={24} color="#68727F" /></Pressable></View>
            <ScrollView style={styles.notificationList} showsVerticalScrollIndicator={false}>
              {notifications.length === 0 ? <Text style={styles.emptyText}>No notifications yet.</Text> : notifications.map(item => (
                <Pressable key={item.id} onPress={() => markNotificationRead(item)} style={[styles.notificationItem, !item.readAt && styles.notificationUnread]}>
                  <MaterialCommunityIcons name="bell-outline" size={20} color={PURPLE} />
                  <View style={{ flex: 1 }}><Text style={styles.notificationTitle}>{item.title}</Text><Text style={styles.notificationBody}>{item.body}</Text><Text style={styles.notificationDate}>{dateLabel(item.createdAt)}</Text></View>
                  {!item.readAt && <View style={styles.unreadDot} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={requestOpen} transparent animationType="slide" onRequestClose={() => setRequestOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.formSheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Request Physical Sample</Text><Pressable onPress={() => setRequestOpen(false)}><MaterialCommunityIcons name="close" size={24} color="#68727F" /></Pressable></View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.formLabel}>PURCHASE ORDER *</Text>
              <Pressable style={styles.formSelect} onPress={() => setOrderPickerOpen(value => !value)}>
                <Text style={styles.formSelectText}>{orders.find(order => order.id === selectedOrderId)?.poNumber || 'Select purchase order'}</Text><MaterialCommunityIcons name="chevron-down" size={22} color="#7B8491" />
              </Pressable>
              {orderPickerOpen && <View style={styles.orderOptions}>{orders.filter(order => order.status !== 'CANCELLED').map(order => <Pressable key={order.id} style={styles.orderOption} onPress={() => { setSelectedOrderId(order.id); setRequestName(order.items?.[0]?.name || 'Apparel Sample'); setOrderPickerOpen(false); }}><Text style={styles.orderOptionTitle}>{order.poNumber}</Text><Text style={styles.orderOptionSub}>{order.supplier?.name || 'Supplier'} • {order.items?.[0]?.name || 'Garment'}</Text></Pressable>)}</View>}
              <Text style={styles.formLabel}>SAMPLE NAME / GARMENT ITEM *</Text>
              <TextInput value={requestName} onChangeText={setRequestName} placeholder="e.g. Heavyweight Hoodie" style={styles.formInput} />
              <Text style={styles.formLabel}>SAMPLE TYPE *</Text>
              <View style={styles.chipWrap}>{SAMPLE_TYPES.map(type => <Pressable key={type} onPress={() => setRequestType(type)} style={[styles.choiceChip, requestType === type && styles.choiceChipActive]}><Text style={[styles.choiceText, requestType === type && styles.choiceTextActive]}>{type}</Text></Pressable>)}</View>
              <Text style={styles.formLabel}>QUANTITY REQUIRED *</Text>
              <TextInput value={requestQuantity} onChangeText={setRequestQuantity} placeholder="e.g. 5 pcs, 3 sets" style={styles.formInput} />
              <Text style={styles.formLabel}>INSPECTION NOTES & SPECIFICATIONS</Text>
              <TextInput value={requestNotes} onChangeText={setRequestNotes} placeholder="Fabric, GSM, colour, measurements, stitching and finishing requirements..." multiline numberOfLines={4} textAlignVertical="top" style={[styles.formInput, styles.notesInput]} />
              <Pressable style={[styles.primaryButton, submitting && { opacity: 0.6 }]} onPress={submitRequest} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="send" size={20} color="#fff" />}
                <Text style={styles.primaryButtonText}>{submitting ? 'Sending...' : 'Send Sample Request'}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailsSheet, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={styles.sheetHeader}><Pressable style={styles.detailBackButton} onPress={() => setSelected(null)}><MaterialCommunityIcons name="arrow-left" size={24} color="#273244" /><Text style={styles.sheetTitle}>Sample Details</Text></Pressable><View style={[styles.statusBadge, { backgroundColor: selected ? statusColors(selected.status).bg : '#FFF8E7', borderColor: selected ? statusColors(selected.status).border : '#F1E1A5' }]}><Text style={[styles.statusBadgeText, { color: selected ? statusColors(selected.status).text : '#8B5A00' }]}>{selected ? statusLabel(selected.status, !!isSupplier) : ''}</Text></View></View>
            {selected && <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.photoHero}>
                {localPhotos[activePhotoIndex]?.url ? <Image source={{ uri: absoluteUrl(localPhotos[activePhotoIndex].url) }} style={styles.heroImage} resizeMode="cover" /> : <View style={styles.photoPlaceholder}><MaterialCommunityIcons name="hanger" size={34} color="#A8B1BE" /><Text style={styles.photoPlaceholderTitle}>Sample View (0/0)</Text><Text style={styles.photoPlaceholderText}>Photos pending from supplier</Text></View>}
                {localPhotos.length > 1 && <><Pressable style={styles.photoPrev} onPress={() => setActivePhotoIndex(index => (index - 1 + localPhotos.length) % localPhotos.length)}><MaterialCommunityIcons name="chevron-left" size={28} color="#fff" /></Pressable><Pressable style={styles.photoNext} onPress={() => setActivePhotoIndex(index => (index + 1) % localPhotos.length)}><MaterialCommunityIcons name="chevron-right" size={28} color="#fff" /></Pressable></>}
                {localPhotos.length > 0 && <View style={styles.photoCounter}><Text style={styles.photoCounterText}>{localPhotos[activePhotoIndex]?.label || 'Sample View'} ({activePhotoIndex + 1}/{localPhotos.length})</Text></View>}
              </View>
              <View style={styles.detailTitleRow}>
                <Text style={styles.detailProductTitle}>{productName(selected)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColors(selected.status).bg, borderColor: statusColors(selected.status).border }]}><Text style={[styles.statusBadgeText, { color: statusColors(selected.status).text }]}>{statusLabel(selected.status, !!isSupplier)}</Text></View>
              </View>
              <View style={styles.detailMeta}>
                <Text style={styles.detailMetaText}>Supplier: <Text style={styles.strong}>{selected.purchaseOrder?.supplier?.name || '—'}</Text></Text>
                <Text style={styles.detailMetaText}>Buyer: <Text style={styles.strong}>{selected.purchaseOrder?.buyer?.name || '—'}</Text></Text>
                <Text style={styles.detailMetaText}>Order ID: <Text style={styles.strong}>{orderNumber(selected)}</Text></Text>
                <Text style={styles.detailMetaText}>Sample Type: <Text style={styles.strong}>{selected.sampleType || 'Final Sample'}</Text></Text>
                <Text style={styles.detailMetaText}>Quantity: <Text style={styles.strong}>{selected.quantity || '5 pcs'}</Text></Text>
                <Text style={styles.detailMetaText}>Due Date: <Text style={styles.strong}>{dateLabel(selected.parsedMeta?.dueDate || selected.purchaseOrder?.expectedDate)}</Text></Text>
                <Text style={styles.detailMetaText}>Sent on: <Text style={styles.strong}>{dateLabel(selected.createdAt)}</Text></Text>
              </View>
              <View style={styles.detailTabs}>
                {(['Sample Photos', 'Details', isSupplier ? 'Buyer Note' : 'Supplier Note', 'Files', 'History'] as const).map(tab => <Pressable key={tab} onPress={() => setDetailsTab(tab)} style={[styles.detailTab, detailsTab === tab && styles.detailTabActive]}><Text style={[styles.detailTabText, detailsTab === tab && styles.detailTabTextActive]}>{tab}</Text></Pressable>)}
              </View>
              {detailsTab === 'Sample Photos' && (
                <View style={styles.tabPanel}>
                  {isSupplier ? <>
                    <Text style={styles.sectionLabel}>UPLOAD SAMPLE PHOTOS</Text>
                    <Text style={styles.uploadHelp}>Add clear photos of the sample (front, back, fabric, close-up, etc.). JPG or PNG, up to 10 photos.</Text>
                    <Pressable style={styles.uploadDropzone} onPress={uploadSamplePhoto} disabled={uploading || localPhotos.length >= 10}>
                      {uploading ? <ActivityIndicator color={PURPLE} size="large" /> : <MaterialCommunityIcons name="cloud-upload-outline" size={38} color={PURPLE} />}
                      <Text style={styles.uploadTitle}>{uploading ? 'Uploading photos...' : 'Choose Photos'}</Text>
                      <Text style={styles.uploadHelp}>Select images from your device</Text>
                    </Pressable>
                    {localPhotos.length ? <View style={styles.photoGrid}>{localPhotos.map((photo, index) => <Pressable key={photo.url + index} onPress={() => setActivePhotoIndex(index)}><Image source={{ uri: absoluteUrl(photo.url) }} style={[styles.photoThumb, activePhotoIndex === index && styles.photoThumbActive]} /></Pressable>)}</View> : <Text style={styles.emptyUpload}>No photos uploaded yet. Select files above to preview front, back, fabric and close-up angles.</Text>}
                    <View style={styles.samplePhotoActions}>
                      <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={saveSampleDraft} disabled={submitting || uploading}><Text style={styles.secondaryButtonText}>{submitting ? 'Saving...' : 'Save as Draft'}</Text></Pressable>
                      <Pressable style={[styles.approveButton, { flex: 1 }]} onPress={submitSampleToBuyer} disabled={submitting || uploading}><Text style={styles.approveButtonText}>{submitting ? 'Submitting...' : 'Submit to Buyer'}</Text></Pressable>
                    </View>
                  </> : <>
                    <Text style={styles.sectionLabel}>SAMPLE PHOTOS</Text>
                    {localPhotos.length ? <View style={styles.photoGrid}>{localPhotos.map((photo, index) => <Pressable key={photo.url + index} onPress={() => setActivePhotoIndex(index)}><Image source={{ uri: absoluteUrl(photo.url) }} style={[styles.photoThumb, activePhotoIndex === index && styles.photoThumbActive]} /></Pressable>)}</View> : <Text style={styles.emptyUpload}>The supplier has not uploaded sample photos yet.</Text>}
                  </>}
                </View>
              )}
              {detailsTab === 'Details' && (
                <View style={styles.tabPanel}>
                  <Text style={styles.sectionLabel}>SAMPLE INFORMATION</Text>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Product</Text><Text style={styles.strong}>{productName(selected)}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Fabric</Text><Text style={styles.strong}>{selected.parsedMeta?.specifications?.fabric || 'Not provided'}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Color</Text><Text style={styles.strong}>{selected.parsedMeta?.specifications?.color || 'Not provided'}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Sizes</Text><Text style={styles.strong}>{selected.parsedMeta?.specifications?.sizes || 'Not provided'}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Finish</Text><Text style={styles.strong}>{selected.parsedMeta?.specifications?.finish || 'Not provided'}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Quantity</Text><Text style={styles.strong}>{selected.quantity || '5 pcs'}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Order ID</Text><Text style={styles.strong}>{selected.purchaseOrder?.poNumber || orderNumber(selected)}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Sample Type</Text><Text style={styles.strong}>{selected.sampleType || 'Final Sample'}</Text></View>
                  <View style={styles.detailInfoRow}><Text style={styles.muted}>Due Date</Text><Text style={styles.strong}>{dateLabel(selected.parsedMeta?.dueDate || selected.purchaseOrder?.expectedDate)}</Text></View>
                </View>
              )}
              {detailsTab === (isSupplier ? 'Buyer Note' : 'Supplier Note') && (
                <View style={styles.tabPanel}>
                  <Text style={styles.sectionLabel}>{isSupplier ? 'BUYER REQUEST NOTES' : 'SUPPLIER / FACTORY NOTES'}</Text>
                  <Text style={styles.notePanel}>{isSupplier
                    ? (selected.description || selected.notes || 'No buyer specifications were provided.')
                    : (selected.supplierNote || 'The supplier has not added a note yet.')}</Text>
                  {!!selected.buyerFeedback && <View style={styles.feedbackPanel}><Text style={styles.feedbackHeading}>BUYER CHANGES REQUESTED</Text><Text style={styles.feedbackText}>{selected.buyerFeedback}</Text></View>}
                  {isSupplier && (
                    <View style={{ gap: 9, marginTop: 14 }}>
                      <Text style={styles.formLabel}>YOUR NOTE TO THE BUYER</Text>
                      <TextInput value={supplierNoteDraft} onChangeText={setSupplierNoteDraft} placeholder="Add production progress, fabric observations or sample details..." multiline textAlignVertical="top" style={[styles.formInput, styles.notesInput]} />
                      <Pressable style={styles.approveButton} onPress={saveSupplierNote} disabled={submitting}><Text style={styles.approveButtonText}>{submitting ? 'Saving...' : 'Save Supplier Note'}</Text></Pressable>
                    </View>
                  )}
                </View>
              )}
              {detailsTab === 'Files' && (
                <View style={styles.tabPanel}>
                  {[...(selected.files || []), ...(selected.photos || [])].length === 0 ? <Text style={styles.emptyText}>No sample files or photos have been uploaded yet.</Text> : [...(selected.files || []), ...(selected.photos || [])].map((file, index) => <Pressable key={file.url + index} style={styles.fileRow} onPress={() => Linking.openURL(absoluteUrl(file.url))}><MaterialCommunityIcons name="file-document-outline" size={24} color={PURPLE} /><View style={{ flex: 1 }}><Text style={styles.fileName}>{file.filename || file.label || 'Sample attachment'}</Text><Text style={styles.fileSize}>{file.size ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : 'Attachment'}</Text></View><MaterialCommunityIcons name="download" size={22} color="#68727F" /></Pressable>)}
                </View>
              )}
              {detailsTab === 'History' && (
                <View style={styles.tabPanel}>
                  {(selected.history || []).length === 0 ? <Text style={styles.emptyText}>No sample history has been recorded yet.</Text> : [...(selected.history || [])].reverse().map((entry, index) => <View key={String(entry.createdAt) + index} style={styles.historyRow}><View style={styles.historyMarker}><MaterialCommunityIcons name="check" size={14} color="#fff" /></View><View style={{ flex: 1 }}><Text style={styles.historyTitle}>{entry.action || entry.status || 'Sample updated'}</Text>{!!entry.note && <Text style={styles.historyNote}>{entry.note}</Text>}<Text style={styles.historyDate}>{dateLabel(entry.createdAt)} {entry.actorRole ? `• ${entry.actorRole}` : ''}</Text></View></View>)}
                </View>
              )}
              {!isSupplier && selected.status !== 'APPROVED' && (
                <View style={styles.supplierActions}>
                  {feedbackOpen && <View style={{ width: '100%', gap: 8 }}><Text style={styles.formLabel}>SPECIFY REQUIRED CHANGES</Text><TextInput value={feedback} onChangeText={setFeedback} placeholder="Describe the changes required from the supplier..." multiline textAlignVertical="top" style={[styles.formInput, styles.notesInput]} /></View>}
                  <Pressable style={[styles.approveButton, { flex: 1 }]} onPress={() => performSampleAction(selected, 'APPROVED', { feedback: 'Sample approved by buyer.' })} disabled={submitting}><Text style={styles.approveButtonText}>{submitting ? 'Saving...' : 'Approve'}</Text></Pressable>
                  <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => {
                    if (!feedbackOpen) { setFeedbackOpen(true); return; }
                    if (!feedback.trim()) { Alert.alert('Feedback required', 'Please describe the changes required.'); return; }
                    void performSampleAction(selected, 'REVISION_REQUIRED', { feedback: feedback.trim() });
                  }} disabled={submitting}><Text style={styles.secondaryButtonText}>{feedbackOpen ? 'Send Changes' : 'Ask for Changes'}</Text></Pressable>
                </View>
              )}
            </ScrollView>}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: { minHeight: 58, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E9EAF0', paddingHorizontal: 14, paddingBottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerIcon: { width: 40, height: 42, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 142, height: 34, flex: 1, marginHorizontal: 5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F0FC', alignItems: 'center', justifyContent: 'center' },
  unreadBadge: { position: 'absolute', right: -2, top: -3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: '#D62828', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fff' },
  unreadBadgeText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  content: { padding: 16, paddingBottom: 24, gap: 16 },
  pageHeading: { gap: 5 },
  pageTitle: { fontSize: 22, fontWeight: '900', color: '#17202D', lineHeight: 37 },
  subtitle: { fontSize: 14, color: '#68727F', lineHeight: 22 },
  primaryButton: { height: 62, backgroundColor: PURPLE, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12 },
  primaryButtonText: { fontSize: 16, fontWeight: '900', color: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchBox: { flex: 1, minHeight: 54, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E4EA', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: '#26313F', paddingVertical: 10 },
  filterButton: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E4EA', alignItems: 'center', justifyContent: 'center' },
  dropdownRow: { flexDirection: 'row', gap: 10 },
  dropdown: { flex: 1, minHeight: 54, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E0E4EA', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  dropdownText: { flex: 1, fontSize: 13, color: '#4C5867', fontWeight: '600' },
  statusTabs: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  statusTab: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EEF0F5' },
  statusTabActive: { backgroundColor: PURPLE },
  statusTabText: { fontSize: 11, fontWeight: '700', color: '#68727F' },
  statusTabTextActive: { color: '#fff' },
  sampleCard: { backgroundColor: '#fff', borderRadius: 23, borderWidth: 1, borderColor: '#E6E8EE', padding: 18, gap: 13, elevation: 1 },
  sampleTitle: { fontSize: 19, fontWeight: '900', color: '#17202D', lineHeight: 25 },
  sampleCardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sampleIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F2EAFE', alignItems: 'center', justifyContent: 'center' },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sampleInfoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 5 },
  sampleInfoCell: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  sampleInfoText: { flex: 1, fontSize: 13, color: '#596675', lineHeight: 19 },
  metaText: { fontSize: 15, color: '#596675', flex: 1 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 8, paddingTop: 4 },
  infoText: { fontSize: 13, color: '#283342' },
  muted: { color: '#98A2AF' },
  strong: { fontWeight: '800', color: '#202A37' },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 22, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  statusBadgeText: { fontSize: 13, fontWeight: '800' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  secondaryButton: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: '#DDE1E7', backgroundColor: '#fff', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  secondaryButtonText: { fontSize: 14, fontWeight: '800', color: '#354151' },
  approveButton: { minHeight: 48, borderRadius: 15, backgroundColor: PURPLE, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  approveButtonText: { fontSize: 14, fontWeight: '900', color: '#fff' },
  changesButton: { alignSelf: 'flex-start', minHeight: 47, borderRadius: 15, borderWidth: 1, borderColor: '#DDE1E7', paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  stateCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', padding: 24, alignItems: 'center', gap: 10, marginTop: 8 },
  stateTitle: { fontSize: 16, fontWeight: '900', color: '#202633', textAlign: 'center' },
  stateText: { fontSize: 13, color: '#737B87', textAlign: 'center', lineHeight: 19 },
  retryButton: { backgroundColor: '#F0E9FF', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 11, marginTop: 3 },
  retryText: { fontSize: 13, fontWeight: '800', color: PURPLE },
  bottomNav: { minHeight: 75, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E6E8ED', paddingTop: 7, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { minWidth: 57, minHeight: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 4, gap: 2 },
  navItemActive: { backgroundColor: '#F1EBFB' },
  navLabel: { fontSize: 10, color: '#687687', fontWeight: '600' },
  navLabelActive: { color: PURPLE, fontWeight: '900' },
  drawerLayer: { position: 'absolute', left: 0, right: 0, zIndex: 30, flexDirection: 'row', backgroundColor: 'rgba(13,10,22,.38)' },
  drawer: { width: '68%', maxWidth: 320, backgroundColor: '#fff', paddingTop: 20, paddingHorizontal: 14, elevation: 14 },
  drawerBackdrop: { flex: 1 },
  drawerItem: { minHeight: 59, borderRadius: 12, marginBottom: 3, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  drawerItemActive: { backgroundColor: PURPLE },
  drawerText: { fontSize: 15, fontWeight: '600', color: '#4B515B' },
  drawerTextActive: { color: '#fff', fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(13,18,30,.48)', justifyContent: 'center', padding: 14 },
  sheet: { maxHeight: '90%', backgroundColor: '#fff', borderRadius: 24, padding: 18 },
  formSheet: { maxHeight: '92%', backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, marginTop: 'auto' },
  detailsSheet: { height: '94%', backgroundColor: '#fff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 18, marginTop: 'auto' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  detailBackButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { fontSize: 20, fontWeight: '900', color: '#17202D' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: '#778291', marginTop: 13, marginBottom: 9 },
  notificationList: { maxHeight: 300 },
  notificationItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 13, marginBottom: 7, backgroundColor: '#F8F9FC' },
  notificationUnread: { backgroundColor: '#F1EBFB', borderWidth: 1, borderColor: '#E3D7FB' },
  notificationTitle: { fontSize: 13, fontWeight: '900', color: '#202A37' },
  notificationBody: { fontSize: 12, color: '#667281', lineHeight: 18, marginTop: 3 },
  notificationDate: { fontSize: 10, color: '#8993A0', marginTop: 5 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PURPLE, marginTop: 5 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { borderRadius: 20, borderWidth: 1, borderColor: '#E1E4EA', paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#fff' },
  choiceChipActive: { backgroundColor: '#F0E9FF', borderColor: '#CDB9F6' },
  choiceText: { fontSize: 12, fontWeight: '700', color: '#596575' },
  choiceTextActive: { color: PURPLE },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  formLabel: { fontSize: 11, fontWeight: '900', letterSpacing: .8, color: '#596575', marginTop: 12, marginBottom: 7 },
  formSelect: { height: 48, borderWidth: 1, borderColor: '#E0E4EA', borderRadius: 13, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formSelectText: { fontSize: 14, color: '#344052', fontWeight: '700' },
  orderOptions: { borderWidth: 1, borderColor: '#E0E4EA', borderRadius: 13, marginTop: 6, overflow: 'hidden' },
  orderOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  orderOptionTitle: { fontSize: 13, fontWeight: '900', color: '#253142' },
  orderOptionSub: { fontSize: 11, color: '#738091', marginTop: 3 },
  formInput: { minHeight: 47, borderWidth: 1, borderColor: '#E0E4EA', borderRadius: 13, paddingHorizontal: 13, fontSize: 14, color: '#26313F', backgroundColor: '#fff' },
  notesInput: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  photoHero: { height: 210, borderRadius: 19, overflow: 'hidden', backgroundColor: '#111827', marginBottom: 17 },
  heroImage: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7 },
  photoPlaceholderTitle: { fontSize: 16, fontWeight: '900', color: '#F4F5F7' },
  photoPlaceholderText: { fontSize: 13, color: '#A9B2C0' },
  detailTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  detailProductTitle: { flex: 1, fontSize: 23, fontWeight: '900', color: '#17202D', lineHeight: 29 },
  detailMeta: { gap: 13, marginTop: 18, marginBottom: 19 },
  detailMetaText: { fontSize: 14, color: '#657181' },
  detailTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, borderBottomWidth: 1, borderBottomColor: '#EEF0F3', paddingBottom: 12 },
  detailTab: { borderRadius: 22, backgroundColor: '#F0F2F6', paddingHorizontal: 13, paddingVertical: 10 },
  detailTabActive: { backgroundColor: PURPLE },
  detailTabText: { fontSize: 12, fontWeight: '800', color: '#596575' },
  detailTabTextActive: { color: '#fff' },
  tabPanel: { paddingTop: 12, paddingBottom: 16 },
  detailInfoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  photoThumb: { width: 94, height: 94, borderRadius: 12, backgroundColor: '#EEF0F3' },
  photoThumbActive: { borderWidth: 3, borderColor: PURPLE },
  photoPrev: { position: 'absolute', left: 8, top: '45%', width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,.5)', alignItems: 'center', justifyContent: 'center' },
  photoNext: { position: 'absolute', right: 8, top: '45%', width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,.5)', alignItems: 'center', justifyContent: 'center' },
  photoCounter: { position: 'absolute', left: 12, right: 12, bottom: 10, borderRadius: 10, backgroundColor: 'rgba(0,0,0,.62)', paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  photoCounterText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  uploadHelp: { fontSize: 13, color: '#68727F', lineHeight: 20, marginBottom: 12 },
  uploadDropzone: { minHeight: 190, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#DCCDF8', borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 18, gap: 9, backgroundColor: '#FCFBFF' },
  uploadTitle: { fontSize: 15, fontWeight: '900', color: '#273244' },
  emptyUpload: { marginTop: 14, padding: 16, borderRadius: 14, backgroundColor: '#F7F8FA', color: '#68727F', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  samplePhotoActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  notePanel: { padding: 14, borderRadius: 13, backgroundColor: '#F7F8FA', fontSize: 13, color: '#4B5665', lineHeight: 20 },
  feedbackPanel: { padding: 14, borderRadius: 13, backgroundColor: '#FFF3F2', marginTop: 12 },
  feedbackHeading: { fontSize: 11, fontWeight: '900', color: '#A82B25', marginBottom: 6 },
  feedbackText: { fontSize: 13, color: '#7C2924', lineHeight: 19 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13, borderWidth: 1, borderColor: '#E7E9EF', borderRadius: 13, marginBottom: 8 },
  fileName: { fontSize: 13, fontWeight: '800', color: '#273244' },
  fileSize: { fontSize: 11, color: '#7D8794', marginTop: 4 },
  emptyText: { fontSize: 13, color: '#7B8491', paddingVertical: 16 },
  historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  historyMarker: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#16A36A', alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontSize: 13, fontWeight: '900', color: '#273244' },
  historyNote: { fontSize: 12, color: '#68727F', marginTop: 3, lineHeight: 18 },
  historyDate: { fontSize: 11, color: '#8B95A1', marginTop: 5 },
  supplierActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 16, marginBottom: 16 },
});
