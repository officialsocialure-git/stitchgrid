import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {MaterialCommunityIcons} from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import {apiGet,apiRequest} from '@/services/api';
import {AppHeader} from '@/components/AppHeader';

const PURPLE='#5314E8';
type OrgProfile={id:string;name:string;legalName?:string|null;businessType?:string|null;taxId?:string|null;city?:string|null;country?:string|null;address?:string|null;verificationStatus:string;supplierProfile?:{description?:string|null;yearsInBusiness?:number|null;productionCapacity?:number|null;categories?:{id:string;category:string}[]}|null};
export default function OrganizationSettingsScreen(){
 const [profile,setProfile]=useState<OrgProfile|null>(null);const [role,setRole]=useState('BUYER');const [orgId,setOrgId]=useState('');
 const [name,setName]=useState('');const [legalName,setLegalName]=useState('');const [taxId,setTaxId]=useState('');const [city,setCity]=useState('');const [country,setCountry]=useState('India');const [address,setAddress]=useState('');
 const [description,setDescription]=useState('');const [years,setYears]=useState('');const [capacity,setCapacity]=useState('');const [categories,setCategories]=useState('');const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [success,setSuccess]=useState('');
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{const raw=await SecureStore.getItemAsync('sg_membership');if(!raw)throw new Error('Your organization session was not found. Please sign in again.');
   const m=JSON.parse(raw);const id=m.organizationId||m.organization?.id;if(!id)throw new Error('Organization ID is missing. Please sign in again.');
   setRole(m.role||'BUYER');setOrgId(id);
   const data=await apiGet<OrgProfile>(`/organization-profile?organizationId=${encodeURIComponent(id)}`);
   setProfile(data);setName(data.name||'');setLegalName(data.legalName||'');setTaxId(data.taxId||'');setCity(data.city||'');setCountry(data.country||'India');setAddress(data.address||'');
   setDescription(data.supplierProfile?.description||'');setYears(data.supplierProfile?.yearsInBusiness!=null?String(data.supplierProfile.yearsInBusiness):'');setCapacity(data.supplierProfile?.productionCapacity!=null?String(data.supplierProfile.productionCapacity):'');setCategories((data.supplierProfile?.categories||[]).map(c=>c.category).join(', '));
  }catch(e){setError(e instanceof Error?e.message:'Unable to load organization profile.');}finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const save=async()=>{
  if(!orgId)return;if(name.trim().length<2){Alert.alert('Check company name','Company name must contain at least 2 characters.');return;}
  setSaving(true);setError('');setSuccess('');
  try{const updated=await apiRequest<OrgProfile>('/organization-profile',{method:'PUT',body:{organizationId:orgId,name:name.trim(),legalName:legalName.trim(),taxId:taxId.trim(),city:city.trim(),country:country.trim(),address:address.trim(),...(role==='SUPPLIER'?{description:description.trim(),yearsInBusiness:years===''?undefined:Number(years),productionCapacity:capacity===''?undefined:Number(capacity),categories:categories.split(',').map(x=>x.trim()).filter(Boolean)}:{})}});
   setProfile(updated);setSuccess('Organization profile saved successfully.');
   const raw=await SecureStore.getItemAsync('sg_membership');if(raw){const m=JSON.parse(raw);m.organization={...(m.organization||{}),id:orgId,name:updated.name};await SecureStore.setItemAsync('sg_membership',JSON.stringify(m));}
  }catch(e){setError(e instanceof Error?e.message:'Unable to save organization profile.');}finally{setSaving(false);}
 };
 const Field=({label,value,onChange,placeholder,editable=true}:{label:string;value:string;onChange:(v:string)=>void;placeholder:string;editable?:boolean})=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A1A1AA" editable={editable} style={[s.input,!editable&&s.readOnly]}/></View>;
 return <KeyboardAvoidingView style={s.screen} behavior={Platform.OS==='ios'?'padding':undefined}>
  <AppHeader
    isBack
    role={role === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER'}
    activeSection="organization-settings"
    title={role === 'SUPPLIER' ? 'Factory Settings' : 'Organization Settings'}
    showLogo={false}
  />
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <Text style={s.heading}>{role==='SUPPLIER'?'Company Profile & Factory Settings':'Organization Profile & Compliance'}</Text>
  <Text style={s.subheading}>{role==='SUPPLIER'?'Manage your factory details, production capacities, GST verification, and manufacturing capabilities.':'Manage your enterprise credentials, GST verification, and delivery locations.'}</Text>
  {loading?<View style={s.state}><ActivityIndicator color={PURPLE}/><Text style={s.muted}>Loading organization profile...</Text></View>:<>
   <View style={s.card}><View style={s.statusRow}><View style={{flex:1}}><Text style={s.sectionTitle}>Verification Status</Text><Text style={s.statusDesc}>{profile?.verificationStatus==='APPROVED'?'Enterprise identity verified':profile?.verificationStatus==='REJECTED'?'Verification needs attention':'Pending identity & GST verification'}</Text></View><View style={[s.badge,profile?.verificationStatus==='APPROVED'&&s.approved]}><MaterialCommunityIcons name={profile?.verificationStatus==='APPROVED'?'check-circle':'clock'} size={18} color={profile?.verificationStatus==='APPROVED'?'#16804A':'#596579'}/><Text style={s.badgeText}>{profile?.verificationStatus||'PENDING'}</Text></View></View>
    <View style={s.separator}/>
    <Field label="ORGANIZATION / COMPANY NAME" value={name} onChange={setName} placeholder="Enter company name"/>
    <Field label="LEGAL NAME" value={legalName} onChange={setLegalName} placeholder="Registered legal name (optional)"/>
    <Field label="GSTIN / TAX IDENTIFICATION" value={taxId} onChange={setTaxId} placeholder="e.g. 29AAAAA0000A1Z5"/>
    <Field label="PRIMARY OPERATING CITY" value={city} onChange={setCity} placeholder="e.g. Mumbai, Tirupur, Noida"/>
    <Field label="COUNTRY" value={country} onChange={setCountry} placeholder="Country"/>
    <Field label="REGISTERED ADDRESS / FACTORY LOCATION" value={address} onChange={setAddress} placeholder="Enter registered or factory address"/>
    {role==='SUPPLIER'&&<><View style={s.separator}/><Text style={s.sectionTitle}>Manufacturing Capabilities</Text>
     <Field label="YEARS IN BUSINESS" value={years} onChange={setYears} placeholder="e.g. 12"/>
     <Field label="MONTHLY PRODUCTION CAPACITY (PCS)" value={capacity} onChange={setCapacity} placeholder="e.g. 50000"/>
     <Field label="FACTORY BIO / EQUIPMENT & SPECIALIZATIONS" value={description} onChange={setDescription} placeholder="Describe machinery, facilities and specialization"/>
     <Field label="GARMENT CATEGORIES & CAPABILITIES (COMMA SEPARATED)" value={categories} onChange={setCategories} placeholder="Knits, Denim, Hoodies, Shirts"/>
    </>}
    {success!==''&&<View style={s.success}><MaterialCommunityIcons name="check-circle" size={18} color="#16804A"/><Text style={s.successText}>{success}</Text></View>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    <Pressable disabled={saving} onPress={()=>void save()} style={[s.save,saving&&{opacity:.6}]}>{saving?<ActivityIndicator color="#fff"/>:<MaterialCommunityIcons name="content-save" size={22} color="#fff"/>}<Text style={s.saveText}>{saving?'Saving Changes...':'Save Changes'}</Text></Pressable>
   </View>
  </>}
 </ScrollView></KeyboardAvoidingView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#F7F8FC'},content:{padding:16,paddingBottom:30,gap:15},heading:{fontSize:22,lineHeight:29,fontWeight:'900',color:'#142033'},subheading:{fontSize:15,lineHeight:23,color:'#68727F',marginBottom:2},card:{backgroundColor:'#fff',borderRadius:22,borderWidth:1,borderColor:'#E8EAF0',padding:18,gap:17},statusRow:{flexDirection:'row',alignItems:'center',gap:10},sectionTitle:{fontSize:20,fontWeight:'900',color:'#17202D'},statusDesc:{fontSize:14,lineHeight:21,color:'#68727F',marginTop:4},badge:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:10,borderRadius:30,backgroundColor:'#E5EDFF'},approved:{backgroundColor:'#E8F8EF'},badgeText:{fontSize:12,fontWeight:'800',color:'#4B5563'},separator:{height:1,backgroundColor:'#E9EAF0',marginVertical:2},field:{gap:8},label:{fontSize:12,fontWeight:'800',color:'#596273'},input:{height:54,borderWidth:1,borderColor:'#E2E4E9',borderRadius:15,paddingHorizontal:14,fontSize:15,color:'#202633',backgroundColor:'#fff'},readOnly:{backgroundColor:'#F0F3FF'},save:{minHeight:54,alignSelf:'flex-end',backgroundColor:'#5200B9',borderRadius:13,paddingHorizontal:22,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10},saveText:{fontSize:16,fontWeight:'800',color:'#fff'},state:{minHeight:220,alignItems:'center',justifyContent:'center',gap:10},muted:{fontSize:13,color:'#7B8491'},error:{color:'#B42318',fontSize:13},success:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#ECFDF3',padding:12,borderRadius:12},successText:{flex:1,color:'#167447',fontSize:13,fontWeight:'600'}});
