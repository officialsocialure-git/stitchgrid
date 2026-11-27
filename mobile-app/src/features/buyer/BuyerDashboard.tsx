import { ui } from '@/theme/ui';
import { AppBottomNav } from '@/components/AppBottomNav';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiPost, API_BASE_URL } from '@/services/api';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';
import { AppHeader } from '@/components/AppHeader';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { disconnectRealtime } from '@/services/realtime';
import { POPULAR_CATEGORIES } from './popularCategories';

const PURPLE = ui.accent;
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';
const HERO_SLIDES = [
  { image: require('../../../assets/banners/banner-1.png'), tint: '#72508F' },
  { image: require('../../../assets/banners/banner-2.png'), tint: '#66508F' },
] as const;
// Legacy sprite replaced by separate high-resolution category PNG assets.

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
  products: { id: string; name: string; itemType: string; imageUrl?: string | null; images?: { imageUrl: string; sortOrder?: number }[] }[];
  logoUrl?: string;
  factoryPhotoUrl?: string;
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
  const factoryMedia = Array.isArray(row?.businessMedia) ? row.businessMedia.find((item: any) => (item.mediaType === 'FACTORY_PHOTO' || item.mediaType === 'COMPANY_PHOTO') && item.url) : undefined;
  const rawFactoryUrl = String(factoryMedia?.url || '');
  const factoryPhotoUrl = rawFactoryUrl ? (rawFactoryUrl.startsWith('http') ? rawFactoryUrl : `${API_BASE_URL.replace('/api', '')}${rawFactoryUrl.startsWith('/') ? '' : '/'}${rawFactoryUrl}`) : undefined;
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
    products: Array.isArray(row?.catalogItems) ? row.catalogItems.map((item: any) => ({ id: String(item.id), name: item.name || 'Catalog product', itemType: item.itemType || 'Product', imageUrl: item.imageUrl || null, images: Array.isArray(item.images) ? item.images : [] })) : [],
    logoUrl,
    factoryPhotoUrl,
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
        <Text numberOfLines={1} style={styles.categoryPill}>{supplier.tags.split(' · ')[0] || supplier.businessType}</Text>
      </View>

      <View style={styles.supplierInfo}>
        <View style={styles.factoryPhoto}>
          {supplier.factoryPhotoUrl ? <Image source={{ uri: supplier.factoryPhotoUrl }} style={styles.factoryPhotoImage} resizeMode="cover" /> : supplier.logoUrl ? <Image source={{ uri: supplier.logoUrl }} style={styles.factoryPhotoImage} resizeMode="contain" /> : <MaterialCommunityIcons name="factory" size={30} color={PURPLE} />}
        </View>
        <View style={styles.supplierDetails}>
          <Text numberOfLines={1} style={styles.supplierName}>{supplier.name}</Text>
          <View style={styles.locationRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={19} color="#9AA4B0" />
            <Text numberOfLines={1} style={styles.locationText}>{supplier.city}</Text>
          </View>
          <View style={styles.supplierBusinessPill}><Text numberOfLines={1} style={styles.supplierBusinessText}>{supplier.businessType}</Text></View>
          <View><View style={styles.supplierTags}>{supplier.tags.split(' · ').filter(Boolean).slice(0, 4).map(tag => <Text key={tag} numberOfLines={1} style={styles.supplierTag}>{tag}</Text>)}</View>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statColumn}>
          <Text style={styles.statLabel}>MOQ</Text>
          <Text numberOfLines={1} style={styles.statValue}>{supplier.moq}</Text>
        </View>
        <View style={styles.statColumn}>
          <Text style={styles.statLabel}>Capacity</Text>
          <Text numberOfLines={1} style={styles.statValue}>{supplier.capacity}</Text>
        </View>
        <Pressable onPress={onPress} style={styles.profileButton}>
          <Text style={styles.profileButtonText}>View Profile</Text>
          <MaterialCommunityIcons name="arrow-right" size={22} color={PURPLE} />
        </Pressable>
      </View>
      <View style={styles.tagsRow}>
        <Text numberOfLines={2} style={styles.tagsText}>{supplier.tags}</Text>
      </View>
    </View>
  );
}

type SupplierReel = {
  id: string;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  impressionCount: number;
  viewCount: number;
  organization: {
    id: string;
    name: string;
    businessType?: string | null;
    city?: string | null;
    verificationStatus: string;
    businessMedia?: { url: string }[];
  };
  products?: { catalogItem: { id: string; name: string; itemType: string } }[];
};

function ReelSlide({ reel, active, width, height, onOpenSupplier }: {
  reel: SupplierReel; active: boolean; width: number; height: number; onOpenSupplier: () => void;
}) {
  const player = useVideoPlayer(reel.videoUrl, instance => {
    instance.loop = true;
    instance.muted = true;
  });
  const [paused, setPaused] = useState(!active);

  useEffect(() => {
    if (active) {
      setPaused(false);
      player.play();
    } else {
      setPaused(true);
      player.pause();
    }
  }, [active, player]);

  const logo = reel.organization.businessMedia?.[0]?.url;
  const logoUrl = logo ? (logo.startsWith('http') ? logo : `${API_BASE_URL.replace('/api', '')}${logo.startsWith('/') ? '' : '/'}${logo}`) : '';

  return (
    <View style={[styles.reelCard, { width, height }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {
        if (paused) { player.play(); setPaused(false); }
        else { player.pause(); setPaused(true); }
      }}>
        <LinearGradient colors={['rgba(12,8,18,.35)', 'transparent', 'rgba(12,8,18,.82)']} locations={[0, .45, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.reelTopBadges}>
          <View style={styles.reelBadge}><MaterialCommunityIcons name="fire" size={13} color="#FBBF24" /><Text style={styles.reelBadgeText}>Viral Trends</Text></View>
          {reel.organization.verificationStatus === 'APPROVED' && <View style={styles.reelBadge}><MaterialCommunityIcons name="check-decagram" size={13} color="#C4B5FD" /><Text style={styles.reelBadgeText}>Verified Supplier</Text></View>}
        </View>
        <View style={styles.reelPlayButton}><MaterialCommunityIcons name={paused ? 'play' : 'pause'} size={28} color="#FFFFFF" /></View>
        <View style={styles.reelBottomInfo}>
          <Pressable style={styles.reelSupplierRow} onPress={event => { event.stopPropagation(); onOpenSupplier(); }}>
            <View style={styles.reelLogo}>{logoUrl ? <Image source={{ uri: logoUrl }} style={styles.reelLogoImage} resizeMode="contain" /> : <MaterialCommunityIcons name="factory" size={21} color={PURPLE} />}</View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.reelSupplierName}>{reel.organization.name}</Text>
              <Text numberOfLines={1} style={styles.reelSupplierType}>{reel.organization.businessType || 'Verified Supplier'}</Text>
            </View>
            <MaterialCommunityIcons name="check-decagram" size={19} color="#C4B5FD" />
          </Pressable>
          <Text numberOfLines={2} style={styles.reelCollectionTitle}>{reel.title}</Text>
          <View style={styles.reelMetaRow}>
            <Text style={styles.reelMetaText}>{reel.durationSeconds}s collection video</Text>
            <Text style={styles.reelMetaText}>{reel.viewCount.toLocaleString('en-IN')} views</Text>
          </View>
        </View>
      </Pressable>
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
  const dashboardScrollRef = useRef<ScrollViewInstance | null>(null);
  const heroSlideRef = useRef<ScrollViewInstance | null>(null);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [trendyCollections, setTrendyCollections] = useState<{ id: string; name: string; description?: string | null; imageUrl: string; organization: { id: string; name: string; city?: string | null } }[]>([]);
  const [refreshingTrendy, setRefreshingTrendy] = useState(false);
  const [supplierReels, setSupplierReels] = useState<SupplierReel[]>([]);
  const [supplierReelTotal, setSupplierReelTotal] = useState(0);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const reelViewerKey = useRef<string | null>(null);
  const reelCarouselRef = useRef<ScrollViewInstance | null>(null);
  const reelCardWidth = Math.min(width - 76, 340);
  const reelCardHeight = Math.min(470, Math.max(390, width * 1.22));
  const heroWidth = Math.min(width - 32, 808);
  const heroHeight = 220;
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
  const displayedTrendingCollections = trendyCollections.slice(0, 3);
  const refreshTrendingCollections = useCallback(async () => {
    const nextSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setRefreshingTrendy(true);
    try {
      const result = await apiGet<{ items?: typeof trendyCollections; total?: number }>(`/trendy-collections?page=1&limit=24&seed=${encodeURIComponent(nextSeed)}`);
      setTrendyCollections(Array.isArray(result?.items) ? result.items : []);
    } catch {
      Alert.alert('Unable to refresh collections', 'Please try again.');
    } finally {
      setRefreshingTrendy(false);
    }
  }, []);
  useEffect(() => { void refreshTrendingCollections(); }, [refreshTrendingCollections]);

  const getReelViewerKey = useCallback(async () => {
    if (reelViewerKey.current) return reelViewerKey.current;
    let key = await SecureStore.getItemAsync('sg_reel_viewer_key');
    if (!key) {
      key = `buyer-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
      await SecureStore.setItemAsync('sg_reel_viewer_key', key);
    }
    reelViewerKey.current = key;
    return key;
  }, []);

  const refreshSupplierReels = useCallback(async () => {
    try {
      const viewerKey = await getReelViewerKey();
      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const result = await apiGet<{ items?: SupplierReel[]; total?: number; hasMore?: boolean }>(`/reels/feed?limit=5&seed=${encodeURIComponent(seed)}&viewerKey=${encodeURIComponent(viewerKey)}`);
      setSupplierReels(Array.isArray(result?.items) ? result.items : []);
      setSupplierReelTotal(Number(result?.total || 0));
      setActiveReelIndex(Array.isArray(result?.items) && result.items.length > 1 ? 1 : 0);
    } catch {
      // Keep the last successfully loaded feed visible if a refresh request fails.
    }
  }, [getReelViewerKey]);

  const trackReelEvent = useCallback(async (reelId: string, eventType: 'IMPRESSION' | 'VIEW' | 'CLICK', watchSeconds = 0) => {
    try {
      const viewerKey = await getReelViewerKey();
      const eventKey = `${viewerKey}-${reelId}-${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await apiPost(`/reels/${reelId}/events`, { eventKey, viewerKey, eventType, watchSeconds }, 12000);
    } catch {
      // Analytics failures must never interrupt video playback.
    }
  }, [getReelViewerKey]);

  useEffect(() => { void refreshSupplierReels(); }, [refreshSupplierReels]);

  useEffect(() => {
    if (!supplierReels.length) return;
    const initialIndex = supplierReels.length > 1 ? 1 : 0;
    requestAnimationFrame(() => reelCarouselRef.current?.scrollTo({ x: initialIndex * (reelCardWidth + 12), animated: false }));
  }, [supplierReels, reelCardWidth]);

  useEffect(() => {
    const activeReel = supplierReels[activeReelIndex];
    if (!activeReel) return;
    void trackReelEvent(activeReel.id, 'IMPRESSION');
    const timer = setTimeout(() => { void trackReelEvent(activeReel.id, 'VIEW', 3); }, 3000);
    return () => clearTimeout(timer);
  }, [supplierReels, activeReelIndex, trackReelEvent]);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroSlideIndex(current => {
        const next = (current + 1) % HERO_SLIDES.length;
        heroSlideRef.current?.scrollTo({ x: next * heroWidth, animated: true });
        return next;
      });
    }, 4200);
    return () => clearInterval(timer);
  }, [heroWidth]);

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
        showCart
        onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
      />

      <ScrollView ref={dashboardScrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshingTrendy} onRefresh={() => { void refreshTrendingCollections(); void refreshSupplierReels(); }} tintColor={PURPLE} colors={[PURPLE]} />}>
        <View style={[styles.hero, { width: heroWidth, height: heroHeight, alignSelf: 'center' }]}> 
          <ScrollView
            ref={heroSlideRef}
            horizontal
            pagingEnabled
            scrollEnabled
            showsHorizontalScrollIndicator={false}
            removeClippedSubviews={false}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: heroHeight, zIndex: 0 }}
            contentContainerStyle={{ flexDirection: 'row', width: heroWidth * HERO_SLIDES.length, height: heroHeight }}
            onMomentumScrollEnd={(event) => setHeroSlideIndex(Math.round(event.nativeEvent.contentOffset.x / heroWidth))}
          >
            {HERO_SLIDES.map((slide, index) => (
              <Image
                key={index}
                source={slide.image}
                style={{ width: heroWidth, height: heroHeight, backgroundColor: slide.tint }}
                resizeMode="cover"
                fadeDuration={0}
              />
            ))}
          </ScrollView>
          <Text style={styles.heroTitle}>Source Garments, Fabrics &amp; Trims Directly from Verified Suppliers</Text>

          <Pressable style={styles.postRfqButton} onPress={() => dashboardScrollRef.current?.scrollTo({ y: 300, animated: true })}>
            <Text style={styles.postRfqText}>Find Suppliers</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color="#FFFFFF" />
          </Pressable>
          <View style={styles.heroDots}>
            {HERO_SLIDES.map((_, index) => <View key={index} style={[styles.heroDot, heroSlideIndex === index && styles.heroDotActive]} />)}
          </View>
        </View>

        <View style={styles.categoryGrid}>
          {([
            { category: 'Garments', image: require('../../../assets/categories/garments.png') },
            { category: 'Fabrics', image: require('../../../assets/categories/fabrics.png') },
            { category: 'Trims', image: require('../../../assets/categories/trims.png') },
            { category: 'Sampling', image: require('../../../assets/categories/sampling.png') },
          ] as const).map(({ category, image }) => (
            <View key={category} style={styles.categoryButtonShadow}>
              <Pressable
                style={({ pressed }) => [styles.categoryButton, pressed && styles.categoryButtonPressed]}
                onPress={() => category === 'Garments' ? router.push('/buyer/garments' as any) : category === 'Fabrics' ? router.push('/buyer/fabrics' as any) : category === 'Trims' ? router.push('/buyer/trims' as any) : router.push('/buyer/sampling' as any)}
                accessibilityRole="button"
                accessibilityLabel={category}
                android_ripple={{ color: '#E8DDFB' }}
              >
                <Image
                  source={image}
                  style={styles.categoryButtonArtwork}
                  resizeMode="contain"
                  fadeDuration={0}
                  resizeMethod="resize"
                />
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.trendySection}>
          <View style={styles.trendyHeader}>
            <View style={styles.trendyTitleRow}>
              <Text style={styles.trendyTitle}>Trending Collection</Text>
              <MaterialCommunityIcons name="crown" size={19} color="#8B5CF6" />
            </View>
            <Pressable onPress={() => router.push('/buyer/trendy-collections' as any)} style={styles.trendyViewAll}>
              <Text style={styles.trendyViewAllText}>View All</Text>
              <MaterialCommunityIcons name="chevron-right" size={17} color="#172033" />
            </Pressable>
          </View>
          {trendyCollections.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendyList}>
              {displayedTrendingCollections.map(collection => (
                <Pressable key={collection.id} style={styles.trendyCard} onPress={() => router.push({ pathname: '/buyer/supplier-preview/[organizationId]', params: { organizationId: collection.organization.id, collectionImageUrl: collection.imageUrl } } as any)}>
                  <View style={styles.trendyImageWrap}>
                    <Image source={{ uri: collection.imageUrl.startsWith('http') ? collection.imageUrl : `${API_BASE_URL.replace('/api', '')}${collection.imageUrl.startsWith('/') ? '' : '/'}${collection.imageUrl}` }} style={styles.trendyImage} resizeMode="contain" />
                  </View>
                  <Text numberOfLines={1} style={styles.trendySupplierName}>{collection.organization.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.trendyEmpty}><MaterialCommunityIcons name="crown-outline" size={21} color="#9A8CB3" /><Text style={styles.trendyEmptyText}>Featured supplier collections will appear here after admin approval.</Text></View>
          )}
        </View>

        <View style={styles.popularSection}>
          <View style={styles.popularHeader}>
            <Text style={styles.popularTitle}>Popular Categories</Text>
            <Pressable onPress={() => router.push('/buyer/popular-categories' as any)} style={styles.popularViewAll}>
              <Text style={styles.popularViewAllText}>View All</Text>
              <MaterialCommunityIcons name="chevron-right" size={17} color="#172033" />
            </Pressable>
          </View>
          <View style={styles.popularGrid}>
            {POPULAR_CATEGORIES.slice(0, 3).map(item => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [styles.popularCard, pressed && styles.popularCardPressed]}
                onPress={() => router.push({ pathname: '/buyer/products', params: { category: item.label } } as any)}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${item.label}`}
                android_ripple={{ color: '#E8DDFB' }}
              >
                <View style={styles.popularArtwork}>
                  {item.image ? <Image source={item.image} style={styles.popularArtworkImage} resizeMode="contain" /> : <MaterialCommunityIcons name={item.icon as any} size={38} color={PURPLE} />}
                </View>
                <Text style={styles.popularLabel} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.reelsSection}>
          <View style={styles.reelsHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reelsTitle}>Viral Trends This Week</Text>
              <Text style={styles.reelsSubtitle}>{supplierReelTotal ? `${supplierReelTotal} approved collection videos from verified suppliers` : 'Collections from verified supplier companies'}</Text>
            </View>
            <Pressable onPress={() => void refreshSupplierReels()} style={styles.reelsRefresh}>
              <MaterialCommunityIcons name="refresh" size={17} color={PURPLE} />
              <Text style={styles.reelsRefreshText}>Refresh</Text>
            </Pressable>
          </View>
          {supplierReels.length ? (
            <>
              <ScrollView
                ref={reelCarouselRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                snapToInterval={reelCardWidth + 12}
                snapToAlignment="start"
                contentContainerStyle={{ paddingHorizontal: Math.max(8, (width - reelCardWidth) / 2 - 16) }}
                onMomentumScrollEnd={event => {
                  const nextIndex = Math.max(0, Math.min(supplierReels.length - 1, Math.round(event.nativeEvent.contentOffset.x / (reelCardWidth + 12))));
                  setActiveReelIndex(nextIndex);
                }}
              >
                {supplierReels.slice(0, 5).map((reel, index) => (
                  <View key={reel.id} style={[{ width: reelCardWidth, marginRight: 12 }, index === activeReelIndex ? { zIndex: 2 } : { transform: [{ scale: 0.92 }], opacity: 0.82 }]}>
                    <ReelSlide reel={reel} active={index === activeReelIndex} width={reelCardWidth} height={reelCardHeight} onOpenSupplier={() => { void trackReelEvent(reel.id, 'CLICK'); router.push({ pathname: '/buyer/supplier/[organizationId]', params: { organizationId: reel.organization.id } } as any); }} />
                  </View>
                ))}
              </ScrollView>
              <View style={styles.reelDots}>
                {supplierReels.slice(0, 5).map((reel, index) => <View key={reel.id} style={[styles.reelDot, index === activeReelIndex && styles.reelDotActive]} />)}
              </View>
              <View style={styles.reelsFairNote}>
                <MaterialCommunityIcons name="shuffle-variant" size={17} color={PURPLE} />
                <Text style={styles.reelsFairText}>Different supplier collections are rotated for every buyer and refresh.</Text>
              </View>
            </>
          ) : (
            <View style={styles.reelsEmpty}>
              <MaterialCommunityIcons name="movie-play-outline" size={27} color="#9888B3" />
              <Text style={styles.reelsEmptyTitle}>Supplier Reels are coming soon</Text>
              <Text style={styles.reelsEmptyText}>Approved collection videos from verified suppliers will appear here.</Text>
            </View>
          )}
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

      <AppBottomNav role="BUYER" activeSection="home" onNavigate={(section) => {
        if (section === 'rfq') { setRfqSupplier({}); setRfqModalVisible(true); return; }
        if (section === 'cart') { router.push('/buyer/cart' as any); return; }
        if (section === 'offers') { openNextPage('My Offers'); return; }
        if (section === 'orders') { openNextPage('Orders'); return; }
        openNextPage('Home');
      }} onLayout={event => setBottomNavHeight(event.nativeEvent.layout.height)} />

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
                  <View style={styles.factoryPhoto}>{selectedSupplier.logoUrl ? <Image source={{ uri: selectedSupplier.logoUrl }} style={styles.supplierLogo} resizeMode="contain" /> : <MaterialCommunityIcons name="factory" size={22} color={PURPLE} />}</View>
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
  hero:{height:220,backgroundColor:'#72508F',borderRadius:16,overflow:'hidden',paddingHorizontal:20,paddingVertical:15,justifyContent:'center',shadowColor:'#3B0AAB',shadowOpacity:0.12,shadowRadius:9,shadowOffset:{width:0,height:5},elevation:2},
  heroSlide:{height:220,alignItems:'flex-end',justifyContent:'center',paddingRight:4},
  heroSlideImage:{position:'absolute',left:0,top:0,width:'100%',height:'100%',opacity:1},
  heroDots:{position:'absolute',bottom:10,left:0,right:0,flexDirection:'row',justifyContent:'center',gap:6},
  heroDot:{width:6,height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.45)'},
  heroDotActive:{width:18,backgroundColor:'#FFFFFF'},

  heroTitle:{fontSize:18,lineHeight:22,fontWeight:'600',letterSpacing:-.2,color:'#FFFFFF',maxWidth:'58%',zIndex:2},

  heroSubtitle:{fontSize:15,lineHeight:22,color:ui.body,marginTop:9,maxWidth:380},
  postRfqButton:{alignSelf:'flex-start',height:34,paddingHorizontal:14,backgroundColor:'#6500F5',borderRadius:20,marginTop:10,flexDirection:'row',alignItems:'center',gap:5,zIndex:2},
  postRfqText:{fontSize:13,fontWeight:'700',color:ui.surface},
  categoryGrid:{width:'104%',marginLeft:'-2%',flexDirection:'row',gap:6},
  categoryButtonShadow:{flex:1,aspectRatio:0.84,minHeight:104,borderRadius:16,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#E9E0F7',elevation:9,shadowColor:'#5420A8',shadowOpacity:0.34,shadowRadius:12,shadowOffset:{width:0,height:6}},
  categoryButton:{flex:1,borderRadius:16,overflow:'hidden',backgroundColor:'#FFFFFF',borderWidth:0},

  categoryButtonPressed:{opacity:0.76,transform:[{scale:0.98}]},
  categoryButtonArtwork:{width:'100%',height:'100%'},

  popularSection:{marginTop:4,marginBottom:4,gap:9},
  popularHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  popularTitle:{fontSize:17,fontWeight:'900',color:ui.ink},
  popularViewAll:{flexDirection:'row',alignItems:'center',gap:2,paddingVertical:3},
  popularViewAllText:{fontSize:12,fontWeight:'800',color:'#172033'},
  popularGrid:{flexDirection:'row',justifyContent:'space-between',gap:10},
  popularCard:{flex:1,minWidth:0,minHeight:154,alignItems:'center',justifyContent:'center',gap:10,borderRadius:14,padding:7,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EEEAF5'},

  popularCardPressed:{opacity:0.78,transform:[{scale:0.97}]},
  popularArtwork:{width:'100%',height:114,borderRadius:12,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',overflow:'hidden'},

  popularArtworkImage:{width:'130%',height:'130%'},



  popularLabel:{fontSize:14,fontWeight:'800',color:ui.ink,textAlign:'center',marginTop:2},

  trendySection:{gap:9,marginTop:0,marginBottom:0},
  trendyHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:1},
  trendyTitleRow:{flexDirection:'row',alignItems:'center',gap:7},
  trendyTitle:{fontSize:18,fontWeight:'800',color:'#151B29',letterSpacing:-.3},
  trendyViewAll:{flexDirection:'row',alignItems:'center',gap:1,paddingVertical:3},
  trendyViewAllText:{fontSize:12,fontWeight:'700',color:'#172033'},
  trendyList:{gap:10,paddingBottom:3},
  trendyCard:{width:132,backgroundColor:'#FFFFFF',borderRadius:14,borderWidth:1,borderColor:'#E9E5F0',padding:7,shadowColor:'#4C1D95',shadowOpacity:.07,shadowRadius:5,shadowOffset:{width:0,height:2},elevation:1},
  trendyImageWrap:{height:124,borderRadius:10,backgroundColor:'#F5F2F8',overflow:'hidden',position:'relative'},
  trendyImage:{width:'100%',height:'100%',backgroundColor:'#F5F2F8'},
 
  trendyProductName:{fontSize:11,fontWeight:'800',color:'#202839',marginTop:6},
  trendySupplierName:{fontSize:9,fontWeight:'600',color:'#7B8493',marginTop:2},
  trendyEmpty:{minHeight:62,borderWidth:1,borderStyle:'dashed',borderColor:'#DDD5EA',borderRadius:12,backgroundColor:'#FAF8FD',paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:9},
  trendyEmptyText:{flex:1,fontSize:11,lineHeight:16,color:'#7B718D'},
  reelsSection:{gap:12,marginTop:4,marginBottom:2},
  reelsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,paddingHorizontal:2},
  reelsTitle:{fontSize:25,lineHeight:30,fontWeight:'900',color:'#5B13EC',letterSpacing:-.5},
  reelsSubtitle:{fontSize:12,color:'#6F7785',marginTop:3},
  reelsRefresh:{minHeight:36,paddingHorizontal:10,borderRadius:18,backgroundColor:'#F3EDFF',flexDirection:'row',alignItems:'center',gap:4},
  reelsRefreshText:{fontSize:11,fontWeight:'800',color:PURPLE},
  reelCard:{borderRadius:22,overflow:'hidden',backgroundColor:'#21172A',borderWidth:2,borderColor:'#FFFFFF',shadowColor:'#4C1D95',shadowOpacity:.2,shadowRadius:12,shadowOffset:{width:0,height:7},elevation:5},
  reelTopBadges:{position:'absolute',top:13,left:12,right:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  reelBadge:{minHeight:28,paddingHorizontal:9,borderRadius:18,backgroundColor:'rgba(24,17,31,.66)',borderWidth:1,borderColor:'rgba(255,255,255,.55)',flexDirection:'row',alignItems:'center',gap:4},
  reelBadgeText:{fontSize:10,fontWeight:'800',color:'#FFFFFF'},
  reelPlayButton:{position:'absolute',top:'43%',alignSelf:'center',width:58,height:58,borderRadius:29,backgroundColor:'rgba(18,12,25,.48)',borderWidth:2,borderColor:'rgba(255,255,255,.9)',alignItems:'center',justifyContent:'center'},
  reelBottomInfo:{position:'absolute',left:13,right:13,bottom:17,gap:9},
  reelSupplierRow:{flexDirection:'row',alignItems:'center',gap:9},
  reelLogo:{width:42,height:42,borderRadius:21,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  reelLogoImage:{width:'86%',height:'86%'},
  reelSupplierName:{fontSize:14,fontWeight:'900',color:'#FFFFFF'},
  reelSupplierType:{fontSize:10,fontWeight:'600',color:'rgba(255,255,255,.82)',marginTop:2},
  reelCollectionTitle:{fontSize:19,lineHeight:24,fontWeight:'800',fontStyle:'italic',color:'#FFFFFF'},
  reelMetaRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  reelMetaText:{fontSize:10,fontWeight:'700',color:'rgba(255,255,255,.86)'},
  reelDots:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:3},
  reelDot:{width:8,height:8,borderRadius:4,backgroundColor:'#D6D3DD'},
  reelDotActive:{width:20,backgroundColor:PURPLE},
  reelsFairNote:{minHeight:40,borderRadius:12,backgroundColor:'#F6F0FF',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingHorizontal:12},
  reelsFairText:{fontSize:11,fontWeight:'700',color:'#5C4A79',flexShrink:1},
  reelsEmpty:{minHeight:116,borderWidth:1,borderStyle:'dashed',borderColor:'#D8CBEA',borderRadius:16,backgroundColor:'#FAF8FD',alignItems:'center',justifyContent:'center',padding:18,gap:7},
  reelsEmptyTitle:{fontSize:14,fontWeight:'800',color:ui.ink},
  reelsEmptyText:{fontSize:11,lineHeight:16,color:ui.muted,textAlign:'center'},
  searchRow:{flexDirection:'row',alignItems:'center',gap:12},
  searchBox:{flex:1,minHeight:52,borderRadius:12,backgroundColor:ui.surface,borderWidth:1,borderColor:ui.border,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:8,shadowColor:'#000',shadowOpacity: 0,shadowRadius:4,elevation: 0},
  searchInput:{flex:1,minWidth:0,fontSize:15,color:'#303744',paddingVertical:10},
  filterButton:{width:52,height:52,borderRadius:12,backgroundColor:ui.accentSoft,borderWidth:1,borderColor:'#E9DFF8',alignItems:'center',justifyContent:'center'},
  activeFilter:{alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:7,backgroundColor:ui.accentSoft,paddingHorizontal:12,paddingVertical:7,borderRadius:18},
  activeFilterText:{fontSize:13,color:PURPLE,fontWeight:'700'},
  supplierCard:{backgroundColor:'#FFFFFF',borderRadius:22,borderWidth:1,borderColor:'#ECE7F4',padding:13,shadowColor:'#4C1D95',shadowOpacity:0.09,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:2},
  cardTopRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:17},
  statusPill:{minHeight:36,paddingHorizontal:11,borderRadius:22,borderWidth:1,flexDirection:'row',alignItems:'center',gap:6},
  verifiedPill:{backgroundColor:'#F0FBF4',borderColor:'#BDE8CB'},
  reviewPill:{backgroundColor:'#FFFCED',borderColor:'#F5E6A1'},
  statusText:{fontSize:13,fontWeight:'700'},
  categoryPill:{maxWidth:'52%',backgroundColor:'#F4EFFC',color:PURPLE,fontSize:13,fontWeight: '700',paddingHorizontal:12,paddingVertical:7,borderRadius:18,overflow:'hidden'},
  supplierInfo:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:14},
  factoryPhoto:{width:104,height:112,borderRadius:14,backgroundColor:'#F4F0FA',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  factoryPhotoImage:{width:'100%',height:'100%'},
  supplierDetails:{flex:1,minWidth:0,gap:5},
  supplierBusinessPill:{alignSelf:'flex-start',maxWidth:'100%',backgroundColor:'#F0E8FF',paddingHorizontal:10,paddingVertical:5,borderRadius:16},
  supplierBusinessText:{fontSize:11,fontWeight:'700',color:PURPLE},
  supplierTags:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:2},
  supplierTag:{backgroundColor:'#F3EDFF',color:'#292044',fontSize:11,fontWeight:'600',paddingHorizontal:8,paddingVertical:5,borderRadius:14,overflow:'hidden'},
  factoryIcon:{width:54,height:54,borderRadius:16,backgroundColor:'#F8F3FF',borderWidth:1,borderColor:'#F0E7FA',alignItems:'center',justifyContent:'center',overflow:'hidden'},
  supplierLogo:{width:'100%',height:'100%'},
  supplierName:{fontSize:19,fontWeight: '700',color:ui.ink,letterSpacing:-.3},
  locationRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:3},
  locationText:{fontSize:14,color:ui.muted,flexShrink:1},
  statsRow:{borderTopWidth:1,borderTopColor:ui.border,paddingTop:12,flexDirection:'row',alignItems:'center',gap:8,flexWrap:'nowrap'},
  capacityColumn:{borderLeftWidth:1,borderLeftColor:ui.border,paddingLeft:10},
  statColumn:{flex:1,minWidth:0},
  statLabel:{fontSize:13,color:ui.muted,lineHeight:19},
  statValue:{fontSize:15,fontWeight: '700',color:ui.ink,marginTop:2},
  profileButton:{minHeight:42,paddingHorizontal:10,borderWidth:1,borderColor:PURPLE,borderRadius:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:3,backgroundColor:'#FFFFFF'},
  profileButtonText:{fontSize: 12,fontWeight: '700',color:PURPLE},
  tagsRow:{display:'none'},
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