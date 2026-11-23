import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiGet, apiPost, API_BASE_URL } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';

type Tab = 'Overview' | 'Products' | 'Capabilities' | 'Factory' | 'Reviews';
type Media = { id: string; mediaType: string; url: string; sortOrder: number };
type Catalog = { id: string; name: string; itemType: string; imageUrl?: string | null; images?: { id: string; imageUrl: string; sortOrder: number }[] };
type Certificate = { id: string; name: string; issuer?: string | null; category?: string | null; status: string };
type WorkforceResource = { id: string; resource: string; availability: 'IN_HOUSE' | 'OUTSOURCED' | 'NOT_AVAILABLE'; headcount?: number | null };
type PublicProfile = {
  id: string; name: string; businessType?: string | null; city?: string | null; country?: string | null;
  address?: string | null; verificationStatus: string;
  supplierProfile?: {
    description?: string | null; yearsInBusiness?: number | null; productionCapacity?: number | null;
    minimumOrderQuantity?: number | null; sampleDevelopment?: boolean;
    categories: { id: string; category: string; imageUrl?: string | null }[];
    capabilities: { id: string; capabilityGroup: string; value: string }[];
    workforceResources?: WorkforceResource[];
    catalogItems: Catalog[]; certifications: Certificate[];
  } | null;
  businessMedia: Media[];
  publicRating: { average: number | null; count: number; breakdown: { rating: number; count: number }[] };
  publicReviews: { id: string; rating: number; comment?: string | null; createdAt: string; reviewerName: string }[];
  supplierTestimonials?: { id: string; customerName: string; rating: number; comment: string; createdAt: string }[];
};
const TABS: Tab[] = ['Overview', 'Products', 'Capabilities', 'Factory', 'Reviews'];
const P = ui.accent;
const mediaUrl = (url?: string | null) => !url ? '' : url.startsWith('http') ? url : `${API_BASE_URL.replace('/api', '')}${url.startsWith('/') ? '' : '/'}${url}`;

export default function BuyerSupplierProfileScreen() {
  const router = useRouter();
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rfqOpen, setRfqOpen] = useState(false);
  const [selectedProductImages, setSelectedProductImages] = useState<string[]>([]);
  const [buyerOrgId, setBuyerOrgId] = useState('');

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError('');
    try {
      const [data, membershipRaw] = await Promise.all([
        apiGet<PublicProfile>(`/suppliers/${encodeURIComponent(String(organizationId))}/profile`),
        SecureStore.getItemAsync('sg_membership'),
      ]);
      if (membershipRaw) {
        const membership = JSON.parse(membershipRaw);
        if (membership.role !== 'BUYER') throw new Error('Please sign in with a buyer account.');
        setBuyerOrgId(membership.organizationId || membership.organization?.id || '');
      }
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load supplier profile.');
    } finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const startChat = async () => {
    if (!profile || !buyerOrgId) {
      Alert.alert('Unable to start chat', 'Your buyer organization could not be identified. Please sign in again.');
      return;
    }
    try {
      const conversation = await apiPost<{ id: string }>('/conversations', {
        buyerOrgId, supplierOrgId: profile.id,
      });
      router.push({ pathname: '/buyer/[section]', params: { section: 'chat', conversationId: conversation.id } } as any);
    } catch (e) {
      Alert.alert('Chat unavailable', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const media = profile?.businessMedia || [];
  const cover = media.find(m => m.mediaType === 'COVER_PHOTO') || media.find(m => m.mediaType === 'COMPANY_PHOTO');
  const logo = media.find(m => m.mediaType === 'COMPANY_LOGO');
  const products = profile?.supplierProfile?.catalogItems || [];
  const categories = profile?.supplierProfile?.categories || [];
  const capabilities = profile?.supplierProfile?.capabilities || [];

  return <View style={s.screen}>
    <AppHeader role="BUYER" isBack onBack={() => router.back()} title="Supplier Profile" showLogo />
    {loading ? <View style={s.state}><ActivityIndicator size="large" color={P}/><Text style={s.muted}>Loading supplier profile...</Text></View>
    : error || !profile ? <View style={s.state}><MaterialCommunityIcons name="cloud-alert-outline" size={36} color="#98A2B3"/><Text style={s.errorTitle}>Couldn't load supplier profile</Text><Text style={s.muted}>{error || 'Supplier profile not found.'}</Text><Pressable style={s.retry} onPress={() => void load()}><Text style={s.retryText}>Try again</Text></Pressable></View>
    : <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={s.hero}>
        {cover ? <Image source={{ uri: mediaUrl(cover.url) }} style={s.cover}/> : <View style={s.coverFallback}><MaterialCommunityIcons name="factory" size={44} color="#A99BCB"/></View>}
        <View style={s.identity}>
          {logo ? <Image source={{ uri: mediaUrl(logo.url) }} style={s.logo}/> : <View style={s.logoFallback}><MaterialCommunityIcons name="factory" size={25} color={P}/></View>}
          <View style={{flex:1}}>
            <Text style={s.name}>{profile.name}</Text>
            <View style={s.verified}><MaterialCommunityIcons name="check-decagram" size={14} color={profile.verificationStatus === 'APPROVED' ? '#16804A' : '#9A6700'}/><Text style={[s.verifiedText,{color:profile.verificationStatus === 'APPROVED' ? '#16804A' : '#9A6700'}]}>{profile.verificationStatus === 'APPROVED' ? 'Verified Supplier' : 'Verification pending'}</Text></View>
            <Text style={s.type}>{profile.businessType || 'Garment Manufacturer'}</Text>
          </View>
        </View>
        <Text style={s.meta}><MaterialCommunityIcons name="map-marker-outline" size={15} color="#667085"/> {profile.city || 'Location not added'}{profile.country ? `, ${profile.country}` : ''}</Text>
        <View style={s.ratingLine}><Text style={s.rating}>★ {profile.supplierTestimonials?.length ? (profile.supplierTestimonials.reduce((sum, item) => sum + item.rating, 0) / profile.supplierTestimonials.length).toFixed(1) : (profile.publicRating?.average != null ? profile.publicRating.average.toFixed(1) : '—')}/5</Text><Text style={s.mutedSmall}>({profile.supplierTestimonials?.length ? `${profile.supplierTestimonials.length} testimonials` : `${profile.publicRating?.count || 0} verified reviews`})</Text><View style={{flex:1}}/><Text style={s.orders}>STITCHGRID Supplier</Text></View>
        <View style={s.actions}>
          <Pressable style={s.primary} onPress={() => setRfqOpen(true)}><MaterialCommunityIcons name="send" size={16} color="#fff"/><Text style={s.primaryText}>Send RFQ</Text></Pressable>
          <Pressable style={s.secondary} onPress={() => void startChat()}><MaterialCommunityIcons name="message-text-outline" size={16} color={P}/><Text style={s.secondaryText}>Message Supplier</Text></Pressable>
        </View>
      </View>
      <ScrollView horizontal style={s.tabsScroll} contentContainerStyle={s.tabs} showsHorizontalScrollIndicator={false}>
        {TABS.map(item => <Pressable key={item} onPress={() => setTab(item)} style={[s.tab,tab===item&&s.activeTab]}><Text style={[s.tabText,tab===item&&s.activeTabText]}>{item}</Text></Pressable>)}
      </ScrollView>
      <View style={s.section}>
        {tab === 'Overview' && <>
          <Text style={s.sectionTitle}>ABOUT THE COMPANY</Text>
          <Text style={s.description}>{profile.supplierProfile?.description || 'Company description has not been added yet.'}</Text>
          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statLabel}>Years in Business</Text><Text style={s.statValue}>{profile.supplierProfile?.yearsInBusiness ?? '—'}</Text></View>
            <View style={s.stat}><Text style={s.statLabel}>Monthly Capacity</Text><Text style={s.statValue}>{profile.supplierProfile?.productionCapacity ? `${Number(profile.supplierProfile.productionCapacity).toLocaleString('en-IN')} pcs` : '—'}</Text></View>
          </View>
          <Pressable style={s.sectionLink} onPress={() => setTab('Products')}><Text style={s.sectionTitle}>PRODUCTS</Text><Text style={s.link}>View all</Text></Pressable>
          <View style={s.productGrid}>{products.slice(0,4).map(item => <View key={item.id} style={s.product}><Pressable onPress={() => setSelectedProductImages([item.imageUrl, ...(item.images || []).map(image => image.imageUrl)].filter(Boolean).map(url => mediaUrl(url)))}>{item.imageUrl ? <Image source={{uri:mediaUrl(item.imageUrl)}} style={s.productImage} resizeMode="contain"/> : <View style={s.productFallback}><MaterialCommunityIcons name="tshirt-crew-outline" size={28} color="#A9A2B6"/></View>}</Pressable><Text numberOfLines={1} style={s.productName}>{item.name}</Text><Text style={s.productType}>{item.itemType}</Text></View>)}</View>
        </>}
        {tab === 'Products' && <>
          <Text style={s.sectionTitle}>PRODUCTS ({products.length})</Text>
          <View style={s.productGrid}>{products.map(item => <View key={item.id} style={s.product}><Pressable onPress={() => setSelectedProductImages([item.imageUrl, ...(item.images || []).map(image => image.imageUrl)].filter(Boolean).map(url => mediaUrl(url)))}>{item.imageUrl ? <Image source={{uri:mediaUrl(item.imageUrl)}} style={s.productImage} resizeMode="contain"/> : <View style={s.productFallback}><MaterialCommunityIcons name="tshirt-crew-outline" size={28} color="#A9A2B6"/></View>}</Pressable><Text numberOfLines={1} style={s.productName}>{item.name}</Text><Text style={s.productType}>{item.itemType}</Text></View>)}</View>
          {!products.length && <Text style={s.empty}>No products have been added yet.</Text>}
        </>}
        {tab === 'Capabilities' && <>
          <Text style={s.sectionTitle}>MANUFACTURING CAPABILITIES</Text>
          <View style={s.capGrid}>{categories.map(c=><View key={c.id} style={s.capCard}>{c.imageUrl ? <Image source={{uri:mediaUrl(c.imageUrl)}} style={s.capImage} resizeMode="contain"/> : <View style={s.capImageFallback}><MaterialCommunityIcons name="image-outline" size={25} color={P}/></View>}<Text style={s.capText}>{c.category}</Text></View>)}</View>
          <View style={s.infoCard}>
            <Text style={s.statLabel}>Production Capacity</Text><Text style={s.statValue}>{profile.supplierProfile?.productionCapacity ? `${Number(profile.supplierProfile.productionCapacity).toLocaleString('en-IN')} pcs / month` : 'Not provided'}</Text>
            <Text style={s.statLabel}>Minimum Order Quantity (MOQ)</Text><Text style={s.statValue}>{profile.supplierProfile?.minimumOrderQuantity ? `${Number(profile.supplierProfile.minimumOrderQuantity).toLocaleString('en-IN')} pcs` : 'Not provided'}</Text>
            <Text style={s.statLabel}>Sample Development</Text><Text style={s.statValue}>{profile.supplierProfile?.sampleDevelopment ? 'Available' : 'Not available'}</Text>
          </View>
          <Text style={s.sectionTitle}>FABRIC EXPERTISE</Text><View style={s.chips}>{capabilities.filter(c=>c.capabilityGroup==='FABRIC').map(c=><Text key={c.id} style={s.chip}>{c.value}</Text>)}</View>
          <Text style={s.sectionTitle}>ADDITIONAL CAPABILITIES</Text><View style={s.chips}>{capabilities.filter(c=>c.capabilityGroup==='SERVICE').map(c=><Text key={c.id} style={s.chip}>{c.value}</Text>)}</View>
          {!!profile.supplierProfile?.workforceResources?.length && (() => {
            const resources = profile.supplierProfile!.workforceResources!;
            const totalSize = resources.reduce((sum, item) => sum + (item.headcount ?? 0), 0);
            const activeTeams = resources.filter(item => item.availability !== 'NOT_AVAILABLE').length;
            const inHouseTeams = resources.filter(item => item.availability === 'IN_HOUSE').length;
            const roleIcons: Record<string, string> = { 'Cutting Masters': 'content-cut', 'Pattern Masters': 'chess-queen', 'Sampling Team': 'layers-outline', 'Stitching Operators': 'sewing-machine', 'Embroidery Team': 'flower-outline', 'Printing Team': 'printer-outline', 'Quality Inspectors': 'shield-check-outline', 'Production Supervisors': 'hard-hat' };
            return <View style={s.workforcePreviewCard}>
              <View style={s.workforcePreviewHeader}><View style={s.workforceHeaderIcon}><MaterialCommunityIcons name="account-group-outline" size={23} color="#FFFFFF"/></View><View style={{flex:1}}><Text style={s.workforceHeaderTitle}>Workforce & Team Availability</Text><Text style={s.workforceHeaderSubtitle}>Skilled teams and current availability for your production needs.</Text></View></View>
              <View style={s.workforcePreviewBody}>
                <View style={s.workforceSummary}><View style={s.workforceSummaryIcon}><MaterialCommunityIcons name="account-multiple-outline" size={22} color={P}/></View><View style={{flex:1}}><Text style={s.workforceSummaryLabel}>Total Team Size <Text style={s.workforceOptional}>(Optional)</Text></Text><Text style={s.workforceSummaryHint}>Approximate number of team members</Text></View><View style={s.workforceTotalValue}><MaterialCommunityIcons name="account-group-outline" size={18} color={P}/><Text style={s.workforceSummaryValue}>{totalSize.toLocaleString('en-IN')}</Text></View></View>
                <View style={s.workforceGrid}>{resources.map(item => {
                  const isHome = item.availability === 'IN_HOUSE'; const isOut = item.availability === 'OUTSOURCED';
                  return <View key={item.id || item.resource} style={s.workforceTile}>
                    <View style={s.workforceTileTop}><View style={s.workforceRoleIcon}><MaterialCommunityIcons name={(roleIcons[item.resource] || 'account-hard-hat-outline') as any} size={19} color={P}/></View><Text numberOfLines={2} style={s.workforceTileRole}>{item.resource}</Text></View>
                    <View style={s.workforceTileBottom}><Text style={s.workforceTileCount}>{item.headcount != null ? `Team size: ${item.headcount}` : 'Team size: —'}</Text><View style={[s.workforceStatusBadge,isHome?s.workforceStatusHome:isOut?s.workforceStatusOut:s.workforceStatusUnavailable]}><Text style={[s.workforceStatusText,isHome?s.workforceStatusHomeText:isOut?s.workforceStatusOutText:s.workforceStatusUnavailableText]}>{isHome?'In-house':isOut?'Outsourced':'Not available'}</Text></View></View>
                  </View>;
                })}</View>
                <View style={s.workforceFootStats}><Text style={s.workforceFootText}>{activeTeams} of {resources.length} teams active</Text><Text style={s.workforceFootText}>{inHouseTeams} in-house teams</Text></View>
              </View>
            </View>;
          })()}
        </>}
        {tab === 'Factory' && <>
          <Text style={s.sectionTitle}>FACTORY & INFRASTRUCTURE</Text>
          <View style={s.factoryGrid}>{media.filter(m=>['FACTORY_PHOTO','WORK_PROCESS','COMPANY_PHOTO'].includes(m.mediaType)).map(m=><Image key={m.id} source={{uri:mediaUrl(m.url)}} style={s.factoryImage}/>)}</View>
          {!media.some(m=>['FACTORY_PHOTO','WORK_PROCESS','COMPANY_PHOTO'].includes(m.mediaType)) && <Text style={s.empty}>Factory photos will appear here when added by the supplier.</Text>}
          <Text style={s.sectionTitle}>CERTIFICATIONS</Text>
          <View style={s.certificateGrid}>{(profile.supplierProfile?.certifications||[]).map(c=><View key={c.id} style={s.certificate}><MaterialCommunityIcons name="certificate-outline" size={22} color="#1479B8"/><Text style={s.productName}>{c.name}</Text><Text style={s.productType}>{c.category||c.issuer||'Verified'}</Text></View>)}</View>
          {!(profile.supplierProfile?.certifications||[]).length && <Text style={s.empty}>No verified certifications available.</Text>}
        </>}
        {tab === 'Reviews' && <>
          <View style={s.reviewSummary}><Text style={s.reviewBig}>★ {profile.supplierTestimonials?.length ? (profile.supplierTestimonials.reduce((sum, item) => sum + item.rating, 0) / profile.supplierTestimonials.length).toFixed(1) : (profile.publicRating?.average != null ? profile.publicRating.average.toFixed(1) : '—')}/5</Text><Text style={s.mutedSmall}>Based on {profile.supplierTestimonials?.length ? `${profile.supplierTestimonials.length} supplier testimonials` : `${profile.publicRating?.count||0} verified buyer reviews`}</Text></View>
          {[5,4,3,2,1].map(star=>{const testimonials=profile.supplierTestimonials||[];const total=testimonials.length||profile.publicRating?.count||0;const count=testimonials.length?testimonials.filter(item=>item.rating===star).length:(profile.publicRating?.breakdown?.find(r=>r.rating===star)?.count||0);return <View key={star} style={s.ratingRow}><Text style={s.mutedSmall}>{star} ★</Text><View style={s.bar}><View style={[s.barFill,{width:total?`${count/total*100}%`:'0%'}]}/></View><Text style={s.mutedSmall}>{total?Math.round(count/total*100):0}%</Text></View>})}
          <Text style={s.sectionTitle}>VERIFIED BUYER REVIEWS</Text>
          {(profile.publicReviews||[]).map(review=><View key={review.id} style={s.reviewCard}><Text style={s.productName}>{review.reviewerName}</Text><Text style={s.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</Text><Text style={s.description}>{review.comment||'Buyer left a rating without a comment.'}</Text><Text style={s.productType}>{new Date(review.createdAt).toLocaleDateString()}</Text></View>)}
          {!(profile.publicReviews||[]).length&&<Text style={s.empty}>No verified buyer reviews yet.</Text>}
          {!!profile.supplierTestimonials?.length && <>
            <Text style={s.sectionTitle}>SUPPLIER-PROVIDED TESTIMONIALS</Text>
            {profile.supplierTestimonials.map(item=><View key={item.id} style={s.reviewCard}><Text style={s.productName}>{item.customerName}</Text><Text style={s.reviewStars}>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</Text><Text style={s.description}>{item.comment}</Text><View style={s.testimonialSource}><MaterialCommunityIcons name="account-edit-outline" size={12} color="#6941C6"/><Text style={s.testimonialSourceText}>Supplier-provided testimonial · {new Date(item.createdAt).toLocaleDateString()}</Text></View></View>)}
          </>}
        </>}
      </View>
    </ScrollView>}
    <CreateRfqModal visible={rfqOpen} onClose={()=>setRfqOpen(false)} onSuccess={()=>{setRfqOpen(false);router.push({pathname:'/buyer/[section]',params:{section:'requests'}} as any);}} supplierOrgId={profile?.id} supplierName={profile?.name}/>
    <Modal visible={selectedProductImages.length>0} transparent animationType="fade" onRequestClose={()=>setSelectedProductImages([])}>
      <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.94)',justifyContent:'center',alignItems:'center',paddingVertical:40}}>
        <Pressable onPress={()=>setSelectedProductImages([])} style={{position:'absolute',top:48,right:22,zIndex:2,width:42,height:42,borderRadius:22,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'}}><MaterialCommunityIcons name="close" size={28} color="#FFFFFF"/></Pressable>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{width:'100%'}} contentContainerStyle={{alignItems:'center'}}>{selectedProductImages.map((uri,index)=><View key={`${uri}-${index}`} style={{width:Dimensions.get('window').width,height:'100%',justifyContent:'center',alignItems:'center',paddingHorizontal:12}}><Image source={{uri}} style={{width:'100%',height:'85%'}} resizeMode="contain"/><Text style={{color:'#FFFFFF',fontSize:13,marginTop:10}}>{index+1} / {selectedProductImages.length}</Text></View>)}</ScrollView>
      </View>
    </Modal>
  </View>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:ui.canvas},state:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:10},muted:{fontSize:12,color:'#7A8494',textAlign:'center'},errorTitle:{fontSize:16,fontWeight:'800',color:ui.ink},retry:{backgroundColor:P,paddingHorizontal:18,paddingVertical:10,borderRadius:9},retryText:{color:'#fff',fontWeight:'800'},content:{padding:12,paddingBottom:30,gap:0},
 hero:{backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:'#E6E7EB',overflow:'hidden',paddingBottom:13,marginBottom:0},cover:{height:150,width:'100%',resizeMode:'cover'},coverFallback:{height:150,backgroundColor:'#ECECF2',alignItems:'center',justifyContent:'center'},identity:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14,marginTop:-25},logo:{width:66,height:66,borderRadius:14,borderWidth:3,borderColor:'#fff',backgroundColor:'#F4EEFF'},logoFallback:{width:66,height:66,borderRadius:14,borderWidth:3,borderColor:'#fff',backgroundColor:'#F4EEFF',alignItems:'center',justifyContent:'center'},name:{fontSize:20,fontWeight:'900',color:'#172033'},verified:{flexDirection:'row',alignItems:'center',gap:4,marginTop:2},verifiedText:{fontSize:12,fontWeight:'800'},type:{fontSize:13,color:'#596579',marginTop:3},meta:{fontSize:13,color:'#667085',paddingHorizontal:15,marginTop:9},ratingLine:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:15,marginTop:7},rating:{fontSize:16,fontWeight:'900',color:'#A56A00'},mutedSmall:{fontSize:12,color:'#667085'},orders:{fontSize:12,fontWeight:'800',color:'#253044'},actions:{flexDirection:'row',gap:9,paddingHorizontal:13,marginTop:12},primary:{flex:1,minHeight:43,backgroundColor:P,borderRadius:9,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},primaryText:{color:'#fff',fontWeight:'800',fontSize:14},secondary:{flex:1,minHeight:43,borderRadius:9,borderWidth:1,borderColor:P,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},secondaryText:{color:P,fontWeight:'800',fontSize:14},
 tabsScroll:{height:46,flexGrow:0,flexShrink:0,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#ECEEF3'},tabs:{minHeight:46,paddingHorizontal:5,alignItems:'center',gap:15},tab:{height:46,justifyContent:'center',borderBottomWidth:2,borderBottomColor:'transparent',paddingHorizontal:4},activeTab:{borderBottomColor:P},tabText:{fontSize:13,color:'#667085',fontWeight:'700'},activeTabText:{color:P},section:{paddingTop:15,gap:12},sectionTitle:{fontSize:14,fontWeight:'900',color:'#253044'},description:{fontSize:14,lineHeight:18,color:'#4B5565'},stats:{flexDirection:'row',gap:8},stat:{flex:1,backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,padding:11,gap:4},statLabel:{fontSize:12,color:'#8992A0'},statValue:{fontSize:15,fontWeight:'900',color:'#253044'},sectionLink:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4},link:{fontSize:13,color:P,fontWeight:'800'},productGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'},product:{width:'48%',backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:12,padding:8},productImage:{height:175,width:'100%',borderRadius:8,backgroundColor:'#F7F7FA'},productFallback:{height:175,backgroundColor:'#F5F3F9',alignItems:'center',justifyContent:'center',borderRadius:8},productName:{fontSize:13,fontWeight:'800',color:'#253044',marginTop:5},productType:{fontSize:12,color:'#7B8494',marginTop:2},empty:{fontSize:14,color:'#8992A0',paddingVertical:14},capGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,justifyContent:'space-between'},capCard:{width:'48%',backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:12,overflow:'hidden',paddingBottom:9,gap:7},capImage:{width:'100%',height:175,backgroundColor:'#F7F7FA'},capImageFallback:{width:'100%',height:175,backgroundColor:'#F5F1FF',alignItems:'center',justifyContent:'center'},capText:{fontSize:12,color:'#253044',fontWeight:'800',textAlign:'center',paddingHorizontal:4},infoCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:11,padding:13,gap:6},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{backgroundColor:'#F2EDFF',color:P,paddingHorizontal:10,paddingVertical:7,borderRadius:20,fontSize:12,fontWeight:'800'},factoryGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},factoryImage:{width:'48%',height:115,borderRadius:10,resizeMode:'cover'},certificateGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},certificate:{width:'48%',backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,padding:11,gap:4},workforcePreviewCard:{backgroundColor:'#fff',borderRadius:17,overflow:'hidden',borderWidth:1,borderColor:'#E9E2FF',marginTop:8,shadowColor:'#5B21B6',shadowOpacity:0.08,shadowRadius:9,elevation:2},workforcePreviewHeader:{minHeight:68,backgroundColor:'#5B20D6',flexDirection:'row',alignItems:'center',paddingHorizontal:13,paddingVertical:11,gap:10},workforceHeaderIcon:{width:42,height:42,borderRadius:14,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'},workforceHeaderTitle:{color:'#fff',fontSize:16,fontWeight:'900'},workforceHeaderSubtitle:{color:'#EEE7FF',fontSize:13,marginTop:4},workforcePreviewBody:{padding:9,gap:9},workforceSummary:{minHeight:72,backgroundColor:'#fff',borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',gap:9},workforceSummaryIcon:{width:36,height:36,borderRadius:11,backgroundColor:'#F3EDFF',alignItems:'center',justifyContent:'center'},workforceSummaryLabel:{color:'#222B3C',fontSize:13,fontWeight:'900'},workforceOptional:{color:'#8992A0',fontSize:11,fontWeight:'500'},workforceSummaryHint:{color:'#8992A0',fontSize:11,marginTop:3},workforceTotalValue:{width:112,minHeight:42,borderRadius:10,borderWidth:1.5,borderColor:'#6424D6',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,backgroundColor:'#fff'},workforceSummaryValue:{color:'#21113E',fontSize:19,fontWeight:'900',marginTop:0},workforceGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},workforceTile:{width:'48.8%',minHeight:74,borderRadius:12,borderWidth:1,borderColor:'#EEE8FF',backgroundColor:'#fff',padding:8,justifyContent:'space-between',gap:6},workforceTileTop:{flexDirection:'row',alignItems:'center',gap:6},workforceRoleIcon:{width:30,height:30,borderRadius:10,backgroundColor:'#F3EDFF',alignItems:'center',justifyContent:'center'},workforceTileRole:{flex:1,color:'#222B3C',fontSize:12,fontWeight:'900'},workforceTileBottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:3},workforceTileCount:{color:'#737B8C',fontSize:10,fontWeight:'700',flexShrink:1},workforceStatusBadge:{borderRadius:12,paddingHorizontal:6,paddingVertical:5},workforceStatusText:{fontSize:9,fontWeight:'900'},workforceStatusHome:{backgroundColor:'#D9F8E5'},workforceStatusHomeText:{color:'#13733D'},workforceStatusOut:{backgroundColor:'#FFF0C2'},workforceStatusOutText:{color:'#925500'},workforceStatusUnavailable:{backgroundColor:'#FFE1E3'},workforceStatusUnavailableText:{color:'#B4232C'},workforceFootStats:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:4,paddingTop:2},workforceFootText:{color:'#6D55A8',fontSize:10,fontWeight:'800'},reviewSummary:{alignItems:'center',padding:15,backgroundColor:'#fff',borderRadius:12,borderWidth:1,borderColor:'#E7E7EF'},reviewBig:{fontSize:27,fontWeight:'900',color:'#D18B00'},ratingRow:{flexDirection:'row',alignItems:'center',gap:8},bar:{flex:1,height:7,backgroundColor:'#E9E7EF',borderRadius:9,overflow:'hidden'},barFill:{height:7,backgroundColor:P,borderRadius:9},reviewCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,padding:12,gap:5},reviewStars:{color:'#E0A000',fontSize:13},testimonialSource:{alignSelf:'flex-start',backgroundColor:'#F1EAFE',borderRadius:18,paddingHorizontal:8,paddingVertical:4,flexDirection:'row',alignItems:'center',gap:4},testimonialSourceText:{color:'#6941C6',fontSize:8,fontWeight:'800'}
});
