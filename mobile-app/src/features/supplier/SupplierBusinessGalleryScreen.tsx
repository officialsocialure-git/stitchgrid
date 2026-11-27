import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { apiGet, apiPost, apiRequest, API_BASE_URL } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';

type MediaType = 'COMPANY_LOGO' | 'COVER_PHOTO' | 'COMPANY_PHOTO' | 'FACTORY_PHOTO' | 'WORK_PROCESS';
type GalleryItem = { id: string; mediaType: MediaType; url: string; fileName?: string | null; sortOrder: number };
type UploadedFile = { url: string; filename: string };

const PURPLE = ui.accent;
const tabs: { key: 'company' | 'factory' | 'work'; label: string; type: MediaType }[] = [
  { key: 'company', label: 'Company', type: 'COMPANY_PHOTO' },
  { key: 'factory', label: 'Factory', type: 'FACTORY_PHOTO' },
  { key: 'work', label: 'Work Process', type: 'WORK_PROCESS' },
];

function absoluteUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

export default function SupplierBusinessGalleryScreen() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState('');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'company' | 'factory' | 'work'>('company');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const membership = JSON.parse(raw);
      const id = membership.organizationId || membership.organization?.id;
      if (!id || membership.role !== 'SUPPLIER') throw new Error('An active supplier account is required.');
      setOrganizationId(id);
      const rows = await apiGet<GalleryItem[]>(`/business-gallery?organizationId=${encodeURIComponent(id)}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load gallery.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pickAndUpload = async (mediaType: MediaType) => {
    if (!organizationId || busy) return;
    const currentCount = items.filter(item => item.mediaType === mediaType).length;
    if ((mediaType === 'COMPANY_PHOTO' && currentCount >= 10) || (mediaType !== 'COMPANY_LOGO' && mediaType !== 'COVER_PHOTO' && currentCount >= 20)) {
      Alert.alert('Gallery limit reached', mediaType === 'COMPANY_PHOTO' ? 'You can add up to 10 company photos.' : 'You can add up to 20 photos in this gallery.');
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission required', 'Allow photo library access to upload your business images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.82,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Image unavailable', 'Could not read this image. Please select another photo.');
      return;
    }
    const extension = asset.mimeType?.includes('png') ? 'png' : asset.mimeType?.includes('webp') ? 'webp' : 'jpg';
    const mime = asset.mimeType || (extension === 'png' ? 'image/png' : 'image/jpeg');
    setBusy(true);
    try {
      const uploaded = await apiPost<UploadedFile>('/upload', {
        filename: asset.fileName || `business-${Date.now()}.${extension}`,
        data: `data:${mime};base64,${asset.base64}`,
        label: mediaType,
      });
      const saved = await apiPost<GalleryItem>('/business-gallery', {
        organizationId,
        mediaType,
        url: uploaded.url.startsWith('/') ? absoluteUrl(uploaded.url) : uploaded.url,
        fileName: uploaded.filename,
      });
      setItems(current => mediaType === 'COMPANY_LOGO' || mediaType === 'COVER_PHOTO'
        ? [...current.filter(item => item.mediaType !== mediaType), saved]
        : [...current, saved]);
      Alert.alert('Uploaded', 'Your image has been saved to your business profile.');
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (item: GalleryItem) => {
    Alert.alert('Remove photo?', 'This image will be removed from your business profile.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await apiRequest(`/business-gallery/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
          setItems(current => current.filter(row => row.id !== item.id));
        } catch (e) {
          Alert.alert('Unable to remove image', e instanceof Error ? e.message : 'Please try again.');
        } finally { setBusy(false); }
      } },
    ]);
  };

  const active = tabs.find(tab => tab.key === activeTab)!;
  const logo = items.find(item => item.mediaType === 'COMPANY_LOGO');
  const cover = items.find(item => item.mediaType === 'COVER_PHOTO');
  const gallery = items.filter(item => item.mediaType === active.type).sort((a, b) => a.sortOrder - b.sortOrder);

  const renderImage = (item: GalleryItem, large = false) => (
    <View key={item.id} style={[s.photoWrap, large && s.largePhoto]}>
      <Image source={{ uri: absoluteUrl(item.url) }} style={s.photo} resizeMode="cover" />
      <Pressable style={s.removeButton} onPress={() => remove(item)} disabled={busy}>
        <MaterialCommunityIcons name="close" size={15} color="#344054" />
      </Pressable>
    </View>
  );

  return (
    <View style={s.screen}>
      <AppHeader role="SUPPLIER" title="Photos & Factory Gallery" activeSection="profile" showLogo />
      {loading ? <View style={s.state}><ActivityIndicator size="large" color={PURPLE} /><Text style={s.muted}>Loading gallery…</Text></View> : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.tabs}>
            {tabs.map(tab => <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={[s.tab, activeTab === tab.key && s.activeTab]}><Text style={[s.tabText, activeTab === tab.key && s.activeTabText]}>{tab.label}</Text></Pressable>)}
          </View>
          {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text><Pressable onPress={() => { setLoading(true); void load(); }}><Text style={s.retry}>Retry</Text></Pressable></View> : null}

          {activeTab === 'company' ? <>
            <Text style={s.label}>Company Logo *</Text>
            <View style={s.logoBox}>
              {logo ? <Image source={{ uri: absoluteUrl(logo.url) }} style={s.logoImage} resizeMode="contain" /> : <View style={s.logoPlaceholder}><MaterialCommunityIcons name="domain" size={35} color={PURPLE} /></View>}
              <Pressable style={s.editButton} onPress={() => void pickAndUpload('COMPANY_LOGO')} disabled={busy}><MaterialCommunityIcons name="pencil" size={17} color={PURPLE} /></Pressable>
            </View>
            <Text style={s.label}>Cover Photo *</Text>
            <View style={s.coverBox}>
              {cover ? <Image source={{ uri: absoluteUrl(cover.url) }} style={s.coverImage} resizeMode="cover" /> : <View style={s.coverPlaceholder}><MaterialCommunityIcons name="image-plus" size={30} color={PURPLE} /><Text style={s.muted}>Add company cover photo</Text></View>}
              <Pressable style={s.editButton} onPress={() => void pickAndUpload('COVER_PHOTO')} disabled={busy}><MaterialCommunityIcons name="pencil" size={17} color={PURPLE} /></Pressable>
            </View>
          </> : <Text style={s.sectionHeading}>{active.label} Photos</Text>}

          <View style={s.galleryHeader}><Text style={s.label}>{activeTab === 'company' ? `Company Photos (${gallery.length}/10)` : `${active.label} Photos (${gallery.length}/20)`}</Text></View>
          <View style={s.grid}>
            {gallery.map(item => renderImage(item))}
            <Pressable style={s.addTile} onPress={() => void pickAndUpload(active.type)} disabled={busy || (activeTab === 'company' ? gallery.length >= 10 : gallery.length >= 20)}>
              {busy ? <ActivityIndicator color={PURPLE} /> : <><MaterialCommunityIcons name="plus" size={26} color={PURPLE} /><Text style={s.addText}>Add Photo</Text></>}
            </Pressable>
          </View>
          <Pressable style={[s.saveButton, busy && s.disabled]} onPress={() => { Alert.alert('Saved', 'Your gallery changes are already saved securely.'); void load(); }} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" /><Text style={s.saveText}>Save Changes</Text></>}
          </Pressable>
          <Text style={s.helper}>Images are uploaded and saved as you add or remove them. Maximum 10 company photos and 20 photos per factory/work-process gallery.</Text>
        </ScrollView>
      )}
      <AppBottomNav role="SUPPLIER" activeSection="profile" onNavigate={(section) => {
        if (section === 'home') router.replace('/workspace?role=SUPPLIER' as any);
        else router.push({ pathname: '/supplier/[section]', params: { section: section === 'profile' ? 'business-profile' : section } } as any);
      }} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 22, gap: 10, width: '100%', maxWidth: 840, alignSelf: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E7E7EF', marginBottom: 4 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: PURPLE },
  tabText: { color: '#778092', fontSize: 12, fontWeight: '700' },
  activeTabText: { color: PURPLE },
  label: { color: '#30394A', fontSize: 12, fontWeight: '800' },
  logoBox: { minHeight: 104, backgroundColor: '#F3F4F8', borderRadius: 12, alignItems: 'center', justifyContent: 'center', position: 'relative', borderWidth: 1, borderColor: '#EAECF0' },
  logoImage: { width: 88, height: 78 },
  logoPlaceholder: { width: 82, height: 76, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  editButton: { position: 'absolute', right: 9, bottom: 9, width: 31, height: 31, borderRadius: 9, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  coverBox: { height: 142, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F3F4F8', position: 'relative', borderWidth: 1, borderColor: '#EAECF0' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  galleryHeader: { marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  photoWrap: { width: '31.5%', aspectRatio: 1.18, borderRadius: 10, overflow: 'hidden', backgroundColor: '#EAECF0' },
  largePhoto: { width: '48%' },
  photo: { width: '100%', height: '100%' },
  removeButton: { position: 'absolute', top: 5, right: 5, width: 23, height: 23, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 2 },
  addTile: { width: '31.5%', aspectRatio: 1.18, borderRadius: 10, borderWidth: 1, borderColor: '#E4D9FF', backgroundColor: '#F7F3FF', alignItems: 'center', justifyContent: 'center', gap: 3 },
  addText: { color: PURPLE, fontSize: 11, fontWeight: '800' },
  saveButton: { minHeight: 43, borderRadius: 10, backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  saveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  helper: { color: '#929BA9', fontSize: 9, lineHeight: 13, textAlign: 'center', paddingHorizontal: 8 },
  sectionHeading: { color: '#253044', fontSize: 15, fontWeight: '800', paddingVertical: 8 },
  errorBox: { backgroundColor: '#FEF3F2', padding: 10, borderRadius: 9, gap: 6 },
  errorText: { color: '#B42318', fontSize: 11 },
  retry: { color: PURPLE, fontWeight: '800', fontSize: 11 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 9 },
  muted: { color: '#8992A0', fontSize: 10 },
});
