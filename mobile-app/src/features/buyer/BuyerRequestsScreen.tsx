import { ui } from '@/theme/ui';

import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiRequest } from '@/services/api';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

type Rfq = {
  id: string; title: string; status: string; targetQuantity: number;
  targetDate?: string | null; createdAt?: string; garmentType?: string;
  fabricSpec?: string; description?: string; targetPrice?: number;
  items?: { id?: string; name?: string; quantity?: number; unit?: string; description?: string }[];
  quotations?: { id: string; status: string; totalAmount?: number; supplier?: { name?: string } }[];
};

const STATUSES = [
  { label: 'All Status', value: 'ALL' },
  { label: 'Quotes Received', value: 'QUOTES_RECEIVED' },
  { label: 'Open (0 Quotes)', value: 'OPEN' },
  { label: 'Awarded', value: 'AWARDED' },
  { label: 'Draft', value: 'DRAFT' },
];
const SORTS = [
  { label: 'Newest First', value: 'NEWEST' },
  { label: 'Oldest First', value: 'OLDEST' },
  { label: 'Quantity (High to Low)', value: 'QTY_DESC' },
  { label: 'Quantity (Low to High)', value: 'QTY_ASC' },
];

function formatDate(value?: string | null) {
  if (!value) return 'Flexible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Flexible';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function rfqCode(id: string) { return `RFQ #RFQ-${String(id || '').slice(-4).toUpperCase()}`; }
function statusOf(rfq: Rfq) {
  const count = rfq.quotations?.length || 0;
  if (rfq.status === 'AWARDED') return 'Awarded';
  if (rfq.status === 'OPEN' && count > 0) return 'Quotes Received';
  if (rfq.status === 'OPEN') return 'Open';
  if (rfq.status === 'DRAFT') return 'Draft';
  return rfq.status || 'Unknown';
}

export default function BuyerRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('NEWEST');
  const [picker, setPicker] = useState<'status' | 'sort' | null>(null);
  const [selected, setSelected] = useState<Rfq | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [postModalVisible, setPostModalVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomNavHeight, setBottomNavHeight] = useState(0);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      const member = raw ? JSON.parse(raw) : null;
      const orgId = member?.organizationId || member?.organization?.id;
      if (!orgId) throw new Error('Buyer organization membership was not found. Please sign in again.');
      const data = await apiGet<Rfq[]>(`/rfqs?organizationId=${encodeURIComponent(orgId)}`);
      setRfqs(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => { void load(true); }, 25000);
    return () => clearInterval(interval);
  }, [load]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rfqs.filter(r => {
      const matches = !q || [r.id, r.title, r.garmentType, r.description].some(v => String(v || '').toLowerCase().includes(q));
      if (!matches) return false;
      const count = r.quotations?.length || 0;
      if (status === 'QUOTES_RECEIVED') return r.status === 'OPEN' && count > 0;
      if (status === 'OPEN') return r.status === 'OPEN' && count === 0;
      if (status === 'AWARDED' || status === 'DRAFT') return r.status === status;
      return true;
    }).sort((a,b) => {
      if (sort === 'OLDEST') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      if (sort === 'QTY_DESC') return (b.targetQuantity || 0) - (a.targetQuantity || 0);
      if (sort === 'QTY_ASC') return (a.targetQuantity || 0) - (b.targetQuantity || 0);
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [rfqs, search, status, sort]);

  const deleteRfq = (rfq: Rfq) => {
    Alert.alert('Delete request?', `Are you sure you want to delete "${rfq.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await apiRequest(`/rfqs/${encodeURIComponent(rfq.id)}`, { method: 'DELETE' });
          setRfqs(prev => prev.filter(item => item.id !== rfq.id));
          setMenuId(null);
          if (selected?.id === rfq.id) setSelected(null);
        } catch (e) { Alert.alert('Unable to delete', e instanceof Error ? e.message : 'Please try again.'); }
      }},
    ]);
  };

  const navigate = (section: string) => {
    if (section === 'home') router.replace('/workspace?role=BUYER' as any);
    else router.replace({ pathname: '/buyer/[section]', params: { section } } as any);
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        role="BUYER"
        activeSection="requests"
        onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}
      />

      <FlatList
        data={loading || error ? [] : visible}
        keyExtractor={rfq => rfq.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={PURPLE} />}
        ListHeaderComponent={<>
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>My Requests</Text>
          <Text style={styles.hubPill}>Buyer Sourcing Hub</Text>
        </View>
        <Text style={styles.subtitle}>Create and manage your production requests (RFQs), compare supplier quotes, and move to order.</Text>


        <Pressable style={styles.postButton} onPress={() => setPostModalVisible(true)}>
          <MaterialCommunityIcons name="plus" size={21} color="#FFFFFF" />
          <Text style={styles.postButtonText}>Post New Request</Text>
        </Pressable>

        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={24} color="#929BA6" />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search by RFQ ID, title or product..." placeholderTextColor={ui.muted} style={styles.searchInput} autoCapitalize="none" />
          {!!search && <Pressable onPress={() => setSearch('')}><MaterialCommunityIcons name="close-circle" size={19} color="#929BA6" /></Pressable>}
        </View>

        <View style={styles.filtersRow}>
          <Pressable style={styles.filterButton} onPress={() => setPicker('status')}>
            <MaterialCommunityIcons name="filter-outline" size={21} color="#68727F" />
            <Text numberOfLines={1} style={styles.filterText}>{STATUSES.find(x => x.value === status)?.label || 'All Status'}</Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color="#929BA6" />
          </Pressable>
          <Pressable style={styles.filterButton} onPress={() => setPicker('sort')}>
            <MaterialCommunityIcons name="swap-vertical" size={21} color="#68727F" />
            <Text numberOfLines={1} style={styles.filterText}>{SORTS.find(x => x.value === sort)?.label || 'Newest First'}</Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color="#929BA6" />
          </Pressable>
        </View>
        </>}
        ListEmptyComponent=        {loading ? (
          <View style={styles.stateCard}><ActivityIndicator color={PURPLE} /><Text style={styles.stateText}>Loading your requests...</Text></View>
        ) : error ? (
          <View style={styles.stateCard}><MaterialCommunityIcons name="cloud-alert-outline" size={30} color="#8B929C" /><Text style={styles.stateTitle}>Couldn't load requests</Text><Text style={styles.stateText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
        ) : (
          <View style={styles.stateCard}><MaterialCommunityIcons name="file-document-outline" size={26} color="#9AA1AA" /><Text style={styles.stateTitle}>No requests found</Text><Text style={styles.stateText}>{search || status !== 'ALL' ? 'Try changing your search or filters.' : 'You have not posted any production requests yet.'}</Text></View>)}
        renderItem={({ item: rfq }) => {
          const label = statusOf(rfq);
          const count = rfq.quotations?.length || 0;
          const awardedTo = rfq.quotations?.find(q => q.status === 'ACCEPTED' || q.status === 'AWARDED')?.supplier?.name;
          return (
            <View key={rfq.id} style={styles.rfqCard}>
              <View style={styles.cardTop}>
                <View style={styles.pillsRow}>
                  <Text style={styles.rfqPill}>{rfqCode(rfq.id)}</Text>
                  <Text style={[styles.statusPill, (label === 'Awarded' || label === 'Quotes Received') ? styles.greenPill : label === 'Open' ? styles.amberPill : styles.grayPill]}>{label}</Text>
                </View>
                <Pressable style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={`More actions for ${rfq.title}`} accessibilityState={{ expanded: menuId === rfq.id }} onPress={() => setMenuId(menuId === rfq.id ? null : rfq.id)}><MaterialCommunityIcons name="dots-vertical" size={23} color="#929BA6" /></Pressable>
              </View>
              {menuId === rfq.id && (
                <View style={styles.menuPopup}>
                  <Pressable style={styles.menuAction} onPress={() => { setSelected(rfq); setMenuId(null); }}><MaterialCommunityIcons name="eye-outline" size={18} color="#4B5563" /><Text style={styles.menuText}>View Details</Text></Pressable>
                  <Pressable style={styles.menuAction} onPress={() => deleteRfq(rfq)}><MaterialCommunityIcons name="delete-outline" size={18} color="#D92D20" /><Text style={[styles.menuText,{color:'#D92D20'}]}>Delete Request</Text></Pressable>
                </View>
              )}
              <Text style={styles.rfqTitle}>{rfq.title}</Text>
              <View style={styles.metaRow}>
                <View style={styles.metaItem}><MaterialCommunityIcons name="layers-outline" size={21} color="#9AA1AA" /><Text style={styles.metaText}>Qty: {Number(rfq.targetQuantity || 0).toLocaleString('en-IN')} {rfq.items?.[0]?.unit || 'pieces'}</Text></View>
                <View style={styles.metaItem}><MaterialCommunityIcons name="calendar-month-outline" size={21} color="#9AA1AA" /><Text style={styles.metaText}>Delivery: {formatDate(rfq.targetDate)}</Text></View>
              </View>
              <View style={styles.cardDivider} />
              {label === 'Awarded' ? (
                <View style={styles.bottomInfo}>
                  <View><Text style={styles.smallLabel}>Awarded To</Text><Text style={styles.infoStrong}>{awardedTo || 'Selected Supplier'}</Text></View>
                  <View style={styles.createdBlock}><Text style={styles.smallLabel}>Created On</Text><Text style={styles.infoStrong}>{formatDate(rfq.createdAt)}</Text></View>
                </View>
              ) : count > 0 ? (
                <View style={styles.bottomInfo}>
                  <View><Text style={styles.smallLabel}>Quotes Received</Text><Text style={styles.quoteCount}>{count}</Text><Pressable onPress={() => router.push({ pathname: '/buyer/[section]', params: { section: 'offers', rfqId: rfq.id } } as any)}><Text style={styles.linkText}>View Quotes</Text></Pressable></View>
                  <View style={styles.createdBlock}><Text style={styles.smallLabel}>Created On</Text><Text style={styles.infoStrong}>{formatDate(rfq.createdAt)}</Text></View>
                </View>
              ) : (
                <View style={styles.bottomInfo}>
                  <View><Text style={styles.smallLabel}>Created On</Text><Text style={styles.infoStrong}>{formatDate(rfq.createdAt)}</Text></View>
                  <View style={styles.createdBlock}><Text style={styles.smallLabel}>Quotes Received</Text><Text style={styles.quoteCount}>0</Text></View>
                </View>
              )}
              <View style={styles.actionsRow}>
                {count > 0 && label !== 'Awarded' && <Pressable style={styles.compareButton} onPress={() => router.push({ pathname: '/buyer/[section]', params: { section: 'offers', rfqId: rfq.id } } as any)}><MaterialCommunityIcons name="compare-horizontal" size={20} color="#FFFFFF" /><Text style={styles.compareText}>Compare Quotes</Text></Pressable>}
                <Pressable style={[styles.detailsButton, count === 0 && { flex: 1 }]} onPress={() => setSelected(rfq)}><MaterialCommunityIcons name="eye-outline" size={21} color={PURPLE} /><Text style={styles.detailsText}>View Details</Text></Pressable>
              </View>
            </View>
          );
        }}
      />

      <AppBottomNav role="BUYER" activeSection="requests" onNavigate={navigate} onLayout={event => setBottomNavHeight(event.nativeEvent.layout.height)} />

      <CreateRfqModal
        visible={postModalVisible}
        onClose={() => setPostModalVisible(false)}
        onSuccess={() => { setPostModalVisible(false); void load(true); }}
      />



      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.pickerSheet} onPress={() => {}}>
            <View style={styles.dragHandle} />
            <View style={styles.pickerHeader}><Text style={styles.pickerTitle}>{picker === 'status' ? 'Filter by Status' : 'Sort Requests'}</Text><Pressable onPress={() => setPicker(null)}><MaterialCommunityIcons name="close" size={23} color="#737B87" /></Pressable></View>
            {(picker === 'status' ? STATUSES : SORTS).map(option => {
              const current = picker === 'status' ? status : sort;
              return <Pressable key={option.value} style={styles.optionRow} onPress={() => { if (picker === 'status') setStatus(option.value); else setSort(option.value); setPicker(null); }}><Text style={[styles.optionText,current === option.value && styles.optionActive]}>{option.label}</Text><MaterialCommunityIcons name={current === option.value ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={current === option.value ? PURPLE : '#A1A1AA'} /></Pressable>;
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.detailBackdrop}>
          <View style={[styles.detailSheet,{paddingBottom:Math.max(insets.bottom,16)}]}>
            <View style={styles.pickerHeader}><View style={{flex:1}}><Text style={styles.detailTitle}>{selected?.title || 'RFQ Details'}</Text><Text style={styles.detailSubtitle}>{selected ? rfqCode(selected.id) : ''} · Created {selected ? formatDate(selected.createdAt) : ''}</Text></View><Pressable onPress={() => setSelected(null)}><MaterialCommunityIcons name="close" size={21} color="#8A929E" /></Pressable></View>
            {selected && <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{gap:13,paddingTop:14}}>
              <View style={styles.detailStatus}><Text style={styles.rfqPill}>{rfqCode(selected.id)}</Text><Text style={[styles.statusPill,styles.greenPill]}>{statusOf(selected)}</Text></View>
              <View style={styles.detailGrid}>
                <View style={styles.detailStat}><Text style={styles.smallLabel}>Target Quantity</Text><Text style={styles.infoStrong}>{Number(selected.targetQuantity || 0).toLocaleString('en-IN')} {selected.items?.[0]?.unit || 'pieces'}</Text></View>
                <View style={styles.detailStat}><Text style={styles.smallLabel}>Target Delivery</Text><Text style={styles.infoStrong}>{formatDate(selected.targetDate)}</Text></View>
              </View>
              {!!selected.garmentType && <View><Text style={styles.detailLabel}>PRODUCT CATEGORY / TYPE</Text><Text style={styles.detailValue}>{selected.garmentType}</Text></View>}
              {!!selected.fabricSpec && <View><Text style={styles.detailLabel}>FABRIC & MATERIAL SPEC</Text><Text style={styles.detailValue}>{selected.fabricSpec}</Text></View>}
              {!!selected.description && <View><Text style={styles.detailLabel}>PRODUCTION SPECIFICATIONS & NOTES</Text><Text style={styles.detailValue}>{selected.description}</Text></View>}
              {!!selected.items?.length && <View><Text style={styles.detailLabel}>REQUEST ITEMS</Text>{selected.items.map((item,i)=><View key={item.id || i} style={styles.itemRow}><Text style={styles.detailValue}>{item.name || item.description || 'Garment item'}</Text><Text style={styles.smallLabel}>{Number(item.quantity || 0).toLocaleString('en-IN')} {item.unit || 'pieces'}</Text></View>)}</View>}
              {!!selected.quotations?.length && <View><Text style={styles.detailLabel}>RECEIVED SUPPLIER QUOTES ({selected.quotations.length})</Text>{selected.quotations.map(q=><View key={q.id} style={styles.itemRow}><Text style={styles.detailValue}>{q.supplier?.name || 'Textile Supplier'}</Text><Text style={styles.infoStrong}>₹{Number(q.totalAmount || 0).toLocaleString('en-IN')}</Text></View>)}</View>}
            </ScrollView>}
            <View style={styles.detailFooter}><Pressable style={styles.closeDetail} onPress={() => setSelected(null)}><Text style={styles.closeDetailText}>Close</Text></Pressable>{!!selected?.quotations?.length && <Pressable style={styles.compareButton} onPress={() => { const id=selected.id; setSelected(null); router.push({pathname:'/buyer/[section]',params:{section:'offers',rfqId:id}} as any); }}><MaterialCommunityIcons name="compare-horizontal" size={19} color="#fff"/><Text style={styles.compareText}>Compare Quotes</Text></Pressable>}</View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  header:{minHeight:58,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:ui.border,paddingHorizontal:14,paddingBottom:5,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6},
  headerIcon:{width:30,alignItems:'flex-start',justifyContent:'center'},
  logo:{height:34,width:170,flexShrink:1},
  headerActions:{flexDirection:'row',alignItems:'center',gap:9},
  headerCircle:{width:38,height:38,borderRadius:19,backgroundColor:ui.accentSoft,alignItems:'center',justifyContent:'center',position:'relative'},
  badge:{position:'absolute',right:-1,top:-4,width:22,height:22,borderRadius:11,backgroundColor:'#D62828',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:ui.surface},
  badgeText:{fontSize: 12,fontWeight: '700',color:ui.surface},
  content:{paddingHorizontal:16,paddingTop:16,paddingBottom:20,gap:16,width:'100%',maxWidth:840,alignSelf:'center'},
  titleRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:9},
  pageTitle:{fontSize:22,fontWeight: '700',color:ui.ink,letterSpacing:-.7},
  hubPill:{fontSize: 13,fontWeight: '700',color:ui.accent,backgroundColor:'#F3EDFF',paddingHorizontal:11,paddingVertical:6,borderRadius:15,overflow:'hidden'},
  subtitle:{fontSize:14,lineHeight:21,color:'#707986',marginTop:-8},
  postButton:{alignSelf:'flex-start',minHeight:49,paddingHorizontal:17,borderRadius:14,backgroundColor:PURPLE,flexDirection:'row',alignItems:'center',gap:8,marginTop:1,marginBottom:5,elevation: 0},
  postButtonText:{fontSize:15,fontWeight: '700',color:ui.surface},
  searchBox:{minHeight:53,backgroundColor:ui.surface,borderWidth:1,borderColor:'#E4E6EB',borderRadius:12,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9},
  searchInput:{flex:1,minWidth:0,fontSize:14,color:'#252B35',paddingVertical:10},
  filtersRow:{flexDirection:'row',gap:9},
  filterButton:{flex:1,minWidth:0,minHeight:51,backgroundColor:ui.surface,borderWidth:1,borderColor:'#E4E6EB',borderRadius:12,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:6},
  filterText:{flex:1,minWidth:0,fontSize: 13,fontWeight:'700',color:'#303744'},
  rfqCard:{backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:ui.border,padding:15,gap:12,shadowColor:ui.ink,shadowOpacity: 0,shadowRadius:6,shadowOffset:{width:0,height:2},elevation: 0},
  cardTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  pillsRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:7,flex:1},
  rfqPill:{fontSize: 13,fontWeight: '700',color:PURPLE,backgroundColor:'#F5F0FF',paddingHorizontal:10,paddingVertical:6,borderRadius:15,overflow:'hidden'},
  statusPill:{fontSize: 12,fontWeight: '700',paddingHorizontal:10,paddingVertical:6,borderRadius:15,overflow:'hidden'},
  greenPill:{color:'#16804A',backgroundColor:'#E9FAF1'},
  amberPill:{color:'#9A5B08',backgroundColor:'#FFF7E6'},
  grayPill:{color:'#525B67',backgroundColor:'#F0F1F3'},
  rfqTitle:{fontSize:18,fontWeight: '700',color:'#151923',marginTop:1},
  metaRow:{flexDirection:'row',flexWrap:'wrap',gap:13},
  metaItem:{flexDirection:'row',alignItems:'center',gap:6,flexShrink:1},
  metaText:{fontSize:13,color:'#697381',flexShrink:1},
  cardDivider:{height:1,backgroundColor:'#F0F1F3'},
  bottomInfo:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},
  smallLabel:{fontSize: 12,color:ui.muted},
  infoStrong:{fontSize:14,fontWeight: '700',color:ui.ink,marginTop:3},
  createdBlock:{alignItems:'flex-end'},
  quoteCount:{fontSize:20,fontWeight: '700',color:ui.ink,marginTop:2},
  linkText:{fontSize:13,fontWeight: '700',color:PURPLE,marginTop:3},
  actionsRow:{flexDirection:'row',gap:9,marginTop:2},
  compareButton:{flex:1,minHeight:48,borderRadius:13,backgroundColor:PURPLE,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:8},
  compareText:{fontSize:13,fontWeight: '700',color:ui.surface},
  detailsButton:{flex:1,minHeight:48,borderRadius:13,borderWidth:1,borderColor:'#E3D9F4',backgroundColor:ui.surface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  detailsText:{fontSize:13,fontWeight: '700',color:PURPLE},
  menuPopup:{alignSelf:'flex-end',backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,borderRadius:12,padding:5,minWidth:155,elevation: 0,zIndex:5},
  menuAction:{minHeight:39,flexDirection:'row',alignItems:'center',gap:9,paddingHorizontal:8},
  menuText:{fontSize:13,fontWeight:'700',color:'#404854'},
  stateCard:{backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:ui.border,padding:24,alignItems:'center',gap:9},
  stateTitle:{fontSize:16,fontWeight: '700',color:ui.ink},
  stateText:{fontSize:13,color:'#737B87',textAlign:'center',lineHeight:19},
  retry:{backgroundColor:ui.accentSoft,paddingHorizontal:18,paddingVertical:10,borderRadius:11,marginTop:3},
  retryText:{fontSize:13,fontWeight: '700',color:PURPLE},
  bottomNav:{minHeight:75,backgroundColor:ui.surface,borderTopWidth:1,borderTopColor:'#E6E8ED',paddingTop:7,paddingHorizontal:5,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
  navItem:{minWidth:57,minHeight:58,borderRadius:16,alignItems:'center',justifyContent:'center',paddingHorizontal:6,paddingVertical:4,gap:2},
  navItemActive:{backgroundColor:ui.accentSoft},
  navLabel:{fontSize:10,color:ui.muted,fontWeight:'600'},
  navLabelActive:{color:PURPLE,fontWeight: '700'},
  pickerBackdrop:{flex:1,backgroundColor:'rgba(13,10,22,.45)',justifyContent:'flex-end'},
  pickerSheet:{backgroundColor:ui.surface,borderTopLeftRadius:25,borderTopRightRadius:25,paddingHorizontal:20,paddingTop:12,paddingBottom:28},
  dragHandle:{width:45,height:5,borderRadius:3,backgroundColor:'#D1D5DB',alignSelf:'center',marginBottom:17},
  pickerHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  pickerTitle:{fontSize:18,fontWeight: '700',color:ui.ink},
  optionRow:{minHeight:51,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#F0F1F3'},
  optionText:{fontSize:14,color:'#4B5563'},
  optionActive:{color:PURPLE,fontWeight: '700'},
  detailBackdrop:{flex:1,backgroundColor:'rgba(0,0,0,.5)',justifyContent:'center',padding:12},
  detailSheet:{maxHeight:'92%',backgroundColor:ui.surface,borderRadius:20,padding:16,overflow:'hidden'},
  detailTitle:{fontSize:18,fontWeight: '700',color:'#171B25'},
  detailSubtitle:{fontSize: 12,color:ui.muted,marginTop:4},
  detailStatus:{flexDirection:'row',gap:8,alignItems:'center'},
  detailGrid:{flexDirection:'row',gap:9},
  detailStat:{flex:1,backgroundColor:ui.canvas,borderRadius:12,padding:11},
  detailLabel:{fontSize: 12,fontWeight: '700',color:ui.muted,letterSpacing:.4},
  detailValue:{fontSize:13,color:'#303744',lineHeight:19,marginTop:6,backgroundColor:'#F8F9FB',borderRadius:11,padding:11},
  itemRow:{padding:11,borderWidth:1,borderColor:'#E8E9ED',borderRadius:11,marginTop:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},
  detailFooter:{flexDirection:'row',gap:9,paddingTop:12,borderTopWidth:1,borderTopColor:'#F0F1F3',marginTop:10},
  closeDetail:{minHeight:45,paddingHorizontal:18,borderRadius:12,backgroundColor:'#F1F2F4',alignItems:'center',justifyContent:'center'},
  closeDetailText:{fontSize:13,fontWeight: '700',color:'#505966'},
  drawerLayer:{position:'absolute',left:0,right:0,zIndex:30,flexDirection:'row'},
  drawer:{width:'68%',maxWidth:320,backgroundColor:ui.surface,paddingTop:18,paddingHorizontal:14,elevation: 0,shadowColor:'#000',shadowOpacity: 0,shadowRadius:12,shadowOffset:{width:3,height:0}},
  drawerBackdrop:{flex:1,backgroundColor:'rgba(13,10,22,.38)'},
  drawerItem:{minHeight:49,borderRadius:12,marginBottom:3,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:14},
  drawerItemActive:{backgroundColor:PURPLE},
  drawerText:{fontSize:15,fontWeight:'600',color:'#4B515B'},
  drawerTextActive:{color:ui.surface,fontWeight: '700'},
});