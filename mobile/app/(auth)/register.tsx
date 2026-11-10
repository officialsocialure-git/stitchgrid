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

WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen() {
  const router = useRouter();
  const { signup, googleLogin, completeGoogleOnboarding } = useAuth();

  const [role, setRole] = useState<"BUYER" | "SUPPLIER">("BUYER");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Google Onboarding modal
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingOrgName, setOnboardingOrgName] = useState("");
  const [onboardingRole, setOnboardingRole] = useState<"BUYER" | "SUPPLIER">("BUYER");
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password || !organizationName.trim()) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await signup({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        organizationName: organizationName.trim(),
        accountType: role,
        city: city.trim() || undefined,
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Registration failed. Please try again.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setErrorMessage("Google Sign-In is not configured yet.");
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
          throw new Error("Google authentication did not return a valid identity token.");
        }

        const res = await googleLogin(idToken);
        if (res.requiresOnboarding) {
          // If the user already filled organization name on the registration form, complete onboarding automatically
          if (organizationName.trim().length >= 2) {
            await completeGoogleOnboarding({
              organizationName: organizationName.trim(),
              accountType: role,
            });
          } else {
            setOnboardingRole(role);
            setOnboardingOrgName("");
            setShowOnboardingModal(true);
          }
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // User cancelled
      } else {
        setErrorMessage("Google sign-in was not completed. Please try again.");
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
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Image
            source={require("../../assets/stitchgrid-logo.png")}
            style={{ width: 170, height: 38 }}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.headerTitle}>Create Account</Text>
        <Text style={styles.headerSubtitle}>Join the verified apparel sourcing ecosystem</Text>

        {/* Role Selector */}
        <View style={styles.roleSelector}>
          <TouchableOpacity
            onPress={() => setRole("BUYER")}
            style={[styles.roleOption, role === "BUYER" && styles.roleOptionActive]}
          >
            <Ionicons
              name="cart-outline"
              size={20}
              color={role === "BUYER" ? "#FFFFFF" : Colors.textSecondary}
            />
            <Text style={[styles.roleText, role === "BUYER" && styles.roleTextActive]}>
              Buyer / Brand
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setRole("SUPPLIER")}
            style={[styles.roleOption, role === "SUPPLIER" && styles.roleOptionActive]}
          >
            <Ionicons
              name="business-outline"
              size={20}
              color={role === "SUPPLIER" ? "#FFFFFF" : Colors.textSecondary}
            />
            <Text style={[styles.roleText, role === "SUPPLIER" && styles.roleTextActive]}>
              Supplier / Mill
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Quick Sign up with Google */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignup}
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
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* OR Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR WITH EMAIL</Text>
            <View style={styles.dividerLine} />
          </View>

          <Input
            label="Full Name *"
            placeholder="e.g. Rahul Sharma"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="person-outline"
          />

          <Input
            label="Work Email *"
            placeholder="e.g. rahul@company.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon="mail-outline"
          />

          <Input
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            leftIcon="call-outline"
          />

          <Input
            label="Password *"
            placeholder="Minimum 6 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
          />

          <Input
            label="Company / Mill Name *"
            placeholder={role === "BUYER" ? "e.g. Urban Threads Apparel" : "e.g. Tirupur Cotton Mills"}
            value={organizationName}
            onChangeText={setOrganizationName}
            leftIcon="business-outline"
          />

          <Input
            label="City"
            placeholder="e.g. Tirupur, Mumbai, Delhi"
            value={city}
            onChangeText={setCity}
            leftIcon="location-outline"
          />

          <Button
            title="Create Account"
            onPress={handleRegister}
            loading={loading}
            disabled={googleLoading}
            size="lg"
            style={{ marginTop: 8 }}
          />
        </View>

        <View style={styles.loginRow}>
          <Text style={styles.loginPrompt}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginLink}> Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Google Onboarding Modal */}
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
              Choose your account type and business name to finalize registration on {APP_NAME}.
            </Text>

            {onboardingError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                <Text style={styles.errorText}>{onboardingError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>ACCOUNT TYPE *</Text>
            <View style={styles.modalRoleSelector}>
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
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
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
    fontSize: 11,
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
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 12,
    marginBottom: 4,
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
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  loginPrompt: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primary,
  },
  // Modal styles
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
  modalRoleSelector: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
});
