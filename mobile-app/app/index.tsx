import { ui } from '@/theme/ui';
import { STITCHGRID_LOGO } from '@/theme/assets';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Image,
  Modal,
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

const PURPLE = ui.accent;
const DEEP_PURPLE = ui.accentPressed;


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
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          bounces={false}
          alwaysBounceVertical={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <View style={styles.logoFrame}>
              <Image
                source={STITCHGRID_LOGO}
                style={styles.logoImage}
                resizeMode="contain"
                accessibilityLabel="STITCHGRID - The Garment Manufacturing Network"
              />
            </View>
            <Text style={styles.tagline}>The operating network for garment manufacturing</Text>
          </View>
          <View style={[styles.card, { width: Math.min(width - 32, 460), padding: compact ? 18 : 22 }]}>
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
                <MaterialCommunityIcons name="account-outline" size={22} color={PURPLE} />
                <TextInput
                  accessibilityLabel="Registered email or mobile number"
                  autoComplete="username"
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="name@company.com or mobile number"
                  placeholderTextColor={ui.muted}
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
                <MaterialCommunityIcons name="lock-outline" size={22} color={PURPLE} />
                <TextInput
                  accessibilityLabel="Account password"
                  autoComplete="current-password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••"
                  placeholderTextColor={ui.muted}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.iconAction} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                  <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={25} color="#626B75" />
                </Pressable>
              </View>
            </View>

            <View style={styles.optionsRow}>
              <Pressable style={styles.rememberRow} onPress={() => setRememberMe((value) => !value)} accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }}>
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <MaterialCommunityIcons name="check" size={17} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable style={styles.forgotAction} onPress={() => { setForgotIdentifier(identifier); setForgotOpen(true); }}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            </View>

            <Pressable style={[styles.signInButton, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading} accessibilityRole="button">
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
              <Pressable style={styles.registerLink} onPress={() => router.push('/register')} accessibilityRole="link">
                <Text style={styles.registerText}>Register Organization</Text>
                <MaterialCommunityIcons name="arrow-right" size={23} color={PURPLE} />
              </Pressable>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={forgotOpen} transparent animationType="fade" onRequestClose={() => setForgotOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.modalCard}>
              <View style={styles.modalTitleRow}>
                <MaterialCommunityIcons name="lock-reset" size={23} color={PURPLE} />
                <Text style={styles.modalTitle}>Reset Account Password</Text>
                <Pressable onPress={() => setForgotOpen(false)} style={styles.modalClose} accessibilityRole="button" accessibilityLabel="Close password reset">
                  <MaterialCommunityIcons name="close" size={22} color="#6B7280" />
                </Pressable>
              </View>
              <Text style={styles.modalDescription}>Enter your registered email address or mobile number.</Text>
              <TextInput
                accessibilityLabel="Password reset email or mobile number"
                value={forgotIdentifier}
                onChangeText={setForgotIdentifier}
                placeholder="Email or mobile number"
                placeholderTextColor={ui.muted}
                autoCapitalize="none"
                style={styles.modalInput}
              />
              <Pressable style={styles.signInButton} onPress={handleForgotPassword} disabled={forgotLoading} accessibilityRole="button">
                {forgotLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.signInText}>Continue</Text>}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.canvas },
  keyboard: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  brand: { width: '100%', maxWidth: 460, alignItems: 'center', marginBottom: 12 },
  logoFrame: { width: '100%', height: 60, alignItems: 'center', justifyContent: 'center' },
  logoImage: { width: '86%', height: 60 },
  tagline: { color: ui.body, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  card: {
    backgroundColor: ui.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  welcomeBlock: { alignItems: 'center', marginBottom: 14 },
  welcomeTitle: { color: ui.ink, fontSize: 25, lineHeight: 31, fontWeight: '700' },
  welcomeSubtitle: { color: ui.body, fontSize: 14, lineHeight: 20, marginTop: 3, textAlign: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, backgroundColor: '#FFF1F2', borderWidth: 1, borderColor: '#FECDD3', marginBottom: 16 },
  errorText: { flex: 1, color: '#9F1239', fontSize: 13, lineHeight: 17 },
  fieldGroup: { marginBottom: 12 },
  label: { color: ui.ink, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputShell: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: ui.border, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: ui.surface },
  identifierShell: { borderWidth: 1, borderColor: ui.border },
  input: { flex: 1, minWidth: 0, minHeight: 48, color: ui.ink, fontSize: 16, paddingVertical: 6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, marginBottom: 6 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 44 },
  forgotAction: { minHeight: 44, justifyContent: 'center' },
  iconAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  checkbox: { width: 21, height: 21, borderRadius: 3, borderWidth: 1.5, borderColor: '#B6B6BE', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#8A2BD0', borderColor: '#8A2BD0' },
  rememberText: { color: ui.body, fontSize: 14 },
  forgotText: { color: ui.accent, fontSize: 14, fontWeight: '600' },
  signInButton: { minHeight: 52, borderRadius: 12, backgroundColor: ui.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonDisabled: { opacity: 0.7 },
  signInText: { color: ui.surface, fontSize: 16, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: ui.border },
  orText: { color: ui.muted, fontSize: 12, fontWeight: '600', paddingHorizontal: 12 },
  googleButton: { minHeight: 52, borderWidth: 1, borderColor: ui.border, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: ui.surface },
  googleText: { color: '#252630', fontSize: 15, fontWeight: '600' },
  footer: { marginTop: 12, paddingTop: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', flexWrap: 'wrap', columnGap: 8 },
  footerMuted: { color: '#777E89', fontSize: 13 },
  registerLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  registerText: { color: '#7132A7', fontSize: 13, fontWeight: '700' },
  stepPill: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0E6FB', borderColor: '#E7D5F8', borderWidth: 1, borderRadius: 28, paddingVertical: 8, paddingHorizontal: 18 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7921C5', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: ui.surface, fontSize: 14, fontWeight: '700' },
  stepText: { color: '#54217E', fontSize: 14, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 10, 25, 0.48)' },
  modalScrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: ui.surface, borderRadius: 20, padding: 20, gap: 12 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#252330' },
  modalClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  modalDescription: { color: '#646B76', fontSize: 13, lineHeight: 19 },
  modalInput: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: '#DDD6E5', paddingHorizontal: 13, color: '#24212A' },
});