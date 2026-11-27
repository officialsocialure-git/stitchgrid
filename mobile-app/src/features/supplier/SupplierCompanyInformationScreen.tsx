import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { apiGet, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type OrganizationProfile = {
  id: string;
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  businessType?: string | null;
  verificationStatus?: string;
  supplierProfile?: { yearsInBusiness?: number | null; description?: string | null } | null;
};

const COUNTRIES = ['India', 'Nepal', 'Bangladesh', 'China', 'Vietnam', 'Sri Lanka', 'Pakistan', 'United States', 'United Kingdom', 'Other'];

type FieldProps = {
  label: string; value: string; onChangeText: (value: string) => void; placeholder: string;
  required?: boolean; keyboardType?: 'default' | 'numeric' | 'email-address'; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; valid?: boolean;
  maxLength?: number;
};

function Field({ label, value, onChangeText, placeholder, required, keyboardType, autoCapitalize = 'sentences', valid, maxLength }: FieldProps) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}{required ? <Text style={s.required}> *</Text> : null}</Text>
      <View style={s.inputWrap}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          keyboardType={keyboardType || 'default'}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          editable={true}
          selectTextOnFocus={false}
          selectionColor={ui.accent}
          maxLength={maxLength}
          style={[s.input, valid && s.validInput]}
        />
        {valid ? <MaterialCommunityIcons name="check-circle" size={18} color="#20A464" style={s.validIcon} /> : null}
      </View>
    </View>
  );
}

export default function SupplierCompanyInformationScreen() {
  const router = useRouter();
  const keyboardVisible = useKeyboardVisible();
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [years, setYears] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('India');
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const membership = JSON.parse(raw);
      const id = membership.organizationId || membership.organization?.id;
      if (!id || membership.role !== 'SUPPLIER') throw new Error('An active supplier organization is required.');
      setOrganizationId(id);
      const data = await apiGet<OrganizationProfile>(`/organization-profile?organizationId=${encodeURIComponent(id)}`);
      setName(data.name || '');
      setLegalName(data.legalName || '');
      setTaxId(data.taxId || '');
      setYears(data.supplierProfile?.yearsInBusiness == null ? '' : String(data.supplierProfile.yearsInBusiness));
      setDescription(data.supplierProfile?.description || '');
      setAddress(data.address || '');
      setCity(data.city || '');
      setCountry(data.country || 'India');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load company information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const taxValid = useMemo(() => {
    const value = taxId.trim();
    if (!value) return false;
    // GSTIN is 15 characters in India. For other countries, accept a reasonable tax-ID format.
    return country === 'India' ? /^[0-9A-Z]{15}$/i.test(value) : /^[A-Z0-9][A-Z0-9/-]{3,29}$/i.test(value);
  }, [taxId, country]);

  const save = async () => {
    setError('');
    setSuccess('');
    if (name.trim().length < 2) return Alert.alert('Required field', 'Enter your organization / company name.');
    if (!taxId.trim()) return Alert.alert('Required field', 'Enter your GSTIN / Tax Identification.');
    if (!taxValid) return Alert.alert('Check tax identification', country === 'India' ? `Indian GSTIN must be exactly 15 characters. Current length: ${taxId.trim().length}. Please correct it before saving.` : 'Enter a valid tax identification number.');
    if (!years.trim() || !Number.isInteger(Number(years)) || Number(years) < 0 || Number(years) > 150) return Alert.alert('Check years in business', 'Enter a whole number from 0 to 150.');
    if (address.trim().length < 5) return Alert.alert('Required field', 'Enter your registered address / factory location.');
    if (city.trim().length < 2) return Alert.alert('Required field', 'Enter your primary operating city.');
    if (!country.trim()) return Alert.alert('Required field', 'Select your country.');
    if (!organizationId) return Alert.alert('Session expired', 'Please sign in again.');

    setSaving(true);
    try {
      const updated = await apiRequest<OrganizationProfile>('/organization-profile', {
        method: 'PUT',
        body: {
          organizationId,
          name: name.trim(),
          legalName: legalName.trim(),
          taxId: taxId.trim().toUpperCase(),
          yearsInBusiness: Number(years),
          description: description.trim(),
          address: address.trim(),
          city: city.trim(),
          country,
        },
      });
      setName(updated.name || name.trim());
      setLegalName(updated.legalName || '');
      setTaxId(updated.taxId || taxId.trim().toUpperCase());
      setAddress(updated.address || address.trim());
      setCity(updated.city || city.trim());
      setCountry(updated.country || country);
      setSuccess('Company information saved successfully.');
      try {
        const raw = await SecureStore.getItemAsync('sg_membership');
        if (raw) {
          const membership = JSON.parse(raw);
          membership.organization = { ...(membership.organization || {}), id: organizationId, name: updated.name };
          await SecureStore.setItemAsync('sg_membership', JSON.stringify(membership));
        }
      } catch {
        // The server save has succeeded; a local membership-cache failure must not show a false save error.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save company information.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader isBack role="SUPPLIER" title="Company Information" showLogo />
      {loading ? (
        <View style={s.state}><ActivityIndicator size="large" color={ui.accent} /><Text style={s.muted}>Loading company information…</Text></View>
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={s.sectionHeading}>Basic Information</Text>
          <View style={s.card}>
            <Field label="Organization / Company Name" value={name} onChangeText={setName} placeholder="Enter company name" required />
            <Field label="Legal Name" value={legalName} onChangeText={setLegalName} placeholder="Registered legal name" />
            <Field label="GSTIN / Tax Identification" value={taxId} onChangeText={setTaxId} placeholder="Enter GSTIN / Tax ID" required autoCapitalize="characters" valid={taxValid} maxLength={country === 'India' ? 15 : undefined} />
            <Field label="Years in Business" value={years} onChangeText={setYears} placeholder="e.g. 5" required keyboardType="numeric" />
            <View style={s.field}>
              <Text style={s.label}>About the Company</Text>
              <TextInput
                accessibilityLabel="About the Company"
                value={description}
                onChangeText={setDescription}
                placeholder="Introduce your company, experience, manufacturing strengths, quality standards and what makes your factory different."
                placeholderTextColor="#98A2B3"
                multiline
                textAlignVertical="top"
                maxLength={4000}
                style={s.multilineInput}
              />
              <Text style={s.characterCount}>{description.length}/4000 characters</Text>
            </View>
            <Field label="Registered Address / Factory Location" value={address} onChangeText={setAddress} placeholder="Enter registered / factory address" required />
            <Field label="Primary Operating City" value={city} onChangeText={setCity} placeholder="e.g. Noida" required />
            <View style={s.field}>
              <Text style={s.label}>Country<Text style={s.required}> *</Text></Text>
              <Pressable style={s.countryInput} onPress={() => setCountryPickerOpen(true)} accessibilityRole="button" accessibilityLabel="Select country">
                <Text style={s.countryValue}>{country || 'Select country'}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#667085" />
              </Pressable>
            </View>
            {!!error && <Text style={s.error}>{error}</Text>}
            {!!success && <View style={s.success}><MaterialCommunityIcons name="check-circle" size={17} color="#16804A" /><Text style={s.successText}>{success}</Text></View>}
            <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [s.saveButton, (saving || pressed) && s.savePressed]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <MaterialCommunityIcons name="content-save-outline" size={18} color="#FFFFFF" />}
              <Text style={s.saveText}>{saving ? 'Saving Changes…' : 'Save Changes'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
      {!keyboardVisible && <AppBottomNav role="SUPPLIER" activeSection="business-profile" onNavigate={(section) => {
        if (section === 'home') router.replace('/workspace?role=SUPPLIER' as any);
        else router.replace({ pathname: '/supplier/[section]', params: { section } } as any);
      }} />}
      <Modal visible={countryPickerOpen} transparent animationType="slide" onRequestClose={() => setCountryPickerOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setCountryPickerOpen(false)}>
          <View style={s.countrySheet}>
            <Text style={s.sheetTitle}>Select Country</Text>
            <ScrollView>
              {COUNTRIES.map(item => (
                <Pressable key={item} style={s.countryOption} onPress={() => { setCountry(item); setCountryPickerOpen(false); }}>
                  <Text style={[s.countryOptionText, item === country && s.selectedCountry]}>{item}</Text>
                  {item === country ? <MaterialCommunityIcons name="check" size={18} color={ui.accent} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { paddingHorizontal: 13, paddingTop: 18, paddingBottom: 24, gap: 12, width: '100%', maxWidth: 840, alignSelf: 'center' },
  sectionHeading: { color: '#202B3C', fontSize: 14, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#E6E8EF', padding: 12, gap: 13 },
  field: { gap: 5 },
  label: { color: '#424D5E', fontSize: 11, fontWeight: '700' },
  required: { color: '#E5484D' },
  inputWrap: { position: 'relative', justifyContent: 'center' },
  input: { minHeight: 42, borderWidth: 1, borderColor: '#E1E5EC', borderRadius: 9, paddingHorizontal: 11, paddingRight: 35, color: '#202B3C', fontSize: 13, backgroundColor: '#FFFFFF' },
  multilineInput: { minHeight: 130, borderWidth: 1, borderColor: '#E1E5EC', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 10, color: '#202B3C', fontSize: 13, backgroundColor: '#FFFFFF', lineHeight: 20 },
  characterCount: { alignSelf: 'flex-end', color: '#98A2B3', fontSize: 10 },
  validInput: { borderColor: '#B6E5CC' },
  validIcon: { position: 'absolute', right: 10 },
  countryInput: { minHeight: 42, borderWidth: 1, borderColor: '#E1E5EC', borderRadius: 9, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countryValue: { color: '#202B3C', fontSize: 13 },
  saveButton: { minHeight: 44, marginTop: 8, borderRadius: 9, backgroundColor: ui.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  savePressed: { opacity: 0.7 },
  saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: '#7A8494', fontSize: 12 },
  error: { color: '#B42318', fontSize: 12, lineHeight: 17 },
  success: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#ECFDF3', padding: 10, borderRadius: 9 },
  successText: { color: '#167447', fontSize: 11, fontWeight: '700', flex: 1 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(16,24,40,0.42)' },
  countrySheet: { maxHeight: '70%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  sheetTitle: { color: '#202B3C', fontSize: 15, fontWeight: '800', paddingBottom: 12 },
  countryOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F0F1F4' },
  countryOptionText: { color: '#344054', fontSize: 13 },
  selectedCountry: { color: ui.accent, fontWeight: '800' },
});
