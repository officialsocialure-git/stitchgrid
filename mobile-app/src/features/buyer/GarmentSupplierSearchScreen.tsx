import { ui } from '@/theme/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { apiGet, API_BASE_URL } from '@/services/api';

const PURPLE = ui.accent;
const GARMENT_TYPES = ['T-Shirts', 'Shirts', 'Hoodies', 'Activewear', 'Polo Shirts', 'Denim & Jeans', 'Trousers', 'Dresses', 'Kids Wear', 'Kurtis', 'Knitwear', 'Sweatshirts', 'Skirts', 'Suits', 'Co-ord Sets'];
type SupplierRow = {
  id: string; organizationId: string; verificationStatus?: string; minimumOrderQuantity?: number | null; fabricMinimumOrderQuantity?: number | null;
  productionCapacity?: number | null; description?: string; organization?: { name?: string; businessType?: string; city?: string; address?: string; country?: string };
  categories?: { category: string }[]; catalogItems?: { name: string; description?: string; moq?: number; minOrderQty?: number }[];
  businessMedia?: { mediaType: string; url: string }[]; rating?: number | null; reviewCount?: number;
};
type Picker = 'location' | 'business' | 'garments' | null;

export default function GarmentSupplierSearchScreen() {
  const router = useRouter();
  const [location, setLocation] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [minimumQuantity, setMinimumQuantity] = useState('');
  const [garmentTypes, setGarmentTypes] = useState<string[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [locationDraft, setLocationDraft] = useState('');
  const [selectedGarments, setSelectedGarments] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('Relevance');

  const searchSuppliers = useCallback(async () => {
    if (!location.trim()) { Alert.alert('Location required', 'Select a location or use Near Me.'); return; }
    if (!businessType) { Alert.alert('Business type required', 'Select Job Work or Garment Manufacturing.'); return; }
    if (!garmentTypes.length) { Alert.alert('Garment type required', 'Select at least one garment type.'); return; }
    const minQty = minimumQuantity.trim() ? Number(minimumQuantity.replace(/,/g, '')) : undefined;
    if (minQty === undefined) { Alert.alert('MOQ required', 'Enter your order quantity so we can match suppliers by MOQ.'); return; }
    if (!Number.isFinite(minQty) || minQty <= 0) { Alert.alert('Invalid MOQ', 'Enter a valid minimum quantity.'); return; }
    setLoading(true); setError(''); setHasSearched(true);
    try {
      const params = new URLSearchParams({ category: 'Garment', region: location.trim(), businessType, garmentTypes: garmentTypes.join(',') });
      if (minQty) params.set('minMoq', String(minQty));
      const data = await apiGet<SupplierRow[]>(`/suppliers?${params.toString()}`);
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      setSuppliers([]); setError(e instanceof Error ? e.message : 'Unable to search suppliers.');
    } finally { setLoading(false); }
  }, [location, businessType, garmentTypes, minimumQuantity]);

  const sortedSuppliers = useMemo(() => {
    const list = [...suppliers];
    if (sort === 'MOQ: Low to High') list.sort((a,b) => Number(a.minimumOrderQuantity || 0) - Number(b.minimumOrderQuantity || 0));
    if (sort === 'Capacity: High to Low') list.sort((a,b) => Number(b.productionCapacity || 0) - Number(a.productionCapacity || 0));
    if (sort === 'Rating') list.sort((a,b) => Number(b.rating || 0) - Number(a.rating || 0));
    return list;
  }, [suppliers, sort]);

  const useNearMe = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { Alert.alert('Location permission', 'Allow location access to find nearby garment suppliers.'); return; }
      const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({ latitude: coords.coords.latitude, longitude: coords.coords.longitude });
      const place = places[0];
      const city = place?.city || place?.district || place?.subregion || place?.region;
      if (!city) { Alert.alert('Location unavailable', 'Could not identify your city. Please select it manually.'); return; }
      setLocation(city);
    } catch { Alert.alert('Location unavailable', 'Please select your location manually.'); }
  };

  const toggleGarment = (item: string) => setSelectedGarments(current => current.includes(item) ? current.filter(x => x !== item) : [...current, item]);
  const confirmPicker = () => {
    if (picker === 'location') setLocation(locationDraft.trim());
    if (picker === 'business') setBusinessType(locationDraft);
    if (picker === 'garments') setGarmentTypes(selectedGarments);
    setPicker(null);
  };

  return (
    <View style={styles.screen}>
      <AppHeader role="BUYER" isBack showLogo />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons name="tshirt-crew-outline" size={40} color={PURPLE} /></View>
          <View style={{flex:1}}><Text style={styles.title}>Find Garment Manufacturer</Text><Text style={styles.subtitle}>Search and connect with verified garment suppliers based on your requirements.</Text></View>
        </View>

        <View style={styles.filters}>
          <View style={styles.filterRow}>
            <View style={styles.labelWrap}><MaterialCommunityIcons name="map-marker-outline" size={22} color={PURPLE}/><Text style={styles.label}>Location <Text style={styles.required}>*</Text></Text></View>
            <View style={styles.locationControls}>
              <Pressable style={[styles.dropdown, {flex:1}]} onPress={() => {setLocationDraft(location);setPicker('location');}}>
                <Text numberOfLines={1} style={[styles.dropdownText,!location && styles.placeholder]}>{location || 'Select Location'}</Text><MaterialCommunityIcons name="chevron-down" size={23} color="#111827"/>
              </Pressable>
              <Pressable style={styles.nearButton} onPress={useNearMe}><MaterialCommunityIcons name="crosshairs-gps" size={19} color={PURPLE}/><Text style={styles.nearText}>Near Me</Text></Pressable>
            </View>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.labelWrap}><MaterialCommunityIcons name="briefcase-outline" size={22} color={PURPLE}/><Text style={styles.label}>Business Type <Text style={styles.required}>*</Text></Text></View>
            <Pressable style={styles.dropdown} onPress={() => {setLocationDraft(businessType);setPicker('business');}}>
              <Text style={[styles.dropdownText,!businessType && styles.placeholder]}>{businessType || 'Select Business Type'}</Text><MaterialCommunityIcons name="chevron-down" size={23} color="#111827"/>
            </Pressable>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.labelWrap}><MaterialCommunityIcons name="layers-triple-outline" size={22} color="#61558D"/><Text style={styles.label}>MOQ (Minimum Order Quantity) <Text style={styles.required}>*</Text></Text></View>
            <TextInput value={minimumQuantity} onChangeText={setMinimumQuantity} keyboardType="number-pad" placeholder="Enter minimum quantity (e.g. 100 pcs)" placeholderTextColor="#77729A" style={styles.input}/>
          </View>
          <View style={styles.filterRow}>
            <View style={styles.labelWrap}><MaterialCommunityIcons name="tshirt-crew-outline" size={22} color={PURPLE}/><Text style={styles.label}>Garment Type <Text style={styles.required}>*</Text></Text></View>
            <Pressable style={styles.dropdown} onPress={() => {setSelectedGarments(garmentTypes);setPicker('garments');}}>
              <View style={styles.chips}>{garmentTypes.length ? <>{garmentTypes.slice(0,3).map(item=><View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text><Pressable onPress={(event) => {event.stopPropagation();setGarmentTypes(current=>current.filter(x=>x!==item));}}><MaterialCommunityIcons name="close" size={17} color={PURPLE}/></Pressable></View>)}{garmentTypes.length > 3 && <Text style={styles.moreText}>+{garmentTypes.length-3}</Text>}</> : <Text style={[styles.dropdownText,styles.placeholder]}>Select Garment Type</Text>}</View>
              <MaterialCommunityIcons name="chevron-down" size={23} color="#111827"/>
            </Pressable>
          </View>
          <Pressable style={styles.searchButton} onPress={() => void searchSuppliers()} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFFFFF"/> : <><MaterialCommunityIcons name="magnify" size={25} color="#FFFFFF"/><Text style={styles.searchButtonText}>Search Suppliers</Text></>}
          </Pressable>
        </View>

        {hasSearched && <View style={styles.resultsHeader}><Text style={styles.resultsTitle}>{suppliers.length} Matching Suppliers</Text><Pressable style={styles.sortButton} onPress={() => Alert.alert('Sort suppliers','Choose sorting order',[{text:'Relevance',onPress:()=>setSort('Relevance')},{text:'Rating',onPress:()=>setSort('Rating')},{text:'MOQ: Low to High',onPress:()=>setSort('MOQ: Low to High')},{text:'Capacity: High to Low',onPress:()=>setSort('Capacity: High to Low')},{text:'Cancel',style:'cancel'}])}><Text style={styles.sortText}>Sort: {sort}</Text><MaterialCommunityIcons name="chevron-down" size={20} color="#111827"/></Pressable></View>}
        {loading && <View style={styles.state}><ActivityIndicator color={PURPLE}/><Text style={styles.stateText}>Finding matching garment suppliers...</Text></View>}
        {!!error && <View style={styles.state}><Text style={styles.errorText}>{error}</Text></View>}
        {hasSearched && !loading && !error && !suppliers.length && <View style={styles.state}><MaterialCommunityIcons name="factory" size={30} color="#9CA3AF"/><Text style={styles.stateTitle}>No matching suppliers found</Text><Text style={styles.stateText}>Try another location or adjust your requirements.</Text></View>}
        {sortedSuppliers.map(supplier => {
          const org = supplier.organization || {};
          const photo = supplier.businessMedia?.find(m=>m.mediaType==='FACTORY_PHOTO')?.url || supplier.businessMedia?.find(m=>m.mediaType==='COMPANY_PHOTO')?.url || supplier.businessMedia?.find(m=>m.mediaType==='COMPANY_LOGO')?.url;
          const imageUrl = photo && (photo.startsWith('http') ? photo : `${API_BASE_URL.replace(/\/api\/?$/, '')}${photo.startsWith('/')?'':'/'}${photo}`);
          const tags = (supplier.categories || []).map(c=>c.category);
          const verified = supplier.verificationStatus === 'APPROVED';
          const catalogMoq = supplier.catalogItems?.map(item => Number(item.moq ?? item.minOrderQty ?? 0)).filter(value => value > 0).sort((a,b) => a-b)[0];
          const displayMoq = supplier.minimumOrderQuantity || catalogMoq;
          return <Pressable key={supplier.organizationId} style={styles.supplierCard} onPress={()=>router.push({pathname:'/buyer/supplier/[organizationId]',params:{organizationId:supplier.organizationId}} as any)}>
            <View style={styles.cardTop}>
              {imageUrl ? <Image source={{uri:imageUrl}} style={styles.factoryPhoto}/> : <View style={styles.factoryPhotoFallback}><MaterialCommunityIcons name="factory" size={34} color={PURPLE}/></View>}
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}><Text numberOfLines={2} style={styles.supplierName}>{org.name || 'Garment Supplier'}</Text>{verified && <MaterialCommunityIcons name="check-decagram" size={19} color={PURPLE}/>}</View>
                <View style={styles.locationLine}><MaterialCommunityIcons name="map-marker" size={16} color="#6B6591"/><Text numberOfLines={1} style={styles.locationText}>{[org.city,org.country].filter(Boolean).join(', ')}</Text></View>
                <Text style={styles.businessPill}>{org.businessType || businessType}</Text>
                <View style={styles.tags}>{tags.slice(0,4).map(tag=><Text key={tag} style={styles.tag}>{tag}</Text>)}</View>
              </View>
              {!!supplier.rating && <View style={styles.rating}><MaterialCommunityIcons name="star" size={16} color="#F4B400"/><Text style={styles.ratingText}>{supplier.rating.toFixed(1)}</Text>{!!supplier.reviewCount && <Text style={styles.reviewCount}>({supplier.reviewCount})</Text>}</View>}
            </View>
            <View style={styles.cardBottom}>
              <View><Text style={styles.metaLabel}>MOQ</Text><Text style={styles.metaValue}>{displayMoq ? `${displayMoq.toLocaleString('en-IN')} pcs` : 'Not specified'}</Text></View>
              <View style={styles.capacity}><Text style={styles.metaLabel}>Capacity</Text><Text style={styles.metaValue}>{supplier.productionCapacity ? `${supplier.productionCapacity.toLocaleString('en-IN')} pcs / month` : 'Not specified'}</Text></View>
              <View style={styles.viewProfile}><Text style={styles.viewProfileText}>View Profile</Text><MaterialCommunityIcons name="arrow-right" size={19} color={PURPLE}/></View>
            </View>
          </Pressable>;
        })}
      </ScrollView>
      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={()=>setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={()=>setPicker(null)}><Pressable style={styles.sheet} onPress={()=>{}}>
          <View style={styles.sheetHeader}><Text style={styles.sheetTitle}>{picker==='location'?'Select Location':picker==='business'?'Select Business Type':'Select Garment Type'}</Text><Pressable onPress={()=>setPicker(null)}><MaterialCommunityIcons name="close" size={23} color="#6B7280"/></Pressable></View>
          {picker==='location' && <><TextInput value={locationDraft} onChangeText={setLocationDraft} placeholder="Enter city, state or area" style={styles.modalInput}/><Text style={styles.helper}>Example: Noida, Uttar Pradesh</Text></>}
          {picker==='business' && ['Job Work','Garment Manufacturing'].map(item=><Pressable key={item} style={styles.option} onPress={()=>setLocationDraft(item)}><Text style={[styles.optionText,locationDraft===item&&styles.optionActive]}>{item}</Text><MaterialCommunityIcons name={locationDraft===item?'radiobox-marked':'radiobox-blank'} size={22} color={locationDraft===item?PURPLE:'#9CA3AF'}/></Pressable>)}
          {picker==='garments' && <ScrollView style={{maxHeight:360}}>{GARMENT_TYPES.map(item=><Pressable key={item} style={styles.option} onPress={()=>toggleGarment(item)}><Text style={[styles.optionText,selectedGarments.includes(item)&&styles.optionActive]}>{item}</Text><MaterialCommunityIcons name={selectedGarments.includes(item)?'checkbox-marked':'checkbox-blank-outline'} size={22} color={selectedGarments.includes(item)?PURPLE:'#9CA3AF'}/></Pressable>)}</ScrollView>}
          <Pressable style={styles.confirmButton} onPress={confirmPicker}><Text style={styles.confirmText}>Done</Text></Pressable>
        </Pressable></Pressable>
      </Modal>
      <AppBottomNav role="BUYER" activeSection="home" onNavigate={(section) => {
        const routes: Record<string,string> = { requests:'requests', orders:'orders', chat:'chat', 'organization-settings':'organization-settings' };
        if (section === 'home') router.replace('/workspace?role=BUYER' as any);
        else if (routes[section]) router.push({ pathname:'/buyer/[section]', params:{ section:routes[section] } } as any);
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F8F6FF'},content:{paddingHorizontal:14,paddingTop:10,paddingBottom:28,gap:15},
  hero:{flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:7,paddingVertical:8},heroIcon:{width:82,height:82,borderRadius:22,backgroundColor:'#EEE5FF',alignItems:'center',justifyContent:'center'},
  title:{fontSize:22,lineHeight:28,fontWeight:'800',color:'#10152D'},subtitle:{fontSize:14,lineHeight:21,color:'#625D85',marginTop:5},
  filters:{backgroundColor:'#FFFFFF',borderRadius:28,paddingHorizontal:16,paddingVertical:18,gap:17,shadowColor:'#5B21B6',shadowOpacity:.07,shadowRadius:15,shadowOffset:{width:0,height:6},elevation:2},
  filterRow:{flexDirection:'column',alignItems:'stretch',gap:9},labelWrap:{width:'100%',flexDirection:'row',alignItems:'center',gap:9},label:{fontSize:15,fontWeight:'800',color:'#11152F',flexShrink:1},required:{color:'#E53935'},
  locationControls:{width:'100%',minWidth:0,flexDirection:'row',alignItems:'center',gap:9},dropdown:{minHeight:52,borderWidth:1.5,borderColor:'#DED8F0',borderRadius:14,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  dropdownText:{fontSize:15,fontWeight:'600',color:'#17152F',flex:1,minWidth:0},placeholder:{color:'#77729A',fontWeight:'500'},nearButton:{height:52,borderWidth:1.5,borderColor: PURPLE,borderRadius:14,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,flexShrink:0},nearText:{fontSize:14,fontWeight:'800',color:PURPLE},
  input:{height:54,borderWidth:1.5,borderColor:'#DED8F0',borderRadius:14,paddingHorizontal:15,fontSize:15,color:'#17152F',width:'100%'},chips:{flex:1,flexDirection:'row',flexWrap:'wrap',gap:6},chip:{flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'#F0E7FF',borderRadius:22,paddingHorizontal:10,paddingVertical:7},chipText:{fontSize:13,fontWeight:'800',color:PURPLE},moreText:{fontSize:12,color:'#6B6591',marginLeft:3},
  searchButton:{height:58,borderRadius:15,backgroundColor:PURPLE,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,marginTop:1},searchButtonText:{fontSize:18,fontWeight:'800',color:'#FFFFFF'},
  resultsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingHorizontal:4,marginTop:4},resultsTitle:{fontSize:18,fontWeight:'800',color:'#10152D'},sortButton:{flexDirection:'row',alignItems:'center',gap:3},sortText:{fontSize:13,fontWeight:'600',color:'#25213D'},
  supplierCard:{backgroundColor:'#FFFFFF',borderRadius:22,padding:13,gap:13,shadowColor:'#4C1D95',shadowOpacity:.08,shadowRadius:12,shadowOffset:{width:0,height:4},elevation:2},cardTop:{flexDirection:'row',gap:11,alignItems:'flex-start'},factoryPhoto:{width:104,height:112,borderRadius:14,backgroundColor:'#F1ECFA'},factoryPhotoFallback:{width:104,height:112,borderRadius:14,backgroundColor:'#F1ECFA',alignItems:'center',justifyContent:'center'},cardInfo:{flex:1,gap:6,minWidth:0},nameRow:{flexDirection:'row',alignItems:'center',gap:4},supplierName:{fontSize:15,fontWeight:'800',color:'#10152D',flexShrink:1},locationLine:{flexDirection:'row',alignItems:'center',gap:3},locationText:{fontSize:12,color:'#625D85',flexShrink:1},businessPill:{alignSelf:'flex-start',backgroundColor:'#EEE5FF',color:PURPLE,fontSize:11,fontWeight:'800',paddingHorizontal:10,paddingVertical:6,borderRadius:18,overflow:'hidden'},tags:{flexDirection:'row',flexWrap:'wrap',gap:5},tag:{backgroundColor:'#F3EDFF',color:'#292052',fontSize:11,fontWeight:'700',paddingHorizontal:9,paddingVertical:5,borderRadius:15,overflow:'hidden'},
  rating:{position:'absolute',right:0,top:0,flexDirection:'row',alignItems:'center',gap:2,backgroundColor:'#FFF9E8',borderRadius:15,paddingHorizontal:6,paddingVertical:4},ratingText:{fontSize:12,fontWeight:'800',color:'#27213C'},reviewCount:{fontSize:10,color:'#625D85'},cardBottom:{borderTopWidth:1,borderTopColor:'#EEEAF5',paddingTop:11,flexDirection:'row',alignItems:'center',gap:8},metaLabel:{fontSize:11,color:'#77729A'},metaValue:{fontSize:13,fontWeight:'800',color:'#15152F'},capacity:{flex:1,borderLeftWidth:1,borderLeftColor:'#E8E2F2',paddingLeft:10},viewProfile:{borderWidth:1.3,borderColor:PURPLE,borderRadius:12,paddingHorizontal:10,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:4},viewProfileText:{fontSize:12,fontWeight:'800',color:PURPLE},
  state:{backgroundColor:'#FFFFFF',borderRadius:18,padding:22,alignItems:'center',gap:9},stateTitle:{fontSize:16,fontWeight:'800',color:'#10152D'},stateText:{fontSize:13,color:'#6B6591',textAlign:'center'},errorText:{fontSize:13,color:'#B42318',textAlign:'center'},
  backdrop:{flex:1,backgroundColor:'rgba(13,10,22,.48)',justifyContent:'flex-end'},sheet:{backgroundColor:'#FFFFFF',borderTopLeftRadius:26,borderTopRightRadius:26,padding:22,paddingBottom:30,gap:12},sheetHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sheetTitle:{fontSize:18,fontWeight:'800',color:'#11152F'},modalInput:{height:52,borderWidth:1,borderColor:'#DED8F0',borderRadius:13,paddingHorizontal:14,fontSize:15},helper:{fontSize:12,color:'#77729A'},option:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#F0EDF5'},optionText:{fontSize:15,color:'#28233E',fontWeight:'600'},optionActive:{color:PURPLE,fontWeight:'800'},confirmButton:{height:50,backgroundColor:PURPLE,borderRadius:13,alignItems:'center',justifyContent:'center',marginTop:8},confirmText:{fontSize:15,fontWeight:'800',color:'#FFFFFF'}
});
