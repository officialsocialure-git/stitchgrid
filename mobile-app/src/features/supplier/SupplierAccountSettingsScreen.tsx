import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { apiGet, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { useRouter } from 'expo-router';

const PURPLE = ui.accent;
type Account = { id: string; fullName: string; email?: string | null; phone?: string | null };

export default function SupplierAccountSettingsScreen() {
  const router=useRouter();
  const keyboardVisible=useKeyboardVisible();
  const navigate=(section:string)=>section==='home'
    ? router.replace('/workspace?role=SUPPLIER' as any)
    : router.replace({pathname:'/supplier/[section]',params:{section}} as any);
  const [account, setAccount] = useState<Account | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet<Account>('/auth/me');
      setAccount(data);
      setFullName(data.fullName || '');
      setPhone(data.phone || '');
      await SecureStore.setItemAsync('sg_user', JSON.stringify(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load account details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Check your name', 'Full name must contain at least 2 characters.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await apiRequest<Account>('/auth/profile', {
        method: 'PATCH',
        body: { fullName: fullName.trim(), phone: phone.trim() },
      });
      setAccount(updated);
      setFullName(updated.fullName || '');
      setPhone(updated.phone || '');
      await SecureStore.setItemAsync('sg_user', JSON.stringify(updated));
      setSuccess('Account details updated successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save account details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader
        isBack
        role="SUPPLIER"
        activeSection="account-settings"
        title="Account Settings"
        showLogo={false}
      />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.titleRow}>
          <View style={s.titleIcon}><MaterialCommunityIcons name="account-cog-outline" size={25} color={PURPLE} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>Your account</Text>
            <Text style={s.subheading}>Manage your personal sign-in details.</Text>
          </View>
        </View>
        {loading ? <View style={s.state}><ActivityIndicator color={PURPLE} /><Text style={s.muted}>Loading account details...</Text></View> : (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Personal Information</Text>
            <View style={s.field}>
              <Text style={s.label}>FULL NAME</Text>
              <TextInput accessibilityLabel="Full name" value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor={ui.muted} style={s.input} />
            </View>
            <View style={s.field}>
              <Text style={s.label}>REGISTERED EMAIL</Text>
              <TextInput value={account?.email || ''} editable={false} style={[s.input, s.readOnly]} />
              <Text style={s.helper}>Email address is managed through your registered account.</Text>
            </View>
            <View style={s.field}>
              <Text style={s.label}>MOBILE NUMBER</Text>
              <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Enter mobile number" placeholderTextColor={ui.muted} style={s.input} />
            </View>
            {!!error && <Text style={s.error}>{error}</Text>}
            {!!success && <View style={s.success}><MaterialCommunityIcons name="check-circle" size={18} color="#16804A" /><Text style={s.successText}>{success}</Text></View>}
            <Pressable onPress={() => void save()} disabled={saving} style={[s.save, saving && { opacity: 0.65 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="content-save-outline" size={20} color="#fff" />}
              <Text style={s.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      {!keyboardVisible && <AppBottomNav role="SUPPLIER" activeSection="account-settings" onNavigate={navigate} />}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { padding: 16, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 840, alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: ui.accentSoft, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: ui.ink },
  subheading: { fontSize: 13, lineHeight: 19, color: ui.muted, marginTop: 3 },
  card: { backgroundColor: ui.surface, borderRadius: 16, borderWidth: 1, borderColor: ui.border, padding: 17, gap: 17 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: ui.ink },
  field: { gap: 7 },
  label: { fontSize: 12, fontWeight: '700', color: '#596273', letterSpacing: 0.5 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#E1E4EA', borderRadius: 12, paddingHorizontal: 13, fontSize: 14, color: ui.ink, backgroundColor: ui.surface },
  readOnly: { backgroundColor: '#F2F3F6', color: ui.muted },
  helper: { color: ui.muted, fontSize: 12 },
  save: { minHeight: 49, borderRadius: 13, backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  saveText: { color: ui.surface, fontSize: 14, fontWeight: '700' },
  error: { color: '#B42318', fontSize: 13 },
  success: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ECFDF3', padding: 11, borderRadius: 11 },
  successText: { flex: 1, color: '#167447', fontSize: 13, fontWeight: '600' },
  state: { minHeight: 200, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { fontSize: 13, color: ui.muted },
});
