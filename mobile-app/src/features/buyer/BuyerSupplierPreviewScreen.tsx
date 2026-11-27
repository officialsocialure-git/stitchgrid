import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet, API_BASE_URL } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import CreateRfqModal from '@/features/buyer/CreateRfqModal';

type Product = { id: string; name: string; itemType?: string; imageUrl?: string | null; images?: { id?: string; imageUrl: string; sortOrder?: number }[] };
type Profile = {
  id: string; name: string; businessType?: string | null; city?: string | null; country?: string | null;
  verificationStatus: string; businessMedia?: { id: string; mediaType: string; url: string }[];
  trendyCollection?: { id: string; name: string; imageUrl: string; images?: string[] } | null;
  supplierProfile?: { yearsInBusiness?: number | null; catalogItems?: Product[] | null } | null;
  publicRating?: { average: number | null; count: number };
  supplierTestimonials?: { id: string; rating: number }[];
  orderCount?: number | null; completedOrders?: number | null;
};
const P = ui.accent;
const imageUri = (url?: string | null) => !url ? '' : url.startsWith('http') ? url : `${API_BASE_URL.replace('/api', '')}${url.startsWith('/') ? '' : '/'}${url}`;
const W = Dimensions.get('window').width - 28;

export default function BuyerSupplierPreviewScreen() {
  const router = useRouter();
  const { organizationId, collectionImageUrl } = useLocalSearchParams<{ organizationId: string; collectionImageUrl?: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [rfqOpen, setRfqOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true); setError('');
    try {
      const data = await apiGet<Profile>(`/suppliers/${encodeURIComponent(String(organizationId))}/profile`);
      setProfile(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load supplier preview.');
    } finally { setLoading(false); }
  }, [organizationId]);
  useEffect(() => { void load(); }, [load]);

  const products = useMemo<Product[]>(() => {
    const gallery = profile?.trendyCollection?.images?.length ? profile.trendyCollection.images : profile?.trendyCollection?.imageUrl ? [profile.trendyCollection.imageUrl] : collectionImageUrl ? [String(collectionImageUrl)] : [];
    return gallery.slice(0, 5).map((url, index) => ({ id: `trendy-${index}`, name: profile?.trendyCollection?.name || 'Trendy Collection', imageUrl: url }));
  }, [profile, collectionImageUrl]);
  const media = profile?.businessMedia || [];
  const logo = media.find(item => item.mediaType === 'COMPANY_LOGO');
  const rating = profile?.supplierTestimonials?.length
    ? profile.supplierTestimonials.reduce((sum, item) => sum + item.rating, 0) / profile.supplierTestimonials.length
    : profile?.publicRating?.average;
  const verified = profile?.verificationStatus === 'APPROVED';
  const orderCount = profile?.completedOrders ?? profile?.orderCount;

  const goToIndex = (index: number) => {
    if (index < 0 || index >= products.length) return;
    setActiveIndex(index);
    carouselRef.current?.scrollTo({ x: index * W, animated: true });
  };
  const carouselRef = React.useRef<ScrollViewInstance | null>(null);

  return <View style={s.screen}>
    <AppHeader role="BUYER" isBack onBack={() => router.back()} title="Supplier Preview" />
    {loading ? <View style={s.state}><ActivityIndicator size="large" color={P}/><Text style={s.muted}>Loading supplier preview...</Text></View>
    : error || !profile ? <View style={s.state}><MaterialCommunityIcons name="cloud-alert-outline" size={34} color="#98A2B3"/><Text style={s.error}>{error || 'Supplier not found.'}</Text><Pressable style={s.retry} onPress={() => void load()}><Text style={s.retryText}>Try Again</Text></Pressable></View>
    : <>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.hero}>
          {products.length ? <>
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={event => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / W))}
              scrollEventThrottle={16}
            >
              {products.map((item, index) => {
                const firstImage = item.imageUrl || item.images?.slice().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0))[0]?.imageUrl;
                return <Pressable key={item.id} style={s.slide} onPress={() => setGalleryOpen(true)}>
                  {firstImage ? <Image source={{ uri: imageUri(firstImage) }} style={s.productImage} resizeMode="contain" /> : <View style={s.imageFallback}><MaterialCommunityIcons name="image-off-outline" size={76} color="#B9B2C7"/><Text style={s.fallbackText}>Image not available</Text></View>}
                  <View style={s.productNamePill}><Text numberOfLines={1} style={s.productName}>Trendy Collection</Text></View>
                  <View style={s.expandHint}><MaterialCommunityIcons name="fullscreen" size={14} color="#FFFFFF"/><Text style={s.expandText}>Tap to view full screen</Text></View>
                </Pressable>;
              })}
            </ScrollView>
            {products.length > 1 && <>
              <Pressable style={[s.arrow,s.leftArrow]} onPress={() => goToIndex(activeIndex - 1)}><MaterialCommunityIcons name="chevron-left" size={30} color="#273044"/></Pressable>
              <Pressable style={[s.arrow,s.rightArrow]} onPress={() => goToIndex(activeIndex + 1)}><MaterialCommunityIcons name="chevron-right" size={30} color="#273044"/></Pressable>
              <View style={s.pagination}>{products.map((item,index)=><Pressable key={item.id} onPress={()=>goToIndex(index)} style={[s.dot,index===activeIndex&&s.activeDot]}/>)}</View>
              <View style={s.counter}><Text style={s.counterText}>{activeIndex + 1} / {products.length}</Text></View>
            </>}
          </> : <View style={s.imageFallback}><MaterialCommunityIcons name="image-off-outline" size={52} color="#B9B2C7"/><Text style={s.fallbackText}>No featured products available</Text></View>}
        </View>

        <View style={s.supplierCard}>
          <View style={s.identity}>
            {logo ? <Image source={{uri:imageUri(logo.url)}} style={s.logo}/> : <View style={s.logoFallback}><MaterialCommunityIcons name="factory" size={29} color={P}/></View>}
            <View style={s.identityText}>
              <View style={s.nameRow}><Text numberOfLines={1} style={s.name}>{profile.name}</Text>{verified&&<MaterialCommunityIcons name="check-decagram" size={20} color={P}/>}</View>
              <Text numberOfLines={1} style={s.businessType}>{profile.businessType || 'Garment Manufacturer'}</Text>
              <Text numberOfLines={1} style={s.location}><MaterialCommunityIcons name="map-marker" size={16} color="#667085"/> {profile.city || 'Location not added'}{profile.country ? `, ${profile.country}` : ''}</Text>
            </View>
            <View style={[s.verifiedBadge,!verified&&s.pendingBadge]}><MaterialCommunityIcons name="check-circle-outline" size={16} color={verified?'#159653':'#98620A'}/><Text style={[s.verifiedText,!verified&&s.pendingText]}>{verified?'Verified':'Pending'}</Text></View>
          </View>
          <View style={s.stats}>
            <View style={s.stat}><Text style={s.statValue}>{rating != null ? rating.toFixed(1) : '—'} <Text style={s.star}>★</Text></Text><Text style={s.statLabel}>Rating</Text></View>
            <View style={s.statDivider}/>
            <View style={s.stat}><Text style={s.statValue}>{orderCount != null ? Number(orderCount).toLocaleString('en-IN') : '—'}</Text><Text style={s.statLabel}>Orders</Text></View>
            <View style={s.statDivider}/>
            <View style={s.stat}><Text style={s.statValue}>{profile.supplierProfile?.yearsInBusiness != null ? `${profile.supplierProfile.yearsInBusiness}+` : '—'}</Text><Text style={s.statLabel}>Years</Text></View>
          </View>
        </View>
      </ScrollView>
      <View style={s.actions}>
        <Pressable style={s.profileButton} onPress={() => router.push({pathname:'/buyer/supplier/[organizationId]',params:{organizationId:String(organizationId)}} as any)}>
          <MaterialCommunityIcons name="storefront-outline" size={20} color={P}/><Text style={s.profileButtonText}>View Profile</Text>
        </Pressable>
        <Pressable style={s.rfqButton} onPress={() => setRfqOpen(true)}>
          <MaterialCommunityIcons name="send" size={19} color="#FFFFFF"/><Text style={s.rfqButtonText}>Send RFQ</Text>
        </Pressable>
      </View>
    </>}
    <Modal visible={galleryOpen} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setGalleryOpen(false)}>
      <View style={s.fullscreen}>
        <Pressable style={s.closeGallery} onPress={() => setGalleryOpen(false)}><MaterialCommunityIcons name="close" size={27} color="#FFFFFF"/></Pressable>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{x:activeIndex*Dimensions.get('window').width,y:0}} onMomentumScrollEnd={event => setActiveIndex(Math.round(event.nativeEvent.contentOffset.x/Dimensions.get('window').width))}>
          {products.map((item,index)=><View key={item.id} style={s.fullscreenSlide}>
            <Image source={{uri:imageUri(item.imageUrl)}} style={s.fullscreenImage} resizeMode="contain"/>
            <Text style={s.fullscreenCounter}>{index+1} / {products.length}</Text>
          </View>)}
        </ScrollView>
      </View>
    </Modal>
    <CreateRfqModal visible={rfqOpen} onClose={()=>setRfqOpen(false)} onSuccess={()=>{setRfqOpen(false);router.push({pathname:'/buyer/[section]',params:{section:'requests'}} as any);}} supplierOrgId={profile?.id} supplierName={profile?.name}/>
  </View>;
}

const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F7F7FB'},
  scroll:{flex:1},
  content:{paddingHorizontal:14,paddingTop:12,paddingBottom:14,gap:14},
  state:{flex:1,alignItems:'center',justifyContent:'center',padding:25,gap:12},
  muted:{fontSize:13,color:'#667085'},
  error:{fontSize:13,color:'#B42318',textAlign:'center'},
  retry:{backgroundColor:P,paddingHorizontal:20,paddingVertical:10,borderRadius:10},
  retryText:{color:'#fff',fontWeight:'800'},
  hero:{height:Math.min(Math.max(Dimensions.get('window').height*0.43,280),430),backgroundColor:'#171717',borderRadius:22,overflow:'hidden',position:'relative'},
  slide:{width:W,height:'100%',alignItems:'center',justifyContent:'center',backgroundColor:'#171717'},
  productImage:{width:'100%',height:'100%'},
  imageFallback:{flex:1,alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#F1EEF7'},
  fallbackText:{fontSize:12,color:'#667085',fontWeight:'700'},
  productNamePill:{position:'absolute',left:14,right:14,bottom:40,alignItems:'center'},
  productName:{fontSize:13,fontWeight:'900',color:'#FFFFFF',backgroundColor:'rgba(0,0,0,0.48)',paddingHorizontal:12,paddingVertical:6,borderRadius:18,overflow:'hidden'},
  expandHint:{position:'absolute',top:12,right:12,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(0,0,0,0.48)',paddingHorizontal:9,paddingVertical:6,borderRadius:16},
  expandText:{fontSize:10,color:'#FFFFFF',fontWeight:'800'},
  fullscreen:{flex:1,backgroundColor:'#050505',justifyContent:'center'},
  closeGallery:{position:'absolute',top:48,right:18,zIndex:5,width:44,height:44,borderRadius:22,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center'},
  fullscreenSlide:{width:Dimensions.get('window').width,height:'100%',alignItems:'center',justifyContent:'center',paddingHorizontal:8},
  fullscreenImage:{width:'100%',height:'82%'},
  fullscreenCounter:{position:'absolute',bottom:48,color:'#FFFFFF',fontSize:14,fontWeight:'900',backgroundColor:'rgba(0,0,0,0.5)',paddingHorizontal:13,paddingVertical:7,borderRadius:18},
  arrow:{position:'absolute',top:'45%',width:42,height:42,borderRadius:22,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  leftArrow:{left:12},rightArrow:{right:12},
  pagination:{position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:9},
  dot:{width:8,height:8,borderRadius:5,backgroundColor:'#FFFFFF',opacity:0.8},
  activeDot:{width:20,backgroundColor:P,opacity:1},
  counter:{position:'absolute',right:12,bottom:9,borderWidth:1,borderColor:'rgba(255,255,255,0.6)',backgroundColor:'rgba(0,0,0,0.4)',paddingHorizontal:10,paddingVertical:5,borderRadius:18},
  counterText:{fontSize:12,color:'#FFFFFF',fontWeight:'800'},
  supplierCard:{backgroundColor:'#FFFFFF',borderRadius:20,borderWidth:1,borderColor:'#ECEAF2',overflow:'hidden',elevation:2,shadowColor:'#30204D',shadowOpacity:0.08,shadowRadius:10},
  identity:{flexDirection:'row',alignItems:'center',padding:13,gap:10,minHeight:105},
  logo:{width:72,height:72,borderRadius:14,backgroundColor:'#F4F0FA'},
  logoFallback:{width:72,height:72,borderRadius:14,backgroundColor:'#F4F0FA',alignItems:'center',justifyContent:'center'},
  identityText:{flex:1,minWidth:0,gap:4},
  nameRow:{flexDirection:'row',alignItems:'center',gap:5},
  name:{fontSize:19,fontWeight:'900',color:'#151827',flexShrink:1},
  businessType:{fontSize:12,color:'#596579',fontWeight:'600'},
  location:{fontSize:12,color:'#596579'},
  verifiedBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:7,borderRadius:20,backgroundColor:'#E7F8EF',borderWidth:1,borderColor:'#A9E8C1'},
  verifiedText:{fontSize:11,fontWeight:'900',color:'#16804A'},
  pendingBadge:{backgroundColor:'#FFF5DB',borderColor:'#F5D58A'},
  pendingText:{color:'#98620A'},
  stats:{minHeight:76,backgroundColor:'#FAF8FF',flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingVertical:10},
  stat:{flex:1,alignItems:'center',gap:3},
  statValue:{fontSize:19,fontWeight:'900',color:'#171827'},
  star:{color:P},
  statLabel:{fontSize:12,color:'#596579',fontWeight:'600'},
  statDivider:{width:1,height:42,backgroundColor:'#D9D0EA'},
  actions:{flexDirection:'row',gap:10,paddingHorizontal:14,paddingTop:10,paddingBottom:12,backgroundColor:'#FFFFFF',borderTopWidth:1,borderTopColor:'#ECEAF2'},
  profileButton:{flex:1,minHeight:52,borderRadius:13,borderWidth:1.5,borderColor:P,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  profileButtonText:{fontSize:15,fontWeight:'900',color:P},
  rfqButton:{flex:1,minHeight:52,borderRadius:13,backgroundColor:P,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},
  rfqButtonText:{fontSize:15,fontWeight:'900',color:'#FFFFFF'},
});
