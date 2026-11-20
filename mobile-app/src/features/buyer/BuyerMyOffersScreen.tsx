import { ui } from '@/theme/ui';

import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPost } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

type Quote = {
  id: string;
  supplierOrgId: string;
  totalAmount: number | string;
  currency?: string;
  leadTimeDays: number;
  sampleCost?: number | string | null;
  sampleLeadDays?: number | null;
  moq?: number | null;
  terms?: string | null;
  status: string;
  items?: { id: string; description: string; quantity: number; unitPrice: number | string }[];
  supplier?: { id: string; name: string; city?: string | null };
};
type Rfq = {
  id: string;
  title: string;
  status: string;
  targetQuantity: number;
  targetDate?: string | null;
  fabricSpec?: string | null;
  description?: string | null;
  items?: { id: string; name: string; quantity: number; unit: string }[];
  quotations?: Quote[];
};

const money = (value: number | string | null | undefined, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const dateLabel = (value?: string | null) => {
  if (!value) return 'Flexible';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Flexible' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const unitPrice = (quote: Quote, quantity: number) => {
  const itemPrice = Number(quote.items?.[0]?.unitPrice || 0);
  return itemPrice || (quantity > 0 ? Number(quote.totalAmount || 0) / quantity : 0);
};

export default function BuyerMyOffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ rfqId?: string }>();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [activeRfqId, setActiveRfqId] = useState(params.rfqId || '');
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [rfqPickerOpen, setRfqPickerOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomHeight, setBottomHeight] = useState(0);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      const member = raw ? JSON.parse(raw) : null;
      const orgId = member?.organizationId || member?.organization?.id;
      if (!orgId) throw new Error('Buyer organization membership was not found. Please sign in again.');
      const data = await apiGet<Rfq[]>(`/rfqs?organizationId=${encodeURIComponent(orgId)}`);
      const list = Array.isArray(data) ? data : [];
      setRfqs(list);
      const requested = params.rfqId && list.some(r => r.id === params.rfqId) ? params.rfqId : '';
      const current = requested || (activeRfqId && list.some(r => r.id === activeRfqId) ? activeRfqId : '') ||
        (list.find(r => (r.quotations || []).length > 0)?.id || list[0]?.id || '');
      setActiveRfqId(current);
      const currentRfq = list.find(r => r.id === current);
      const quotes = currentRfq?.quotations || [];
      setSelectedQuoteId(previous => quotes.some(q => q.id === previous) ? previous : (quotes.find(q => q.status === 'ACCEPTED')?.id || quotes[0]?.id || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load supplier offers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [params.rfqId, activeRfqId]);

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(true); }, 20000);
    return () => clearInterval(interval);
  }, [load]);

  const activeRfq = rfqs.find(r => r.id === activeRfqId) || null;
  const quotes = activeRfq?.quotations || [];
  const selectedQuote = quotes.find(q => q.id === selectedQuoteId) || quotes[0] || null;
  const accepted = activeRfq?.status === 'AWARDED' || quotes.some(q => q.status === 'ACCEPTED');
  const comparableQuotes = quotes.filter(q => q.status !== 'REJECTED' && q.status !== 'WITHDRAWN');
  const bestValueId = useMemo(() => {
    if (!activeRfq || comparableQuotes.length === 0) return '';
    return [...comparableQuotes].sort((a,b) => unitPrice(a, activeRfq.targetQuantity) - unitPrice(b, activeRfq.targetQuantity))[0]?.id || '';
  }, [activeRfq, comparableQuotes]);
  const fastestId = useMemo(() => [...comparableQuotes].sort((a,b) => a.leadTimeDays - b.leadTimeDays)[0]?.id || '', [comparableQuotes]);

  const navigate = (section: string) => {
    setDrawerOpen(false);
    if (section === 'home') router.replace('/workspace?role=BUYER' as any);
    else router.replace({ pathname: '/buyer/[section]', params: { section } } as any);
  };

  const acceptQuote = () => {
    if (!selectedQuote || !activeRfq || accepted) return;
    Alert.alert(
      'Accept supplier quotation?',
      `This will issue a Purchase Order to ${selectedQuote.supplier?.name || 'the selected supplier'} for ${activeRfq.title}. Other quotations for this RFQ will be rejected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Accept & Issue PO', onPress: async () => {
          try {
            setBusy(true);
            const po = await apiPost<{ id: string; poNumber?: string }>('/purchase-orders', { quotationId: selectedQuote.id, ...(activeRfq.targetDate ? { expectedDate: activeRfq.targetDate } : {}) });
            Alert.alert('Purchase Order issued', `PO ${po?.poNumber || 'created'} has been issued and sent to the supplier.`, [
              { text: 'View My Orders', onPress: () => router.replace({ pathname: '/buyer/[section]', params: { section: 'orders' } } as any) },
              { text: 'Done', onPress: () => void load(true) },
            ]);
            await load(true);
          } catch (e) {
            Alert.alert('Unable to issue Purchase Order', e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setBusy(false);
          }
        }},
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        role="BUYER"
        activeSection="offers"
        onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true);void load(true);}} tintColor={PURPLE}/>}
      >

        {loading ? <View style={styles.stateCard}><ActivityIndicator color={PURPLE}/><Text style={styles.stateText}>Loading supplier quotations...</Text></View> :
        error ? <View style={styles.stateCard}><MaterialCommunityIcons name="cloud-alert-outline" size={30} color="#8B929C"/><Text style={styles.stateTitle}>Couldn't load offers</Text><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></View> :
        !activeRfq ? <View style={styles.stateCard}><MaterialCommunityIcons name="file-document-outline" size={32} color="#9AA1AA"/><Text style={styles.stateTitle}>No requests available</Text><Text style={styles.stateText}>Post a buyer request to receive supplier quotations.</Text><Pressable style={styles.primaryButton} onPress={() => navigate('requests')}><Text style={styles.primaryButtonText}>Go to My Requests</Text></Pressable></View> :
        <>
          <View style={styles.contextCard}>
            <View style={styles.contextTop}>
              <View style={styles.contextPills}>
                <Text style={styles.rfqPill}>RFQ #{activeRfq.id.slice(0,12)}</Text>
                <Text style={styles.quoteCountPill}>{quotes.length} {quotes.length === 1 ? 'QUOTE' : 'QUOTES'} SUBMITTED</Text>
              </View>
            </View>
            <Pressable style={styles.rfqSelect} onPress={() => setRfqPickerOpen(true)}>
              <Text numberOfLines={1} style={styles.rfqSelectText}>{activeRfq.title} ({quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'})</Text>
              <MaterialCommunityIcons name="chevron-down" size={22} color="#68727F"/>
            </Pressable>
            <Text style={styles.rfqTitle}>{activeRfq.title}</Text>
            <Text style={styles.rfqDescription}>Target Delivery: {dateLabel(activeRfq.targetDate)}{activeRfq.fabricSpec ? ` • Fabric: ${activeRfq.fabricSpec}` : ''}</Text>
            <View style={styles.contextActions}>
              <Pressable style={styles.backRequestsButton} onPress={() => navigate('requests')}>
                <MaterialCommunityIcons name="arrow-left" size={22} color="#202633"/>
                <Text style={styles.backRequestsText}>Back to My Requests</Text>
              </Pressable>
              {accepted ?
                <Pressable style={styles.viewPoButton} onPress={() => navigate('orders')}>
                  <MaterialCommunityIcons name="archive-outline" size={22} color="#FFFFFF"/>
                  <Text style={styles.viewPoText}>View Purchase Order →</Text>
                </Pressable> :
                <Pressable disabled={!selectedQuote || busy} style={[styles.viewPoButton,(!selectedQuote||busy)&&{opacity:.5}]} onPress={acceptQuote}>
                  {busy ? <ActivityIndicator color="#fff"/> : <MaterialCommunityIcons name="check-circle-outline" size={22} color="#FFFFFF"/>}
                  <Text style={styles.viewPoText}>{busy ? 'Issuing...' : 'Accept This Quote'}</Text>
                </Pressable>
              }
            </View>
          </View>

          {quotes.length === 0 ? <View style={styles.stateCard}><MaterialCommunityIcons name="compare-horizontal" size={32} color="#9AA1AA"/><Text style={styles.stateTitle}>No quotations received</Text><Text style={styles.stateText}>Suppliers have not submitted offers for this request yet.</Text></View> :
            quotes.map(quote => {
              const isSelected = selectedQuoteId === quote.id;
              const best = quote.id === bestValueId;
              const fastest = quote.id === fastestId && quotes.length > 1;
              const price = unitPrice(quote, activeRfq.targetQuantity);
              return (
                <Pressable key={quote.id} onPress={() => setSelectedQuoteId(quote.id)} style={[styles.quoteCard,isSelected&&styles.quoteCardSelected]}>
                  <View style={styles.quoteTop}>
                    {best ? <View style={styles.bestBadge}><MaterialCommunityIcons name="check-decagram" size={19} color="#5314B8"/><Text style={styles.bestBadgeText}>BEST VALUE RATING</Text></View> :
                    fastest ? <View style={styles.fastBadge}><MaterialCommunityIcons name="lightning-bolt" size={18} color="#9A6500"/><Text style={styles.fastBadgeText}>FASTEST LEAD TIME</Text></View> :
                    <View style={styles.emptyBadge}/>}
                    <MaterialCommunityIcons name={isSelected?'radiobox-marked':'radiobox-blank'} size={23} color={isSelected?'#1683D8':'#A3AAB4'}/>
                  </View>
                  <Text style={styles.supplierName}>{quote.supplier?.name || 'Verified Supplier'}</Text>
                  <Text style={styles.supplierLocation}>{[quote.supplier?.city,'India'].filter(Boolean).join(', ')}</Text>
                  <View style={styles.pricePanel}>
                    <View style={styles.priceLine}><Text style={styles.unitPrice}>{money(price,quote.currency)}</Text><Text style={styles.perPiece}> / piece</Text></View>
                    <Text style={styles.totalPrice}>{money(Number(quote.totalAmount),quote.currency)} Total</Text>
                  </View>
                  <View style={styles.specRows}>
                    <View style={styles.specRow}><Text style={styles.specLabel}>Bulk Production</Text><Text style={styles.specValue}>{quote.leadTimeDays} Days</Text></View>
                    <View style={styles.specRow}><Text style={styles.specLabel}>Pre-Prod Sample</Text><Text style={styles.specValue}>{quote.sampleLeadDays || 7} Days</Text></View>
                    <View style={styles.specRow}><Text style={styles.specLabel}>Fabric Spec</Text><Text numberOfLines={1} style={styles.specValueFlex}>{activeRfq.fabricSpec || 'As per RFQ'}</Text></View>
                    <View style={styles.specRow}><Text style={styles.specLabel}>Payment Terms</Text><Text numberOfLines={2} style={styles.specValueFlex}>{quote.terms || 'To be mutually agreed'}</Text></View>
                    {quote.moq ? <View style={styles.specRow}><Text style={styles.specLabel}>Minimum Order</Text><Text style={styles.specValue}>{Number(quote.moq).toLocaleString('en-IN')} pcs</Text></View> : null}
                    {Number(quote.sampleCost || 0) > 0 ? <View style={styles.specRow}><Text style={styles.specLabel}>Sample Cost</Text><Text style={styles.specValue}>{money(quote.sampleCost,quote.currency)}</Text></View> : null}
                  </View>
                  {quote.status === 'ACCEPTED' ? <View style={styles.acceptedBanner}><MaterialCommunityIcons name="check-decagram" size={20} color="#087653"/><Text style={styles.acceptedText}>Quote Accepted • PO Issued</Text></View> :
                   quote.status === 'REJECTED' ? <View style={styles.rejectedBanner}><Text style={styles.rejectedText}>Quotation Not Selected</Text></View> :
                   <View style={styles.quoteStatus}><Text style={styles.quoteStatusText}>{quote.status.replaceAll('_',' ')}</Text></View>}
                </Pressable>
              );
            })
          }
        </>}
      </ScrollView>

      <AppBottomNav role="BUYER" activeSection="offers" onNavigate={navigate} onLayout={e => setBottomHeight(e.nativeEvent.layout.height)} />



      <Modal visible={rfqPickerOpen} transparent animationType="slide" onRequestClose={()=>setRfqPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={()=>setRfqPickerOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={()=>{}}>
            <View style={styles.dragHandle}/>
            <View style={styles.pickerHeader}><Text style={styles.pickerTitle}>Select Buyer Request</Text><Pressable onPress={()=>setRfqPickerOpen(false)}><MaterialCommunityIcons name="close" size={23} color="#737B87"/></Pressable></View>
            <FlatList
              data={rfqs}
              keyExtractor={r => r.id}
              style={{ flexGrow: 0, flexShrink: 1, maxHeight: 340 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: r }) => <Pressable style={styles.pickerOption} accessibilityRole="radio" accessibilityState={{ checked: r.id === activeRfqId }} onPress={() => { setActiveRfqId(r.id); setSelectedQuoteId(r.quotations?.find(q => q.status === 'ACCEPTED')?.id || r.quotations?.[0]?.id || ''); setRfqPickerOpen(false); }}><View style={{ flex: 1 }}><Text style={styles.pickerOptionTitle}>{r.title}</Text><Text style={styles.pickerOptionMeta}>{r.quotations?.length || 0} quotations · {r.status}</Text></View><MaterialCommunityIcons name={r.id === activeRfqId ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={r.id === activeRfqId ? PURPLE : ui.muted}/></Pressable>}
              ListEmptyComponent={<Text style={styles.pickerOptionMeta}>No requests available.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  header:{minHeight:64,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:'#E9EAF0',paddingHorizontal:14,paddingBottom:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  headerIcon:{width:40,height:42,alignItems:'center',justifyContent:'center'},
  logo:{width:158,height:40,flex:1,marginHorizontal:5},
  headerActions:{flexDirection:'row',alignItems:'center',gap:8},
  headerCircle:{width:38,height:38,borderRadius:19,backgroundColor:ui.accentSoft,alignItems:'center',justifyContent:'center'},
  badge:{position:'absolute',right:-1,top:-3,width:19,height:19,borderRadius:10,backgroundColor:'#D92D36',alignItems:'center',justifyContent:'center'},
  badgeText:{fontSize:10,fontWeight: '700',color:ui.surface},
  content:{padding:16,paddingBottom:24,gap:16,width:'100%',maxWidth:840,alignSelf:'center'},
  contextCard:{backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:'#EAEBEF',padding:18,elevation: 0,shadowColor:'#1D2433',shadowOpacity: 0,shadowRadius:6,shadowOffset:{width:0,height:2}},
  contextTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  contextPills:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8},
  rfqPill:{overflow:'hidden',backgroundColor:'#F0E5FF',color:'#5314B8',fontSize: 13,fontWeight: '700',paddingHorizontal:10,paddingVertical:7,borderRadius:20},
  quoteCountPill:{overflow:'hidden',backgroundColor:'#EAFBF3',color:'#16815D',borderWidth:1,borderColor:'#B8EED8',fontSize: 12,fontWeight: '700',paddingHorizontal:10,paddingVertical:7,borderRadius:20},
  rfqSelect:{minHeight:42,borderWidth:1,borderColor:'#E1E3E8',borderRadius:22,marginTop:12,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  rfqSelectText:{flex:1,fontSize:13,fontWeight:'700',color:'#333B47'},
  rfqTitle:{fontSize:21,fontWeight: '700',color:ui.ink,marginTop:13},
  rfqDescription:{fontSize:14,color:ui.muted,lineHeight:23,marginTop:7},
  contextActions:{flexDirection:'row',gap:9,marginTop:16},
  backRequestsButton:{flex:1,minHeight:50,borderRadius:13,borderWidth:1,borderColor:'#DADDE3',backgroundColor:ui.surface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:7},
  backRequestsText:{fontSize: 13,fontWeight: '700',color:ui.ink,flexShrink:1,textAlign:'center'},
  viewPoButton:{flex:1,minHeight:50,borderRadius:13,backgroundColor:'#4B00B8',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:8},
  viewPoText:{fontSize: 13,fontWeight: '700',color:ui.surface,flexShrink:1,textAlign:'center'},
  quoteCard:{backgroundColor:ui.surface,borderWidth:1,borderColor:'#E5E1EB',borderRadius:16,padding:17,elevation: 0,shadowColor:'#1D2433',shadowOpacity: 0,shadowRadius:7,shadowOffset:{width:0,height:2}},
  quoteCardSelected:{borderColor:'#6B2BC1',borderWidth:1.5,elevation: 0,shadowOpacity: 0},
  quoteTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:32,marginBottom:12},
  bestBadge:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#F0E3FF',borderRadius:20,paddingHorizontal:10,paddingVertical:8},
  bestBadgeText:{fontSize: 12,fontWeight: '700',color:'#5720A8'},
  fastBadge:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FFF4D9',borderRadius:20,paddingHorizontal:10,paddingVertical:8},
  fastBadgeText:{fontSize: 12,fontWeight: '700',color:'#946200'},
  emptyBadge:{height:30},
  supplierName:{fontSize:18,fontWeight: '700',color:ui.ink},
  supplierLocation:{fontSize:13,color:ui.muted,marginTop:4},
  pricePanel:{backgroundColor:'#E9F4FF',borderRadius:15,padding:14,marginTop:17,marginBottom:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  priceLine:{flexDirection:'row',alignItems:'baseline',flexShrink:1},
  unitPrice:{fontSize:25,fontWeight: '700',color:'#5314B8'},
  perPiece:{fontSize: 13,color:ui.muted},
  totalPrice:{fontSize: 13,fontWeight: '700',color:ui.ink,flexShrink:0},
  specRows:{gap:0},
  specRow:{minHeight:46,borderBottomWidth:1,borderBottomColor:ui.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingVertical:9},
  specLabel:{fontSize:13,color:ui.muted,flex:1},
  specValue:{fontSize:13,fontWeight: '700',color:ui.ink,textAlign:'right',flexShrink:0},
  specValueFlex:{fontSize: 13,fontWeight:'700',color:ui.ink,textAlign:'right',flex:1},
  acceptedBanner:{minHeight:48,marginTop:16,borderRadius:14,backgroundColor:'#E9FBF2',borderWidth:1,borderColor:'#B7EED4',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:10},
  acceptedText:{fontSize:13,fontWeight: '700',color:'#087653'},
  rejectedBanner:{marginTop:15,padding:13,backgroundColor:'#FFF1F1',borderRadius:12,alignItems:'center'},
  rejectedText:{fontSize:13,fontWeight: '700',color:'#B42318'},
  quoteStatus:{marginTop:15,alignSelf:'flex-start',backgroundColor:'#F3F4F6',borderRadius:12,paddingHorizontal:12,paddingVertical:8},
  quoteStatusText:{fontSize: 12,fontWeight: '700',color:'#586170'},
  stateCard:{backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:ui.border,padding:24,alignItems:'center',gap:9},
  stateTitle:{fontSize:16,fontWeight: '700',color:ui.ink},
  stateText:{fontSize:13,color:'#737B87',textAlign:'center',lineHeight:19},
  retry:{backgroundColor:ui.accentSoft,paddingHorizontal:18,paddingVertical:10,borderRadius:11,marginTop:3},
  retryText:{fontSize:13,fontWeight: '700',color:PURPLE},
  primaryButton:{marginTop:8,backgroundColor:PURPLE,borderRadius:12,paddingHorizontal:18,paddingVertical:12},
  primaryButtonText:{fontSize:13,fontWeight: '700',color:ui.surface},
  bottomNav:{minHeight:75,backgroundColor:ui.surface,borderTopWidth:1,borderTopColor:'#E6E8ED',paddingTop:7,paddingHorizontal:5,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
  navItem:{minWidth:57,minHeight:58,borderRadius:16,alignItems:'center',justifyContent:'center',paddingHorizontal:6,paddingVertical:4,gap:2},
  navItemActive:{backgroundColor:ui.accentSoft},
  navLabel:{fontSize:10,color:ui.muted,fontWeight:'600'},
  navLabelActive:{color:PURPLE,fontWeight: '700'},
  drawerLayer:{position:'absolute',left:0,right:0,zIndex:30,flexDirection:'row'},
  drawer:{width:'68%',maxWidth:320,backgroundColor:ui.surface,paddingTop:18,paddingHorizontal:14,elevation: 0,shadowColor:'#000',shadowOpacity: 0,shadowRadius:12,shadowOffset:{width:3,height:0}},
  drawerBackdrop:{flex:1,backgroundColor:'rgba(13,10,22,.38)'},
  drawerItem:{minHeight:49,borderRadius:12,marginBottom:3,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:14},
  drawerItemActive:{backgroundColor:PURPLE},
  drawerText:{fontSize:15,fontWeight:'600',color:'#4B515B'},
  drawerTextActive:{color:ui.surface,fontWeight: '700'},
  modalBackdrop:{flex:1,backgroundColor:'rgba(13,10,22,.45)',justifyContent:'flex-end'},
  pickerSheet:{backgroundColor:ui.surface,borderTopLeftRadius:25,borderTopRightRadius:25,paddingHorizontal:20,paddingTop:12,paddingBottom:28,maxHeight:'75%'},
  dragHandle:{width:45,height:5,borderRadius:3,backgroundColor:'#D1D5DB',alignSelf:'center',marginBottom:17},
  pickerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:10},
  pickerTitle:{fontSize:18,fontWeight: '700',color:ui.ink},
  pickerOption:{minHeight:58,borderBottomWidth:1,borderBottomColor:'#F0F1F3',flexDirection:'row',alignItems:'center',gap:12},
  pickerOptionTitle:{fontSize:14,fontWeight: '700',color:'#303744'},
  pickerOptionMeta:{fontSize: 12,color:ui.muted,marginTop:3},
});
