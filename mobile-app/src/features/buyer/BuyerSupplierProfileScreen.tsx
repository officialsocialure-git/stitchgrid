import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiGet, apiPost, API_BASE_URL } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';

type Tab = 'Overview' | 'Products' | 'Capabilities' | 'Factory' | 'Reviews';
type Media = { id: string; mediaType: string; url: string; sortOrder: number };
type Catalog = { id: string; name: string; itemType: string; imageUrl?: string | null };
type Certificate = { id: string; name: string; issuer?: string | null; category?: string | null; status: string };
type PublicProfile = {
  id: string; name: string; businessType?: string | null; city?: string | null; country?: string | null;
  address?: string | null; verificationStatus: string;
  supplierProfile?: {
    description?: string | null; yearsInBusiness?: number | null; productionCapacity?: number | null;
    minimumOrderQuantity?: number | null; sampleDevelopment?: boolean;
    categories: { id: string; category: string }[];
    capabilities: { id: string; capabilityGroup: string; value: string }[];
    catalogItems: Catalog[]; certifications: Certificate[];
  } | null;
  businessMedia: Media[];
  publicRating: { average: number | null; count: number; breakdown: { rating: number; count: number }[] };
  publicReviews: { id: string; rating: number; comment?: string | null; createdAt: string; reviewerName: string }[];
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
        <View style={s.ratingLine}><Text style={s.rating}>★ {profile.publicRating?.average != null ? profile.publicRating.average.toFixed(1) : '—'}/5</Text><Text style={s.mutedSmall}>({profile.publicRating?.count || 0} Reviews)</Text><View style={{flex:1}}/><Text style={s.orders}>STITCHGRID Supplier</Text></View>
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
          <View style={s.productGrid}>{products.slice(0,4).map(item => <View key={item.id} style={s.product}>{item.imageUrl ? <Image source={{uri:mediaUrl(item.imageUrl)}} style={s.productImage}/> : <View style={s.productFallback}><MaterialCommunityIcons name="tshirt-crew-outline" size={28} color="#A9A2B6"/></View>}<Text numberOfLines={1} style={s.productName}>{item.name}</Text><Text style={s.productType}>{item.itemType}</Text></View>)}</View>
        </>}
        {tab === 'Products' && <>
          <Text style={s.sectionTitle}>PRODUCTS ({products.length})</Text>
          <View style={s.productGrid}>{products.map(item => <View key={item.id} style={s.product}>{item.imageUrl ? <Image source={{uri:mediaUrl(item.imageUrl)}} style={s.productImage}/> : <View style={s.productFallback}><MaterialCommunityIcons name="tshirt-crew-outline" size={28} color="#A9A2B6"/></View>}<Text numberOfLines={1} style={s.productName}>{item.name}</Text><Text style={s.productType}>{item.itemType}</Text></View>)}</View>
          {!products.length && <Text style={s.empty}>No approved products are available yet.</Text>}
        </>}
        {tab === 'Capabilities' && <>
          <Text style={s.sectionTitle}>MANUFACTURING CAPABILITIES</Text>
          <View style={s.capGrid}>{categories.map(c=><View key={c.id} style={s.capCard}><MaterialCommunityIcons name="tshirt-crew-outline" size={22} color={P}/><Text style={s.capText}>{c.category}</Text></View>)}</View>
          <View style={s.infoCard}>
            <Text style={s.statLabel}>Production Capacity</Text><Text style={s.statValue}>{profile.supplierProfile?.productionCapacity ? `${Number(profile.supplierProfile.productionCapacity).toLocaleString('en-IN')} pcs / month` : 'Not provided'}</Text>
            <Text style={s.statLabel}>Minimum Order Quantity (MOQ)</Text><Text style={s.statValue}>{profile.supplierProfile?.minimumOrderQuantity ? `${Number(profile.supplierProfile.minimumOrderQuantity).toLocaleString('en-IN')} pcs` : 'Not provided'}</Text>
            <Text style={s.statLabel}>Sample Development</Text><Text style={s.statValue}>{profile.supplierProfile?.sampleDevelopment ? 'Available' : 'Not available'}</Text>
          </View>
          <Text style={s.sectionTitle}>FABRIC EXPERTISE</Text><View style={s.chips}>{capabilities.filter(c=>c.capabilityGroup==='FABRIC').map(c=><Text key={c.id} style={s.chip}>{c.value}</Text>)}</View>
          <Text style={s.sectionTitle}>ADDITIONAL CAPABILITIES</Text><View style={s.chips}>{capabilities.filter(c=>c.capabilityGroup==='SERVICE').map(c=><Text key={c.id} style={s.chip}>{c.value}</Text>)}</View>
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
          <View style={s.reviewSummary}><Text style={s.reviewBig}>★ {profile.publicRating?.average != null ? profile.publicRating.average.toFixed(1) : '—'}/5</Text><Text style={s.mutedSmall}>Based on {profile.publicRating?.count||0} reviews</Text></View>
          {[5,4,3,2,1].map(star=>{const count=profile.publicRating?.breakdown?.find(r=>r.rating===star)?.count||0;const total=profile.publicRating?.count||0;return <View key={star} style={s.ratingRow}><Text style={s.mutedSmall}>{star} ★</Text><View style={s.bar}><View style={[s.barFill,{width:total?`${count/total*100}%`:'0%'}]}/></View><Text style={s.mutedSmall}>{total?Math.round(count/total*100):0}%</Text></View>})}
          <Text style={s.sectionTitle}>BUYER REVIEWS</Text>
          {(profile.publicReviews||[]).map(review=><View key={review.id} style={s.reviewCard}><Text style={s.productName}>{review.reviewerName}</Text><Text style={s.reviewStars}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</Text><Text style={s.description}>{review.comment||'Buyer left a rating without a comment.'}</Text><Text style={s.productType}>{new Date(review.createdAt).toLocaleDateString()}</Text></View>)}
          {!(profile.publicReviews||[]).length&&<Text style={s.empty}>No buyer reviews yet.</Text>}
        </>}
      </View>
    </ScrollView>}
    <CreateRfqModal visible={rfqOpen} onClose={()=>setRfqOpen(false)} onSuccess={()=>{setRfqOpen(false);router.push({pathname:'/buyer/[section]',params:{section:'requests'}} as any);}} supplierOrgId={profile?.id} supplierName={profile?.name}/>
  </View>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:ui.canvas},state:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:10},muted:{fontSize:12,color:'#7A8494',textAlign:'center'},errorTitle:{fontSize:16,fontWeight:'800',color:ui.ink},retry:{backgroundColor:P,paddingHorizontal:18,paddingVertical:10,borderRadius:9},retryText:{color:'#fff',fontWeight:'800'},content:{padding:12,paddingBottom:30,gap:0},
 hero:{backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:'#E6E7EB',overflow:'hidden',paddingBottom:13,marginBottom:0},cover:{height:150,width:'100%',resizeMode:'cover'},coverFallback:{height:150,backgroundColor:'#ECECF2',alignItems:'center',justifyContent:'center'},identity:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:14,marginTop:-25},logo:{width:66,height:66,borderRadius:14,borderWidth:3,borderColor:'#fff',backgroundColor:'#F4EEFF'},logoFallback:{width:66,height:66,borderRadius:14,borderWidth:3,borderColor:'#fff',backgroundColor:'#F4EEFF',alignItems:'center',justifyContent:'center'},name:{fontSize:18,fontWeight:'900',color:'#172033'},verified:{flexDirection:'row',alignItems:'center',gap:4,marginTop:2},verifiedText:{fontSize:11,fontWeight:'800'},type:{fontSize:11,color:'#596579',marginTop:3},meta:{fontSize:12,color:'#667085',paddingHorizontal:15,marginTop:9},ratingLine:{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:15,marginTop:7},rating:{fontSize:14,fontWeight:'900',color:'#A56A00'},mutedSmall:{fontSize:11,color:'#667085'},orders:{fontSize:11,fontWeight:'800',color:'#253044'},actions:{flexDirection:'row',gap:9,paddingHorizontal:13,marginTop:12},primary:{flex:1,minHeight:43,backgroundColor:P,borderRadius:9,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},primaryText:{color:'#fff',fontWeight:'800',fontSize:12},secondary:{flex:1,minHeight:43,borderRadius:9,borderWidth:1,borderColor:P,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:6},secondaryText:{color:P,fontWeight:'800',fontSize:12},
 tabsScroll:{height:46,flexGrow:0,flexShrink:0,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#ECEEF3'},tabs:{minHeight:46,paddingHorizontal:5,alignItems:'center',gap:15},tab:{height:46,justifyContent:'center',borderBottomWidth:2,borderBottomColor:'transparent',paddingHorizontal:4},activeTab:{borderBottomColor:P},tabText:{fontSize:11,color:'#667085',fontWeight:'700'},activeTabText:{color:P},section:{paddingTop:15,gap:12},sectionTitle:{fontSize:12,fontWeight:'900',color:'#253044'},description:{fontSize:12,lineHeight:18,color:'#4B5565'},stats:{flexDirection:'row',gap:8},stat:{flex:1,backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,padding:11,gap:4},statLabel:{fontSize:10,color:'#8992A0'},statValue:{fontSize:13,fontWeight:'900',color:'#253044'},sectionLink:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:4},link:{fontSize:11,color:P,fontWeight:'800'},productGrid:{flexDirection:'row',flexWrap:'wrap',gap:9},product:{width:'31%',backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,padding:7},productImage:{height:105,width:'100%',resizeMode:'cover',borderRadius:7},productFallback:{height:105,backgroundColor:'#F5F3F9',alignItems:'center',justifyContent:'center',borderRadius:7},productName:{fontSize:11,fontWeight:'800',color:'#253044',marginTop:5},productType:{fontSize:10,color:'#7B8494',marginTop:2},empty:{fontSize:12,color:'#8992A0',paddingVertical:14},capGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},capCard:{width:'31%',minHeight:78,backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,alignItems:'center',justifyContent:'center',padding:8,gap:5},capText:{fontSize:10,color:'#253044',fontWeight:'700',textAlign:'center'},infoCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:11,padding:13,gap:6},chips:{flexDirection:'row',flexWrap:'wrap',gap:7},chip:{backgroundColor:'#F2EDFF',color:P,paddingHorizontal:10,paddingVertical:7,borderRadius:20,fontSize:10,fontWeight:'800'},factoryGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},factoryImage:{width:'48%',height:115,borderRadius:10,resizeMode:'cover'},certificateGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},certificate:{width:'48%',backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,padding:11,gap:4},reviewSummary:{alignItems:'center',padding:15,backgroundColor:'#fff',borderRadius:12,borderWidth:1,borderColor:'#E7E7EF'},reviewBig:{fontSize:27,fontWeight:'900',color:'#D18B00'},ratingRow:{flexDirection:'row',alignItems:'center',gap:8},bar:{flex:1,height:7,backgroundColor:'#E9E7EF',borderRadius:9,overflow:'hidden'},barFill:{height:7,backgroundColor:P,borderRadius:9},reviewCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E7E7EF',borderRadius:10,padding:12,gap:5},reviewStars:{color:'#E0A000',fontSize:13}
});
