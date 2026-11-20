import { ui } from '@/theme/ui';
import { STITCHGRID_LOGO } from '@/theme/assets';
import React, { useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signup, SignupPayload } from '@/services/auth';

const PURPLE = ui.accent;

const CAPABILITIES = ['T-Shirts','Shirts','Hoodies','Activewear','Polo Shirts','Denim & Jeans','Trousers','Dresses','Kids Wear','Knitwear','Woven Fabric'];
const PROCESSES = ['Cutting','Stitching','Printing','Embroidery','Washing','Finishing','Packing'];
const REGIONS = ['Delhi NCR, UP, Haryana','Tamil Nadu & South India','Gujarat & Western India','Punjab & North India','Bengal & Eastern India','Pan-India (Domestic)','Pan-India & Global Export'];
const MOQ_OPTIONS = ['100 pcs','200 pcs','300 pcs','500 pcs','1,000 pcs','2,500 pcs','5,000 pcs'];
const YEARS = Array.from({ length: 45 }, (_, i) => String(2026 - i));

type Role = 'Brand / Buyer' | 'Manufacturer';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  right?: React.ReactNode;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
};

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', secureTextEntry = false, right, icon }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        {icon ? <MaterialCommunityIcons name={icon} size={21} color={PURPLE} /> : null}
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={ui.muted}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          style={styles.input}
        />
        {right}
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState<Role>('Brand / Buyer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [year, setYear] = useState('2018');
  const [factoryLocation, setFactoryLocation] = useState('');
  const [region, setRegion] = useState(REGIONS[0]);
  const [capabilities, setCapabilities] = useState(['T-Shirts','Shirts','Hoodies','Activewear']);
  const [processes, setProcesses] = useState(['Cutting','Stitching','Printing','Washing','Packing']);
  const [capacity, setCapacity] = useState('');
  const [moq, setMoq] = useState('300 pcs');
  const [picker, setPicker] = useState<'year' | 'region' | 'moq' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const showValidationError = (message: string) => {
    setError(message);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    AccessibilityInfo.announceForAccessibility(message);
  };

  const pickerOptions = useMemo(() => picker === 'year' ? YEARS : picker === 'region' ? REGIONS : MOQ_OPTIONS, [picker]);

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter(v => v !== value) : [...values, value]);
  };

  const validateBasic = () => {
    if (!fullName.trim() || !organizationName.trim()) return 'Please complete your contact person and organization name.';
    if (!email.trim()) return 'Please enter your work email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid work email address.';
    if (phone.trim().replace(/\D/g, '').length < 6) return 'Please enter a valid mobile number.';
    if (password.length < 10) return 'Password must be at least 10 characters.';
    return '';
  };

  const continueBasic = () => {
    const validation = validateBasic();
    if (validation) { showValidationError(validation); return; }
    setError('');
    if (role === 'Manufacturer') setStep(2);
    else void submitRegistration();
  };

  const submitRegistration = async () => {
    setError('');
    if (role === 'Manufacturer') {
      if (!gstNumber.trim() || !factoryLocation.trim() || !capacity.trim() || capabilities.length === 0 || processes.length === 0) {
        showValidationError('Please complete all required manufacturer details.');
        return;
      }
    }
    const accountType: SignupPayload['accountType'] = role === 'Brand / Buyer' ? 'BUYER' : 'SUPPLIER';
    const payload: SignupPayload = {
      fullName: fullName.trim(),
      organizationName: organizationName.trim(),
      accountType,
      email: email.trim(),
      phone: phone.trim().replace(/\s+/g, ''),
      password,
      ...(accountType !== 'BUYER' ? {
        gstNumber: gstNumber.trim().toUpperCase(),
        establishmentYear: Number(year),
        factoryLocation: factoryLocation.trim(),
        serviceableRegions: region,
        capabilities,
        keyProcesses: processes,
        monthlyCapacity: capacity.trim(),
        moq,
      } : {}),
    };
    setLoading(true);
    try {
      const result = await signup(payload);
      const memberships = result.memberships || [];
      const selected = memberships.find(m => m.role === (accountType === 'SUPPLIER' ? 'SUPPLIER' : 'BUYER')) || result.activeMembership;
      const destination = selected?.role === 'SUPPLIER' ? '/workspace?role=SUPPLIER' : '/workspace?role=BUYER';
      Alert.alert('Account created', result.message || 'Your STITCHGRID account has been created successfully.', [
        { text: 'Continue', onPress: () => router.replace(destination) },
      ]);
    } catch (e) {
      showValidationError(e instanceof Error ? e.message : 'Registration failed. Please review your details.');
    } finally {
      setLoading(false);
    }
  };

  const selectField = (label: string, value: string, type: 'year' | 'region' | 'moq') => (
    <View style={styles.field}>
      <Text style={styles.labelSmall}>{label}</Text>
      <Pressable style={styles.selectBox} onPress={() => setPicker(type)}>
        <Text style={styles.selectText}>{value}</Text>
        <MaterialCommunityIcons name="chevron-down" size={25} color="#8A9AAA" />
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef} contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 16) }]}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { width: Math.min(width - 32, 520) }]}>
            {step === 1 ? (
              <>
                <View style={styles.brand}>
                  <Image source={STITCHGRID_LOGO} style={styles.logo} resizeMode="contain" />
                  <Text style={styles.registrationTitle}>{role === 'Manufacturer' ? 'Register as Manufacturer' : 'Create Your Organization Account'}</Text>
                  <Text style={styles.tagline}>{role === 'Manufacturer' ? 'List your factory, receive RFQs and grow your business.' : "Join India's B2B garment sourcing network."}</Text>
                </View>
                {!!error && <View style={styles.error}><MaterialCommunityIcons name="alert-circle-outline" size={19} color="#BE123C" /><Text style={styles.errorText}>{error}</Text></View>}
                <Field label="CONTACT PERSON FULL NAME *" value={fullName} onChangeText={setFullName} placeholder="Amit Sharma" icon="account-outline" />
                <Field label="REGISTERED ORGANIZATION NAME *" value={organizationName} onChangeText={setOrganizationName} placeholder="Asha Apparel Mills Pvt Ltd" icon="domain" />
                <View style={styles.field}>
                  <Text style={styles.label}>ORGANIZATION ROLE *</Text>
                  <View style={styles.roleGroup}>
                    {(['Brand / Buyer','Manufacturer'] as Role[]).map(item => (
                      <Pressable key={item} onPress={() => setRole(item)} style={[styles.roleOption, role === item && styles.roleActive]}>
                        <Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <Field label="WORK EMAIL *" value={email} onChangeText={setEmail} placeholder="amit@ashapparel.in" keyboardType="email-address" icon="email-outline" />
                <Field label="MOBILE NUMBER *" value={phone} onChangeText={setPhone} placeholder="+91 9876543210" keyboardType="phone-pad" icon="phone-outline" />
                <Field label="PASSWORD (MIN 10 CHARACTERS) *" value={password} onChangeText={setPassword} placeholder="••••••••••••" secureTextEntry={!showPassword}
                  icon="lock-outline" right={<Pressable onPress={() => setShowPassword(v => !v)} hitSlop={10}><MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={23} color="#8795A4" /></Pressable>} />
                <Pressable onPress={continueBasic} disabled={loading} style={[styles.primaryButton, loading && { opacity: 0.7 }]}>
                  {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryText}>{role === 'Brand / Buyer' ? 'Create Account' : 'Continue to Factory Details'}</Text><MaterialCommunityIcons name="arrow-right" size={24} color="#fff" /></>}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.manufacturerHeader}>
                  <Image source={STITCHGRID_LOGO} style={styles.smallLogo} resizeMode="contain" />
                  <Text style={styles.manufacturerTitle}>Manufacturer Details</Text>
                  <Text style={styles.manufacturerSubtitle}>Tell us about your manufacturing capability to get verified and receive relevant business opportunities.</Text>
                  <Text style={styles.stepText}>Step 2 of 2</Text>
                  <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
                </View>
                {!!error && <View style={styles.error}><MaterialCommunityIcons name="alert-circle-outline" size={19} color="#BE123C" /><Text style={styles.errorText}>{error}</Text></View>}
                <Text style={styles.sectionTitle}>BUSINESS & FACTORY INFORMATION</Text>
                <Field label="GST Number *" value={gstNumber} onChangeText={(v: string) => setGstNumber(v.toUpperCase())} placeholder="09ABCDE1234F1Z5" />
                {selectField('Establishment Year *', year, 'year')}
                <Field label="Factory Location *" value={factoryLocation} onChangeText={setFactoryLocation} placeholder="Noida, Uttar Pradesh" />
                {selectField('Serviceable Regions *', region, 'region')}
                <View style={styles.field}>
                  <View style={styles.capabilityHeading}><Text style={styles.sectionTitle}>MANUFACTURING CAPABILITIES *</Text><Text style={styles.hint}>Click tags to select or remove</Text></View>
                  <View style={styles.selectedTags}>
                    {capabilities.map(item => <Pressable key={item} onPress={() => toggle(item, capabilities, setCapabilities)} style={styles.selectedTag}><Text style={styles.selectedTagText}>{item}</Text><MaterialCommunityIcons name="close" size={18} color={PURPLE} /></Pressable>)}
                  </View>
                  <View style={styles.suggestTags}>
                    {CAPABILITIES.filter(item => !capabilities.includes(item)).map(item => <Pressable key={item} onPress={() => toggle(item, capabilities, setCapabilities)} style={styles.suggestTag}><Text style={styles.suggestTagText}>+ {item}</Text></Pressable>)}
                  </View>
                </View>
                <View style={styles.field}>
                  <Text style={styles.sectionTitle}>KEY PROCESSES / OPERATIONS *</Text>
                  <View style={styles.processGrid}>
                    {PROCESSES.map(item => {
                      const active = processes.includes(item);
                      return <Pressable key={item} onPress={() => toggle(item, processes, setProcesses)} style={[styles.processOption, active && styles.processActive]}>
                        <MaterialCommunityIcons name={active ? 'checkbox-marked' : 'checkbox-blank-outline'} size={23} color={active ? '#1683E8' : '#777'} />
                        <Text style={[styles.processText, active && { color: PURPLE, fontWeight: '700' }]}>{item}</Text>
                      </Pressable>;
                    })}
                  </View>
                </View>
                <Field label="Monthly Production Capacity *" value={capacity} onChangeText={setCapacity} placeholder="50,000 pcs" />
                {selectField('Minimum Order Quantity (MOQ) *', moq, 'moq')}
                <View style={styles.actions}>
                  <Pressable onPress={() => { setError(''); setStep(1); }} style={styles.backButton}><Text style={styles.backText}>← Back</Text></Pressable>
                  <Pressable onPress={submitRegistration} disabled={loading} style={[styles.primaryButton, styles.saveButton, loading && { opacity: 0.7 }]}>
                    {loading ? <ActivityIndicator color="#fff" /> : <><Text style={styles.primaryText}>Create Account</Text><MaterialCommunityIcons name="arrow-right" size={27} color="#fff" /></>}
                  </Pressable>
                </View>
              </>
            )}
            <View style={styles.footer}>
              <Text style={styles.footerMuted}>Already registered?</Text>
              <Pressable onPress={() => router.replace('/')}><Text style={styles.signInLink}>Sign In  ›</Text></Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{picker === 'year' ? 'Establishment Year' : picker === 'region' ? 'Serviceable Regions' : 'Minimum Order Quantity'}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {pickerOptions.map(option => <Pressable key={option} style={styles.pickerOption} onPress={() => {
                if (picker === 'year') setYear(option);
                else if (picker === 'region') setRegion(option);
                else setMoq(option);
                setPicker(null);
              }}><Text style={styles.pickerOptionText}>{option}</Text><MaterialCommunityIcons name={(picker === 'year' ? year : picker === 'region' ? region : moq) === option ? 'radiobox-marked' : 'radiobox-blank'} size={21} color={PURPLE} /></Pressable>)}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:ui.canvas}, scroll:{alignItems:'center',paddingHorizontal:16},
  card:{backgroundColor:ui.surface,borderRadius:16,borderWidth:1,borderColor:'#E9E5EF',padding:20,shadowColor:'#1B1230',shadowOpacity: 0,shadowRadius:18,shadowOffset:{width:0,height:8},elevation: 0},
  brand:{alignItems:'center',marginBottom:12},logo:{width:'76%',height:48},registrationTitle:{fontSize:21,lineHeight:27,fontWeight: '700',color:'#17172D',textAlign:'center',marginTop:7},tagline:{fontSize:13,lineHeight:19,color:'#66717F',textAlign:'center',marginTop:5},
  field:{marginBottom:12},label:{fontSize: 12,fontWeight:'700',letterSpacing:.85,color:'#3E4650',marginBottom:7},labelSmall:{fontSize:13,fontWeight:'700',color:'#596571',marginBottom:7},
  inputWrap:{minHeight:52,borderRadius:12,borderWidth:1,borderColor:'#DCD6E7',paddingHorizontal:14,flexDirection:'row',alignItems:'center',backgroundColor:ui.surface,shadowColor:'#000',shadowOpacity: 0,shadowRadius:2,shadowOffset:{width:0,height:1},elevation: 0},
  input:{flex:1,minHeight:50,fontSize:14,color:'#242631',paddingVertical:8},roleGroup:{flexDirection:'row',backgroundColor:'#F5F1FA',padding:4,borderRadius:16,borderWidth:1,borderColor:'#E7DFF0'},
  roleOption:{flex:1,minHeight:52,borderRadius:12,alignItems:'center',justifyContent:'center',paddingHorizontal:6},roleActive:{backgroundColor:'#6816C8'},roleText:{fontSize:13,fontWeight:'700',color:'#52606C',textAlign:'center'},roleTextActive:{color:ui.surface},
  primaryButton:{minHeight:56,borderRadius:12,backgroundColor:PURPLE,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:14,marginTop:4,shadowColor:PURPLE,shadowOpacity: 0,shadowRadius:8,shadowOffset:{width:0,height:4},elevation: 0},
  primaryText:{fontSize:15,fontWeight:'700',color:ui.surface},footer:{borderTopWidth:1,borderTopColor:'#F0F0F2',marginTop:18,paddingTop:15,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,flexWrap:'wrap'},
  footerMuted:{fontSize:14,color:ui.muted},signInLink:{fontSize:15,color:PURPLE,fontWeight: '700'},error:{flexDirection:'row',gap:8,alignItems:'center',padding:12,borderRadius:12,backgroundColor:'#FFF1F2',borderColor:'#FECDD3',borderWidth:1,marginBottom:18},errorText:{flex:1,color:'#9F1239',fontSize:13,lineHeight:19},
  manufacturerHeader:{borderBottomWidth:1,borderBottomColor:'#F0F0F2',paddingBottom:18,marginBottom:18},smallLogo:{width:145,height:40,alignSelf:'flex-start'},manufacturerTitle:{fontSize:25,fontWeight: '700',color:ui.ink,marginTop:7},manufacturerSubtitle:{fontSize:14,lineHeight:21,color:'#687382',marginTop:6},stepText:{fontSize:13,color:ui.muted,marginTop:12,letterSpacing:1},progressTrack:{height:7,width:160,borderRadius:8,backgroundColor:'#EEF0F4',marginTop:10,overflow:'hidden'},progressFill:{width:'100%',height:'100%',backgroundColor:PURPLE,borderRadius:8},
  sectionTitle:{fontSize:14,fontWeight:'700',color:ui.ink,marginBottom:8},selectBox:{minHeight:52,borderRadius:12,borderWidth:1,borderColor:'#E0E1E5',paddingHorizontal:17,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:ui.surface,elevation: 0},selectText:{fontSize:16,color:'#303642',flex:1,paddingRight:8},
  capabilityHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',gap:10},hint:{fontSize: 13,color:ui.muted,flex:1},selectedTags:{minHeight:0,borderRadius:12,borderWidth:1,borderColor:ui.border,padding:12,flexDirection:'row',flexWrap:'wrap',gap:8,backgroundColor:ui.surface},selectedTag:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#EEE8FF',borderRadius:30,paddingHorizontal:13,paddingVertical:10},selectedTagText:{fontSize:15,color:PURPLE,fontWeight:'700'},suggestTags:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:14},suggestTag:{borderWidth:1,borderColor:'#E1E3E8',borderRadius:30,paddingHorizontal:14,paddingVertical:9},suggestTagText:{fontSize:14,color:'#52606C'},
  processGrid:{flexDirection:'row',flexWrap:'wrap',gap:10},processOption:{width:'48%',minHeight:58,borderWidth:1,borderColor:'#E3E5E9',borderRadius:16,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9},processActive:{backgroundColor:'#F3F0FF',borderColor:PURPLE},processText:{fontSize:15,color:'#4B5563',flexShrink:1},
  actions:{flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderTopColor:ui.border,paddingTop:16,marginTop:8},backButton:{paddingHorizontal:8,paddingVertical:15},backText:{fontSize:16,fontWeight:'700',color:'#53606C'},saveButton:{flex:1,marginTop:0},
  stepPill:{flexDirection:'row',alignItems:'center',gap:9,backgroundColor:'#F0E6FB',borderWidth:1,borderColor:'#E7D5F8',borderRadius:28,paddingVertical:8,paddingHorizontal:17},stepDot:{width:28,height:28,borderRadius:14,backgroundColor:PURPLE,alignItems:'center',justifyContent:'center'},stepDotText:{color:ui.surface,fontSize:14,fontWeight: '700'},stepPillText:{color:'#54217E',fontSize:13,fontWeight:'700'},

  modalBackdrop:{flex:1,backgroundColor:'rgba(12,8,20,.45)',justifyContent:'center',padding:24},pickerCard:{backgroundColor:ui.surface,borderRadius:22,padding:20},pickerTitle:{fontSize:18,fontWeight: '700',color:'#20212A',marginBottom:12},pickerOption:{minHeight:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#F0F0F2'},pickerOptionText:{fontSize:15,color:'#3C4652'}
});