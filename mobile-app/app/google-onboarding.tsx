import { ui } from '@/theme/ui';
import { STITCHGRID_LOGO } from '@/theme/assets';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { completeGoogleOnboarding } from '@/services/auth';

const PURPLE = ui.accent;

const CATEGORIES = [
  'T-Shirts', 'Shirts', 'Hoodies', 'Activewear', 'Polo Shirts', 'Denim & Jeans',
  'Trousers', 'Dresses', 'Kids Wear', 'Knitwear', 'Woven Fabric',
];

export default function GoogleOnboardingScreen() {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState('');
  const [accountType, setAccountType] = useState<'BUYER' | 'SUPPLIER'>('BUYER');
  const [city, setCity] = useState('');
  const [taxId, setTaxId] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    SecureStore.getItemAsync('sg_token')
      .then((token) => {
        if (!token) router.replace('/');
      })
      .catch(() => router.replace('/'));
  }, [router]);

  const toggleCategory = (category: string) => {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const handleContinue = async () => {
    const cleanName = organizationName.trim();
    if (cleanName.length < 2) {
      setError('Please enter your organization name.');
      return;
    }
    if (accountType === 'SUPPLIER' && categories.length === 0) {
      setError('Please select at least one manufacturing category.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const result = await completeGoogleOnboarding({
        organizationName: cleanName,
        accountType,
        city: city.trim() || undefined,
        taxId: taxId.trim() || undefined,
        description: description.trim() || undefined,
        categories: accountType === 'SUPPLIER' ? categories : undefined,
        businessType: accountType === 'SUPPLIER' ? 'Garments & Textiles' : 'Brand / Buyer',
      });
      if (result.activeMembership.role === 'BUYER') {
        router.replace('/workspace?role=BUYER');
      } else {
        router.replace('/workspace?role=SUPPLIER');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to complete your organization setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Image
            source={STITCHGRID_LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="STITCHGRID - The Garment Manufacturing Network"
          />
          <Text style={styles.brandSubtitle}>Complete your business profile to get started.</Text>
          <Text style={styles.title}>Set up your organization</Text>
          <Text style={styles.subtitle}>
            Choose how you will use STITCHGRID. You can continue once your organization details are saved.
          </Text>

          {!!error && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#BE123C" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>ACCOUNT TYPE *</Text>
          <View style={styles.choiceRow}>
            <Pressable
              style={[styles.choice, accountType === 'BUYER' && styles.choiceActive]}
              onPress={() => setAccountType('BUYER')}
            >
              <Text style={[styles.choiceTitle, accountType === 'BUYER' && styles.choiceTitleActive]}>
                Buyer / Brand
              </Text>
              <Text style={[styles.choiceDescription, accountType === 'BUYER' && styles.choiceDescriptionActive]}>
                Source garments from manufacturers
              </Text>
            </Pressable>
            <Pressable
              style={[styles.choice, accountType === 'SUPPLIER' && styles.choiceActive]}
              onPress={() => setAccountType('SUPPLIER')}
            >
              <Text style={[styles.choiceTitle, accountType === 'SUPPLIER' && styles.choiceTitleActive]}>
                Supplier / Manufacturer
              </Text>
              <Text style={[styles.choiceDescription, accountType === 'SUPPLIER' && styles.choiceDescriptionActive]}>
                Receive requests and fulfil orders
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>ORGANIZATION NAME *</Text>
          <TextInput
            value={organizationName}
            onChangeText={setOrganizationName}
            placeholder="Your company or brand name"
            placeholderTextColor={ui.muted}
            autoCapitalize="words"
            maxLength={150}
            returnKeyType="next"
            style={styles.input}
          />

          <Text style={styles.label}>CITY</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Noida"
            placeholderTextColor={ui.muted}
            maxLength={100}
            style={styles.input}
          />

          {accountType === 'SUPPLIER' && (
            <>
              <Text style={styles.label}>GST / TAX ID (OPTIONAL)</Text>
              <TextInput
                value={taxId}
                onChangeText={setTaxId}
                placeholder="GSTIN"
                placeholderTextColor={ui.muted}
                maxLength={30}
                autoCapitalize="characters"
                style={styles.input}
              />

              <Text style={styles.label}>MANUFACTURING CATEGORIES *</Text>
              <View style={styles.categoryWrap}>
                {CATEGORIES.map((category) => {
                  const selected = categories.includes(category);
                  return (
                    <Pressable
                      key={category}
                      onPress={() => toggleCategory(category)}
                      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                    >
                      <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>BUSINESS DESCRIPTION (OPTIONAL)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Tell buyers about your manufacturing capabilities"
                placeholderTextColor={ui.muted}
                multiline
                maxLength={2000}
                numberOfLines={4}
                textAlignVertical="top"
                style={[styles.input, styles.descriptionInput]}
              />
            </>
          )}

          <Pressable
            style={[styles.continueButton, loading && styles.disabled]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueText}>Complete Setup & Continue</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.surface },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: ui.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEE5F6',
    padding: 22,
    shadowColor: '#6D28D9',
    shadowOpacity: 0,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 0,
  },
  logo: { width: 220, height: 50, alignSelf: 'center' },
  brandSubtitle: { color: ui.muted, fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 5, marginBottom: 24 },
  title: { color: ui.ink, fontSize: 25, lineHeight: 32, fontWeight: '700' },
  subtitle: { color: ui.muted, fontSize: 13, lineHeight: 20, marginTop: 7, marginBottom: 20 },
  label: { color: '#334155', fontSize: 12, fontWeight: '700', letterSpacing: 0.35, marginTop: 16, marginBottom: 8 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, minHeight: 94, borderWidth: 1, borderColor: ui.border, borderRadius: 12, padding: 12, justifyContent: 'center' },
  choiceActive: { borderColor: PURPLE, backgroundColor: ui.accentSoft, borderWidth: 1.5 },
  choiceTitle: { color: ui.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  choiceTitleActive: { color: '#5B159A' },
  choiceDescription: { color: ui.muted, fontSize: 12, lineHeight: 16, marginTop: 5 },
  choiceDescriptionActive: { color: '#6B3A91' },
  input: { minHeight: 49, borderWidth: 1, borderColor: ui.border, borderRadius: 12, paddingHorizontal: 13, color: ui.ink, fontSize: 14, backgroundColor: ui.surface },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { borderWidth: 1, borderColor: ui.border, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8 },
  categoryChipSelected: { borderColor: PURPLE, backgroundColor: '#F1E7FC' },
  categoryText: { color: '#475569', fontSize: 12, fontWeight: '600' },
  categoryTextSelected: { color: '#5B159A' },
  descriptionInput: { minHeight: 92, paddingTop: 12 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', borderRadius: 12, padding: 11, marginBottom: 8 },
  errorText: { flex: 1, color: '#BE123C', fontSize: 13, lineHeight: 17 },
  continueButton: { minHeight: 52, borderRadius: 12, backgroundColor: PURPLE, marginTop: 24, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  continueText: { color: ui.surface, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  disabled: { opacity: 0.7 },
});
