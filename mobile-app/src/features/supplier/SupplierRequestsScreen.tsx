import { ui } from '@/theme/ui';
import { SourcingTabs } from '@/components/SourcingTabs';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Alert, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';
type Tab = 'ALL' | 'NEW' | 'VIEWED' | 'QUOTE_SENT';
type Rfq = {
  id: string; title?: string; description?: string; garmentType?: string; fabricSpec?: string;
  targetQuantity?: number; targetDate?: string; targetPrice?: number; status?: string;
  buyer?: { id?: string; name?: string; city?: string; country?: string };
  items?: { id?: string; name?: string; description?: string; quantity?: number; unit?: string }[];
  quotations?: Quote[];
};
type Quote = {
  id: string; supplierOrgId: string; totalAmount: number; currency?: string; leadTimeDays?: number;
  sampleCost?: number; terms?: string; status?: string;
  items?: { description?: string; quantity?: number; unitPrice?: number }[];
};
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const date = (v?: string) => v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not specified';
const code = (id: string) => `RFQ #RFQ-${String(id || '').slice(-4).toUpperCase()}`;
const statusColor = (s: string) => s === 'Quote Sent'
  ? { bg: '#FFF3D6', fg: '#946200' }
  : s === 'Viewed' ? { bg: '#EAF4FF', fg: '#2464A5' }
  : { bg: '#F2EAFF', fg: PURPLE };

export default function SupplierRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [membership, setMembership] = useState<any>(null);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [category, setCategory] = useState('ALL');
  const [location, setLocation] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [viewed, setViewed] = useState<string[]>([]);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [detailTab, setDetailTab] = useState<'REQUIREMENTS' | 'BUYER_INFO'>('REQUIREMENTS');
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState('180');
  const [delivery, setDelivery] = useState('21');
  const [sampleCost, setSampleCost] = useState('0');
  const [terms, setTerms] = useState('50% Advance, 50% on QC Pass');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const orgId = membership?.organizationId || membership?.organization?.id || '';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const m = JSON.parse(raw);
      if (m.role !== 'SUPPLIER' || !(m.organizationId || m.organization?.id)) throw new Error('Active supplier membership not found. Please sign in again.');
      setMembership(m);
      const rows = await apiGet<Rfq[]>(`/rfqs?organizationId=${encodeURIComponent(m.organizationId || m.organization.id)}`);
      setRfqs(Array.isArray(rows) ? rows : []);
      const seen = await SecureStore.getItemAsync('sg_supplier_viewed_rfqs');
      setViewed(seen ? JSON.parse(seen) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load buyer requests.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const getQuote = useCallback((rfq: Rfq) =>
    (rfq.quotations || []).find(q => q.supplierOrgId === orgId) || null, [orgId]);
  const getStatus = useCallback((rfq: Rfq) => getQuote(rfq) ? 'Quote Sent' : viewed.includes(rfq.id) ? 'Viewed' : 'New', [getQuote, viewed]);
  const garment = (r: Rfq) => r.garmentType || r.items?.[0]?.name || 'Apparel';
  const fabric = (r: Rfq) => r.fabricSpec || r.items?.[0]?.description || 'Not specified';
  const city = (r: Rfq) => [r.buyer?.city, r.buyer?.country === 'IN' || !r.buyer?.country ? 'UP' : r.buyer?.country].filter(Boolean).join(', ') || 'Not specified';

  const counts = useMemo(() => ({
    ALL: rfqs.length,
    NEW: rfqs.filter(r => getStatus(r) === 'New').length,
    VIEWED: rfqs.filter(r => getStatus(r) === 'Viewed').length,
    QUOTE_SENT: rfqs.filter(r => getStatus(r) === 'Quote Sent').length,
  }), [rfqs, getStatus]);

  const categories = useMemo(() => Array.from(new Set(rfqs.map(garment).filter(Boolean))), [rfqs]);
  const locations = useMemo(() => Array.from(new Set(rfqs.map(city).filter(Boolean))), [rfqs]);
  const visible = useMemo(() => rfqs.filter(r => {
    const s = getStatus(r);
    if (tab !== 'ALL' && s !== (tab === 'QUOTE_SENT' ? 'Quote Sent' : tab === 'NEW' ? 'New' : 'Viewed')) return false;
    const q = search.trim().toLowerCase();
    if (q && ![code(r.id), r.id, r.title, garment(r), fabric(r), city(r), r.buyer?.name].some(v => String(v || '').toLowerCase().includes(q))) return false;
    if (category !== 'ALL' && garment(r) !== category) return false;
    if (location !== 'ALL' && city(r) !== location) return false;
    if (filterStatus !== 'ALL' && s !== filterStatus) return false;
    return true;
  }), [rfqs, tab, search, category, location, filterStatus, getStatus]);

  const openDetails = async (rfq: Rfq) => {
    setSelected(rfq); setDetailTab('REQUIREMENTS'); setEditing(false);
    const next = Array.from(new Set([...viewed, rfq.id]));
    setViewed(next);
    await SecureStore.setItemAsync('sg_supplier_viewed_rfqs', JSON.stringify(next));
  };
  const openQuoteForm = (rfq: Rfq) => {
    const existing = getQuote(rfq);
    setSelected(rfq); setDetailTab('REQUIREMENTS'); setEditing(true);
    const qty = Math.max(1, Number(rfq.targetQuantity || rfq.items?.[0]?.quantity || 1));
    setPrice(String(existing?.items?.[0]?.unitPrice ?? rfq.targetPrice ?? 180));
    setDelivery(String(existing?.leadTimeDays || 21));
    setSampleCost(String(existing?.sampleCost || 0));
    setTerms(existing?.terms || '50% Advance, 50% on QC Pass');
    setNote('');
  };

  const submitQuote = async () => {
    if (!selected || !orgId) return;
    const unitPrice = Number(price), days = Number(delivery), sample = Number(sampleCost);
    const qty = Math.max(1, Number(selected.targetQuantity || selected.items?.[0]?.quantity || 1));
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isInteger(days) || days <= 0 || !Number.isFinite(sample) || sample < 0) {
      Alert.alert('Invalid quote', 'Please enter a valid price, delivery time and sample cost.'); return;
    }
    setSaving(true);
    try {
      const existing = getQuote(selected);
      const payload = {
        rfqId: selected.id, supplierOrgId: orgId, totalAmount: unitPrice * qty,
        currency: 'INR', leadTimeDays: days, sampleCost: sample, sampleLeadDays: 7,
        moq: qty, terms: note.trim() ? `${terms}\n${note.trim()}` : terms,
        items: [{ description: `${selected.title || 'Garment Lot'} - Supplier Quote`, quantity: qty, unitPrice }],
      };
      if (existing) {
        await apiRequest(`/quotations/${encodeURIComponent(existing.id)}`, { method: 'PUT', body: payload });
      } else {
        await apiRequest('/quotations', { method: 'POST', body: payload });
      }
      Alert.alert('Success', existing ? 'Your revised quotation has been submitted to the buyer.' : 'Your quotation has been submitted to the buyer.');
      setSelected(null); setEditing(false); await load(true);
    } catch (e) {
      Alert.alert('Unable to submit quote', e instanceof Error ? e.message : 'Please try again.');
    } finally { setSaving(false); }
  };

  const tabItems: { key: Tab; label: string }[] = [
    { key: 'ALL', label: 'All Requests' }, { key: 'NEW', label: 'New' },
    { key: 'VIEWED', label: 'Viewed' }, { key: 'QUOTE_SENT', label: 'Quote Sent' },
  ];

  return (
    <View style={styles.screen}>
      <AppHeader
        role="SUPPLIER"
        activeSection="requests"
      />
      <FlatList
        data={loading || error ? [] : visible}
        keyExtractor={rfq => rfq.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={PURPLE} />}
        ListHeaderComponent={<>
        <View style={styles.titleRow}><Text style={styles.title}>Buyer Requests</Text><Text style={styles.newPill}>{counts.NEW} New</Text></View>
        <Text style={styles.subtitle}>View buyer requirements and send your price quote.</Text>
        <SourcingTabs role="SUPPLIER" active="requests" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {tabItems.map(item => <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label} ({counts[item.key]})</Text>
          </Pressable>)}
        </ScrollView>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}><MaterialCommunityIcons name="magnify" size={22} color="#94A0AE" /><TextInput value={search} onChangeText={setSearch} placeholder="Search by RFQ ID or product..." placeholderTextColor={ui.muted} style={styles.searchInput} /></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Filter buyer requests" accessibilityState={{ expanded: filterOpen }} style={[styles.filterButton, filterOpen && styles.filterButtonActive]} onPress={() => setFilterOpen(v => !v)}><MaterialCommunityIcons name="tune" size={25} color={filterOpen ? '#FFFFFF' : '#536170'} /></Pressable>
        </View>
        {filterOpen && <View style={styles.filterPanel}>
          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{['ALL', ...categories].map(v => <Pressable key={v} onPress={() => setCategory(v)} style={[styles.chip, category === v && styles.chipActive]}><Text style={[styles.chipText, category === v && styles.chipTextActive]}>{v === 'ALL' ? 'All' : v}</Text></Pressable>)}</ScrollView>
          <Text style={styles.filterLabel}>Delivery Location</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{['ALL', ...locations].map(v => <Pressable key={v} onPress={() => setLocation(v)} style={[styles.chip, location === v && styles.chipActive]}><Text style={[styles.chipText, location === v && styles.chipTextActive]}>{v === 'ALL' ? 'All' : v}</Text></Pressable>)}</ScrollView>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.chipRow}>{['ALL','New','Viewed','Quote Sent'].map(v => <Pressable key={v} onPress={() => setFilterStatus(v)} style={[styles.chip, filterStatus === v && styles.chipActive]}><Text style={[styles.chipText, filterStatus === v && styles.chipTextActive]}>{v === 'ALL' ? 'All' : v}</Text></Pressable>)}</View>
          <Pressable onPress={() => { setCategory('ALL'); setLocation('ALL'); setFilterStatus('ALL'); setSearch(''); }}><Text style={styles.clearFilters}>Clear all filters</Text></Pressable>
        </View>}
        </>}
        ListEmptyComponent=        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={PURPLE} /><Text style={styles.stateText}>Loading buyer requests...</Text></View>
          : error ? <View style={styles.state}><MaterialCommunityIcons name="cloud-alert-outline" size={34} color="#9099A5" /><Text style={styles.stateTitle}>Couldn't load buyer requests</Text><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
          : <View style={styles.state}><MaterialCommunityIcons name="file-search-outline" size={34} color="#9099A5" /><Text style={styles.stateTitle}>No buyer requests found</Text><Text style={styles.stateText}>Try changing your search or filters, or check back shortly.</Text></View>}
        renderItem={({ item: rfq }) => {
            const s = getStatus(rfq), tone = statusColor(s);
            const qty = Number(rfq.targetQuantity || rfq.items?.[0]?.quantity || 0);
            return <View key={rfq.id} style={styles.rfqCard}>
              <View style={styles.cardTop}><Text style={styles.rfqCode}>{code(rfq.id)}</Text><Text style={[styles.statusPill, { backgroundColor: tone.bg, color: tone.fg }]}>{s}</Text></View>
              <Text style={styles.rfqTitle}>{rfq.title || garment(rfq)}</Text>
              <View style={styles.meta}><MaterialCommunityIcons name="layers-outline" size={21} color={ui.muted} /><Text style={styles.metaText}>{fabric(rfq)}</Text></View>
              <View style={styles.meta}><MaterialCommunityIcons name="archive-outline" size={21} color={ui.muted} /><Text style={styles.metaText}>Quantity: <Text style={styles.metaStrong}>{qty.toLocaleString('en-IN')} pcs</Text></Text></View>
              <View style={styles.meta}><MaterialCommunityIcons name="calendar-month-outline" size={21} color={ui.muted} /><Text style={styles.metaText}>Delivery: <Text style={styles.metaStrong}>{date(rfq.targetDate)}</Text></Text></View>
              <View style={styles.meta}><MaterialCommunityIcons name="map-marker-outline" size={21} color={ui.muted} /><Text style={styles.metaText}>Location: <Text style={styles.metaStrong}>{city(rfq)}</Text></Text></View>
              <View style={styles.cardFooter}>
                <Pressable style={styles.detailsButton} onPress={() => void openDetails(rfq)}><Text style={styles.detailsText}>View Details</Text></Pressable>
                {s !== 'Quote Sent' && rfq.status === 'OPEN' && <Pressable style={styles.sendButton} onPress={() => openQuoteForm(rfq)}><Text style={styles.sendText}>Send Quote</Text></Pressable>}
              </View>
            </View>;
        }}
      />

      <AppBottomNav role="SUPPLIER" activeSection="requests" onNavigate={(section) => section === 'home' ? router.replace('/workspace?role=SUPPLIER' as any) : router.push({ pathname: '/supplier/[section]', params: { section } } as any)} />

      <Modal visible={!!selected} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { setSelected(null); setEditing(false); }}>
        {selected && <View style={styles.modalScreen}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Text style={styles.modalHeading}>RFQ Details</Text><Text style={styles.modalCode}>{code(selected.id)}</Text>
            <Text style={[styles.statusPill, { backgroundColor: statusColor(getStatus(selected)).bg, color: statusColor(getStatus(selected)).fg }]}>{getStatus(selected)}</Text>
            <Pressable style={styles.close} onPress={() => { setSelected(null); setEditing(false); }}><MaterialCommunityIcons name="close" size={27} color="#8994A1" /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.detailTitle}>{selected.title || garment(selected)}</Text>
            <Text style={styles.buyerLine}><MaterialCommunityIcons name="office-building" size={19} color={PURPLE} /> Buyer: <Text style={{ fontWeight: '800', color: '#202633' }}>{selected.buyer?.name || 'Buyer'}</Text><Text style={{ color: '#A0A8B2' }}>  •  {city(selected)}</Text></Text>
            <View style={styles.detailTabs}>
              <Pressable onPress={() => setDetailTab('REQUIREMENTS')} style={[styles.detailTab, detailTab === 'REQUIREMENTS' && styles.detailTabActive]}><Text style={[styles.detailTabText, detailTab === 'REQUIREMENTS' && styles.detailTabTextActive]}>Requirements</Text></Pressable>
              <Pressable onPress={() => setDetailTab('BUYER_INFO')} style={[styles.detailTab, detailTab === 'BUYER_INFO' && styles.detailTabActive]}><Text style={[styles.detailTabText, detailTab === 'BUYER_INFO' && styles.detailTabTextActive]}>Buyer Info</Text></Pressable>
            </View>
            {detailTab === 'REQUIREMENTS' ? <View style={styles.infoCard}>
              {[
                ['Quantity', `${Number(selected.targetQuantity || selected.items?.[0]?.quantity || 0).toLocaleString('en-IN')} pcs`, 'archive-outline'],
                ['Fabric', fabric(selected), 'layers-outline'],
                ['Sizes', 'See buyer instructions', 'ruler'],
                ['Colors', 'See buyer instructions', 'palette-outline'],
                ['Sample Required', /sample\s*:\s*yes/i.test(selected.description || '') ? 'Yes' : 'Check instructions', 'hanger'],
                ['Delivery Date', date(selected.targetDate), 'calendar-month-outline'],
                ['Delivery Location', city(selected), 'map-marker-outline'],
              ].map(([label, value, icon]) => <View key={label} style={styles.infoRow}><View style={styles.infoLabel}><MaterialCommunityIcons name={icon as any} size={21} color={ui.muted} /><Text style={styles.infoLabelText}>{label}</Text></View><Text style={styles.infoValue}>{value}</Text></View>)}
              {!!selected.description && <View style={styles.instructions}><Text style={styles.instructionsTitle}>BUYER INSTRUCTIONS</Text><Text style={styles.instructionsText}>{selected.description}</Text></View>}
            </View> : <View style={styles.infoCard}>
              <View style={styles.infoRow}><Text style={styles.infoLabelText}>Company Name</Text><Text style={styles.infoValue}>{selected.buyer?.name || 'Not available'}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabelText}>Location</Text><Text style={styles.infoValue}>{city(selected)}</Text></View>
              <View style={styles.infoRow}><Text style={styles.infoLabelText}>Buyer ID</Text><Text style={styles.infoValue}>{selected.buyer?.id || 'Not shared'}</Text></View>
              <Text style={styles.buyerPrivacy}>Buyer contact details are shared through the platform's authorized workflow.</Text>
            </View>}
            {getQuote(selected) && !editing ? <View style={styles.quoteCard}>
              <View style={styles.quoteTop}><View><Text style={styles.quoteTitle}>Your Submitted Quotation</Text><Text style={styles.quoteSent}>Sent to Buyer</Text></View>{selected.status === 'OPEN' && <Pressable onPress={() => openQuoteForm(selected)} style={styles.revise}><MaterialCommunityIcons name="pencil-outline" size={18} color={PURPLE} /><Text style={styles.reviseText}>Revise</Text></Pressable>}</View>
              <View style={styles.quoteGrid}>
                <View style={styles.quoteMetric}><Text style={styles.metricLabel}>Price per Piece</Text><Text style={styles.metricValue}>{money(Number(getQuote(selected)?.items?.[0]?.unitPrice || 0))}</Text></View>
                <View style={styles.quoteMetric}><Text style={styles.metricLabel}>Total Quoted</Text><Text style={[styles.metricValue,{color:PURPLE}]}>{money(getQuote(selected)?.totalAmount || 0)}</Text></View>
                <View style={styles.quoteMetric}><Text style={styles.metricLabel}>Delivery Time</Text><Text style={styles.metricValue}>{getQuote(selected)?.leadTimeDays || 21} Days</Text></View>
                <View style={styles.quoteMetric}><Text style={styles.metricLabel}>Sample Cost</Text><Text style={styles.metricValue}>{money(getQuote(selected)?.sampleCost || 0)}</Text></View>
              </View>
              <Text style={styles.metricLabel}>Payment Terms</Text><Text style={styles.termsText}>{getQuote(selected)?.terms || 'Not specified'}</Text>
            </View> : <View style={styles.quoteCard}>
              <Text style={styles.quoteTitle}>{getQuote(selected) ? 'Revise Your Quote' : 'Send Your Quote'}</Text>
              <Text style={styles.fieldLabel}>Price per Piece (₹) *</Text><TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={styles.fieldInput} placeholder="Enter price" />
              <Text style={styles.fieldLabel}>Total Price (₹)</Text><View style={styles.totalBox}><Text style={styles.totalText}>{money(Number(price || 0) * Math.max(1, Number(selected.targetQuantity || selected.items?.[0]?.quantity || 1)))}</Text></View>
              <Text style={styles.fieldLabel}>Delivery Time</Text><View style={styles.choiceRow}>{['15','21','30','45'].map(v => <Pressable key={v} onPress={() => setDelivery(v)} style={[styles.choice, delivery === v && styles.choiceActive]}><Text style={[styles.choiceText, delivery === v && styles.choiceTextActive]}>{v} Days</Text></Pressable>)}</View>
              <Text style={styles.fieldLabel}>Sample Cost (₹)</Text><TextInput value={sampleCost} onChangeText={setSampleCost} keyboardType="decimal-pad" style={styles.fieldInput} placeholder="0" />
              <Text style={styles.fieldLabel}>Payment Terms</Text>
              {['50% Advance, 50% on QC Pass','30% Advance, 70% before Dispatch','100% Secure Payment on PO','Net 30 Days'].map(v => <Pressable key={v} onPress={() => setTerms(v)} style={[styles.termChoice, terms === v && styles.choiceActive]}><MaterialCommunityIcons name={terms === v ? 'radiobox-marked' : 'radiobox-blank'} size={18} color={terms === v ? PURPLE : '#87919D'} /><Text style={[styles.choiceText, terms === v && styles.choiceTextActive]}>{v}</Text></Pressable>)}
              <Text style={styles.fieldLabel}>Note (Optional)</Text><TextInput value={note} onChangeText={setNote} multiline style={[styles.fieldInput,{minHeight:76,textAlignVertical:'top'}]} placeholder="Additional details for buyer..." />
              <Pressable style={[styles.submitButton, saving && {opacity:.6}]} onPress={() => void submitQuote()} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitText}>{getQuote(selected) ? 'Update & Submit Quote' : 'Submit Quote'}</Text>}</Pressable>
              {getQuote(selected) && <Pressable onPress={() => setEditing(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></Pressable>}
            </View>}
          </ScrollView>
        </View>}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas}, header:{minHeight:58,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:ui.border,paddingHorizontal:14,paddingBottom:5,flexDirection:'row',alignItems:'center',gap:12},
  headerButton:{width:38,height:42,alignItems:'center',justifyContent:'center'},logo:{width:142,height:34,flex:1},headerRight:{flexDirection:'row',gap:9},headerCircle:{width:38,height:38,borderRadius:19,backgroundColor:'#F5F0FF',alignItems:'center',justifyContent:'center'},
  content:{paddingHorizontal:16,paddingTop:16,paddingBottom:20,width:'100%',maxWidth:840,alignSelf:'center'},titleRow:{flexDirection:'row',alignItems:'center',gap:10},title:{fontSize:22,fontWeight: '700',color:ui.ink},newPill:{backgroundColor:PURPLE,color:ui.surface,overflow:'hidden',borderRadius:18,paddingHorizontal:13,paddingVertical:6,fontSize:13,fontWeight: '700'},subtitle:{fontSize:14,color:'#657181',marginTop:7,marginBottom:22,lineHeight:20},
  tabsScroll:{marginBottom:12,marginHorizontal:-16},tabs:{paddingHorizontal:16,alignItems:'center',gap:20,borderBottomWidth:1,borderBottomColor:ui.border},tab:{paddingVertical:12,borderBottomWidth:3,borderBottomColor:'transparent'},tabActive:{borderBottomColor:PURPLE},tabText:{fontSize:14,fontWeight:'700',color:'#596575'},tabTextActive:{color:PURPLE},
  searchRow:{flexDirection:'row',gap:12,marginBottom:16},searchBox:{height:52,flex:1,backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,borderRadius:12,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:9},searchInput:{flex:1,fontSize:14,color:ui.ink},filterButton:{width:54,height:52,borderRadius:12,backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,alignItems:'center',justifyContent:'center'},filterButtonActive:{backgroundColor:PURPLE,borderColor:PURPLE},
  filterPanel:{backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,borderRadius:16,padding:13,gap:9,marginBottom:15},filterLabel:{fontSize: 13,fontWeight: '700',color:'#5D6877',marginTop:4},chipRow:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{paddingHorizontal:11,paddingVertical:8,borderRadius:20,backgroundColor:'#F3F4F6'},chipActive:{backgroundColor:ui.accentSoft},chipText:{fontSize: 13,color:'#566171'},chipTextActive:{color:PURPLE,fontWeight: '700'},clearFilters:{color:PURPLE,fontSize: 13,fontWeight: '700',alignSelf:'flex-end',paddingTop:4},
  rfqCard:{backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,borderRadius:16,padding:17,marginBottom:15},cardTop:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:17},rfqCode:{fontSize:16,fontWeight: '700',color:'#1C2230'},statusPill:{overflow:'hidden',borderRadius:18,paddingHorizontal:11,paddingVertical:6,fontSize: 13,fontWeight: '700'},rfqTitle:{fontSize:22,fontWeight: '700',color:ui.ink,marginBottom:15},meta:{flexDirection:'row',alignItems:'center',gap:11,marginBottom:12},metaText:{fontSize:14,color:'#687585',flex:1},metaStrong:{fontWeight: '700',color:'#28313E'},cardFooter:{borderTopWidth:1,borderTopColor:'#F0F1F4',paddingTop:13,marginTop:3,flexDirection:'row',gap:9},detailsButton:{flex:1,minHeight:48,borderWidth:1.5,borderColor:PURPLE,borderRadius:13,alignItems:'center',justifyContent:'center'},detailsText:{fontSize:15,fontWeight: '700',color:PURPLE},sendButton:{flex:1,minHeight:48,backgroundColor:PURPLE,borderRadius:13,alignItems:'center',justifyContent:'center'},sendText:{fontSize:15,fontWeight: '700',color:ui.surface},
  state:{minHeight:230,alignItems:'center',justifyContent:'center',padding:25,gap:10},stateText:{fontSize:13,color:'#737D8B',textAlign:'center',lineHeight:20},stateTitle:{fontSize:17,fontWeight: '700',color:ui.ink},retry:{paddingHorizontal:22,paddingVertical:11,backgroundColor:PURPLE,borderRadius:12,marginTop:5},retryText:{color:ui.surface,fontWeight: '700'},
  drawer:{position:'absolute',zIndex:10,top:80,bottom:0,left:0,width:'68%',backgroundColor:ui.surface,padding:16,elevation: 0},drawerItem:{paddingVertical:15,paddingHorizontal:14,borderRadius:14},drawerActive:{backgroundColor:PURPLE},drawerText:{fontSize:16,fontWeight:'700',color:'#586372'},
  modalScreen:{flex:1,backgroundColor:ui.surface},modalHeader:{minHeight:70,paddingHorizontal:18,paddingBottom:12,borderBottomWidth:1,borderBottomColor:'#EEF0F3',flexDirection:'row',alignItems:'center',gap:7},modalHeading:{fontSize:20,fontWeight: '700',color:ui.ink},modalCode:{fontSize: 12,fontWeight: '700',color:PURPLE,backgroundColor:'#F5F0FF',overflow:'hidden',borderRadius:20,paddingHorizontal:9,paddingVertical:6},close:{marginLeft:'auto',padding:3},modalBody:{padding:20,paddingBottom:35},detailTitle:{fontSize:25,fontWeight: '700',color:ui.ink,marginBottom:9},buyerLine:{fontSize:14,color:'#657181',marginBottom:25},detailTabs:{flexDirection:'row',gap:26,borderBottomWidth:1,borderBottomColor:ui.border,marginBottom:18},detailTab:{paddingBottom:12,borderBottomWidth:3,borderBottomColor:'transparent'},detailTabActive:{borderBottomColor:PURPLE},detailTabText:{fontSize:14,color:'#6A7482'},detailTabTextActive:{color:PURPLE,fontWeight: '700'},
  infoCard:{backgroundColor:ui.surfaceMuted,borderWidth:1,borderColor:ui.border,borderRadius:16,paddingHorizontal:15,paddingVertical:5,marginBottom:18},infoRow:{minHeight:61,borderBottomWidth:1,borderBottomColor:'#EAEDF1',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},infoLabel:{flexDirection:'row',alignItems:'center',gap:10,flex:1},infoLabelText:{fontSize:13,color:'#718091'},infoValue:{fontSize:13,fontWeight: '700',color:ui.ink,textAlign:'right',flex:1.25},instructions:{paddingVertical:15},instructionsTitle:{fontSize: 13,fontWeight: '700',color:'#6C7786',marginBottom:9},instructionsText:{fontSize:14,lineHeight:23,color:'#566171',backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,borderRadius:15,padding:14},buyerPrivacy:{fontSize: 13,lineHeight:19,color:'#6C7786',paddingVertical:14},
  quoteCard:{borderWidth:1,borderColor:'#E3D8F8',borderRadius:16,padding:16,marginTop:3,marginBottom:20,backgroundColor:'#FFFEFF'},quoteTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:17},quoteTitle:{fontSize:18,fontWeight: '700',color:ui.ink},quoteSent:{fontSize:13,color:'#16845A',fontWeight: '700',marginTop:5},revise:{flexDirection:'row',alignItems:'center',gap:4},reviseText:{fontSize:14,fontWeight: '700',color:PURPLE},quoteGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:15},quoteMetric:{width:'48%',minHeight:90,backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,borderRadius:15,padding:13,justifyContent:'center'},metricLabel:{fontSize: 13,color:'#7A8592'},metricValue:{fontSize:19,fontWeight: '700',color:ui.ink,marginTop:6},termsText:{fontSize:14,color:'#303846',marginTop:6,lineHeight:21},
  fieldLabel:{fontSize:13,fontWeight: '700',color:'#394352',marginTop:14,marginBottom:7},fieldInput:{minHeight:49,borderWidth:1,borderColor:'#DDE1E7',borderRadius:12,paddingHorizontal:13,fontSize:15,color:ui.ink,backgroundColor:ui.surface},totalBox:{minHeight:48,backgroundColor:'#F4F1FA',borderRadius:13,justifyContent:'center',paddingHorizontal:13},totalText:{fontSize:16,fontWeight: '700',color:PURPLE},choiceRow:{flexDirection:'row',gap:8},choice:{flex:1,borderWidth:1,borderColor:'#E0E3E8',borderRadius:12,paddingVertical:12,alignItems:'center'},choiceActive:{borderColor:PURPLE,backgroundColor:'#F4EEFF'},choiceText:{fontSize: 13,color:'#536071'},choiceTextActive:{color:PURPLE,fontWeight: '700'},termChoice:{flexDirection:'row',alignItems:'center',gap:9,padding:11,borderWidth:1,borderColor:ui.border,borderRadius:12,marginBottom:7},submitButton:{minHeight:51,backgroundColor:PURPLE,borderRadius:14,alignItems:'center',justifyContent:'center',marginTop:18},submitText:{fontSize:15,fontWeight: '700',color:ui.surface},cancelButton:{alignItems:'center',padding:13},cancelText:{color:'#6C7786',fontWeight: '700'},
});