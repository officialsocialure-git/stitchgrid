import { ui } from '@/theme/ui';
import { SourcingTabs } from '@/components/SourcingTabs';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

type Quote = {
  id: string; supplierOrgId: string; totalAmount: number | string; currency?: string;
  leadTimeDays?: number; sampleCost?: number | string | null; sampleLeadDays?: number | null;
  moq?: number | null; terms?: string | null; status: string;
  items?: { id?: string; description?: string; quantity?: number; unitPrice?: number | string }[];
};
type Rfq = {
  id: string; title: string; status: string; targetQuantity?: number;
  targetDate?: string | null; fabricSpec?: string | null; description?: string | null;
  destination?: string | null; deliveryLocation?: string | null;
  buyer?: { id?: string; name?: string; city?: string | null };
  items?: { id?: string; name?: string; quantity?: number; unit?: string }[];
  quotations?: Quote[];
};
const money = (value: number | string | null | undefined, currency = 'INR') => {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0)); }
  catch { return '₹' + Number(value || 0).toLocaleString('en-IN'); }
};
const dateLabel = (value?: string | null) => {
  if (!value) return 'Not specified';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 'Not specified' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const rfqCode = (id: string) => `RFQ #RFQ-${String(id || '').slice(-4).toUpperCase()}`;

export default function SupplierMyOffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const member = JSON.parse(raw);
      const id = member?.organizationId || member?.organization?.id;
      if (member?.role !== 'SUPPLIER' || !id) throw new Error('Active supplier membership not found. Please sign in again.');
      setOrgId(id);
      setOrgName(member?.organization?.name || member?.organizationName || 'Your Supplier Company');
      const data = await apiGet<Rfq[]>(`/rfqs?organizationId=${encodeURIComponent(id)}`);
      const rows = Array.isArray(data) ? data : [];
      const withOffers = rows.filter(r => (r.quotations || []).some(q => q.supplierOrgId === id));
      setRfqs(withOffers);
      setActiveId(previous => withOffers.some(r => r.id === previous) ? previous : withOffers[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your submitted offers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => { void load(true); }, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const active = rfqs.find(r => r.id === activeId) || null;
  const quote = useMemo(() => active?.quotations?.find(q => q.supplierOrgId === orgId) || null, [active, orgId]);
  const awarded = quote?.status === 'ACCEPTED';
  const rejected = quote?.status === 'REJECTED';
  const withdrawn = quote?.status === 'WITHDRAWN';
  const quoteStatusLabel = awarded ? 'AWARDED TO YOU' : rejected ? 'NOT SELECTED' : withdrawn ? 'WITHDRAWN' : quote?.status?.replaceAll('_', ' ') || 'SUBMITTED';
  const unitPrice = Number(quote?.items?.[0]?.unitPrice || (Number(active?.targetQuantity || 0) ? Number(quote?.totalAmount || 0) / Number(active?.targetQuantity) : 0));
  const destination = active?.deliveryLocation || active?.destination || 'Destination not specified';

  const navigate = (section: string) => {
    setMenuOpen(false);
    if (section === 'home') router.replace('/workspace?role=SUPPLIER' as any);
    else router.push({ pathname: '/supplier/[section]', params: { section } } as any);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        role="SUPPLIER"
        activeSection="offers"
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={PURPLE} />}>
        <SourcingTabs role="SUPPLIER" active="offers" />
        {loading ? <View style={styles.state}><ActivityIndicator size="large" color={PURPLE}/><Text style={styles.muted}>Loading your offers...</Text></View>
        : error ? <View style={styles.state}><MaterialCommunityIcons name="cloud-alert-outline" size={34} color="#8994A1"/><Text style={styles.stateTitle}>Couldn't load My Offers</Text><Text style={styles.muted}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
        : !active || !quote ? <View style={styles.state}><MaterialCommunityIcons name="file-document-outline" size={38} color="#9AA1AA"/><Text style={styles.stateTitle}>No offers submitted yet</Text><Text style={styles.muted}>Your submitted quotations for Buyer Requests will appear here.</Text><Pressable style={styles.primaryButton} onPress={() => navigate('requests')}><Text style={styles.primaryText}>Browse Buyer Requests</Text></Pressable></View>
        : <>
          <View style={styles.contextCard}>
            <View style={styles.pillRow}>
              <Text style={styles.rfqPill}>{rfqCode(active.id)}</Text>
              <Text style={[styles.statusPill, awarded ? styles.awardedPill : rejected ? styles.rejectedPill : withdrawn ? styles.withdrawnPill : styles.submittedPill]}>{quoteStatusLabel}</Text>
            </View>
            {rfqs.length > 1 && <Pressable style={styles.picker} onPress={() => setPickerOpen(true)}>
              <Text numberOfLines={1} style={styles.pickerText}>{active.title} ({rfqs.length} offers)</Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color="#68727F"/>
            </Pressable>}
            <Text style={styles.rfqTitle}>{active.title}</Text>
            <Text style={styles.description}>Target Delivery: {dateLabel(active.targetDate)} • Destination: {destination}{active.fabricSpec ? ` • ${active.fabricSpec}` : ''}</Text>
            <View style={styles.actions}>
              <Pressable style={styles.backButton} onPress={() => navigate('requests')}>
                <MaterialCommunityIcons name="arrow-left" size={21} color="#202633"/>
                <Text style={styles.backText}>Back to Buyer Requests</Text>
              </Pressable>
              {awarded && <Pressable style={styles.ordersButton} onPress={() => navigate('orders')}>
                <MaterialCommunityIcons name="archive-outline" size={20} color="#FFFFFF"/>
                <Text style={styles.ordersText}>Go to Orders →</Text>
              </Pressable>}
            </View>
          </View>

          <View style={styles.quoteCard}>
            <View style={styles.quoteTop}>
              <View style={styles.bestBadge}><MaterialCommunityIcons name="check-decagram" size={19} color="#5314B8"/><Text style={styles.bestText}>{awarded ? 'AWARDED QUOTATION' : 'YOUR SUBMITTED OFFER'}</Text></View>
              <MaterialCommunityIcons name="radiobox-marked" size={23} color="#1683D8"/>
            </View>
            <Text style={styles.supplierName}>{orgName}</Text>
            <Text style={styles.location}>{active.buyer?.name || 'Buyer'}{active.buyer?.city ? ` • ${active.buyer.city}` : ''}</Text>
            <View style={styles.pricePanel}>
              <View style={styles.priceLine}><Text style={styles.price}>{money(unitPrice, quote.currency)}</Text><Text style={styles.perPiece}> / piece</Text></View>
              <Text style={styles.total}>{money(quote.totalAmount, quote.currency)} Total</Text>
            </View>
            <View style={styles.rows}>
              <View style={styles.specRow}><Text style={styles.specLabel}>Bulk Production</Text><Text style={styles.specValue}>{quote.leadTimeDays || '—'} Days</Text></View>
              <View style={styles.specRow}><Text style={styles.specLabel}>Pre-Prod Sample</Text><Text style={styles.specValue}>{quote.sampleLeadDays || 7} Days</Text></View>
              <View style={styles.specRow}><Text style={styles.specLabel}>Fabric Spec</Text><Text style={styles.specValueFlex}>{active.fabricSpec || 'As per RFQ'}</Text></View>
              <View style={styles.specRow}><Text style={styles.specLabel}>Payment Terms</Text><Text style={styles.specValueFlex}>{quote.terms || 'To be mutually agreed'}</Text></View>
              {!!quote.moq && <View style={styles.specRow}><Text style={styles.specLabel}>Minimum Order</Text><Text style={styles.specValue}>{Number(quote.moq).toLocaleString('en-IN')} pcs</Text></View>}
              {Number(quote.sampleCost || 0) > 0 && <View style={styles.specRow}><Text style={styles.specLabel}>Sample Cost</Text><Text style={styles.specValue}>{money(quote.sampleCost, quote.currency)}</Text></View>}
            </View>
            <View style={styles.cardFooter}>
              {awarded ? <Pressable style={styles.awardedButton} onPress={() => navigate('orders')}>
                <MaterialCommunityIcons name="check-decagram" size={22} color="#FFFFFF"/><Text style={styles.awardedText}>Awarded to You • Go to Orders →</Text>
              </Pressable> : rejected ? <View style={styles.rejectedBanner}><MaterialCommunityIcons name="close-circle-outline" size={20} color="#B42318"/><Text style={styles.rejectedText}>Buyer selected another supplier for this RFQ</Text></View> : withdrawn ? <View style={styles.rejectedBanner}><MaterialCommunityIcons name="alert-circle-outline" size={20} color="#8A5A00"/><Text style={styles.rejectedText}>This quotation was withdrawn</Text></View> : <View style={styles.submittedBanner}><MaterialCommunityIcons name="check-all" size={20} color="#087653"/><Text style={styles.submittedText}>{quote.status === "REVISED" ? "Revised quotation submitted • Awaiting buyer decision" : "Quotation submitted to buyer • Awaiting decision"}</Text></View>}
            </View>
          </View>
        </>}
      </ScrollView>

      <AppBottomNav role="SUPPLIER" activeSection="offers" onNavigate={navigate} onLayout={e => setBottomHeight(e.nativeEvent.layout.height)} />



      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.handle}/>
            <Text style={styles.pickerTitle}>Select Your Offer</Text>
            <FlatList
              data={rfqs}
              keyExtractor={r => r.id}
              style={{ flexGrow: 0, flexShrink: 1, maxHeight: 340 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: r }) => <Pressable style={styles.pickerItem} accessibilityRole="radio" accessibilityState={{ checked: r.id === activeId }} onPress={() => { setActiveId(r.id); setPickerOpen(false); }}><View style={{ flex: 1 }}><Text style={styles.pickerItemTitle}>{r.title}</Text><Text style={styles.muted}>{rfqCode(r.id)}</Text></View><MaterialCommunityIcons name={r.id === activeId ? 'radiobox-marked' : 'radiobox-blank'} size={22} color={PURPLE}/></Pressable>}
              ListEmptyComponent={<Text style={styles.muted}>No submitted offers yet.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  header:{minHeight:72,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:ui.border,paddingHorizontal:18,paddingBottom:10,flexDirection:'row',alignItems:'center',gap:12},
  headerButton:{width:38,height:42,alignItems:'center',justifyContent:'center'},logo:{width:142,height:34,flex:1},headerActions:{flexDirection:'row',gap:9},headerCircle:{width:38,height:38,borderRadius:19,backgroundColor:'#F5F0FF',alignItems:'center',justifyContent:'center'},
  content:{paddingHorizontal:16,paddingTop:16,paddingBottom:20,gap:16,width:'100%',maxWidth:840,alignSelf:'center'},
  contextCard:{backgroundColor:ui.surface,borderRadius:16,padding:20,borderWidth:1,borderColor:ui.border,shadowColor:'#101828',shadowOpacity: 0,shadowRadius:8,elevation: 0},
  pillRow:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14},rfqPill:{backgroundColor:'#F0E6FF',color:'#5314B8',overflow:'hidden',borderRadius:20,paddingHorizontal:13,paddingVertical:7,fontSize:13,fontWeight: '700'},statusPill:{overflow:'hidden',borderRadius:20,paddingHorizontal:12,paddingVertical:7,fontSize: 12,fontWeight: '700'},awardedPill:{backgroundColor:'#E5F8EF',color:'#087653'},submittedPill:{backgroundColor:'#E8F5FF',color:'#2367A5'},rejectedPill:{backgroundColor:'#FEECEB',color:'#B42318'},withdrawnPill:{backgroundColor:'#FFF4D6',color:'#8A5A00'},
  picker:{minHeight:43,borderWidth:1,borderColor:ui.border,borderRadius:22,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:13},pickerText:{fontSize:14,fontWeight:'700',color:'#26313D',flex:1},rfqTitle:{fontSize:21,fontWeight: '700',lineHeight:34,color:'#142033',marginBottom:8},description:{fontSize:14,lineHeight:23,color:ui.muted},
  actions:{flexDirection:'row',gap:10,marginTop:20},backButton:{flex:1,minHeight:52,borderWidth:1,borderColor:'#D9DDE4',borderRadius:13,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:7,paddingHorizontal:8},backText:{fontSize:13,fontWeight: '700',color:ui.ink,flexShrink:1,textAlign:'center'},ordersButton:{flex:1,minHeight:52,backgroundColor:'#5700B8',borderRadius:13,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6,paddingHorizontal:8},ordersText:{fontSize:13,fontWeight: '700',color:ui.surface},
  quoteCard:{backgroundColor:ui.surface,borderWidth:1.5,borderColor:'#8A52C9',borderRadius:16,padding:18,shadowColor:'#4B168C',shadowOpacity: 0,shadowRadius:8,elevation: 0},quoteTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:18},bestBadge:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:'#F0E3FF',borderRadius:22,paddingHorizontal:12,paddingVertical:8},bestText:{fontSize: 12,fontWeight: '700',color:'#5314B8'},supplierName:{fontSize:19,fontWeight: '700',color:'#17212F'},location:{fontSize:14,color:ui.muted,marginTop:5},
  pricePanel:{backgroundColor:'#E8F3FF',borderRadius:16,padding:14,marginTop:12,marginBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},priceLine:{flexDirection:'row',alignItems:'baseline',flexShrink:1},price:{fontSize:27,fontWeight: '700',color:'#5314B8'},perPiece:{fontSize:14,color:ui.muted},total:{fontSize:13,fontWeight: '700',color:'#1C2938',flexShrink:0},
  rows:{gap:0},specRow:{minHeight:53,borderBottomWidth:1,borderBottomColor:'#E8EBF0',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},specLabel:{fontSize:14,color:ui.muted,flex:1},specValue:{fontSize:14,fontWeight: '700',color:'#26313D'},specValueFlex:{fontSize:13,fontWeight:'700',color:'#26313D',textAlign:'right',flex:1.25},
  cardFooter:{borderTopWidth:1,borderTopColor:'#E9ECF0',paddingTop:17,marginTop:18},awardedButton:{minHeight:54,backgroundColor:'#07966B',borderRadius:13,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,paddingHorizontal:10},awardedText:{fontSize:14,fontWeight: '700',color:ui.surface,textAlign:'center'},submittedBanner:{minHeight:48,backgroundColor:'#EAF8F1',borderRadius:12,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,paddingHorizontal:10},submittedText:{fontSize:13,fontWeight: '700',color:'#087653',textAlign:'center'},rejectedBanner:{minHeight:48,backgroundColor:'#FFF0EF',borderRadius:12,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,paddingHorizontal:10},rejectedText:{fontSize:13,fontWeight: '700',color:'#A52820',textAlign:'center'},
  state:{minHeight:300,alignItems:'center',justifyContent:'center',padding:26,gap:12},stateTitle:{fontSize:18,fontWeight: '700',color:ui.ink},muted:{fontSize:13,color:'#707B89',textAlign:'center',lineHeight:20},retry:{backgroundColor:PURPLE,borderRadius:12,paddingHorizontal:22,paddingVertical:12},retryText:{fontSize:14,fontWeight: '700',color:ui.surface},primaryButton:{backgroundColor:PURPLE,borderRadius:12,paddingHorizontal:18,paddingVertical:13},primaryText:{fontSize:14,fontWeight: '700',color:ui.surface},
  bottomNav:{minHeight:76,backgroundColor:ui.surface,borderTopWidth:1,borderTopColor:'#E8EBF0',paddingTop:9,paddingHorizontal:7,flexDirection:'row',justifyContent:'space-around'},navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:4},navLabel:{fontSize: 12,color:ui.muted,fontWeight:'700'},
  drawerLayer:{position:'absolute',left:0,right:0,zIndex:20,flexDirection:'row'},drawer:{width:'65%',backgroundColor:ui.surface,paddingHorizontal:16,paddingTop:24,elevation: 0},backdrop:{flex:1,backgroundColor:'rgba(0,0,0,.35)'},drawerItem:{minHeight:57,borderRadius:13,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:14},drawerActive:{backgroundColor: PURPLE},drawerText:{fontSize:15,fontWeight:'700',color:'#586372'},drawerTextActive:{color:ui.surface},
  modalBackdrop:{flex:1,backgroundColor:'rgba(15,20,30,.35)',justifyContent:'flex-end'},pickerSheet:{backgroundColor:ui.surface,borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,paddingBottom:35,maxHeight:'75%'},handle:{width:42,height:5,borderRadius:5,backgroundColor:'#D8DCE3',alignSelf:'center',marginBottom:18},pickerTitle:{fontSize:19,fontWeight: '700',color:ui.ink,marginBottom:12},pickerItem:{minHeight:62,borderBottomWidth:1,borderBottomColor:'#EEF0F3',flexDirection:'row',alignItems:'center',gap:12},pickerItemTitle:{fontSize:14,fontWeight: '700',color:ui.ink}
});
