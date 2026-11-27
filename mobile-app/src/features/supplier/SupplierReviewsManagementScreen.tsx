import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { apiGet, apiPost, apiRequest } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { ui } from '@/theme/ui';

type Testimonial = { id: string; customerName: string; rating: number; comment: string; createdAt: string };
const purple = ui.accent;

export default function SupplierReviewsManagementScreen() {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState('');
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await SecureStore.getItemAsync('sg_membership');
      if (!raw) throw new Error('Supplier session not found. Please sign in again.');
      const membership = JSON.parse(raw);
      const id = membership.organizationId || membership.organization?.id;
      if (!id || membership.role !== 'SUPPLIER') throw new Error('Active supplier account required.');
      setOrganizationId(id);
      const rows = await apiGet<Testimonial[]>(`/supplier-testimonials?organizationId=${encodeURIComponent(id)}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (error) {
      Alert.alert('Unable to load reviews', error instanceof Error ? error.message : 'Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resetForm = () => { setEditingId(null); setCustomerName(''); setRating(5); setComment(''); };
  const openCreate = () => { resetForm(); setModal(true); };
  const openEdit = (item: Testimonial) => { setEditingId(item.id); setCustomerName(item.customerName); setRating(item.rating); setComment(item.comment); setModal(true); };

  const save = async () => {
    if (customerName.trim().length < 2) { Alert.alert('Customer name required', 'Enter at least 2 characters.'); return; }
    if (comment.trim().length < 3) { Alert.alert('Review required', 'Enter a short customer testimonial.'); return; }
    setBusy(true);
    try {
      const payload = { customerName: customerName.trim(), rating, comment: comment.trim(), ...(!editingId ? { organizationId } : {}) };
      if (editingId) await apiRequest(`/supplier-testimonials/${encodeURIComponent(editingId)}`, { method: 'PATCH', body: payload });
      else await apiPost('/supplier-testimonials', payload);
      setModal(false); resetForm(); await load();
      Alert.alert(editingId ? 'Review updated' : 'Review added', 'This supplier-provided testimonial is now visible on your public profile.');
    } catch (error) {
      Alert.alert('Unable to save review', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  const remove = (item: Testimonial) => Alert.alert('Delete testimonial?', `Remove the testimonial from ${item.customerName}?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      setBusy(true);
      try { await apiRequest(`/supplier-testimonials/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); setItems(rows => rows.filter(row => row.id !== item.id)); }
      catch (error) { Alert.alert('Delete failed', error instanceof Error ? error.message : 'Please try again.'); }
      finally { setBusy(false); }
    } },
  ]);

  const average = items.length ? items.reduce((sum, item) => sum + item.rating, 0) / items.length : 0;
  const distribution = [5, 4, 3, 2, 1].map(star => ({ star, count: items.filter(item => item.rating === star).length }));

  return <View style={s.screen}>
    <AppHeader role="SUPPLIER" title="Reviews & Ratings" activeSection="profile" showLogo />
    {loading ? <View style={s.center}><ActivityIndicator color={purple} /><Text style={s.muted}>Loading testimonials…</Text></View> : <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <View style={s.hero}><View style={s.heroIcon}><MaterialCommunityIcons name="star-plus-outline" size={25} color={purple} /></View><View style={{ flex: 1 }}><Text style={s.heroTitle}>Supplier Reviews & Ratings</Text><Text style={s.heroText}>Add customer testimonials and ratings to build trust with buyers.</Text></View></View>
      <View style={s.summary}>
        <View style={s.averageBox}><Text style={s.average}>{items.length ? average.toFixed(1) : '—'} / 5</Text><Text style={s.stars}>★★★★★</Text><Text style={s.muted}>Based on {items.length} testimonials</Text></View>
        <View style={s.bars}>{distribution.map(row => <View key={row.star} style={s.barRow}><Text style={s.barLabel}>{row.star} ★</Text><View style={s.track}><View style={[s.fill, { width: items.length ? `${row.count / items.length * 100}%` : '0%' }]} /></View><Text style={s.barPercent}>{items.length ? Math.round(row.count / items.length * 100) : 0}%</Text></View>)}</View>
      </View>
      <Pressable style={s.addButton} onPress={openCreate} disabled={busy}><MaterialCommunityIcons name="plus" size={19} color="#fff" /><Text style={s.addText}>Add Review</Text></Pressable>
      <View style={s.listHeading}><Text style={s.listTitle}>Your Reviews ({items.length})</Text><Text style={s.demoLabel}>SUPPLIER-PROVIDED</Text></View>
      {items.map(item => <View key={item.id} style={s.card}>
        <View style={s.cardTop}><View style={s.avatar}><Text style={s.avatarText}>{item.customerName.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('')}</Text></View><View style={{ flex: 1 }}><Text style={s.customer}>{item.customerName}</Text><Text style={s.date}>{new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={s.ratingValue}>{item.rating.toFixed(1)}</Text><Text style={s.cardStars}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</Text><Pressable onPress={() => openEdit(item)} hitSlop={8}><MaterialCommunityIcons name="pencil-outline" size={19} color={purple} /></Pressable><Pressable onPress={() => remove(item)} hitSlop={8}><MaterialCommunityIcons name="delete-outline" size={20} color="#D92D20" /></Pressable></View>
        <Text style={s.comment}>{item.comment}</Text><View style={s.sourcePill}><MaterialCommunityIcons name="account-edit-outline" size={12} color="#6941C6" /><Text style={s.sourceText}>Supplier-provided testimonial</Text></View>
      </View>)}
      {!items.length && <View style={s.empty}><MaterialCommunityIcons name="comment-quote-outline" size={34} color="#A99BCB" /><Text style={s.emptyTitle}>No testimonials added yet</Text><Text style={s.muted}>Add customer feedback that you have permission to share.</Text></View>}
      <Text style={s.disclaimer}>Supplier-provided testimonials are displayed separately and do not affect verified buyer ratings.</Text>
    </ScrollView>}
    <AppBottomNav role="SUPPLIER" activeSection="profile" onNavigate={section => { if (section === 'home') router.replace('/workspace?role=SUPPLIER' as any); else router.push({ pathname: '/supplier/[section]', params: { section: section === 'profile' ? 'business-profile' : section } } as any); }} />
    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
      <View style={s.backdrop}><View style={s.sheet}><View style={s.modalHead}><Text style={s.modalTitle}>{editingId ? 'Edit Review' : 'Add Review'}</Text><Pressable onPress={() => setModal(false)}><MaterialCommunityIcons name="close" size={22} color="#667085" /></Pressable></View>
        <ScrollView style={s.formScroll} contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
          <Text style={s.label}>CUSTOMER NAME *</Text><TextInput value={customerName} onChangeText={setCustomerName} placeholder="Enter customer name" style={s.input} maxLength={150} />
          <Text style={s.label}>RATING *</Text><View style={s.ratingPicker}>{[1,2,3,4,5].map(value => <Pressable key={value} onPress={() => setRating(value)} hitSlop={5}><MaterialCommunityIcons name={value <= rating ? 'star' : 'star-outline'} size={34} color={value <= rating ? '#E5A000' : '#C9CDD5'} /></Pressable>)}</View>
          <Text style={s.label}>REVIEW / TESTIMONIAL *</Text><TextInput value={comment} onChangeText={setComment} placeholder="Write the customer's feedback…" style={[s.input, s.multiline]} multiline textAlignVertical="top" maxLength={2000} />
          <Text style={s.charCount}>{comment.length}/2000</Text>
        </ScrollView>
        <View style={s.modalFooter}>
          <Pressable style={s.cancelButton} onPress={() => { setModal(false); resetForm(); }} disabled={busy}><Text style={s.cancelText}>Cancel</Text></Pressable>
          <Pressable style={[s.saveButton, busy && { opacity: .6 }]} onPress={() => void save()} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>{editingId ? 'Save Changes' : 'Save Review'}</Text>}</Pressable>
        </View>
      </View></View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, content: { padding: 14, paddingBottom: 24, gap: 12, width: '100%', maxWidth: 840, alignSelf: 'center' },
  hero: { backgroundColor: '#F1EAFE', borderRadius: 13, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E5D9FF', alignItems: 'center', justifyContent: 'center' }, heroTitle: { color: '#21113E', fontSize: 14, fontWeight: '900' }, heroText: { color: '#566174', fontSize: 10, lineHeight: 15, marginTop: 3 },
  summary: { backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#E7E7EF', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, averageBox: { width: '42%', alignItems: 'center', gap: 5, borderRightWidth: 1, borderRightColor: '#E7E7EF', paddingRight: 8 }, average: { color: '#182230', fontSize: 23, fontWeight: '900' }, stars: { color: '#E5A000', fontSize: 18, letterSpacing: 1 }, muted: { color: '#87909F', fontSize: 10, textAlign: 'center' },
  bars: { flex: 1, gap: 8 }, barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 }, barLabel: { width: 30, color: '#536074', fontSize: 9, fontWeight: '700' }, track: { flex: 1, height: 7, backgroundColor: '#E9EBF0', borderRadius: 8, overflow: 'hidden' }, fill: { height: 7, backgroundColor: '#6424D6', borderRadius: 8 }, barPercent: { width: 27, color: '#758093', fontSize: 9, textAlign: 'right' },
  addButton: { height: 48, borderRadius: 11, backgroundColor: purple, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, addText: { color: '#fff', fontSize: 14, fontWeight: '900' }, listHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }, listTitle: { color: '#202B3C', fontSize: 15, fontWeight: '900' }, demoLabel: { color: '#6941C6', fontSize: 8, fontWeight: '900', letterSpacing: .4 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E7EF', borderRadius: 13, padding: 12, gap: 9 }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: 7 }, avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1EAFE', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: purple, fontSize: 12, fontWeight: '900' }, customer: { color: '#202B3C', fontSize: 12, fontWeight: '900' }, date: { color: '#87909F', fontSize: 9, marginTop: 2 }, ratingValue: { color: '#202B3C', fontSize: 11, fontWeight: '900' }, cardStars: { color: '#E5A000', fontSize: 11 }, comment: { color: '#465266', fontSize: 11, lineHeight: 17 }, sourcePill: { alignSelf: 'flex-start', backgroundColor: '#F1EAFE', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }, sourceText: { color: '#6941C6', fontSize: 8, fontWeight: '800' },
  empty: { backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#E7E7EF', padding: 28, alignItems: 'center', gap: 8 }, emptyTitle: { color: '#202B3C', fontSize: 13, fontWeight: '900' }, disclaimer: { color: '#87909F', fontSize: 9, lineHeight: 14, textAlign: 'center', paddingHorizontal: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,.48)', justifyContent: 'flex-end' }, sheet: { height: '82%', maxHeight: '90%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 17 }, modalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, modalTitle: { color: '#202B3C', fontSize: 17, fontWeight: '900' }, formScroll: { flex: 1 }, formContent: { paddingBottom: 12 }, modalFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF0F4', backgroundColor: '#fff' }, cancelButton: { flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: '#D0D5DD', alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#475467', fontSize: 13, fontWeight: '800' }, label: { color: '#667085', fontSize: 9, fontWeight: '900', marginTop: 12, marginBottom: 6 }, input: { borderWidth: 1, borderColor: '#D9DDE5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: '#202B3C', fontSize: 12 }, multiline: { minHeight: 110 }, ratingPicker: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 5 }, charCount: { color: '#87909F', fontSize: 9, textAlign: 'right', marginTop: 4 }, saveButton: { flex: 1, height: 46, borderRadius: 10, backgroundColor: purple, alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
