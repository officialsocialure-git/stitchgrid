import { ui } from '@/theme/ui';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { apiGet, apiPost, apiRequest, API_BASE_URL } from '@/services/api';
import { AppHeader } from '@/components/AppHeader';
import { AppBottomNav } from '@/components/AppBottomNav';
import { useRouter } from 'expo-router';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

type CapabilityTag = { id: string; capabilityGroup: string; value: string };
type CategoryImage = { category: string; imageUrl: string };
type WorkforceResource = { resource: string; availability: 'IN_HOUSE' | 'OUTSOURCED' | 'NOT_AVAILABLE'; headcount: number | null };
type UploadedFile = { url: string; filename: string };
const absoluteMediaUrl = (url: string) => /^https?:\/\//i.test(url) ? url : `${API_BASE_URL.replace(/\/api\/?$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
type ProfileResponse = {
  supplierProfile?: {
    yearsInBusiness?: number | null;
    productionCapacity?: number | null;
    minimumOrderQuantity?: number | null;
    sampleDevelopment?: boolean;
    categories?: { category: string; imageUrl?: string | null }[];
    capabilities?: CapabilityTag[];
    workforceResources?: WorkforceResource[];
  } | null;
};
const PRODUCT_CATEGORIES = ['T-Shirts', 'Hoodies & Sweatshirts', 'Shirts', 'Jackets', 'Bottom Wear', 'Activewear', 'Kids Wear', 'Workwear', 'Others'];
const FABRICS = ['Cotton', 'Polyester', 'Denim', 'Linen', 'Blends', 'Others'];
const SERVICES = ['Fabric Sourcing', 'Pattern Making', 'Sampling', 'Cutting', 'Stitching', 'Printing', 'Embroidery', 'Quality Control (QC)'];
const WORKFORCE_ROLES = ['Cutting Masters', 'Pattern Masters', 'Sampling Team', 'Stitching Operators', 'Embroidery Team', 'Printing Team', 'Quality Inspectors', 'Production Supervisors'];
const WORKFORCE_STATUSES: { value: WorkforceResource['availability']; label: string }[] = [
  { value: 'IN_HOUSE', label: 'In-house' },
  { value: 'OUTSOURCED', label: 'Outsourced' },
  { value: 'NOT_AVAILABLE', label: 'Not available' },
];

export default function SupplierManufacturingCapabilitiesScreen() {
  const router = useRouter();
  const keyboardVisible = useKeyboardVisible();
  const [organizationId, setOrganizationId] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryImages, setCategoryImages] = useState<Record<string, string>>({});
  const [uploadingCategory, setUploadingCategory] = useState('');
  const [imagePromptCategory, setImagePromptCategory] = useState<string | null>(null);
  const [capacity, setCapacity] = useState('');
  const [moq, setMoq] = useState('');
  const [years, setYears] = useState('');
  const [sampleDevelopment, setSampleDevelopment] = useState(false);
  const [fabrics, setFabrics] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceResource[]>([]);
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
      setCategoryImages(Object.fromEntries((profile?.categories || []).filter(item => item.imageUrl).map(item => [item.category, item.imageUrl as string])));
      setCapacity(profile?.productionCapacity == null ? '' : String(profile.productionCapacity));
      setMoq(profile?.minimumOrderQuantity == null ? '' : String(profile.minimumOrderQuantity));
      setYears(profile?.yearsInBusiness == null ? '' : String(profile.yearsInBusiness));
      setSampleDevelopment(Boolean(profile?.sampleDevelopment));
      const tags = profile?.capabilities || [];
      setFabrics(tags.filter(tag => tag.capabilityGroup === 'FABRIC').map(tag => tag.value));
      setServices(tags.filter(tag => tag.capabilityGroup === 'SERVICE').map(tag => tag.value));
      const savedWorkforce = profile?.workforceResources || [];
      setWorkforce(WORKFORCE_ROLES.map(resource => {
        const saved = savedWorkforce.find(item => item.resource === resource);
        return saved ? { resource, availability: saved.availability, headcount: saved.headcount ?? null } : { resource, availability: 'NOT_AVAILABLE' as const, headcount: null };
      }));
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

  const pickCategoryImage = async (category: string) => {
    if (uploadingCategory) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission required', 'Allow photo library access to upload category images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.82, base64: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) return Alert.alert('Image unavailable', 'Please select another photo.');
    const extension = asset.mimeType?.includes('png') ? 'png' : asset.mimeType?.includes('webp') ? 'webp' : 'jpg';
    const mime = asset.mimeType || (extension === 'png' ? 'image/png' : 'image/jpeg');
    setUploadingCategory(category);
    try {
      const uploaded = await apiPost<UploadedFile>('/upload', {
        filename: asset.fileName || `capability-${Date.now()}.${extension}`,
        data: `data:${mime};base64,${asset.base64}`,
        label: `CAPABILITY_${category.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
      });
      const savedImageUrl = uploaded.url.startsWith('/') ? absoluteMediaUrl(uploaded.url) : uploaded.url;
      const nextImages = { ...categoryImages, [category]: savedImageUrl };
      setCategoryImages(nextImages);
      // Persist the category-image mapping immediately so it survives leaving the
      // screen; the main Save Changes button still saves the other capability fields.
      try {
        await apiRequest('/organization-profile', {
          method: 'PUT',
          body: {
            organizationId,
            categories,
            categoryImages: categories.filter(item => nextImages[item]).map(item => ({ category: item, imageUrl: nextImages[item] })),
          },
        });
      } catch (saveError) {
        Alert.alert('Image uploaded, not saved yet', saveError instanceof Error ? `${saveError.message}\nPlease tap Save Changes to retry.` : 'Please tap Save Changes to save this image.');
      }
      setImagePromptCategory(null);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setUploadingCategory('');
    }
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
          categoryImages: categories.filter(category => categoryImages[category]).map(category => ({ category, imageUrl: categoryImages[category] })),
          productionCapacity: Number(capacity),
          minimumOrderQuantity: Number(moq),
          yearsInBusiness: Number(years),
          sampleDevelopment,
          fabricExpertise: fabrics,
          additionalCapabilities: services,
          workforceResources: workforce,
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
          <Pressable key={option} onPress={() => {
            if (!compact && options === PRODUCT_CATEGORIES) {
              if (active) {
                setCategories(current => current.filter(item => item !== option));
                setCategoryImages(current => { const next = { ...current }; delete next[option]; return next; });
                if (imagePromptCategory === option) setImagePromptCategory(null);
              } else {
                setCategories(current => [...current, option]);
                setImagePromptCategory(option);
              }
            } else toggle(option, selected, setter);
          }} style={[compact ? s.compactChoice : s.categoryChoice, active && s.choiceActive, !compact && index === options.length - 1 && s.lastChoice]}>
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
              {!!categories.length && <View style={s.categoryImageSection}>
                <Text style={s.imageSectionTitle}>Category Images</Text>
                <Text style={s.imageSectionHint}>Upload a representative photo for each category. Buyers will see these images on your public profile.</Text>
                <View style={s.categoryImageGrid}>
                  {categories.map(category => <View key={category} style={s.categoryImageCard}>
                    {categoryImages[category] ? <Image source={{ uri: absoluteMediaUrl(categoryImages[category]) }} style={s.categoryImagePreview} resizeMode="cover" /> : <View style={s.categoryImagePlaceholder}><MaterialCommunityIcons name="image-plus" size={25} color={ui.accent} /></View>}
                    <Text numberOfLines={1} style={s.categoryImageName}>{category}</Text>
                    <Pressable onPress={() => setImagePromptCategory(category)} disabled={!!uploadingCategory} style={s.categoryImageButton}>
                      {uploadingCategory === category ? <ActivityIndicator size="small" color={ui.accent} /> : <><MaterialCommunityIcons name="camera-plus-outline" size={14} color={ui.accent} /><Text style={s.categoryImageButtonText}>{categoryImages[category] ? 'Change Image' : 'Upload Image'}</Text></>}
                    </Pressable>
                  </View>)}
                </View>
              </View>}
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
            <View style={s.card}>
              <View style={s.sectionHead}><MaterialCommunityIcons name="account-hard-hat-outline" size={24} color={ui.accent} /><View style={s.sectionCopy}><Text style={s.sectionTitle}>Manufacturing Resources & Workforce</Text><Text style={s.sectionHint}>Tell buyers which skilled teams are available in your factory or through partners.</Text></View></View>
              {WORKFORCE_ROLES.map(role => {
                const current = workforce.find(item => item.resource === role) || { resource: role, availability: 'NOT_AVAILABLE' as const, headcount: null };
                return <View key={role} style={s.workforceRow}>
                  <View style={s.workforceTop}><Text style={s.workforceRole}>{role}</Text><Text style={s.workforceStatus}>{WORKFORCE_STATUSES.find(status => status.value === current.availability)?.label}</Text></View>
                  <View style={s.workforceOptions}>{WORKFORCE_STATUSES.map(status => <Pressable key={status.value} onPress={() => setWorkforce(items => [...items.filter(item => item.resource !== role), { ...current, availability: status.value, headcount: status.value === 'NOT_AVAILABLE' ? null : current.headcount }])} style={[s.workforceOption, current.availability === status.value && s.workforceOptionActive]}><Text style={[s.workforceOptionText, current.availability === status.value && s.workforceOptionTextActive]}>{status.label}</Text></Pressable>)}</View>
                  {current.availability !== 'NOT_AVAILABLE' && <View style={s.workforceCount}><Text style={s.workforceCountLabel}>Team size (optional)</Text><TextInput value={current.headcount == null ? '' : String(current.headcount)} onChangeText={value => setWorkforce(items => [...items.filter(item => item.resource !== role), { ...current, headcount: value.trim() && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null }])} keyboardType="number-pad" placeholder="e.g. 5" style={s.workforceCountInput} /></View>}
                </View>;
              })}
            </View>
            <Pressable disabled={saving} onPress={() => void save()} style={[s.saveButton, saving && s.disabled]}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <><MaterialCommunityIcons name="content-save-outline" size={22} color="#FFFFFF" /><Text style={s.saveText}>Save Changes</Text></>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      <Modal visible={!!imagePromptCategory} transparent animationType="fade" onRequestClose={() => setImagePromptCategory(null)}>
        <View style={s.modalBackdrop}>
          <View style={s.imagePromptCard}>
            <View style={s.promptIcon}><MaterialCommunityIcons name="image-plus" size={28} color={ui.accent} /></View>
            <Text style={s.promptTitle}>{imagePromptCategory && categoryImages[imagePromptCategory] ? 'Change Category Image' : 'Add Category Image'}</Text>
            <Text style={s.promptMessage}>Upload a representative photo for {imagePromptCategory || 'this category'}. Buyers will see it on your supplier profile.</Text>
            {imagePromptCategory && categoryImages[imagePromptCategory] ? <Image source={{ uri: absoluteMediaUrl(categoryImages[imagePromptCategory]) }} style={s.promptPreview} resizeMode="cover" /> : null}
            <Pressable style={s.promptPrimary} disabled={!!uploadingCategory} onPress={() => imagePromptCategory && void pickCategoryImage(imagePromptCategory)}>
              {uploadingCategory === imagePromptCategory ? <ActivityIndicator color="#fff" /> : <><MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#fff" /><Text style={s.promptPrimaryText}>{imagePromptCategory && categoryImages[imagePromptCategory] ? 'Choose New Image' : 'Upload Image'}</Text></>}
            </Pressable>
            <Pressable style={s.promptSecondary} onPress={() => setImagePromptCategory(null)} disabled={!!uploadingCategory}><Text style={s.promptSecondaryText}>{imagePromptCategory && categoryImages[imagePromptCategory] ? 'Keep Current Image' : 'Skip for Now'}</Text></Pressable>
          </View>
        </View>
      </Modal>
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
  categoryImageSection: { gap: 8, marginTop: 4 },
  imageSectionTitle: { color: '#30394A', fontSize: 12, fontWeight: '900' },
  imageSectionHint: { color: '#7B8493', fontSize: 10, lineHeight: 15 },
  categoryImageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  categoryImageCard: { width: '31.5%', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E6E8EF', borderRadius: 11, padding: 6, gap: 5 },
  categoryImagePreview: { width: '100%', aspectRatio: 1.15, borderRadius: 7, backgroundColor: '#F2F3F7' },
  categoryImagePlaceholder: { width: '100%', aspectRatio: 1.15, borderRadius: 7, backgroundColor: '#F5F1FF', alignItems: 'center', justifyContent: 'center' },
  categoryImageName: { color: '#30394A', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  categoryImageButton: { minHeight: 29, borderRadius: 7, backgroundColor: '#F4EEFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 3 },
  categoryImageButtonText: { color: ui.accent, fontSize: 9, fontWeight: '800' },
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
  workforceRow: { borderTopWidth: 1, borderTopColor: '#EEF0F5', paddingTop: 11, gap: 8 },
  workforceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  workforceRole: { color: '#263044', fontSize: 12, fontWeight: '800', flex: 1 },
  workforceStatus: { color: '#667085', fontSize: 10, fontWeight: '700' },
  workforceOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  workforceOption: { borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: '#FFFFFF' },
  workforceOptionActive: { borderColor: ui.accent, backgroundColor: '#F4EEFF' },
  workforceOptionText: { color: '#667085', fontSize: 10, fontWeight: '700' },
  workforceOptionTextActive: { color: ui.accent },
  workforceCount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  workforceCountLabel: { color: '#667085', fontSize: 10 },
  workforceCountInput: { minWidth: 75, borderWidth: 1, borderColor: '#DDE2EB', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, color: '#263044', textAlign: 'center', fontSize: 12 },
  saveButton: { minHeight: 52, borderRadius: 13, backgroundColor: ui.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(16,24,40,0.52)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  imagePromptCard: { width: '100%', maxWidth: 380, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, alignItems: 'center', gap: 11 },
  promptIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#F3EDFF', alignItems: 'center', justifyContent: 'center' },
  promptTitle: { color: '#202B3C', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  promptMessage: { color: '#667085', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  promptPreview: { width: 150, height: 105, borderRadius: 11, backgroundColor: '#F2F3F7' },
  promptPrimary: { width: '100%', minHeight: 46, borderRadius: 11, backgroundColor: ui.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 3 },
  promptPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  promptSecondary: { width: '100%', minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  promptSecondaryText: { color: '#667085', fontSize: 12, fontWeight: '800' },
});
