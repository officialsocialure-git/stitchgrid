import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet,
  Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet, API_BASE_URL } from '@/services/api';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';
import { AppHeader } from '@/components/AppHeader';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { disconnectRealtime } from '@/services/realtime';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';
const CATEGORY_TILES_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAdYAAACCCAMAAADMrBk9AAABIFBMVEVhXZ7Rs5ucnd7UoWCVclopVapXL52ikKNwL9aKcJ5aldxhV2khN5isi2wzj+rEqOa3w9fnzat1hKPj1dL0xHqPXdpjXcmZazghWNQuOVlVMm8eHyA4RWNxSSHIjDyALvM/QD9+gX/39/vs6/R0pfvJqvoWFhbOs/j32K2TWPALCwvKx8xmm/dOiPJVlfTW1thJpfebZPNpaGw2NjeoqK7xyZEmJifl2veiaveKSO8rauovVrInSauJh43Z1+gyZtG1tbi3ucg2dexXWFlHR0m6lvQ0mPWTl62ndfN0d4wqWMmVlph2dniCOfCyiPTntXV1RsiXd9HUx+yHV9NKdtBnOLR7NesrRpSco7CxqMtDe+uulpL105Pm1cyQaNMxddKoo7wTAAAAYHRSTlP///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////9ebwvOAAAfsElEQVR42u2diUPiSLPAm0jCLYqjszO73/feoxGUcEiIoIZTYJBjEDkGr8H//794VZ2EYwRBEmR3ltodZQiTSvev6+jqTiD+rfyGQrZdsMW6lS3WrWyxbmWNWCkK+wmv4b/Re3TyA/pf6dS/HB+c+tBCobPEP+f1Qlld5VvXMWqt/tfxz/c1U++o0TX80sETPf32pS6NdekLfIfQxY01XSVd3L8b0PnBXUvWp3ix9vXofLMpm2jnBnSSdXbw26deo07/x+ucy45uom/JujXP1b0BnZtoJ93IMCXrCaoLlW9A5W+pcy7W9VOd0bgNqPxNdc7B+hFUX7XuI1r7b9WpY91AqrKBQbyJdn5MM+lMrBtIQX+vHHjDI2lBOeL362H6L9H5L8O6EcOhfweqm8BK/b9zF6+m09iwo4axUporVqvVh2Lu4J2XQk3qYrgArkg/fihRKhZy6ksxTs3TSYs2kIcc3Zy10lyVZBRF4fmMwhPiqxbFpS/HDKyU7lUJz7/wpJr7WMdAxWpTkiR2wqJEsvLCmuiSujvEYbNls44+Z6a5vgsrLQ4y+atrkPzLy8v1Sz6vZBTCvW+g0dXNdM9HlJfds7Oz3W8v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';
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
  yearsInBusiness?: number | null;
  sampleDevelopment?: boolean;
  fabricExpertise: string[];
  additionalCapabilities: string[];
  catalog: { name: string; price: string; moq?: number }[];
  logoUrl?: string;
};

function parseSupplier(row: any): Supplier {
  const org = row?.organization || {};
  const description = String(row?.description || '');
  const moqMatch = description.match(/MOQ:\s*([^|]+)/i);
  const capacityMatch = description.match(/Capacity:\s*([^|]+)/i);
  const firstCatalog = Array.isArray(row?.catalogItems) ? row.catalogItems[0] : undefined;
  const logoMedia = Array.isArray(row?.businessMedia) ? row.businessMedia.find((item: any) => item.mediaType === 'COMPANY_LOGO' && item.url) : undefined;
  const rawLogoUrl = String(logoMedia?.url || '');
  const logoUrl = rawLogoUrl ? (rawLogoUrl.startsWith('http') ? rawLogoUrl : `${API_BASE_URL.replace('/api', '')}${rawLogoUrl.startsWith('/') ? '' : '/'}${rawLogoUrl}`) : undefined;
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
    moq: row?.minimumOrderQuantity ? `${Number(row.minimumOrderQuantity).toLocaleString('en-IN')} pcs` : moqMatch?.[1]?.trim() || (firstCatalog?.minOrderQty ? `${firstCatalog.minOrderQty} pcs` : 'Flexible'),
    capacity: row?.productionCapacity ? `${Number(row.productionCapacity).toLocaleString('en-IN')} pcs / month` : capacityMatch?.[1]?.trim() || 'Flexible',
    tags: categories.slice(0, 3).join(' · ') || 'Garment manufacturing',
    description: description.split('|')[0].trim() || 'Registered business in the STITCHGRID supplier network.',
    yearsInBusiness: row?.yearsInBusiness ?? null,
    sampleDevelopment: Boolean(row?.sampleDevelopment),
    fabricExpertise: Array.isArray(row?.capabilities) ? row.capabilities.filter((item: any) => item.capabilityGroup === 'FABRIC').map((item: any) => item.value) : [],
    additionalCapabilities: Array.isArray(row?.capabilities) ? row.capabilities.filter((item: any) => item.capabilityGroup === 'SERVICE').map((item: any) => item.value) : [],
    catalog,
    logoUrl,
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
          {supplier.logoUrl ? <Image source={{ uri: supplier.logoUrl }} style={styles.supplierLogo} resizeMode="contain" /> : <MaterialCommunityIcons name="factory" size={22} color={PURPLE} />}
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
  const supplierRequestId = useRef(0);

  const loadSuppliers = useCallback(async () => {
    const requestId = ++supplierRequestId.current;
    setLoading(true);
    setRefreshingError('');
    try {
      const params = new URLSearchParams();
      if (category !== 'All') params.append('category', category);
      if (search.trim()) params.append('q', search.trim());
      const query = params.toString();
      const data = await apiGet<any[]>(`/suppliers${query ? `?${query}` : ''}`);
      if (requestId !== supplierRequestId.current) return;
      setSuppliers(Array.isArray(data) ? data.map(parseSupplier) : []);
    } catch (error) {
      if (requestId !== supplierRequestId.current) return;
      setSuppliers([]);
      setRefreshingError(error instanceof Error ? error.message : 'Unable to load suppliers.');
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadSuppliers(); }, 400);
    return () => clearTimeout(timer);
  }, [loadSuppliers]);
  useRealtimeRefresh(loadSuppliers, ['*']);

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
          disconnectRealtime();
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

        <View style={styles.categoryGrid}>
          {(['Garments', 'Fabrics', 'Trims', 'Sampling'] as const).map((category, index) => (
            <View key={category} style={styles.categoryButtonShadow}>
              <Pressable
                style={({ pressed }) => [styles.categoryButton, pressed && styles.categoryButtonPressed]}
                onPress={() => category === 'Garments' ? router.push('/buyer/garments' as any) : category === 'Fabrics' ? router.push('/buyer/fabrics' as any) : Alert.alert(category, 'This category page will be connected in the next step.')}
                accessibilityRole="button"
                accessibilityLabel={category}
                android_ripple={{ color: '#E8DDFB' }}
              >
                <Image
                  source={{ uri: CATEGORY_TILES_IMAGE }}
                  style={[styles.categoryButtonArtwork, { left: `${index * -100}%` }]}
                  resizeMode="stretch"
                />
              </Pressable>
            </View>
          ))}
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
            {visibleSuppliers.map(supplier => <SupplierCard key={supplier.id} supplier={supplier} onPress={() => router.push({ pathname: '/buyer/supplier/[organizationId]', params: { organizationId: supplier.organizationId } } as any)} />)}
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
                  <View style={styles.factoryIcon}>{selectedSupplier.logoUrl ? <Image source={{ uri: selectedSupplier.logoUrl }} style={styles.supplierLogo} resizeMode="contain" /> : <MaterialCommunityIcons name="factory" size={22} color={PURPLE} />}</View>
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
                  <View style={styles.detailBox}><Text style={styles.statLabel}>Years in Business</Text><Text style={styles.statValue}>{selectedSupplier.yearsInBusiness ?? '—'}</Text></View>
                  <View style={styles.detailBox}><Text style={styles.statLabel}>Sample Development</Text><Text style={styles.statValue}>{selectedSupplier.sampleDevelopment ? 'Available' : 'Not specified'}</Text></View>
                </View>
                {!!selectedSupplier.fabricExpertise.length && <><Text style={styles.detailHeading}>FABRIC EXPERTISE</Text><Text style={styles.description}>{selectedSupplier.fabricExpertise.join(' · ')}</Text></>}
                {!!selectedSupplier.additionalCapabilities.length && <><Text style={styles.detailHeading}>ADDITIONAL CAPABILITIES</Text><Text style={styles.description}>{selectedSupplier.additionalCapabilities.join(' · ')}</Text></>}
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
  categoryGrid:{width:'104%',marginLeft:'-2%',flexDirection:'row',gap:6},
  categoryButtonShadow:{flex:1,aspectRatio:0.84,minHeight:104,borderRadius:16,backgroundColor:ui.surface,elevation:5,shadowColor:'#6D28D9',shadowOpacity:0.24,shadowRadius:9,shadowOffset:{width:0,height:4}},
  categoryButton:{flex:1,borderRadius:16,overflow:'hidden',backgroundColor:ui.surface,borderWidth:0},
  categoryButtonPressed:{opacity:0.76,transform:[{scale:0.98}]},
  categoryButtonArtwork:{position:'absolute',top:0,width:'400%',height:'108%'},
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
  factoryIcon:{width:54,height:54,borderRadius:16,backgroundColor:'#F8F3FF',borderWidth:1,borderColor:'#F0E7FA',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  supplierLogo:{width:'100%',height:'100%'},
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