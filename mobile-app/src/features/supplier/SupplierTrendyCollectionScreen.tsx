import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { apiGet, apiPost, apiRequest, API_BASE_URL } from '@/services/api';

type Collection = { id: string; name?: string; description?: string | null; imageUrl: string; images?: string[] | null; isActive: boolean; status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN'; moderationNote?: string | null };
type Upload = { url: string; filename: string };
const purple = ui.accent;
const mediaUrl = (url?: string | null) => !url ? '' : url.startsWith('http') ? url : `${API_BASE_URL.replace('/api', '')}${url.startsWith('/') ? '' : '/'}${url}`;

export default function SupplierTrendyCollectionScreen() {
  const router = useRouter();
  const [item, setItem] = useState<Collection | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const savedImages = item?.images?.length ? item.images : item?.imageUrl ? [item.imageUrl] : [];
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await apiGet<Collection | null>('/trendy-collections/mine');
      setItem(data);
      setIsActive(!!data?.isActive);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load your collection.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const choosePhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission required', 'Allow photo library access to choose collection images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5,
      quality: 0.82, base64: true,
    });
    if (!result.canceled) {
      const selected = result.assets.filter(asset => !!asset.base64).slice(0, 5)
        .map(asset => `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
      if (selected.length) setPhotos(selected);
      if (result.assets.length > 5) Alert.alert('Maximum 5 images', 'Only the first 5 selected images will be used.');
    }
  };

  const save = async () => {
    if (!photos.length && !savedImages.length) { Alert.alert('Collection images required', 'Upload 1 to 5 collection images before saving.'); return; }
    setSaving(true);
    try {
      let images = savedImages;
      if (photos.length) {
        const uploadedImages: string[] = [];
        for (let index = 0; index < photos.length; index += 1) {
          const uploaded = await apiPost<Upload>('/upload', {
            filename: `trendy-collection-${Date.now()}-${index + 1}.jpg`,
            data: photos[index], label: 'TRENDY_COLLECTION',
          }, 120000);
          uploadedImages.push(uploaded.url);
        }
        images = uploadedImages;
      }
      const saved = await apiRequest<Collection>('/trendy-collections/mine', {
        method: 'PUT',
        body: { imageUrl: images[0], images, isActive },
        timeoutMs: 180000,
      });
      setItem(saved); setPhotos([]); setIsActive(!!saved.isActive);
      Alert.alert('Collection submitted', saved.status === 'PENDING'
        ? 'Your 1–5 collection images have been sent for admin review. They will appear to buyers after approval.'
        : 'Your collection images have been saved.');
    } catch (e) { Alert.alert('Unable to save collection', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (value: boolean) => {
    if (!item || item.status !== 'APPROVED') { Alert.alert('Approval required', 'Your collection must be approved by an admin before you can publish it.'); return; }
    setSaving(true);
    try {
      const saved = await apiRequest<Collection>('/trendy-collections/mine', {
        method: 'PUT', body: { imageUrl: savedImages[0], images: savedImages, isActive: value },
      });
      setItem(saved); setIsActive(saved.isActive);
    } catch (e) { Alert.alert('Unable to update status', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setSaving(false); }
  };

  const displayedImages = photos.length ? photos : savedImages.map(mediaUrl);
  const statusLabel = item?.status === 'APPROVED' ? 'Approved' : item?.status === 'REJECTED' ? 'Rejected' : item?.status === 'HIDDEN' ? 'Hidden by admin' : item ? 'Pending admin review' : 'Not submitted';
  const statusColor = item?.status === 'APPROVED' ? '#16804A' : item?.status === 'REJECTED' || item?.status === 'HIDDEN' ? '#B42318' : '#9A6708';

  return <View style={s.screen}>
    <AppHeader role="SUPPLIER" title="Trendy Collection" activeSection="profile" showLogo />
    {loading ? <View style={s.center}><ActivityIndicator color={purple}/><Text style={s.muted}>Loading collection…</Text></View> :
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.intro}>
          <View style={s.introIcon}><MaterialCommunityIcons name="crown-outline" size={24} color={purple}/></View>
          <View style={{flex:1}}><Text style={s.title}>Showcase your Trendy Collection</Text><Text style={s.muted}>Upload up to 5 product or collection photos. Buyers can swipe through them and open any image full-screen.</Text></View>
        </View>
        {!!error && <View style={s.error}><Text style={s.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.retry}>Retry</Text></Pressable></View>}
        <View style={s.card}>
          <View style={s.cardHead}><Text style={s.cardTitle}>Collection Gallery</Text><Text style={s.optional}>{displayedImages.length}/5 images</Text></View>
          <Pressable style={s.imagePicker} onPress={() => void choosePhotos()} disabled={saving}>
            {displayedImages.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gallery}>
              {displayedImages.map((uri,index)=><View key={`${index}-${uri.slice(-24)}`} style={s.thumbWrap}>
                <Image source={{uri: photos.length ? uri : uri}} style={s.thumb} resizeMode="cover"/>
                <View style={s.number}><Text style={s.numberText}>{index+1}</Text></View>
              </View>)}
            </ScrollView> : <View style={s.placeholder}><MaterialCommunityIcons name="image-multiple-outline" size={38} color={purple}/><Text style={s.pickText}>Select Collection Images</Text><Text style={s.hint}>Choose 1 to 5 images · JPG / PNG / WEBP</Text></View>}
            <View style={s.changePhoto}><MaterialCommunityIcons name="camera-plus-outline" size={15} color="#fff"/><Text style={s.changeText}>{displayedImages.length ? 'Replace Images' : 'Choose Images'}</Text></View>
          </Pressable>
          <Text style={s.helper}>The first image is used as the cover on the buyer home screen. All selected images appear in the full-screen swipe gallery.</Text>
          {item && <View style={s.statusBox}><View style={{flex:1}}><Text style={s.statusTitle}>Admin review status</Text><Text style={[s.statusValue,{color:statusColor}]}>{statusLabel}</Text>{!!item.moderationNote && <Text style={s.moderationNote}>{item.moderationNote}</Text>}</View><MaterialCommunityIcons name={item.status === 'APPROVED' ? 'check-decagram' : 'clock-outline'} size={22} color={statusColor}/></View>}
          <View style={s.activeRow}><View style={{flex:1}}><Text style={s.statusTitle}>Publish collection</Text><Text style={s.mutedSmall}>{item?.status === 'APPROVED' ? 'Show or hide your approved collection on the buyer home page.' : 'Available after admin approval.'}</Text></View><Switch value={isActive} onValueChange={toggleActive} disabled={saving || item?.status !== 'APPROVED'} trackColor={{false:'#D0D5DD',true:'#C8B5FF'}} thumbColor={isActive ? purple : '#F9FAFB'}/></View>
          <Pressable style={[s.save,saving && {opacity:0.65}]} onPress={() => void save()} disabled={saving}>{saving ? <ActivityIndicator color="#fff"/> : <><MaterialCommunityIcons name="cloud-upload-outline" size={17} color="#fff"/><Text style={s.saveText}>{item ? 'Save Gallery' : 'Submit Collection'}</Text></>}</Pressable>
        </View>
        <Text style={s.footnote}>Maximum 5 images per supplier. New or edited galleries require admin approval before appearing publicly.</Text>
      </ScrollView>}
    <AppBottomNav role="SUPPLIER" activeSection="profile" onNavigate={section => { if(section === 'home') router.replace('/workspace?role=SUPPLIER' as any); else router.push({pathname:'/supplier/[section]',params:{section:section === 'profile' ? 'business-profile' : section}} as any); }}/>
  </View>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:ui.canvas},content:{padding:14,paddingBottom:28,gap:13,maxWidth:840,width:'100%',alignSelf:'center'},
 center:{flex:1,alignItems:'center',justifyContent:'center',gap:9},intro:{backgroundColor:'#F3EEFF',borderRadius:13,padding:13,flexDirection:'row',alignItems:'center',gap:11},introIcon:{width:42,height:42,borderRadius:12,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},title:{fontSize:15,fontWeight:'900',color:'#202B3C'},muted:{fontSize:11,color:'#7D8796',lineHeight:17},mutedSmall:{fontSize:10,color:'#7D8796',lineHeight:15,marginTop:3},
 card:{backgroundColor:'#fff',borderRadius:14,borderWidth:1,borderColor:'#E7E7EF',padding:13,gap:10},cardHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},cardTitle:{fontSize:14,fontWeight:'900',color:'#253044'},optional:{fontSize:10,color:'#8992A0'},imagePicker:{minHeight:190,borderRadius:11,backgroundColor:'#F7F4FC',borderWidth:1,borderColor:'#DED3F4',overflow:'hidden',justifyContent:'center'},gallery:{padding:9,gap:9,alignItems:'center'},thumbWrap:{width:112,height:155,borderRadius:9,overflow:'hidden',backgroundColor:'#F0ECF7'},thumb:{width:'100%',height:'100%'},number:{position:'absolute',top:6,left:6,width:23,height:23,borderRadius:12,backgroundColor:'rgba(0,0,0,0.65)',alignItems:'center',justifyContent:'center'},numberText:{fontSize:11,color:'#fff',fontWeight:'900'},placeholder:{alignItems:'center',gap:8,padding:22},pickText:{fontSize:12,fontWeight:'800',color:purple},hint:{fontSize:10,color:'#8992A0'},changePhoto:{alignSelf:'flex-end',margin:9,backgroundColor:'rgba(24,20,35,.82)',borderRadius:8,paddingHorizontal:10,paddingVertical:7,flexDirection:'row',alignItems:'center',gap:5},changeText:{fontSize:10,fontWeight:'800',color:'#fff'},helper:{fontSize:10,color:'#7D8796',lineHeight:15},statusBox:{backgroundColor:'#FAF9FC',borderRadius:10,padding:11,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#EEEAF5'},statusTitle:{fontSize:12,fontWeight:'800',color:'#263044'},statusValue:{fontSize:11,fontWeight:'800',marginTop:3},moderationNote:{fontSize:10,color:'#7D8796',marginTop:4},activeRow:{flexDirection:'row',alignItems:'center',paddingVertical:7,borderTopWidth:1,borderTopColor:'#F0EEF4'},save:{height:45,backgroundColor:purple,borderRadius:10,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:2},saveText:{fontSize:12,fontWeight:'900',color:'#fff'},footnote:{fontSize:10,color:'#8992A0',lineHeight:15,textAlign:'center',paddingHorizontal:8},error:{backgroundColor:'#FEF3F2',padding:12,borderRadius:9},errorText:{fontSize:11,color:'#B42318'},retry:{fontSize:11,color:purple,fontWeight:'900',marginTop:5}
});
