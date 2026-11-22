import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { apiPost, API_BASE_URL } from '@/services/api';

type Props = { visible: boolean; orderId: string; poNumber: string; onClose: () => void; onSubmitted: () => void };
const CHECKS = [
  ['fabricQuality', 'Fabric quality checked'],
  ['stitching', 'Stitching and seams checked'],
  ['measurements', 'Measurements verified'],
  ['colorAndFinishing', 'Color and finishing checked'],
  ['buttonsZippersAccessories', 'Buttons, zippers and accessories checked'],
  ['defectsInspected', 'Defects inspected'],
] as const;
const PURPLE = '#5B13B8';

export default function SupplierQcSubmitModal({ visible, orderId, poNumber, onClose, onSubmitted }: Props) {
  const [total, setTotal] = useState('');
  const [inspected, setInspected] = useState('');
  const [passed, setPassed] = useState('');
  const [defective, setDefective] = useState('0');
  const [remarks, setRemarks] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [defectPhotos, setDefectPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickPhotos = async (optional = false) => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { Alert.alert('Permission required', 'Allow photo library access to attach QC evidence.'); return; }
      const current = optional ? defectPhotos : photos;
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: Math.max(1, (optional ? 8 : 12) - current.length), base64: true, quality: 0.75 });
      if (result.canceled) return;
      setUploading(true);
      const urls: string[] = [];
      for (const [i, asset] of result.assets.entries()) {
        if (!asset.base64) continue;
        const filename = asset.fileName || `qc-${Date.now()}-${i}.jpg`;
        const mime = asset.mimeType || 'image/jpeg';
        const uploaded = await apiPost<{ url: string }>('/upload', { filename, data: `data:${mime};base64,${asset.base64}`, label: optional ? 'QC Defect Photo' : 'QC Inspection Photo' });
        const backendOrigin = API_BASE_URL.replace(/\/api\/?$/, '');
        urls.push(uploaded.url.startsWith('http') ? uploaded.url : `${backendOrigin}${uploaded.url.startsWith('/') ? '' : '/'}${uploaded.url}`);
      }
      if (optional) setDefectPhotos(v => [...v, ...urls].slice(0, 8));
      else setPhotos(v => [...v, ...urls].slice(0, 12));
    } catch (e) { Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unable to upload photos.'); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    const values = [total, inspected, passed, defective].map(v => Number(v));
    const [t, i, p, d] = values;
    if (values.some(v => !Number.isInteger(v) || v < 0) || t < 1 || i < 1 || i > t || p + d !== i) {
      Alert.alert('Check quantities', 'Enter valid quantities. Passed + defective must equal inspected, and inspected cannot exceed total.'); return;
    }
    if (photos.length === 0) { Alert.alert('QC photos required', 'Please attach at least one inspection photo.'); return; }
    if (CHECKS.some(([key]) => !checklist[key])) { Alert.alert('Checklist incomplete', 'Please confirm every required quality checklist item.'); return; }
    try {
      setBusy(true);
      await apiPost(`/orders/${orderId}/quality-checks`, { totalQuantity: t, inspectedQuantity: i, passedQuantity: p, defectiveQuantity: d, checklist, photos, ...(defectPhotos.length ? { defectivePhotos: defectPhotos } : {}), remarks: remarks.trim() || undefined });
      Alert.alert('QC report submitted', 'Buyer has been notified and can now review your report.');
      onSubmitted();
      onClose();
    } catch (e) { Alert.alert('Unable to submit QC report', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={s.backdrop}><View style={s.sheet}>
      <View style={s.header}><View style={{flex:1}}><Text style={s.title}>Submit Quality Check</Text><Text style={s.sub}>PO #{poNumber}</Text></View><Pressable onPress={onClose}><MaterialCommunityIcons name="close" size={24} color="#667085"/></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:24}}>
        <Text style={s.section}>Production quantities</Text>
        {([['Total quantity produced',total,setTotal],['Quantity inspected',inspected,setInspected],['Quantity passed',passed,setPassed],['Defective quantity',defective,setDefective]] as const).map(([label,value,setter]) => <View key={label} style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={setter} keyboardType="number-pad" placeholder="0" style={s.input}/></View>)}
        <Text style={s.hint}>Passed + defective quantity must equal inspected quantity.</Text>
        <Text style={s.section}>Quality checklist</Text>
        {CHECKS.map(([key,label]) => <Pressable key={key} onPress={() => setChecklist(v => ({...v,[key]:!v[key]}))} style={s.checkRow}><MaterialCommunityIcons name={checklist[key] ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={checklist[key] ? PURPLE : '#98A2B3'}/><Text style={s.checkText}>{label}</Text></Pressable>)}
        <Text style={s.section}>QC inspection photos <Text style={{color:'#D92D20'}}>*Required</Text></Text>
        <Text style={s.hint}>Add clear photos showing overall garment quality and close-up inspection.</Text>
        <Pressable style={s.upload} onPress={() => void pickPhotos(false)} disabled={uploading}><MaterialCommunityIcons name="camera-plus-outline" size={21} color={PURPLE}/><Text style={s.uploadText}>{uploading ? 'Uploading...' : 'Add QC photos'}</Text></Pressable>
        <View style={s.photos}>{photos.map((url,i) => <View key={url+i} style={s.thumb}><Image source={{uri:url}} style={s.image}/><Pressable onPress={() => setPhotos(v=>v.filter((_,j)=>j!==i))} style={s.remove}><MaterialCommunityIcons name="close" size={14} color="#fff"/></Pressable></View>)}</View>
        <Text style={s.section}>Defect evidence <Text style={s.optional}>(Optional)</Text></Text>
        <Pressable style={s.upload} onPress={() => void pickPhotos(true)} disabled={uploading}><MaterialCommunityIcons name="image-plus-outline" size={21} color={PURPLE}/><Text style={s.uploadText}>Add defective-item photos</Text></Pressable>
        <View style={s.photos}>{defectPhotos.map((url,i) => <View key={url+i} style={s.thumb}><Image source={{uri:url}} style={s.image}/><Pressable onPress={() => setDefectPhotos(v=>v.filter((_,j)=>j!==i))} style={s.remove}><MaterialCommunityIcons name="close" size={14} color="#fff"/></Pressable></View>)}</View>
        <Text style={s.section}>Supplier remarks <Text style={s.optional}>(Optional)</Text></Text>
        <TextInput value={remarks} onChangeText={setRemarks} placeholder="Add inspection observations..." multiline style={[s.input,{minHeight:82,textAlignVertical:'top'}]}/>
        <Pressable style={[s.submit,(busy||uploading)&&{opacity:.6}]} onPress={() => void submit()} disabled={busy||uploading}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={s.submitText}>Submit QC Report</Text>}</Pressable>
      </ScrollView>
    </View></View>
  </Modal>;
}
const s=StyleSheet.create({
 backdrop:{flex:1,backgroundColor:'rgba(15,23,42,.5)',justifyContent:'flex-end'},sheet:{backgroundColor:'#fff',borderTopLeftRadius:24,borderTopRightRadius:24,padding:20,maxHeight:'94%'},
 header:{flexDirection:'row',alignItems:'center',marginBottom:18},title:{fontSize:20,fontWeight:'800',color:'#172033'},sub:{fontSize:12,color:'#667085',marginTop:4},
 section:{fontSize:15,fontWeight:'800',color:'#202939',marginTop:18,marginBottom:9},field:{marginBottom:10},label:{fontSize:12,fontWeight:'700',color:'#475467',marginBottom:5},input:{borderWidth:1,borderColor:'#D0D5DD',borderRadius:11,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:'#172033',backgroundColor:'#fff'},
 hint:{fontSize:11,color:'#667085',lineHeight:16},checkRow:{minHeight:42,flexDirection:'row',alignItems:'center',gap:10},checkText:{fontSize:13,color:'#344054',fontWeight:'600'},
 upload:{height:46,borderWidth:1,borderStyle:'dashed',borderColor:'#B7A0E9',borderRadius:11,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:'#FAF8FF'},uploadText:{color:PURPLE,fontSize:13,fontWeight:'800'},
 photos:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:9},thumb:{width:68,height:68,position:'relative'},image:{width:68,height:68,borderRadius:9,backgroundColor:'#F2F4F7'},remove:{position:'absolute',right:-5,top:-5,width:21,height:21,borderRadius:11,backgroundColor:'#D92D20',alignItems:'center',justifyContent:'center'},
 optional:{fontSize:11,color:'#667085',fontWeight:'500'},submit:{height:50,backgroundColor:PURPLE,borderRadius:13,alignItems:'center',justifyContent:'center',marginTop:22},submitText:{color:'#fff',fontWeight:'800',fontSize:14}
});
