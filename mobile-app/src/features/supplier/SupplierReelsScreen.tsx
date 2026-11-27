import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { apiDelete, apiGet, apiPatch, apiPost, API_BASE_URL } from '@/services/api';
import { ui } from '@/theme/ui';

const PURPLE = ui.accent;
type Reel = {
  id: string; title: string; videoUrl: string; durationSeconds: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HIDDEN';
  moderationNote?: string | null; impressionCount: number; viewCount: number;
  createdAt: string; products?: { catalogItem: { id: string; name: string } }[];
};
type CatalogItem = { id: string; name: string; itemType: string; isActive?: boolean };

export default function SupplierReelsScreen() {
  const router = useRouter();
  const [reels, setReels] = useState<Reel[]>([]);
  const [products, setProducts] = useState<CatalogItem[]>([]);
  const [title, setTitle] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [editingReel, setEditingReel] = useState<Reel | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editProducts, setEditProducts] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const [items, catalog] = await Promise.all([
        apiGet<Reel[]>('/supplier/reels'),
        apiGet<CatalogItem[]>('/catalog-items').catch(() => []),
      ]);
      setReels(Array.isArray(items) ? items : []);
      setProducts(Array.isArray(catalog) ? catalog.filter(item => item.isActive !== false) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load your Reels.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleProduct = (id: string) => setSelectedProducts(current =>
    current.includes(id) ? current.filter(value => value !== id) : [...current, id].slice(0, 20)
  );

  const upload = async () => {
    if (!title.trim()) { Alert.alert('Collection name required', 'Add a name for this collection before uploading.'); return; }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission required', 'Allow video library access to upload a collection Reel.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      videoMaxDuration: 60,
      quality: 0.75,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const durationSeconds = Math.round((asset.duration || 0) / 1000);
    if (durationSeconds < 15 || durationSeconds > 60) {
      Alert.alert('Video duration not supported', 'Please select a video between 15 and 60 seconds.');
      return;
    }
    if (asset.fileSize && asset.fileSize > 30 * 1024 * 1024) {
      Alert.alert('Video too large', 'Please select a video under 30 MB.');
      return;
    }
    try {
      setUploading(true);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const mimeType = asset.mimeType || (asset.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : asset.uri.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4');
      const filename = asset.fileName || `supplier-reel-${Date.now()}.${mimeType === 'video/quicktime' ? 'mov' : mimeType === 'video/webm' ? 'webm' : 'mp4'}`;
      const uploaded = await apiPost<{ url: string; durationSeconds?: number | null }>('/upload', {
        filename,
        data: `data:${mimeType};base64,${base64}`,
        label: 'SUPPLIER_REEL',
      }, 180000);
      const verifiedDuration = uploaded.durationSeconds ?? durationSeconds;
      if (verifiedDuration < 15 || verifiedDuration > 60) {
        throw new Error('The uploaded video must be between 15 and 60 seconds.');
      }
      await apiPost('/supplier/reels', {
        title: title.trim(),
        videoUrl: uploaded.url.startsWith('http') ? uploaded.url : `${API_BASE_URL.replace('/api', '')}${uploaded.url}`,
        durationSeconds: verifiedDuration,
        productIds: selectedProducts,
      }, 60000);
      setTitle('');
      setSelectedProducts([]);
      Alert.alert('Reel submitted', 'Your Reel is now pending admin approval.');
      await load(true);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (reel: Reel) => {
    setEditingReel(reel);
    setEditTitle(reel.title);
    setEditProducts((reel.products || []).map(item => item.catalogItem.id));
  };

  const saveEdit = async () => {
    if (!editingReel || !editTitle.trim()) return;
    try {
      setSavingEdit(true);
      await apiPatch(`/supplier/reels/${editingReel.id}`, { title: editTitle.trim(), productIds: editProducts });
      setEditingReel(null);
      await load(true);
      Alert.alert('Reel updated', 'Your updated Reel has been sent for admin approval again.');
    } catch (e) {
      Alert.alert('Unable to update Reel', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteReel = (reel: Reel) => Alert.alert('Delete Reel?', 'This Reel will be removed from your supplier profile.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      try { await apiDelete(`/supplier/reels/${reel.id}`); await load(true); }
      catch (e) { Alert.alert('Unable to delete', e instanceof Error ? e.message : 'Please try again.'); }
    } },
  ]);

  const navigate = (section: string) => {
    if (section === 'home') { router.replace('/workspace?role=SUPPLIER' as any); return; }
    router.push({ pathname: '/supplier/[section]', params: { section } } as any);
  };

  return (
    <View style={s.screen}>
      <AppHeader role="SUPPLIER" title="Viral Trends / Reels" activeSection="profile" showLogo />
      <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={PURPLE} />}>
        <Text style={s.heading}>Showcase Your Collections</Text>
        <Text style={s.subheading}>Upload a short collection video to feature your company on the buyer homepage.</Text>
        <View style={s.uploadCard}>
          <View style={s.uploadIcon}><MaterialCommunityIcons name="video-plus-outline" size={28} color={PURPLE} /></View>
          <Text style={s.uploadTitle}>Upload Reel</Text>
          <Text style={s.helper}>Direct video upload · 15–60 seconds · MP4, MOV or WEBM · Max 30 MB</Text>
          <Text style={s.label}>COLLECTION NAME</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Banarasi Silk Collection" placeholderTextColor="#98A2B3" style={s.input} maxLength={120} />
          <View style={s.productHeader}><Text style={s.label}>LINK PRODUCTS (OPTIONAL)</Text><Text style={s.count}>{selectedProducts.length}/20</Text></View>
          {products.length ? products.slice(0, 30).map(item => {
            const checked = selectedProducts.includes(item.id);
            return <Pressable key={item.id} onPress={() => toggleProduct(item.id)} style={s.productRow}>
              <View style={[s.checkbox, checked && s.checkboxChecked]}>{checked && <MaterialCommunityIcons name="check" size={14} color="#fff" />}</View>
              <View style={{ flex: 1 }}><Text style={s.productName}>{item.name}</Text><Text style={s.productType}>{item.itemType}</Text></View>
            </Pressable>;
          }) : <Text style={s.helper}>Add products to your catalog first, or upload a collection Reel without product links.</Text>}
          <Pressable disabled={uploading} onPress={() => void upload()} style={[s.uploadButton, uploading && { opacity: 0.65 }]}>
            {uploading ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="cloud-upload-outline" size={20} color="#fff" />}
            <Text style={s.uploadButtonText}>{uploading ? 'Uploading Reel…' : 'Choose Video & Upload'}</Text>
          </Pressable>
        </View>

        <View style={s.listHeader}><Text style={s.listTitle}>My Reels</Text><Text style={s.count}>{reels.length} uploaded</Text></View>
        {loading ? <ActivityIndicator color={PURPLE} style={{ marginTop: 24 }} /> : error ? <Text style={s.error}>{error}</Text> : reels.length ? reels.map(reel => (
          <View key={reel.id} style={s.reelRow}>
            <View style={s.videoIcon}><MaterialCommunityIcons name="movie-play-outline" size={25} color={PURPLE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.reelTitle} numberOfLines={1}>{reel.title}</Text>
              <Text style={s.reelMeta}>{reel.durationSeconds}s · {reel.impressionCount} impressions · {reel.viewCount} views</Text>
              <Text style={[s.status, reel.status === 'APPROVED' ? s.approved : reel.status === 'REJECTED' ? s.rejected : s.pending]}>{reel.status === 'APPROVED' ? 'Approved' : reel.status === 'REJECTED' ? 'Rejected' : reel.status === 'HIDDEN' ? 'Hidden' : 'Pending review'}</Text>
              {!!reel.moderationNote && <Text style={s.moderationNote}>{reel.moderationNote}</Text>}
            </View>
            <Pressable onPress={() => openEdit(reel)} hitSlop={10} style={s.deleteButton}><MaterialCommunityIcons name="pencil-outline" size={19} color={PURPLE} /></Pressable>
            <Pressable onPress={() => deleteReel(reel)} hitSlop={10} style={s.deleteButton}><MaterialCommunityIcons name="trash-can-outline" size={20} color="#B42318" /></Pressable>
          </View>
        )) : <View style={s.empty}><MaterialCommunityIcons name="movie-open-outline" size={28} color="#A6A0B4" /><Text style={s.emptyTitle}>No Reels uploaded yet</Text><Text style={s.helper}>Your approved Reels will appear in Viral Trends on the buyer homepage.</Text></View>}
      </ScrollView>
      <AppBottomNav role="SUPPLIER" activeSection="profile" onNavigate={navigate} />
      <Modal visible={!!editingReel} transparent animationType="slide" onRequestClose={() => setEditingReel(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.editSheet}>
            <View style={s.listHeader}>
              <Text style={s.listTitle}>Edit Reel Details</Text>
              <Pressable onPress={() => setEditingReel(null)}><MaterialCommunityIcons name="close" size={23} color="#7B8493" /></Pressable>
            </View>
            <Text style={s.label}>COLLECTION NAME</Text>
            <TextInput value={editTitle} onChangeText={setEditTitle} style={s.input} maxLength={120} placeholder="Collection name" />
            <Text style={s.label}>LINKED PRODUCTS</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {products.slice(0, 30).map(item => {
                const checked = editProducts.includes(item.id);
                return <Pressable key={item.id} onPress={() => setEditProducts(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id].slice(0, 20))} style={s.productRow}>
                  <View style={[s.checkbox, checked && s.checkboxChecked]}>{checked && <MaterialCommunityIcons name="check" size={14} color="#fff" />}</View>
                  <View style={{ flex: 1 }}><Text style={s.productName}>{item.name}</Text><Text style={s.productType}>{item.itemType}</Text></View>
                </Pressable>;
              })}
            </ScrollView>
            <Text style={s.helper}>Saving changes sends the Reel back to admin review.</Text>
            <Pressable disabled={savingEdit} onPress={() => void saveEdit()} style={[s.uploadButton, savingEdit && { opacity: .65 }]}>
              {savingEdit ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="content-save-outline" size={19} color="#fff" />}
              <Text style={s.uploadButtonText}>{savingEdit ? 'Saving…' : 'Save Changes'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  content: { padding: 18, paddingBottom: 28, gap: 12 },
  heading: { fontSize: 22, fontWeight: '800', color: ui.ink },
  subheading: { fontSize: 14, lineHeight: 21, color: ui.muted, marginBottom: 6 },
  uploadCard: { backgroundColor: '#F8F3FF', borderWidth: 1, borderColor: '#E7DDF8', borderRadius: 18, padding: 16, gap: 10 },
  uploadIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#EEE5FF', alignItems: 'center', justifyContent: 'center' },
  uploadTitle: { fontSize: 18, fontWeight: '800', color: ui.ink },
  helper: { fontSize: 12, lineHeight: 18, color: ui.muted },
  label: { fontSize: 11, fontWeight: '800', color: '#667085', letterSpacing: .5 },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D9D2E6', backgroundColor: '#fff', paddingHorizontal: 12, color: ui.ink },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  count: { fontSize: 12, color: ui.muted, fontWeight: '700' },
  productRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#E8E3EF', paddingVertical: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#A99CBD', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: PURPLE, borderColor: PURPLE },
  productName: { fontSize: 13, fontWeight: '700', color: ui.ink },
  productType: { fontSize: 11, color: ui.muted, marginTop: 2 },
  uploadButton: { minHeight: 50, borderRadius: 13, backgroundColor: PURPLE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 8 },
  uploadButtonText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  listTitle: { fontSize: 18, fontWeight: '800', color: ui.ink },
  reelRow: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: ui.border, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  videoIcon: { width: 48, height: 58, borderRadius: 10, backgroundColor: '#F2ECFC', alignItems: 'center', justifyContent: 'center' },
  reelTitle: { fontSize: 14, fontWeight: '800', color: ui.ink },
  reelMeta: { fontSize: 11, color: ui.muted, marginTop: 3 },
  status: { fontSize: 10, fontWeight: '800', alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, marginTop: 5 },
  approved: { backgroundColor: '#E8F8EF', color: '#16804A' },
  pending: { backgroundColor: '#FFF4D6', color: '#936200' },
  rejected: { backgroundColor: '#FDECEC', color: '#B42318' },
  moderationNote: { color: '#B42318', fontSize: 11, marginTop: 4 },
  deleteButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18, 12, 28, .48)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, gap: 12, maxHeight: '85%' },
  empty: { backgroundColor: '#fff', borderRadius: 16, padding: 22, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: ui.border },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: ui.ink },
  error: { color: '#B42318', fontSize: 13, padding: 12 },
});
