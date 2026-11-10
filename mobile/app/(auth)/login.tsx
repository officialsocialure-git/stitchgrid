import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { useAuth } from "../../src/hooks/useAuth";
import { APP_NAME, GOOGLE_CLIENT_ID } from "../../src/constants/config";

// Complete any pending auth session in web browser
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { login, googleLogin, completeGoogleOnboarding } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Onboarding modal state for new accounts
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingRole, setOnboardingRole] = useState<"BUYER" | "SUPPLIER">("BUYER");
  const [onboardingOrgName, setOnboardingOrgName] = useState("");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      setErrorMessage("Please enter both email/phone and password.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await login(identifier.trim(), password);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to sign in. Please verify your credentials.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setErrorMessage("Google Sign-In is not configured yet. Please sign in with email and password.");
      return;
    }

    try {
      setGoogleLoading(true);
      setErrorMessage(null);

      const redirectUrl = Linking.createURL("oauth");
      const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        `&response_type=id_token` +
        `&scope=${encodeURIComponent("openid profile email")}` +
        `&nonce=${encodeURIComponent(nonce)}` +
        `&prompt=select_account`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === "success" && result.url) {
        const match = result.url.match(/[#?&]id_token=([^&]+)/);
        const idToken = match ? decodeURIComponent(match[1]) : null;

        if (!idToken) {
          throw new Error("Google sign-in did not return a valid identity token. Please try again.");
        }

        const res = await googleLogin(idToken);
        if (res.requiresOnboarding) {
          setShowOnboardingModal(true);
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // User cancelled, do nothing
      } else {
        setErrorMessage("Google sign-in could not be completed. Please try again.");
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        "Google sign-in failed. Please try again.";
      setErrorMessage(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleCompleteGoogleOnboarding = async () => {
    if (!onboardingOrgName.trim() || onboardingOrgName.trim().length < 2) {
      setOnboardingError("Please enter your organization name (minimum 2 characters).");
      return;
    }

    try {
      setOnboardingLoading(true);
      setOnboardingError(null);
      await completeGoogleOnboarding({
        organizationName: onboardingOrgName.trim(),
        accountType: onboardingRole,
      });
      setShowOnboardingModal(false);
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error?.message ||
        err.message ||
        "Failed to complete profile setup. Please try again.";
      setOnboardingError(msg);
    } finally {
      setOnboardingLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <Image
            source={require("../../assets/stitchgrid-logo.png")}
            style={styles.officialLogo}
            resizeMode="contain"
          />
        </View>

        {/* Welcome Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to manage your manufacturing contracts</Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          <Input
            label="Email or Phone Number"
            placeholder="e.g. buyer@stitchgrid.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon="mail-outline"
          />

          <Input
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
          />

          <View style={styles.forgotRow}>
            <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            disabled={googleLoading}
            size="lg"
            style={{ marginTop: 8 }}
          />

          {/* OR Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Sign in with Google Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            disabled={googleLoading || loading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <>
                <Image
                  source={require("../../assets/google-icon.png")}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Register Link */}
        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.registerLink}> Create Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Google Onboarding Modal for New Google Users */}
      <Modal
        visible={showOnboardingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set up your organization</Text>
            <Text style={styles.modalSubtitle}>
              Choose how you will use {APP_NAME}. You can continue once your organization details are saved.
            </Text>

            {onboardingError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.errorText}>{onboardingError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>ACCOUNT TYPE *</Text>
            <View style={styles.roleSelector}>
              <TouchableOpacity
                style={[
                  styles.roleOption,
                  onboardingRole === "BUYER" && styles.roleOptionActive,
                ]}
                onPress={() => setOnboardingRole("BUYER")}
              >
                <Ionicons
                  name="cart-outline"
                  size={20}
                  color={onboardingRole === "BUYER" ? "#FFFFFF" : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.roleText,
                    onboardingRole === "BUYER" && styles.roleTextActive,
                  ]}
                >
                  Buyer / Brand
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.roleOption,
                  onboardingRole === "SUPPLIER" && styles.roleOptionActive,
                ]}
                onPress={() => setOnboardingRole("SUPPLIER")}
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color={onboardingRole === "SUPPLIER" ? "#FFFFFF" : Colors.textSecondary}
                />
                <Text
                  style={[
                    styles.roleText,
                    onboardingRole === "SUPPLIER" && styles.roleTextActive,
                  ]}
                >
                  Supplier
                </Text>
              </TouchableOpacity>
            </View>

            <Input
              label="Organization Name *"
              placeholder="Your company or brand name"
              value={onboardingOrgName}
              onChangeText={setOnboardingOrgName}
              leftIcon="business-outline"
            />

            <Button
              title="Complete Setup"
              onPress={handleCompleteGoogleOnboarding}
              loading={onboardingLoading}
              size="lg"
              style={{ marginTop: 12 }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 40,
    justifyContent: "center",
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  officialLogo: {
    width: 250,
    height: 56,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dangerText,
    fontWeight: "500",
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: 16,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.primary,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
  },
  googleIcon: {
    width: 22,
    height: 22,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  registerPrompt: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  // Onboarding Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 44 : 28,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  roleOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  roleText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  roleTextActive: {
    color: "#FFFFFF",
  },
});
