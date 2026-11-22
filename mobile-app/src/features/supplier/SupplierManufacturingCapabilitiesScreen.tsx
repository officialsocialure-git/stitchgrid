import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { useRouter } from 'expo-router';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type CapabilityTag = { id: string; capabilityGroup: string; value: string };
type ProfileResponse = {
  supplierProfile?: {
    yearsInBusiness?: number | null;
    productionCapacity?: number | null;
    minimumOrderQuantity?: number | null;
    sampleDevelopment?: boolean;
    categories?: { category: string }[];
    capabilities?: CapabilityTag[];
  } | null;
};
const PRODUCT_CATEGORIES = ['T-Shirts', 'Hoodies & Sweatshirts', 'Shirts', 'Jackets', 'Bottom Wear', 'Activewear', 'Kids Wear', 'Workwear', 'Others'];
const FABRICS = ['Cotton', 'Polyester', 'Denim', 'Linen', 'Blends', 'Others'];
const SERVICES = ['Fabric Sourcing', 'Pattern Making', 'Sampling', 'Cutting', 'Stitching', 'Printing', 'Embroidery', 'Quality Control (QC)'];

export default function SupplierManufacturingCapabilitiesScreen() {
  const router = useRouter();
  const keyboardVisible = useKeyboardVisible();
  const [organizationId, setOrganizationId] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [capacity, setCapacity] = useState('');
  const [moq, setMoq] = useState('');
  const [years, setYears] = useState('');
  const [sampleDevelopment, setSampleDevelopment] = useState(false);
  const [fabrics, setFabrics] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const membership = JSON.parse(raw);
      const id = membership.organizationId || membership.organization?.id;
      if (!id || membership.role !== 'SUPPLIER') throw new Error('An active supplier account is required.');
      setOrganizationId(id);
      const data = await apiGet<ProfileResponse>(`/organization-profile?organizationId=${encodeURIComponent(id)}`);
      const profile = data.supplierProfile;
      setCategories((profile?.categories || []).map(item => item.category));
      setCapacity(profile?.productionCapacity == null ? '' : String(profile.productionCapacity));
      setMoq(profile?.minimumOrderQuantity == null ? '' : String(profile.minimumOrderQuantity));
      setYears(profile?.yearsInBusiness == null ? '' : String(profile.yearsInBusiness));
      setSampleDevelopment(Boolean(profile?.sampleDevelopment));
      const tags = profile?.capabilities || [];
      setFabrics(tags.filter(tag => tag.capabilityGroup === 'FABRIC').map(tag => tag.value));
      setServices(tags.filter(tag => tag.capabilityGroup === 'SERVICE').map(tag => tag.value));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load manufacturing capabilities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = (value: string, values: string[], setter: (next: string[]) => void) => {
    setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  };

  const save = async () => {
    if (!organizationId) return Alert.alert('Session expired', 'Please sign in again.');
    if (!categories.length) return Alert.alert('Select product categories', 'Choose at least one product category you manufacture.');
    if (!capacity.trim() || !Number.isSafeInteger(Number(capacity)) || Number(capacity) < 1) return Alert.alert('Check production capacity', 'Enter a valid monthly production capacity in pieces.');
    if (!moq.trim() || !Number.isSafeInteger(Number(moq)) || Number(moq) < 1) return Alert.alert('Check MOQ', 'Enter a valid minimum order quantity.');
    if (!years.trim() || !Number.isInteger(Number(years)) || Number(years) < 0 || Number(years) > 150) return Alert.alert('Check experience', 'Enter years in business from 0 to 150.');
    setSaving(true);
    setError('');
    try {
      await apiRequest('/organization-profile', {
        method: 'PUT',
        body: {
          organizationId,
          categories,
          productionCapacity: Number(capacity),
          minimumOrderQuantity: Number(moq),
          yearsInBusiness: Number(years),
          sampleDevelopment,
          fabricExpertise: fabrics,
          additionalCapabilities: services,
        },
      });
      Alert.alert('Saved successfully', 'Your manufacturing capabilities have been updated.');
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unable to save manufacturing capabilities.';
      setError(message);
      Alert.alert('Save failed', message);
    } finally {
      setSaving(false);
    }
  };

  const renderChoices = (options: string[], selected: string[], setter: (next: string[]) => void, compact = false) => (
    <View style={compact ? s.compactChoices : s.categoryGrid}>
      {options.map((option, index) => {
        const active = selected.includes(option);
        return (
          <Pressable key={option} onPress={() => toggle(option, selected, setter)} style={[compact ? s.compactChoice : s.categoryChoice, active && s.choiceActive, !compact && index === options.length - 1 && s.lastChoice]}>
            {compact ? <MaterialCommunityIcons name={active ? 'checkbox-marked' : 'checkbox-blank-outline'} size={18} color={active ? ui.accent : '#A8AFBC'} /> : <><MaterialCommunityIcons name={active ? 'checkbox-marked' : 'checkbox-blank-outline'} size={19} color={active ? ui.accent : '#B8BFCA'} /><Text style={[s.choiceText, active && s.choiceTextActive]}>{option}</Text></>}
            {compact && <Text style={[s.compactText, active && s.choiceTextActive]}>{option}</Text>}
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <View style={s.screen}>
      <AppHeader role="SUPPLIER" title="Manufacturing Capabilities" isBack showLogo={false} />
      {loading ? (
        <View style={s.state}><ActivityIndicator size="large" color={ui.accent} /><Text style={s.stateText}>Loading manufacturing capabilities…</Text></View>
      ) : (
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.heading}>Manufacturing Capabilities</Text>
            <Text style={s.subtitle}>Showcase your manufacturing capabilities, production capacity, and fabric expertise to attract more buyers.</Text>
            {!!error && <View style={s.errorBox}><MaterialCommunityIcons name="alert-circle-outline" size={18} color="#B42318" /><Text style={s.errorText}>{error}</Text><Pressable onPress={() => void load()}><Text style={s.retryText}>Retry</Text></Pressable></View>}

            <View style={s.card}>
              <View style={s.sectionHead}><MaterialCommunityIcons name="tshirt-crew-outline" size={25} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Product Categories <Text style={s.required}>*</Text></Text><Text style={s.sectionHint}>Select the products you manufacture.</Text></View></View>
              {renderChoices(PRODUCT_CATEGORIES, categories, setCategories)}
            </View>

            <View style={s.twoColumn}>
              <View style={[s.card, s.halfCard]}>
                <View style={s.sectionHead}><MaterialCommunityIcons name="factory" size={24} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Production Capacity</Text><Text style={s.sectionHint}>Maximum per month</Text></View></View>
                <View style={s.inputWithSuffix}><TextInput value={capacity} onChangeText={setCapacity} keyboardType="number-pad" placeholder="e.g. 100000" style={s.numberInput} /><Text style={s.suffix}>pcs / month</Text></View>
              </View>
              <View style={[s.card, s.halfCard]}>
                <View style={s.sectionHead}><MaterialCommunityIcons name="package-variant-closed" size={24} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Minimum Order Quantity (MOQ)</Text><Text style={s.sectionHint}>Smallest order accepted</Text></View></View>
                <View style={s.inputWithSuffix}><TextInput value={moq} onChangeText={setMoq} keyboardType="number-pad" placeholder="e.g. 100" style={s.numberInput} /><Text style={s.suffix}>pcs</Text></View>
              </View>
              <View style={[s.card, s.halfCard]}>
                <View style={s.sectionHead}><MaterialCommunityIcons name="calendar-check-outline" size={24} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Years in Business</Text><Text style={s.sectionHint}>Manufacturing experience</Text></View></View>
                <View style={s.inputWithSuffix}><TextInput value={years} onChangeText={setYears} keyboardType="number-pad" placeholder="e.g. 5" style={s.numberInput} /><Text style={s.suffix}>years</Text></View>
              </View>
              <View style={[s.card, s.halfCard]}>
                <View style={s.sectionHead}><MaterialCommunityIcons name="flask-outline" size={24} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Sample Development</Text><Text style={s.sectionHint}>Do you provide samples?</Text></View></View>
                <Pressable onPress={() => setSampleDevelopment(value => !value)} style={s.switchRow}><View style={[s.switchTrack, sampleDevelopment && s.switchOn]}><View style={[s.switchThumb, sampleDevelopment && s.switchThumbOn]} /></View><Text style={s.switchLabel}>{sampleDevelopment ? 'Yes' : 'No'}</Text></Pressable>
              </View>
            </View>

            <View style={s.card}>
              <View style={s.sectionHead}><MaterialCommunityIcons name="texture-box" size={24} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Fabric Expertise</Text><Text style={s.sectionHint}>Select the fabric types you work with.</Text></View></View>
              {renderChoices(FABRICS, fabrics, setFabrics, true)}
            </View>

            <View style={s.card}>
              <View style={s.sectionHead}><MaterialCommunityIcons name="cog-outline" size={24} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Additional Capabilities</Text><Text style={s.sectionHint}>Other manufacturing services you offer.</Text></View></View>
              {renderChoices(SERVICES, services, setServices, true)}
            </View>
            <Pressable disabled={saving} onPress={() => void save()} style={[s.saveButton, saving && s.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="content-save-outline" size={22} color="#FFFFFF" /><Text style={s.saveText}>Save Changes</Text></>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      {!keyboardVisible && <AppBottomNav role="SUPPLIER" activeSection="profile" onNavigate={(section) => {
        if (section === 'home') router.replace('/workspace?role=SUPPLIER' as any);
        else router.replace({ pathname: '/supplier/[section]', params: { section } } as any);
      }} />}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7FB' },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, gap: 14 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: '#697386', fontSize: 13 },
  heading: { color: '#1D2939', fontSize: 22, fontWeight: '900', marginTop: 3 },
  subtitle: { color: '#667085', fontSize: 13, lineHeight: 19, marginTop: -7, marginBottom: 3 },
  errorBox: { backgroundColor: '#FEF3F2', borderRadius: 10, padding: 11, flexDirection: 'row', gap: 8, alignItems: 'center' },
  errorText: { color: '#B42318', fontSize: 12, flex: 1 },
  retryText: { color: ui.accent, fontSize: 12, fontWeight: '900' }, 
  card: { backgroundColor: '#FFFFFF', borderRadius: 17, borderWidth: 1, borderColor: '#E6E8EF', padding: 14, gap: 13, shadowColor: '#182230', shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  sectionCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: '#202B3C', fontSize: 14, fontWeight: '900' },
  required: { color: '#D92D20' },
  sectionHint: { color: '#7B8493', fontSize: 11, lineHeight: 15 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChoice: { width: '30%', minHeight: 82, borderRadius: 13, borderWidth: 1, borderColor: '#E2E5ED', alignItems: 'center', justifyContent: 'center', padding: 7, gap: 7, position: 'relative' },
  lastChoice: { },
  choiceActive: { backgroundColor: '#F5EFFF', borderColor: '#B99AFF' },
  choiceText: { color: '#30394A', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  choiceTextActive: { color: ui.accent },
  twoColumn: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  halfCard: { width: '47%', minHeight: 145, padding: 11, gap: 10 },
  inputWithSuffix: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: '#DDE2EB', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, gap: 5 },
  numberInput: { flex: 1, color: '#263044', fontSize: 13, paddingVertical: 8 },
  suffix: { color: '#667085', fontSize: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 3 },
  switchTrack: { width: 42, height: 24, borderRadius: 20, backgroundColor: '#C9CDD6', padding: 3, justifyContent: 'center' },
  switchOn: { backgroundColor: ui.accent },
  switchThumb: { width: 18, height: 18, borderRadius: 10, backgroundColor: '#FFFFFF' },
  switchThumbOn: { alignSelf: 'flex-end' },
  switchLabel: { color: '#263044', fontSize: 12, fontWeight: '700' },
  compactChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  compactChoice: { minHeight: 37, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E5ED', flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactText: { color: '#344054', fontSize: 10, fontWeight: '700' },
  saveButton: { minHeight: 52, borderRadius: 13, backgroundColor: ui.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.65 },
});
