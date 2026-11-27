import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { apiGet, API_BASE_URL } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { getSupplierProfileCompletion } from '@/services/supplierProfileCompletion';

type SupplierProfile = {
  id: string;
  name: string;
  legalName?: string | null;
  businessType?: string | null;
  taxId?: string | null;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  verificationStatus?: string;
  supplierProfile?: {
    description?: string | null;
    yearsInBusiness?: number | null;
    productionCapacity?: number | null;
    minimumOrderQuantity?: number | null;
    fabricMinimumOrderQuantity?: number | null;
    sampleDevelopment?: boolean;
    workforceResources?: { id: string; resource: string; availability: 'IN_HOUSE' | 'OUTSOURCED' | 'NOT_AVAILABLE'; headcount?: number | null }[];
    capabilities?: { id: string; capabilityGroup: string; value: string }[];
    categories?: { id: string; category: string; imageUrl?: string | null }[];
    catalogItems?: CatalogItem[];
    certifications?: Certificate[];
  } | null;
  businessMedia?: { id: string; mediaType: string; url: string; sortOrder: number }[];
  publicRating?: { average: number | null; count: number; breakdown?: { rating: number; count: number }[] };
  publicReviews?: { id: string; rating: number; comment?: string | null; createdAt: string; reviewerName: string }[];
  supplierTestimonials?: { id: string; customerName: string; rating: number; comment: string; createdAt: string }[];
};
type CatalogItem = { id: string; name: string; itemType: string; imageUrl?: string | null; images?: { id: string; imageUrl: string; sortOrder: number }[]; moderationStatus?: string };
type Certificate = { id: string; name: string; issuer?: string | null; category?: string | null; documentUrl?: string | null; status: string };
type PreviewTab = 'Overview' | 'Products' | 'Capabilities' | 'Factory' | 'Reviews';
const PREVIEW_TABS: PreviewTab[] = ['Overview', 'Products', 'Capabilities', 'Factory', 'Reviews'];
const absoluteMediaUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const base = API_BASE_URL.replace('/api', '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const PURPLE = ui.accent;
const sections = [
  { key: 'company', title: 'Company Information', subtitle: 'Basic company and legal details', icon: 'domain', target: 'company-information' },
  { key: 'gallery', title: 'Photos & Factory Gallery', subtitle: 'Logo, factory and product photos', icon: 'image-multiple-outline', target: 'business-gallery' },
  { key: 'products', title: 'Products & Portfolio', subtitle: 'Your products and previous work', icon: 'hanger', target: 'catalog' },
  { key: 'reels', title: 'Viral Trends / Reels', subtitle: 'Upload and manage short collection videos', icon: 'movie-play-outline', target: 'supplier-reels' },
  { key: 'trendy', title: 'Trendy Collection', subtitle: 'Showcase one featured collection to buyers', icon: 'crown-outline', target: 'trendy-collection' },
  { key: 'capabilities', title: 'Manufacturing Capabilities', subtitle: 'Categories, capacity, MOQ etc.', icon: 'factory', target: 'manufacturing-capabilities' },
  { key: 'certificates', title: 'Certifications', subtitle: 'Business and quality certificates', icon: 'certificate-outline', target: 'business-certifications' },
  { key: 'reviews', title: 'Reviews & Ratings', subtitle: 'Add customer testimonials and ratings', icon: 'star-plus-outline', target: 'supplier-reviews' },
  { key: 'contact', title: 'Contact Information', subtitle: 'Phone, email, website and address', icon: 'card-account-phone-outline', target: 'account-settings' },
] as const;

export default function SupplierBusinessProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('Overview');
  const [selectedProductImages, setSelectedProductImages] = useState<string[]>([]);
  const previewContentRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const selectPreviewTab = (tab: PreviewTab) => {
    setPreviewTab(tab);
    requestAnimationFrame(() => previewContentRef.current?.scrollTo({ y: 0, animated: false }));
  };

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Your supplier session was not found. Please sign in again.');
      const membership = JSON.parse(raw);
      const id = membership.organizationId || membership.organization?.id;
      if (!id) throw new Error('Your supplier organization could not be identified.');
      if (membership.role !== 'SUPPLIER') throw new Error('This profile is available to supplier accounts only.');
      const [org, items] = await Promise.all([
        apiGet<SupplierProfile>(`/organization-profile?organizationId=${encodeURIComponent(id)}`),
        apiGet<CatalogItem[]>(`/catalog-items?organizationId=${encodeURIComponent(id)}`).catch(() => []),
      ]);
      setProfile(org);
      setCatalog(Array.isArray(items) ? items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your business profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const completion = useMemo(
    () => getSupplierProfileCompletion(profile, catalog.length),
    [profile, catalog],
  );

  const navigate = (section: string) => {
    if (section === 'home') {
      router.replace('/workspace?role=SUPPLIER' as any);
      return;
    }
    if (section === 'company-information') {
      router.push({ pathname: '/supplier/[section]', params: { section: 'company-information' } } as any);
      return;
    }
    router.push({ pathname: '/supplier/[section]', params: { section } } as any);
  };

  const status = profile?.verificationStatus || 'PENDING';
  const statusColor = status === 'APPROVED' ? '#16804A' : status === 'REJECTED' ? '#B42318' : '#9A5B08';
  // Product listings are self-published by suppliers; all saved products are public.
  const approvedProducts = catalog.length ? catalog : (profile?.supplierProfile?.catalogItems || []);
  const pendingProducts: CatalogItem[] = [];

  return (
    <View style={s.screen}>
      <AppHeader role="SUPPLIER" title="My Business Profile" activeSection="profile" showLogo />
      {loading ? (
        <View style={s.state}><ActivityIndicator size="large" color={PURPLE} /><Text style={s.muted}>Loading your business profile…</Text></View>
      ) : error ? (
        <View style={s.state}>
          <MaterialCommunityIcons name="cloud-alert-outline" size={34} color="#98A2B3" />
          <Text style={s.stateTitle}>Couldn't load your profile</Text>
          <Text style={s.muted}>{error}</Text>
          <Pressable style={s.retry} onPress={() => void load()}><Text style={s.retryText}>Try again</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={PURPLE} />}>
          <Text style={s.heading}>My Business Profile</Text>
          <Text style={s.subheading}>Manage your company profile, factory, products, capabilities and verification details.</Text>

          <View style={s.companyCard}>
            <View style={s.logo}><MaterialCommunityIcons name="factory" size={25} color={PURPLE} /></View>
            <View style={s.companyText}>
              <Text numberOfLines={1} style={s.companyName}>{profile?.name || 'Your Company'}</Text>
              <Text numberOfLines={1} style={s.companyType}>{profile?.businessType || 'Garment Manufacturer'}</Text>
              <Text style={s.location}><MaterialCommunityIcons name="map-marker-outline" size={13} color="#667085" /> {profile?.city || 'Add your city'}{profile?.country ? `, ${profile.country}` : ''}</Text>
              <View style={[s.statusPill, { backgroundColor: status === 'APPROVED' ? '#E8F8EF' : status === 'REJECTED' ? '#FEF3F2' : '#FFF5E8' }]}>
                <MaterialCommunityIcons name={status === 'APPROVED' ? 'check-decagram' : 'clock-outline'} size={13} color={statusColor} />
                <Text style={[s.statusText, { color: statusColor }]}>{status === 'APPROVED' ? 'Verified' : status === 'REJECTED' ? 'Action Required' : 'Under Review'}</Text>
              </View>
            </View>
            <Pressable onPress={() => navigate('company-information')} hitSlop={8} style={s.editIcon}><MaterialCommunityIcons name="pencil-outline" size={18} color={PURPLE} /></Pressable>
          </View>

          <View style={s.completionCard}>
            <View style={s.completionTop}><Text style={s.completionTitle}>Profile Completion</Text><Text style={s.completionValue}>{completion}%</Text></View>
            <View style={s.progressTrack}><View style={[s.progressFill, { width: `${completion}%` }]} /></View>
            <Text style={s.progressHint}>{completion === 100 ? 'Your business profile is complete.' : 'Complete the sections below to build buyer confidence.'}</Text>
          </View>

          <View style={s.sectionList}>
            {sections.map((item, index) => (
              <Pressable key={item.key} onPress={() => navigate(item.target)} style={({ pressed }) => [s.sectionRow, pressed && s.pressed, index === sections.length - 1 && s.lastRow]}>
                <View style={s.sectionIcon}><MaterialCommunityIcons name={item.icon as any} size={19} color={PURPLE} /></View>
                <View style={s.sectionCopy}><Text style={s.sectionTitle}>{item.title}</Text><Text style={s.sectionSubtitle}>{item.subtitle}</Text></View>
                <MaterialCommunityIcons name="chevron-right" size={22} color="#98A2B3" />
              </Pressable>
            ))}
          </View>

          <Pressable style={s.previewButton} onPress={() => { setPreviewTab('Overview'); setPreviewOpen(true); void load(true); }}>
            <MaterialCommunityIcons name="eye-outline" size={17} color={PURPLE} />
            <Text style={s.previewText}>Preview Public Profile</Text>
          </Pressable>
          <Text style={s.note}>Only approved public business information is shown to buyers. Private account and payment details stay protected.</Text>
        </ScrollView>
      )}

      <AppBottomNav role="SUPPLIER" activeSection="profile" onNavigate={navigate} />

      <Modal visible={previewOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPreviewOpen(false)}>
        <View style={s.publicScreen}>
          <View style={s.publicTop}>
            <Pressable onPress={() => setPreviewOpen(false)} hitSlop={10}><MaterialCommunityIcons name="chevron-left" size={27} color="#1D2433" /></Pressable>
            <Text style={s.publicTopTitle}>Public Profile Preview</Text>
            <View style={{ width: 27 }} />
          </View>
          <ScrollView ref={previewContentRef} style={s.publicBody} contentContainerStyle={s.publicContent} showsVerticalScrollIndicator={false}>
              <View style={s.publicHero}>
                {(() => { const cover = profile?.businessMedia?.find(m => m.mediaType === 'COVER_PHOTO') || profile?.businessMedia?.find(m => m.mediaType === 'COMPANY_PHOTO'); return cover ? <Image source={{ uri: absoluteMediaUrl(cover.url) }} style={s.publicCover} /> : <View style={s.publicCoverFallback}><MaterialCommunityIcons name="factory" size={42} color="#A99BCB" /></View>; })()}
                <View style={s.publicIdentity}>
                  {(() => { const logo = profile?.businessMedia?.find(m => m.mediaType === 'COMPANY_LOGO'); return logo ? <Image source={{ uri: absoluteMediaUrl(logo.url) }} style={s.publicLogo} /> : <View style={s.publicLogoFallback}><MaterialCommunityIcons name="factory" size={25} color={PURPLE} /></View>; })()}
                  <View style={{ flex: 1 }}>
                    <Text style={s.publicName}>{profile?.name || 'Your Company'}</Text>
                    <Text style={s.publicType}>{profile?.businessType || 'Garment Manufacturer'}</Text>
                    <View style={s.publicVerified}><MaterialCommunityIcons name="check-decagram" size={12} color="#16804A" /><Text style={s.publicVerifiedText}>{profile?.verificationStatus === 'APPROVED' ? 'Verified Supplier' : 'Verification pending'}</Text></View>
                  </View>
                </View>
                <Text style={s.publicLocation}><MaterialCommunityIcons name="map-marker-outline" size={13} color="#7B8493" /> {profile?.city || 'Location not added'}{profile?.country ? `, ${profile.country}` : ''}</Text>
                <View style={s.publicRatingLine}><Text style={s.publicRatingValue}>★ {profile?.supplierTestimonials?.length ? (profile.supplierTestimonials.reduce((sum, item) => sum + item.rating, 0) / profile.supplierTestimonials.length).toFixed(1) : (profile?.publicRating?.average != null ? profile.publicRating.average.toFixed(1) : '—')}/5</Text><Text style={s.publicRatingMeta}>({profile?.supplierTestimonials?.length ? `${profile.supplierTestimonials.length} testimonials` : `${profile?.publicRating?.count || 0} verified reviews`})</Text></View>
                <View style={s.publicActionRow}><View style={s.publicActionDisabled}><Text style={s.publicActionText}>Send RFQ</Text></View><View style={s.publicActionOutline}><Text style={s.publicActionOutlineText}>Message Supplier</Text></View></View>
              </View>
            <ScrollView horizontal style={s.publicTabsScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={s.publicTabs}>
              {PREVIEW_TABS.map(tab => <Pressable key={tab} onPress={() => selectPreviewTab(tab)} style={[s.publicTab, previewTab === tab && s.publicTabActive]}><Text style={[s.publicTabText, previewTab === tab && s.publicTabTextActive]}>{tab}</Text></Pressable>)}
            </ScrollView>
            {previewTab === 'Overview' && <>
              <Text style={s.publicSectionTitle}>ABOUT THE COMPANY</Text>
              <Text style={s.publicDescription}>{profile?.supplierProfile?.description || 'Add a company description to introduce your business to buyers.'}</Text>
              <View style={s.publicMiniStats}><View style={s.publicMiniStat}><Text style={s.publicStatLabel}>Years in Business</Text><Text style={s.publicStatValue}>{profile?.supplierProfile?.yearsInBusiness ?? '—'}</Text></View><View style={s.publicMiniStat}><Text style={s.publicStatLabel}>Monthly Capacity</Text><Text style={s.publicStatValue}>{profile?.supplierProfile?.productionCapacity ? `${Number(profile.supplierProfile.productionCapacity).toLocaleString('en-IN')} pcs` : '—'}</Text></View></View>
              <Pressable onPress={() => selectPreviewTab('Products')} style={s.publicSectionLink}><Text style={s.publicSectionTitle}>PRODUCTS</Text><Text style={s.publicLinkText}>View all</Text></Pressable>
              <View style={s.publicProductGrid}>{approvedProducts.slice(0, 4).map(item => <View key={item.id} style={s.publicProductCard}>{item.imageUrl ? <Pressable onPress={() => setSelectedProductImages([item.imageUrl!, ...(item.images || []).map(image => image.imageUrl)].filter(Boolean).map(url => absoluteMediaUrl(url)))}><Image source={{ uri: absoluteMediaUrl(item.imageUrl) }} style={s.publicProductImage} resizeMode="contain" /></Pressable> : <View style={s.publicProductPlaceholder}><MaterialCommunityIcons name="tshirt-crew-outline" size={31} color="#A9A2B6" /></View>}<Text style={s.publicProductName} numberOfLines={1}>{item.name}</Text><Text style={s.publicProductType}>{item.itemType}</Text></View>)}</View>
              {!approvedProducts.length && <Text style={s.publicEmpty}>No products added yet.</Text>}
              {!!pendingProducts.length && <Text style={s.moderationNotice}>{pendingProducts.length} product(s) are under review and will appear to buyers after approval.</Text>}
            </>}
            {previewTab === 'Products' && <>
              <Text style={s.publicSectionTitle}>Products ({approvedProducts.length})</Text>
              <View style={s.publicProductGrid}>{approvedProducts.map(item => <View key={item.id} style={s.publicProductCard}>{item.imageUrl ? <Pressable onPress={() => setSelectedProductImages([item.imageUrl!, ...(item.images || []).map(image => image.imageUrl)].filter(Boolean).map(url => absoluteMediaUrl(url)))}><Image source={{ uri: absoluteMediaUrl(item.imageUrl) }} style={s.publicProductImage} resizeMode="contain" /></Pressable> : <View style={s.publicProductPlaceholder}><MaterialCommunityIcons name="tshirt-crew-outline" size={31} color="#A9A2B6" /></View>}<Text style={s.publicProductName} numberOfLines={1}>{item.name}</Text><Text style={s.publicProductType}>{item.itemType}</Text></View>)}</View>
              {!approvedProducts.length && <Text style={s.publicEmpty}>No products added yet.</Text>}
              {!!pendingProducts.length && <View style={s.moderationNoticeBox}><MaterialCommunityIcons name="clock-outline" size={16} color="#9A6700"/><Text style={s.moderationNotice}>{pendingProducts.length} product(s) are awaiting admin approval. They will appear to buyers once approved.</Text></View>}
            </>}
            {previewTab === 'Capabilities' && <>
              <Text style={s.publicSectionTitle}>Manufacturing Capabilities</Text>
              <View style={s.capabilityGrid}>{(profile?.supplierProfile?.categories || []).map(c => <View key={c.id} style={s.capabilityCard}>{c.imageUrl ? <Image source={{ uri: absoluteMediaUrl(c.imageUrl) }} style={s.capabilityImage} resizeMode="contain" /> : <View style={s.capabilityImageFallback}><MaterialCommunityIcons name="image-outline" size={25} color={PURPLE} /></View>}<Text style={s.capabilityText}>{c.category}</Text></View>)}</View>
              <View style={s.publicInfoCard}>
                <Text style={s.publicInfoTitle}>Production Capacity</Text><Text style={s.publicInfoValue}>{profile?.supplierProfile?.productionCapacity ? `${Number(profile.supplierProfile.productionCapacity).toLocaleString('en-IN')} pcs / month` : 'Not provided'}</Text>
                <Text style={s.publicInfoTitle}>Minimum Order Quantity – Pieces (PCS)</Text><Text style={s.publicInfoValue}>{profile?.supplierProfile?.minimumOrderQuantity ? `${Number(profile.supplierProfile.minimumOrderQuantity).toLocaleString('en-IN')} pcs` : 'Not provided'}</Text>
                <Text style={s.publicInfoTitle}>Minimum Order Quantity – Fabric (Meters)</Text><Text style={s.publicInfoValue}>{profile?.supplierProfile?.fabricMinimumOrderQuantity ? `${Number(profile.supplierProfile.fabricMinimumOrderQuantity).toLocaleString('en-IN')} meters` : 'Not provided'}</Text>
                <Text style={s.publicInfoTitle}>Years in Business</Text><Text style={s.publicInfoValue}>{profile?.supplierProfile?.yearsInBusiness ?? 'Not provided'} years</Text>
                <Text style={s.publicInfoTitle}>Sample Development</Text><Text style={s.publicInfoValue}>{profile?.supplierProfile?.sampleDevelopment ? 'Available' : 'Not available'}</Text>
              </View>
              <Text style={s.publicSectionTitle}>Fabric Expertise</Text><View style={s.chips}>{(profile?.supplierProfile?.capabilities || []).filter(item => item.capabilityGroup === 'FABRIC').map(item => <View key={item.id} style={s.chip}><Text style={s.chipText}>{item.value}</Text></View>)}</View>
              <Text style={s.publicSectionTitle}>Additional Capabilities</Text><View style={s.chips}>{(profile?.supplierProfile?.capabilities || []).filter(item => item.capabilityGroup === 'SERVICE').map(item => <View key={item.id} style={s.chip}><Text style={s.chipText}>{item.value}</Text></View>)}</View>
              {!!profile?.supplierProfile?.workforceResources?.length && (() => {
                const resources = profile.supplierProfile!.workforceResources!;
                const totalSize = resources.reduce((sum, item) => sum + (item.headcount ?? 0), 0);
                const activeTeams = resources.filter(item => item.availability !== 'NOT_AVAILABLE').length;
                const inHouseTeams = resources.filter(item => item.availability === 'IN_HOUSE').length;
                const roleIcons: Record<string, string> = { 'Cutting Masters': 'content-cut', 'Pattern Masters': 'chess-queen', 'Sampling Team': 'layers-outline', 'Stitching Operators': 'sewing-machine', 'Embroidery Team': 'flower-outline', 'Printing Team': 'printer-outline', 'Quality Inspectors': 'shield-check-outline', 'Production Supervisors': 'hard-hat' };
                return <View style={s.workforcePreviewCard}>
                  <View style={s.workforcePreviewHeader}><View style={s.workforceHeaderIcon}><MaterialCommunityIcons name="account-group-outline" size={23} color="#FFFFFF" /></View><View style={{ flex: 1 }}><Text style={s.workforceHeaderTitle}>Workforce & Team Availability</Text><Text style={s.workforceHeaderSubtitle}>Your skilled teams and current availability.</Text></View></View>
                  <View style={s.workforcePreviewBody}>
                    <View style={s.workforceSummary}><View style={s.workforceSummaryIcon}><MaterialCommunityIcons name="account-multiple-outline" size={22} color={PURPLE} /></View><View style={{ flex: 1 }}><Text style={s.workforceSummaryLabel}>Total Team Size <Text style={s.workforceOptional}>(Optional)</Text></Text><Text style={s.workforceSummaryHint}>Approximate number of team members</Text></View><View style={s.workforceTotalValue}><MaterialCommunityIcons name="account-group-outline" size={18} color={PURPLE} /><Text style={s.workforceSummaryValue}>{totalSize.toLocaleString('en-IN')}</Text></View></View>
                    <View style={s.workforceGrid}>{resources.map(item => {
                      const isHome = item.availability === 'IN_HOUSE';
                      const isOut = item.availability === 'OUTSOURCED';
                      return <View key={item.id || item.resource} style={s.workforceTile}>
                        <View style={s.workforceTileTop}><View style={s.workforceRoleIcon}><MaterialCommunityIcons name={(roleIcons[item.resource] || 'account-hard-hat-outline') as any} size={19} color={PURPLE} /></View><Text numberOfLines={2} style={s.workforceTileRole}>{item.resource}</Text></View>
                        <View style={s.workforceTileBottom}><Text style={s.workforceTileCount}>{item.headcount != null ? `Team size: ${item.headcount}` : 'Team size: —'}</Text><View style={[s.workforceStatusBadge, isHome ? s.workforceStatusHome : isOut ? s.workforceStatusOut : s.workforceStatusUnavailable]}><Text style={[s.workforceStatusText, isHome ? s.workforceStatusHomeText : isOut ? s.workforceStatusOutText : s.workforceStatusUnavailableText]}>{isHome ? 'In-house' : isOut ? 'Outsourced' : 'Not available'}</Text></View></View>
                      </View>;
                    })}</View>
                    <View style={s.workforceFootStats}><Text style={s.workforceFootText}>{activeTeams} of {resources.length} teams active</Text><Text style={s.workforceFootText}>{inHouseTeams} in-house teams</Text></View>
                  </View>
                </View>;
              })()}
            </>}
            {previewTab === 'Factory' && <>
              <Text style={s.publicSectionTitle}>Factory & Infrastructure</Text>
              <View style={s.factoryGrid}>{(profile?.businessMedia || []).filter(m => ['FACTORY_PHOTO', 'WORK_PROCESS', 'COMPANY_PHOTO'].includes(m.mediaType)).map(media => <Image key={media.id} source={{ uri: absoluteMediaUrl(media.url) }} style={s.factoryImage} />)}</View>
              {!(profile?.businessMedia || []).some(m => ['FACTORY_PHOTO', 'WORK_PROCESS', 'COMPANY_PHOTO'].includes(m.mediaType)) && <Text style={s.publicEmpty}>Factory and infrastructure photos will appear here after you add them to your gallery.</Text>}
              <Text style={s.publicSectionTitle}>Certifications</Text>
              <View style={s.certificateRow}>{(profile?.supplierProfile?.certifications || []).map(cert => <View key={cert.id} style={s.certificateBadge}><MaterialCommunityIcons name="certificate-outline" size={20} color="#1479B8" /><Text style={s.certificateName}>{cert.name}</Text><Text style={s.certificateIssuer}>{cert.category || cert.issuer || 'Verified'}</Text></View>)}</View>
              {!(profile?.supplierProfile?.certifications || []).length && <Text style={s.publicEmpty}>No verified certifications to display yet.</Text>}
            </>}
            {previewTab === 'Reviews' && <>
              <View style={s.reviewsSummary}><Text style={s.reviewsBig}>★ {profile?.supplierTestimonials?.length ? (profile.supplierTestimonials.reduce((sum, item) => sum + item.rating, 0) / profile.supplierTestimonials.length).toFixed(1) : (profile?.publicRating?.average != null ? profile.publicRating.average.toFixed(1) : '—')}/5</Text><Text style={s.publicRatingMeta}>Based on {profile?.supplierTestimonials?.length ? `${profile.supplierTestimonials.length} supplier testimonials` : `${profile?.publicRating?.count || 0} verified buyer reviews`}</Text></View>
              {[5,4,3,2,1].map(star => { const testimonials = profile?.supplierTestimonials || []; const total = testimonials.length || profile?.publicRating?.count || 0; const count = testimonials.length ? testimonials.filter(item => item.rating === star).length : (profile?.publicRating?.breakdown?.find(row => row.rating === star)?.count || 0); return <View key={star} style={s.ratingBarRow}><Text style={s.ratingStarLabel}>{star} ★</Text><View style={s.ratingBarTrack}><View style={[s.ratingBarFill,{width: total ? `${(count/total)*100}%` : '0%'}]} /></View><Text style={s.ratingCount}>{total ? Math.round(count/total*100) : 0}%</Text></View>; })}
              <Text style={s.publicSectionTitle}>Verified Buyer Reviews</Text>
              {(profile?.publicReviews || []).map(review => <View key={review.id} style={s.reviewCard}><Text style={s.reviewBuyer}>{review.reviewerName}</Text><Text style={s.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</Text>{review.comment ? <Text style={s.reviewComment}>{review.comment}</Text> : <Text style={s.reviewComment}>Buyer left a rating without a comment.</Text>}<Text style={s.reviewDate}>{new Date(review.createdAt).toLocaleDateString()}</Text></View>)}
              {!(profile?.publicReviews || []).length && <Text style={s.publicEmpty}>No verified buyer reviews yet. Completed orders and buyer feedback will appear here.</Text>}
              <Text style={s.publicSectionTitle}>Supplier-provided Testimonials</Text>
              {!!profile?.supplierTestimonials?.length
                ? profile.supplierTestimonials.map(item => <View key={item.id} style={s.reviewCard}><Text style={s.reviewBuyer}>{item.customerName}</Text><Text style={s.reviewStars}>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</Text><Text style={s.reviewComment}>{item.comment}</Text><Text style={s.testimonialSource}>Supplier-provided testimonial · {new Date(item.createdAt).toLocaleDateString()}</Text></View>)
                : <Text style={s.publicEmpty}>No supplier-provided testimonials added yet. Add a testimonial from Reviews & Ratings to display it here.</Text>}
            </>}
            <Text style={s.publicPreviewNote}>This is a preview of the public information buyers can see. RFQ and messaging actions are disabled in preview mode.</Text>
          </ScrollView>
          <Modal visible={selectedProductImages.length > 0} transparent animationType="fade" onRequestClose={() => setSelectedProductImages([])}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
              <Pressable onPress={() => setSelectedProductImages([])} style={{ position: 'absolute', top: 48, right: 22, zIndex: 2, width: 42, height: 42, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="close" size={28} color="#FFFFFF" /></Pressable>
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }}>{selectedProductImages.map((uri, index) => <View key={`${uri}-${index}`} style={{ width: Dimensions.get('window').width, height: '100%', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 12 }}><Image source={{ uri }} style={{ width: '100%', height: '85%' }} resizeMode="contain" /><Text style={{ color: '#FFFFFF', fontSize: 13, marginTop: 10 }}>{index + 1} / {selectedProductImages.length}</Text></View>)}</ScrollView>
            </View>
          </Modal>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 20, gap: 10, width: '100%', maxWidth: 840, alignSelf: 'center' },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '800', color: '#172033' },
  subheading: { fontSize: 13, lineHeight: 19, color: '#697386', marginTop: -5 },
  companyCard: { backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E7E7EF', padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 43, height: 43, borderRadius: 12, backgroundColor: '#F0EAFE', alignItems: 'center', justifyContent: 'center' },
  companyText: { flex: 1, minWidth: 0, gap: 2 },
  companyName: { color: '#1B2434', fontSize: 15, fontWeight: '800' },
  companyType: { color: '#4D5666', fontSize: 12, fontWeight: '600' },
  location: { color: '#667085', fontSize: 12 },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20, marginTop: 3 },
  statusText: { fontSize: 11, fontWeight: '800' },
  editIcon: { width: 31, height: 31, borderRadius: 9, backgroundColor: '#F5F1FF', alignItems: 'center', justifyContent: 'center' },
  completionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#ECECF2', gap: 7 },
  completionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completionTitle: { color: '#253044', fontSize: 13, fontWeight: '800' },
  completionValue: { color: '#16804A', fontSize: 14, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 10, backgroundColor: '#E9ECEF', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 10, backgroundColor: '#18B85A' },
  progressHint: { color: '#8490A0', fontSize: 11 },
  sectionList: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E8E8EF', borderRadius: 13, paddingHorizontal: 10 },
  sectionRow: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#F0F0F4', paddingVertical: 7 },
  lastRow: { borderBottomWidth: 0 },
  sectionIcon: { width: 31, height: 31, borderRadius: 9, backgroundColor: '#F2EDFF', alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: '#263044', fontSize: 12, fontWeight: '800' },
  sectionSubtitle: { color: '#8992A0', fontSize: 11 },
  pressed: { opacity: 0.65 },
  previewButton: { minHeight: 37, borderRadius: 8, borderWidth: 1.3, borderColor: PURPLE, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  previewText: { color: PURPLE, fontSize: 12, fontWeight: '800' },
  note: { color: '#98A2B3', fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 12 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  stateTitle: { color: '#253044', fontSize: 15, fontWeight: '800' },
  muted: { color: '#7A8494', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  retry: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: PURPLE, borderRadius: 9, marginTop: 4 },
  retryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.48)', justifyContent: 'flex-end' },
  previewSheet: { maxHeight: '88%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 12 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#EAECF0' },
  previewHeading: { color: '#1B2434', fontSize: 15, fontWeight: '900' },
  previewCompany: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  previewSection: { color: '#8992A0', fontSize: 9, fontWeight: '900', letterSpacing: 0.6, marginTop: 12 },
  previewBody: { color: '#596579', fontSize: 11, lineHeight: 17, marginTop: 5 },
  previewStats: { flexDirection: 'row', gap: 9, marginTop: 12 },
  previewStat: { flex: 1, backgroundColor: '#F8F7FC', padding: 10, borderRadius: 9, gap: 4 },
  previewStatLabel: { color: '#8992A0', fontSize: 9 },
  previewStatValue: { color: '#253044', fontSize: 13, fontWeight: '800' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F2EDFF' },
  chipText: { color: PURPLE, fontSize: 10, fontWeight: '700' },
  catalogRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F1F4' },
  catalogName: { color: '#263044', fontSize: 11, fontWeight: '800' },
  catalogType: { color: '#8992A0', fontSize: 9, marginTop: 2 },
  catalogStatus: { color: '#7B61B8', fontSize: 9, fontWeight: '800' },
  editProfileButton: { marginTop: 16, marginBottom: 10, padding: 12, borderRadius: 10, backgroundColor: PURPLE, alignItems: 'center' },
  editProfileText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  publicScreen: { flex: 1, backgroundColor: '#F7F8FC' },
  publicTop: { height: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECEEF3' },
  publicTopTitle: { color: '#202B3C', fontSize: 15, fontWeight: '900' },
  publicTabsScroll: { width: '100%', height: 42, flexGrow: 0, flexShrink: 0, backgroundColor: '#FFFFFF' },
  publicTabs: { width: '100%', minHeight: 42, flexGrow: 1, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#ECEEF3' },
  publicTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  publicTabActive: { borderBottomColor: PURPLE },
  publicTabText: { color: '#7B8493', fontSize: 12, fontWeight: '700' },
  publicTabTextActive: { color: PURPLE },
  publicBody: { flex: 1 },
  publicContent: { padding: 13, paddingBottom: 32, gap: 10 },
  publicHero: { backgroundColor: '#FFFFFF', borderRadius: 13, borderWidth: 1, borderColor: '#E8EAF0', paddingBottom: 12, overflow: 'hidden' },
  publicCover: { width: '100%', height: 145, resizeMode: 'cover' },
  publicCoverFallback: { height: 145, backgroundColor: '#EAE8F0', alignItems: 'center', justifyContent: 'center' },
  publicIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginTop: -20 },
  publicLogo: { width: 54, height: 54, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  publicLogoFallback: { width: 54, height: 54, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: '#F1ECFF', alignItems: 'center', justifyContent: 'center' },
  publicName: { color: '#1C2638', fontSize: 15, fontWeight: '900' },
  publicType: { color: '#657084', fontSize: 12, marginTop: 2 },
  publicVerified: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  publicVerifiedText: { color: '#16804A', fontSize: 11, fontWeight: '800' },
  publicLocation: { color: '#687386', fontSize: 12, marginTop: 9, paddingHorizontal: 12 },
  publicRatingLine: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, marginTop: 6 },
  publicRatingValue: { color: '#243044', fontSize: 14, fontWeight: '900' },
  publicRatingMeta: { color: '#8791A0', fontSize: 11 },
  publicActionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, marginTop: 10 },
  publicActionDisabled: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: PURPLE, alignItems: 'center', opacity: 0.55 },
  publicActionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  publicActionOutline: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: PURPLE, alignItems: 'center' },
  publicActionOutlineText: { color: PURPLE, fontSize: 12, fontWeight: '800' },
  publicSectionTitle: { color: '#283246', fontSize: 14, fontWeight: '900', marginTop: 8 },
  publicDescription: { color: '#586477', fontSize: 13, lineHeight: 20 },
  publicMiniStats: { flexDirection: 'row', gap: 8 },
  publicMiniStat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#ECEEF2', padding: 10, gap: 4 },
  publicStatLabel: { color: '#8791A0', fontSize: 11 },
  publicStatValue: { color: '#263044', fontSize: 14, fontWeight: '900' },
  publicSectionLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
  publicLinkText: { color: PURPLE, fontSize: 12, fontWeight: '800' },
  publicProductGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  publicProductCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E8EAF0', padding: 8, gap: 5 },
  publicProductImage: { width: '100%', height: 175, borderRadius: 8, backgroundColor: '#F7F7FA' },
  publicProductPlaceholder: { width: '100%', height: 175, borderRadius: 8, backgroundColor: '#F0F1F5', alignItems: 'center', justifyContent: 'center' },
  publicProductName: { color: '#263044', fontSize: 12, fontWeight: '900' },
  publicProductType: { color: '#8992A0', fontSize: 11 },
  publicEmpty: { color: '#8A93A1', fontSize: 10, lineHeight: 16, paddingVertical: 12 },
  moderationNoticeBox: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 9, backgroundColor: '#FFF7E8', borderWidth: 1, borderColor: '#F5DCA8' },
  moderationNotice: { color: '#8A5A0A', fontSize: 9, lineHeight: 14, flex: 1 },
  capabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  capabilityCard: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#ECEEF2', overflow: 'hidden', paddingBottom: 9, gap: 7 },
  capabilityImage: { width: '100%', height: 175, backgroundColor: '#F7F7FA' },
  capabilityImageFallback: { width: '100%', height: 175, backgroundColor: '#F5F1FF', alignItems: 'center', justifyContent: 'center' },
  capabilityText: { color: '#4B5567', fontSize: 12, fontWeight: '800', textAlign: 'center', paddingHorizontal: 4 },
  publicInfoCard: { backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#ECEEF2', padding: 12, gap: 5 },
  publicInfoTitle: { color: '#8992A0', fontSize: 11, fontWeight: '700', marginTop: 3 },
  publicInfoValue: { color: '#263044', fontSize: 14, fontWeight: '900' },
  workforcePreviewCard: { backgroundColor: '#FFFFFF', borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#E9E2FF', marginTop: 8, shadowColor: '#5B21B6', shadowOpacity: 0.08, shadowRadius: 9, elevation: 2 },
  workforcePreviewHeader: { minHeight: 68, backgroundColor: '#5B20D6', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11, gap: 10 },
  workforceHeaderIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  workforceHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' }, workforceHeaderSubtitle: { color: '#EEE7FF', fontSize: 13, marginTop: 4 },
  workforcePreviewBody: { padding: 9, gap: 9 },
  workforceSummary: { minHeight: 72, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  workforceSummaryIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#F3EDFF', alignItems: 'center', justifyContent: 'center' },
  workforceSummaryLabel: { color: '#222B3C', fontSize: 13, fontWeight: '900' }, workforceOptional: { color: '#8992A0', fontSize: 11, fontWeight: '500' }, workforceSummaryHint: { color: '#8992A0', fontSize: 11, marginTop: 3 },
  workforceTotalValue: { width: 112, minHeight: 42, borderRadius: 10, borderWidth: 1.5, borderColor: '#6424D6', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#FFFFFF' }, workforceSummaryValue: { color: '#21113E', fontSize: 19, fontWeight: '900', marginTop: 0 },
  workforceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  workforceTile: { width: '48.8%', minHeight: 74, borderRadius: 12, borderWidth: 1, borderColor: '#EEE8FF', backgroundColor: '#FFFFFF', padding: 8, justifyContent: 'space-between', gap: 6 },
  workforceTileTop: { flexDirection: 'row', alignItems: 'center', gap: 6 }, workforceRoleIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#F3EDFF', alignItems: 'center', justifyContent: 'center' },
  workforceTileRole: { flex: 1, color: '#222B3C', fontSize: 12, fontWeight: '900' }, workforceTileBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3 },
  workforceTileCount: { color: '#737B8C', fontSize: 10, fontWeight: '700', flexShrink: 1 }, workforceStatusBadge: { borderRadius: 12, paddingHorizontal: 6, paddingVertical: 5 }, workforceStatusText: { fontSize: 9, fontWeight: '900' },
  workforceStatusHome: { backgroundColor: '#D9F8E5' }, workforceStatusHomeText: { color: '#13733D' }, workforceStatusOut: { backgroundColor: '#FFF0C2' }, workforceStatusOutText: { color: '#925500' }, workforceStatusUnavailable: { backgroundColor: '#FFE1E3' }, workforceStatusUnavailableText: { color: '#B4232C' },
  workforceFootStats: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 2 }, workforceFootText: { color: '#6D55A8', fontSize: 10, fontWeight: '800' },
  factoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  factoryImage: { width: '47%', height: 112, borderRadius: 9, resizeMode: 'cover' },
  certificateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  certificateBadge: { width: '30%', backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#ECEEF2', padding: 9, alignItems: 'center', gap: 4 },
  certificateName: { color: '#263044', fontSize: 9, fontWeight: '900', textAlign: 'center' },
  certificateIssuer: { color: '#8992A0', fontSize: 8, textAlign: 'center' },
  reviewsSummary: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#ECEEF2', padding: 16, alignItems: 'center', gap: 5 },
  reviewsBig: { color: '#E4A000', fontSize: 26, fontWeight: '900' },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingStarLabel: { color: '#536074', fontSize: 9, width: 28 },
  ratingBarTrack: { flex: 1, height: 6, backgroundColor: '#E9EBF0', borderRadius: 10, overflow: 'hidden' },
  ratingBarFill: { height: 6, backgroundColor: '#7450D8', borderRadius: 10 },
  ratingCount: { color: '#758093', fontSize: 9, width: 30, textAlign: 'right' },
  reviewCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECEEF2', borderRadius: 10, padding: 11, gap: 5 },
  reviewBuyer: { color: '#263044', fontSize: 12, fontWeight: '900' },
  reviewStars: { color: '#E4A000', fontSize: 12 },
  reviewComment: { color: '#566174', fontSize: 10, lineHeight: 16 },
  reviewDate: { color: '#929AA7', fontSize: 8, textAlign: 'right' },
  testimonialSource: { color: '#6941C6', fontSize: 8, fontWeight: '800', marginTop: 2 },
  publicPreviewNote: { color: '#929AA7', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingVertical: 12 },
});
