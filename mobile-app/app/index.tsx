import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getRememberedIdentifier,
  getRememberMePreference,
  login,
  requestPasswordReset,
  saveRememberedIdentifier,
  saveRememberMePreference,
} from '@/services/auth';

const PURPLE = '#8124CF';
const DEEP_PURPLE = '#6816B8';
const LOGO_URI = 'https://stitchgrid-three.vercel.app/stitchgrid-logo-transparent.png';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 760;
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    Promise.all([getRememberedIdentifier(), getRememberMePreference()])
      .then(([savedIdentifier, savedRememberMe]) => {
        if (savedIdentifier) setIdentifier(savedIdentifier);
        setRememberMe(savedRememberMe);
      })
      .catch(() => undefined);
  }, []);

  const handleLogin = async () => {
    setError('');
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setError('Please enter your registered email address or mobile number.');
      return;
    }
    if (!password) {
      setError('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      await Promise.all([
        saveRememberedIdentifier(rememberMe ? cleanIdentifier : null),
        saveRememberMePreference(rememberMe),
      ]);
      const result = await login(cleanIdentifier, password);
      const admin = result.memberships?.find((item) => item.role === 'ADMIN');
      const membership = admin || result.activeMembership;
      if (membership?.role === 'BUYER') router.replace('/workspace?role=BUYER');
      else if (membership?.role === 'SUPPLIER') router.replace('/workspace?role=SUPPLIER');
      else if (membership?.role === 'ADMIN') router.replace('/workspace?role=ADMIN');
      else router.replace('/workspace?role=UNKNOWN');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('Google Login testing will be enabled in the development build. For now, please use email and password to test the app in Expo Go.');
  };

  const handleForgotPassword = async () => {
    const value = forgotIdentifier.trim();
    if (!value) {
      Alert.alert('Required', 'Please enter your registered email or mobile number.');
      return;
    }
    setForgotLoading(true);
    try {
      const result = await requestPasswordReset(value);
      Alert.alert('Password reset', result.message || 'If an active account exists, password reset instructions have been generated.');
      setForgotOpen(false);
    } catch (e) {
      Alert.alert('Unable to reset password', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + (compact ? 4 : 10), 12),
              paddingBottom: Math.max(insets.bottom + 8, 12),
              minHeight: Math.max(height - insets.top - insets.bottom, 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoFrame}>
              <Image
                source={{ uri: LOGO_URI }}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="STITCHGRID - The Garment Manufacturing Network"
              />
            </View>
            <Text style={styles.tagline}>The operating network for garment manufacturing</Text>
          </View>
          <View style={[styles.card, { width: Math.min(width - 44, 650), padding: compact ? 23 : 28 }]}>
            <View style={styles.welcomeBlock}>
              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>Sign in to your STITCHGRID account</Text>
            </View>

            {!!error && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={19} color="#BE123C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>REGISTERED EMAIL OR MOBILE NUMBER</Text>
              <View style={[styles.inputShell, styles.identifierShell]}>
                <MaterialCommunityIcons name="account-outline" size={25} color={PURPLE} />
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="name@company.com or mobile number"
                  placeholderTextColor="#A1A1AA"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>ACCOUNT PASSWORD</Text>
              <View style={styles.inputShell}>
                <MaterialCommunityIcons name="lock-outline" size={25} color={PURPLE} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••"
                  placeholderTextColor="#A1A1AA"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={12}>
                  <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={25} color="#626B75" />
                </Pressable>
              </View>
            </View>

            <View style={styles.optionsRow}>
              <Pressable style={styles.rememberRow} onPress={() => setRememberMe((value) => !value)}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <MaterialCommunityIcons name="check" size={17} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable onPress={() => { setForgotIdentifier(identifier); setForgotOpen(true); }}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.signInButton, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Text style={styles.signInText}>Sign In</Text>
                  <MaterialCommunityIcons name="arrow-right" size={28} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            <Pressable
              style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              accessibilityRole="button"
              accessibilityLabel="Login with Google"
            >
              {googleLoading ? (
                <ActivityIndicator color="#4285F4" />
              ) : (
                <>
                  <FontAwesome name="google" size={22} color="#4285F4" />
                  <Text style={styles.googleText}>Login with Google</Text>
                </>
              )}
            </Pressable>

            <View style={styles.footer}>
              <Text style={styles.footerMuted}>New to STITCHGRID?</Text>
              <Pressable style={styles.registerLink} onPress={() => router.push('/register')}>
                <Text style={styles.registerText}>Register Organization</Text>
                <MaterialCommunityIcons name="arrow-right" size={23} color={PURPLE} />
              </Pressable>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {forgotOpen && (
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTitleRow}>
              <MaterialCommunityIcons name="lock-reset" size={23} color={PURPLE} />
              <Text style={styles.modalTitle}>Reset Account Password</Text>
              <Pressable onPress={() => setForgotOpen(false)} style={styles.modalClose}>
                <MaterialCommunityIcons name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>
            <Text style={styles.modalDescription}>Enter your registered email address or mobile number.</Text>
            <TextInput
              value={forgotIdentifier}
              onChangeText={setForgotIdentifier}
              placeholder="Email or mobile number"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              style={styles.modalInput}
            />
            <Pressable style={styles.signInButton} onPress={handleForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.signInText}>Continue</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboard: { flex: 1 },
  scrollContent: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 0, gap: 0 },
  brand: { width: '100%', maxWidth: 650, alignItems: 'center', marginBottom: 28 },
  logoFrame: { width: '100%', height: 92, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: '88%', height: 92 },
  tagline: { color: '#535D73', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 13, fontWeight: '500' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 34,
    borderWidth: 1,
    borderColor: '#F2E9FA',
    shadowColor: '#6D28D9',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  welcomeBlock: { alignItems: 'center', marginBottom: 25 },
  welcomeTitle: { color: '#17172D', fontSize: 29, lineHeight: 36, fontWeight: '800' },
  welcomeSubtitle: { color: '#515B73', fontSize: 15, marginTop: 5, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', marginBottom: 16 },
  errorText: { flex: 1, color: '#9F1239', fontSize: 12, lineHeight: 17 },
  fieldGroup: { marginBottom: 20 },
  label: { color: '#17172D', fontSize: 13, letterSpacing: 0.1, fontWeight: '700', marginBottom: 9, textTransform: 'capitalize' },
  inputShell: { height: 58, borderRadius: 16, borderWidth: 1.5, borderColor: '#E1D8EA', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF' },
  identifierShell: { borderWidth: 2, borderColor: '#8B35D1' },
  input: { flex: 1, color: '#20212A', fontSize: 15, paddingVertical: 0 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -2, marginBottom: 14 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  checkbox: { width: 21, height: 21, borderRadius: 3, borderWidth: 1.5, borderColor: '#B6B6BE', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#8A2BD0', borderColor: '#8A2BD0' },
  rememberText: { color: '#343B50', fontSize: 14 },
  forgotText: { color: '#7119C7', fontSize: 14, fontWeight: '800' },
  signInButton: { minHeight: 58, borderRadius: 17, backgroundColor: '#8124CF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#7E22CE', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  buttonDisabled: { opacity: 0.7 },
  signInText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 0, marginVertical: 20 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  orText: { overflow: 'hidden', color: '#777B84', fontWeight: '700', letterSpacing: 2, backgroundColor: '#F4F4F5', borderRadius: 20, paddingHorizontal: 17, paddingVertical: 8, marginHorizontal: -1 },
  googleButton: { height: 56, borderWidth: 1.5, borderColor: '#E4E0E9', borderRadius: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, backgroundColor: '#FFFFFF' },
  googleText: { color: '#252630', fontSize: 15, fontWeight: '600' },
  footer: { marginTop: 22, paddingTop: 17, borderTopWidth: 1, borderTopColor: '#F0F0F2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footerMuted: { color: '#777E89', fontSize: 13 },
  registerLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  registerText: { color: '#7132A7', fontSize: 13, fontWeight: '700' },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0E6FB', borderColor: '#E7D5F8', borderWidth: 1, borderRadius: 28, paddingVertical: 8, paddingHorizontal: 18 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7921C5', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  stepText: { color: '#54217E', fontSize: 14, fontWeight: '700' },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: 'rgba(15, 10, 25, 0.48)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 22, padding: 22, gap: 15 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#252330' },
  modalClose: { padding: 3 },
  modalDescription: { color: '#646B76', fontSize: 13, lineHeight: 19 },
  modalInput: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#DDD6E5', paddingHorizontal: 13, color: '#24212A' },
});