import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet } from '@/services/api';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';
import { AppHeader } from '@/components/AppHeader';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';
const FILTERS = [
  { label: 'All Categories', value: 'All' },
  { label: 'Garment', value: 'Garment' },
  { label: 'Fabric', value: 'Fabric' },
  { label: 'Trims', value: 'Trims' },
  { label: 'Job Work', value: 'Job work' },
];

type Supplier = {
  id: string;
  organizationId: string;
  name: string;
  businessType: string;
  city: string;
  address?: string;
  verificationStatus: string;
  moq: string;
  capacity: string;
  tags: string;
  description: string;
  catalog: { name: string; price: string; moq?: number }[];
};

function parseSupplier(row: any): Supplier {
  const org = row?.organization || {};
  const description = String(row?.description || '');
  const moqMatch = description.match(/MOQ:\s*([^|]+)/i);
  const capacityMatch = description.match(/Capacity:\s*([^|]+)/i);
  const firstCatalog = Array.isArray(row?.catalogItems) ? row.catalogItems[0] : undefined;
  const categories = Array.isArray(row?.categories) ? row.categories.map((item: any) => item.category).filter(Boolean) : [];
  const catalog = Array.isArray(row?.catalogItems) ? row.catalogItems.map((item: any) => ({
    name: item.name || 'Catalog item',
    price: item.unitPrice ? `₹${Number(item.unitPrice).toFixed(0)}` : 'Quote required',
    moq: item.minOrderQty,
  })) : [];

  return {
    id: String(row?.id || org.id || ''),
    organizationId: String(row?.organizationId || org.id || ''),
    name: org.name || 'Textile Partner',
    businessType: org.businessType || categories[0] || 'Manufacturer',
    city: org.city || 'India',
    address: org.address || undefined,
    verificationStatus: row?.verificationStatus || org.verificationStatus || 'PENDING',
    moq: moqMatch?.[1]?.trim() || (firstCatalog?.minOrderQty ? `${firstCatalog.minOrderQty} pcs` : 'Flexible'),
    capacity: capacityMatch?.[1]?.trim() || (row?.productionCapacity ? `${Number(row.productionCapacity).toLocaleString('en-IN')} pcs / month` : 'Flexible'),
    tags: categories.slice(0, 3).join(' · ') || 'Garment manufacturing',
    description: description.split('|')[0].trim() || 'Registered business in the STITCHGRID supplier network.',
    catalog,
  };
}

function SupplierCard({ supplier, onPress }: { supplier: Supplier; onPress: () => void }) {
  const approved = supplier.verificationStatus === 'APPROVED';
  return (
    <View style={styles.supplierCard}>
      <View style={styles.cardTopRow}>
        <View style={[styles.statusPill, approved ? styles.verifiedPill : styles.reviewPill]}>
          <MaterialCommunityIcons name={approved ? 'check-circle-outline' : 'information-outline'} size={17} color={approved ? '#16804A' : '#8B4C08'} />
          <Text style={[styles.statusText, { color: approved ? '#16804A' : '#8B4C08' }]}>{approved ? 'Verified' : 'Under review'}</Text>
        </View>
        <Text numberOfLines={1} style={styles.categoryPill}>{supplier.businessType}</Text>
      </View>

      <View style={styles.supplierInfo}>
        <View style={styles.factoryIcon}>
          <MaterialCommunityIcons name="factory" size={22} color={PURPLE} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.supplierName}>{supplier.name}</Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={19} color="#9AA4B0" />
            <Text numberOfLines={1} style={styles.locationText}>{supplier.city}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statColumn}>
          <Text style={styles.statLabel}>Minimum order</Text>
          <Text numberOfLines={1} style={styles.statValue}>{supplier.moq}</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.statLabel}>Capacity / range</Text>
          <Text numberOfLines={1} style={styles.statValue}>{supplier.capacity}</Text>
        </View>
        <Pressable onPress={onPress} style={styles.profileButton}>
          <Text style={styles.profileButtonText}>View supplier profile</Text>
          <MaterialCommunityIcons name="arrow-right" size={22} color={PURPLE} />
        </Pressable>
      </View>
      <View style={styles.tagsRow}>
        <Text numberOfLines={2} style={styles.tagsText}>{supplier.tags}</Text>
      </View>
    </View>
  );
}

export default function BuyerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingError, setRefreshingError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState('All');
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rfqModalVisible, setRfqModalVisible] = useState(false);
  const [rfqSupplier, setRfqSupplier] = useState<{ id?: string; name?: string }>({});
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [headerHeight, setHeaderHeight] = useState(0);
  const [bottomNavHeight, setBottomNavHeight] = useState(0);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setRefreshingError('');
    try {
      const params = new URLSearchParams();
      if (category !== 'All') params.append('category', category);
      if (search.trim()) params.append('q', search.trim());
      const query = params.toString();
      const data = await apiGet<any[]>(`/suppliers${query ? `?${query}` : ''}`);
      setSuppliers(Array.isArray(data) ? data.map(parseSupplier) : []);
    } catch (error) {
      setSuppliers([]);
      setRefreshingError(error instanceof Error ? error.message : 'Unable to load suppliers.');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadSuppliers(); }, 250);
    return () => clearTimeout(timer);
  }, [loadSuppliers]);

  const visibleSuppliers = useMemo(() => suppliers, [suppliers]);

  const confirmLogout = () => {
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

  const openNextPage = (tab: string) => {
    setMenuOpen(false);
    if (tab === 'Home') {
      setActiveTab('Dashboard');
      return;
    }
    const routes: Record<string, string> = {
      Requests: 'requests',
      'My Requests': 'requests',
      'My Offers': 'offers',
      Orders: 'orders',
      'My Orders': 'orders',
      'Order Tracking': 'tracking',
      Samples: 'samples',
      Chat: 'chat',
      Payments: 'payments',
      Settings: 'organization-settings',
      'Organization Settings': 'organization-settings',
    };
    const section = routes[tab];
    if (section) {
      setActiveTab(tab);
      router.push({ pathname: '/buyer/[section]', params: { section } } as any);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        role="BUYER"
        activeSection="home"
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Find a manufacturing partner.</Text>
          <Text style={styles.heroSubtitle}>Search suppliers by location, product and capability.</Text>
          <Pressable style={styles.postRfqButton} onPress={() => { setRfqSupplier({}); setRfqModalVisible(true); }}>
            <MaterialCommunityIcons name="plus" size={22} color="#FFFFFF" />
            <Text style={styles.postRfqText}>Post RFQ</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={22} color="#929BA6" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, capability or location."
              placeholderTextColor={ui.muted}
              style={styles.searchInput}
              returnKeyType="search"
              autoCapitalize="none"
            />
            {search.length > 0 && <Pressable onPress={() => setSearch('')}><MaterialCommunityIcons name="close-circle" size={20} color="#9AA1AA" /></Pressable>}
          </View>
          <Pressable style={styles.filterButton} onPress={() => { setDraftCategory(category); setFilterOpen(true); }}>
            <MaterialCommunityIcons name="tune-variant" size={21} color={PURPLE} />
          </Pressable>
        </View>

        {category !== 'All' && <View style={styles.activeFilter}><Text style={styles.activeFilterText}>{category}</Text><Pressable onPress={() => setCategory('All')}><MaterialCommunityIcons name="close-circle" size={18} color={PURPLE} /></Pressable></View>}

        {loading ? (
          <View style={{ gap: 16, paddingBottom: 20 }}>
            {[1,2,3].map(n => <View key={n} style={styles.loadingCard}><ActivityIndicator color={PURPLE} /><Text style={styles.loadingText}>Loading supplier network...</Text></View>)}
          </View>
        ) : refreshingError ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="cloud-alert-outline" size={34} color="#8A92A0" />
            <Text style={styles.emptyTitle}>Couldn't load suppliers</Text>
            <Text style={styles.emptyText}>{refreshingError}</Text>
            <Pressable onPress={() => void loadSuppliers()} style={styles.retryButton}><Text style={styles.retryText}>Try again</Text></Pressable>
          </View>
        ) : visibleSuppliers.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="factory" size={34} color="#A1A1AA" />
            <Text style={styles.emptyTitle}>No production partners found</Text>
            <Text style={styles.emptyText}>Try adjusting your search terms or category filter.</Text>
            <Pressable onPress={() => { setSearch(''); setCategory('All'); }} style={styles.retryButton}><Text style={styles.retryText}>Reset filters</Text></Pressable>
          </View>
        ) : (
          <View style={{ gap: 16, paddingBottom: 20 }}>
            {visibleSuppliers.map(supplier => <SupplierCard key={supplier.id} supplier={supplier} onPress={() => setSelectedSupplier(supplier)} />)}
          </View>
        )}
      </ScrollView>

      <AppBottomNav role="BUYER" activeSection="home" onNavigate={(section) => openNextPage(section === 'organization-settings' ? 'Settings' : section === 'chat' ? 'Chat' : section === 'orders' ? 'Orders' : section === 'requests' ? 'Requests' : 'Home')} onLayout={event => setBottomNavHeight(event.nativeEvent.layout.height)} />

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.dragHandle} />
            <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Select Category</Text><Pressable onPress={() => setFilterOpen(false)}><MaterialCommunityIcons name="close" size={23} color="#7B8490" /></Pressable></View>
            {FILTERS.map(item => {
              const active = draftCategory === item.value;
              return <Pressable key={item.value} style={styles.filterOption} onPress={() => setDraftCategory(item.value)}>
                <Text style={[styles.filterOptionText, active && { color: PURPLE, fontWeight: '800' }]}>{item.label}</Text>
                <MaterialCommunityIcons name={active ? 'checkbox-marked' : 'checkbox-blank-outline'} size={23} color={active ? PURPLE : '#A1A1AA'} />
              </Pressable>;
            })}
            <View style={styles.sheetActions}>
              <Pressable style={styles.clearButton} onPress={() => setDraftCategory('All')}><Text style={styles.clearText}>Clear</Text></Pressable>
              <Pressable style={styles.applyButton} onPress={() => { setCategory(draftCategory); setFilterOpen(false); }}><Text style={styles.applyText}>Apply</Text></Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedSupplier} transparent animationType="slide" onRequestClose={() => setSelectedSupplier(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.profileSheet}>
            <View style={styles.sheetHeader}>
              <Text numberOfLines={1} style={styles.sheetTitle}>{selectedSupplier?.name}</Text>
              <Pressable onPress={() => setSelectedSupplier(null)}><MaterialCommunityIcons name="close" size={23} color="#7B8490" /></Pressable>
            </View>
            {selectedSupplier && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileSummary}>
                  <View style={styles.factoryIcon}><MaterialCommunityIcons name="factory" size={22} color={PURPLE} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.profileName}>{selectedSupplier.name}</Text>
                    <Text style={styles.locationText}>{selectedSupplier.city}{selectedSupplier.address ? ` · ${selectedSupplier.address}` : ''}</Text>
                  </View>
                </View>
                <Text style={styles.detailHeading}>ABOUT SUPPLIER & CAPABILITIES</Text>
                <Text style={styles.description}>{selectedSupplier.description}</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailBox}><Text style={styles.statLabel}>Minimum Order (MOQ)</Text><Text style={styles.statValue}>{selectedSupplier.moq}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.statLabel}>Capacity / Range</Text><Text style={styles.statValue}>{selectedSupplier.capacity}</Text></View>
                </View>
                {!!selectedSupplier.catalog.length && <>
                  <Text style={styles.detailHeading}>VERIFIED PRODUCTION CATALOG</Text>
                  {selectedSupplier.catalog.map((item, index) => <View key={index} style={styles.catalogRow}><View style={{ flex: 1 }}><Text style={styles.catalogName}>{item.name}</Text>{!!item.moq && <Text style={styles.statLabel}>MOQ: {item.moq} units</Text>}</View><Text style={styles.catalogPrice}>{item.price}</Text></View>)}
                </>}
                <Pressable style={styles.directRfqButton} onPress={() => { const supplier = selectedSupplier; setSelectedSupplier(null); setRfqSupplier({ id: supplier.organizationId, name: supplier.name }); setRfqModalVisible(true); }}>
                  <MaterialCommunityIcons name="send" size={19} color="#fff" /><Text style={styles.directRfqText}>Send Direct RFQ to this Supplier</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <CreateRfqModal
        visible={rfqModalVisible}
        onClose={() => setRfqModalVisible(false)}
        supplierOrgId={rfqSupplier.id}
        supplierName={rfqSupplier.name}
        onSuccess={() => {
          setRfqModalVisible(false);
          router.push({ pathname: '/buyer/[section]', params: { section: 'requests' } } as any);
        }}
      />


    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas},
  header:{minHeight:70,backgroundColor:ui.surface,borderBottomWidth:1,borderBottomColor:ui.border,paddingHorizontal:14,paddingBottom:6,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:6,zIndex:2},
  headerIcon:{width:30,alignItems:'flex-start',justifyContent:'center'},
  headerLogo:{height:36,flexShrink:1},
  headerActions:{flexDirection:'row',alignItems:'center',gap:9},
  roundHeaderButton:{width:38,height:38,borderRadius:19,backgroundColor:ui.accentSoft,alignItems:'center',justifyContent:'center',position:'relative'},
  notificationBadge:{position:'absolute',right:-1,top:-4,width:25,height:25,borderRadius:13,backgroundColor:'#D62828',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:ui.surface},
  notificationText:{fontSize: 13,fontWeight: '700',color:ui.surface},
  scrollContent:{paddingHorizontal:16,paddingTop:16,paddingBottom:20,gap:16,width:'100%',maxWidth:840,alignSelf:'center'},
  hero:{backgroundColor: ui.surface, borderWidth: 1, borderColor: ui.border,borderRadius:16,paddingHorizontal:21,paddingTop:23,paddingBottom:22,minHeight: 0,justifyContent:'center',shadowColor:'#3B0AAB',shadowOpacity: 0,shadowRadius:9,shadowOffset:{width:0,height:5},elevation: 0},

  heroTitle:{fontSize:22,lineHeight:29,fontWeight: '700',letterSpacing:-.6,color:ui.ink,maxWidth:360},
  heroSubtitle:{fontSize:15,lineHeight:22,color:ui.body,marginTop:9,maxWidth:380},
  postRfqButton:{alignSelf:'flex-start',height:54,paddingHorizontal:18,backgroundColor:ui.accent,borderRadius:12,marginTop:23,flexDirection:'row',alignItems:'center',gap:8},
  postRfqText:{fontSize:16,fontWeight: '700',color:ui.surface},
  searchRow:{flexDirection:'row',alignItems:'center',gap:12},
  searchBox:{flex:1,minHeight:52,borderRadius:12,backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:8,shadowColor:'#000',shadowOpacity: 0,shadowRadius:4,elevation: 0},
  searchInput:{flex:1,minWidth:0,fontSize:15,color:'#303744',paddingVertical:10},
  filterButton:{width:52,height:52,borderRadius:12,backgroundColor:ui.accentSoft,borderWidth:1,borderColor:'#E9DFF8',alignItems:'center',justifyContent:'center'},
  activeFilter:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,backgroundColor:ui.accentSoft,paddingHorizontal:12,paddingVertical:7,borderRadius:18},
  activeFilterText:{fontSize:13,color:PURPLE,fontWeight:'700'},
  supplierCard:{backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:'#E6E7EB',padding:15,shadowColor:ui.ink,shadowOpacity: 0,shadowRadius:6,shadowOffset:{width:0,height:2},elevation: 0},
  cardTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:17},
  statusPill:{minHeight:36,paddingHorizontal:11,borderRadius:22,borderWidth:1,flexDirection:'row',alignItems:'center',gap:6},
  verifiedPill:{backgroundColor:'#F0FBF4',borderColor:'#BDE8CB'},
  reviewPill:{backgroundColor:'#FFFCED',borderColor:'#F5E6A1'},
  statusText:{fontSize:13,fontWeight:'700'},
  categoryPill:{maxWidth:'52%',backgroundColor:'#F4EFFC',color:PURPLE,fontSize:13,fontWeight: '700',paddingHorizontal:12,paddingVertical:7,borderRadius:18,overflow:'hidden'},
  supplierInfo:{flexDirection:'row',alignItems:'center',gap:15,marginBottom:19},
  factoryIcon:{width:54,height:54,borderRadius:16,backgroundColor:'#F8F3FF',borderWidth:1,borderColor:'#F0E7FA',alignItems:'center',justifyContent:'center'},
  supplierName:{fontSize:19,fontWeight: '700',color:ui.ink,letterSpacing:-.3},
  locationRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:3},
  locationText:{fontSize:14,color:ui.muted,flexShrink:1},
  statsRow:{borderTopWidth:1,borderTopColor:ui.border,borderBottomWidth:1,borderBottomColor:ui.border,paddingVertical:16,flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},
  statColumn:{flex:1,minWidth:0},
  statLabel:{fontSize:13,color:ui.muted,lineHeight:19},
  statValue:{fontSize:15,fontWeight: '700',color:ui.ink,marginTop:2},
  profileButton:{minHeight:48,width:'100%',paddingHorizontal:12,borderWidth:1,borderColor:'#E5DDF1',borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2,backgroundColor:ui.surface},
  profileButtonText:{fontSize: 13,fontWeight: '700',color:PURPLE},
  tagsRow:{paddingTop:14},
  tagsText:{fontSize: 13,color:'#747C87',fontWeight:'500'},
  bottomNav:{minHeight:75,backgroundColor:ui.surface,borderTopWidth:1,borderTopColor:'#E6E8ED',paddingTop:7,paddingHorizontal:5,flexDirection:'row',alignItems:'center',justifyContent:'space-around'},
  navItem:{minWidth:61,minHeight:61,borderRadius:18,alignItems:'center',justifyContent:'center',paddingHorizontal:8,paddingVertical:5,gap:2},
  navItemActive:{backgroundColor:ui.accentSoft},
  navLabel:{fontSize: 12,color:ui.muted,fontWeight:'600'},
  navLabelActive:{color:PURPLE,fontWeight: '700'},
  loadingCard:{minHeight:100,borderRadius:22,borderWidth:1,borderColor:'#E7E8ED',backgroundColor:ui.surface,alignItems:'center',justifyContent:'center',gap:9},
  loadingText:{fontSize:13,color:ui.muted},
  emptyState:{backgroundColor:ui.surface,borderRadius:22,borderWidth:1,borderColor:'#E7E8ED',padding:25,alignItems:'center',gap:10},
  emptyTitle:{fontSize:17,fontWeight: '700',color:ui.ink},
  emptyText:{fontSize:13,color:ui.muted,textAlign:'center',lineHeight:20},
  retryButton:{paddingHorizontal:18,paddingVertical:11,borderRadius:12,backgroundColor:ui.accentSoft,marginTop:4},
  retryText:{fontSize:13,color:PURPLE,fontWeight: '700'},
  modalBackdrop:{flex:1,backgroundColor:'rgba(13,10,22,.48)',justifyContent:'flex-end'},
  sheet:{backgroundColor:ui.surface,borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:22,paddingTop:12,paddingBottom:28},
  dragHandle:{width:48,height:5,borderRadius:3,backgroundColor:'#D1D5DB',alignSelf:'center',marginBottom:17},
  sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:14},
  sheetTitle:{fontSize:18,fontWeight: '700',color:ui.ink,flex:1},
  filterOption:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#F0F1F3'},
  filterOptionText:{fontSize:15,color:'#3F4854',fontWeight:'600'},
  sheetActions:{flexDirection:'row',alignItems:'center',gap:12,marginTop:19},
  clearButton:{height:50,paddingHorizontal:23,borderWidth:1,borderColor:'#E1E3E8',borderRadius:13,alignItems:'center',justifyContent:'center'},
  clearText:{fontSize:14,color:'#515B67',fontWeight: '700'},
  applyButton:{height:50,flex:1,backgroundColor:PURPLE,borderRadius:13,alignItems:'center',justifyContent:'center'},
  applyText:{fontSize:15,color:ui.surface,fontWeight: '700'},
  profileSheet:{maxHeight:'88%',backgroundColor:ui.surface,borderTopLeftRadius:25,borderTopRightRadius:25,paddingHorizontal:20,paddingTop:22,paddingBottom:30},
  profileSummary:{flexDirection:'row',alignItems:'center',gap:13,backgroundColor:'#F8F4FF',borderRadius:17,padding:13,marginBottom:19},
  profileName:{fontSize:16,fontWeight: '700',color:ui.ink},
  detailHeading:{fontSize: 13,fontWeight: '700',letterSpacing:.6,color:'#697381',marginBottom:9,marginTop:8},
  description:{fontSize:14,color:'#4B5563',lineHeight:21,backgroundColor:'#F8F9FB',borderRadius:13,padding:13,marginBottom:14},
  detailGrid:{flexDirection:'row',gap:10,marginBottom:15},
  detailBox:{flex:1,backgroundColor:'#F8F9FB',borderRadius:13,padding:12},
  catalogRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,padding:12,borderWidth:1,borderColor:'#E6E8ED',borderRadius:13,marginBottom:8},
  catalogName:{fontSize:13,fontWeight: '700',color:ui.ink},
  catalogPrice:{fontSize:14,fontWeight: '700',color:PURPLE},
  directRfqButton:{minHeight:53,backgroundColor:PURPLE,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:14},
  directRfqText:{fontSize:14,color:ui.surface,fontWeight: '700'},
  drawerLayer:{position:'absolute',left:0,right:0,zIndex:20,flexDirection:'row'},
  drawerBackdrop:{flex:1,backgroundColor:'rgba(13,10,22,.38)'},
  drawer:{width:'68%',maxWidth:320,backgroundColor:ui.surface,paddingTop:18,paddingHorizontal:14,elevation: 0,shadowColor:'#000',shadowOpacity: 0,shadowRadius:12,shadowOffset:{width:3,height:0}},
  drawerItem:{minHeight:49,borderRadius:12,marginBottom:3,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:14},
  drawerItemActive:{backgroundColor:PURPLE},
  drawerItemText:{fontSize:15,fontWeight:'600',color:'#4B515B'},
  drawerItemTextActive:{color:ui.surface,fontWeight: '700'},
});