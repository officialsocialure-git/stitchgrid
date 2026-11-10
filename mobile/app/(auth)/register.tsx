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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Input } from "../../src/components/common/Input";
import { Button } from "../../src/components/common/Button";
import { useAuth } from "../../src/hooks/useAuth";

export default function RegisterScreen() {
  const router = useRouter();
  const { signup } = useAuth();

  const [role, setRole] = useState<"BUYER" | "SUPPLIER">("BUYER");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
              Manufacturer
            </Text>
          </TouchableOpacity>
        </View>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.formCard}>
          <Input
            label="Full Name *"
            placeholder="e.g. John Doe"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="person-outline"
          />

          <Input
            label="Work Email *"
            placeholder="e.g. buyer@company.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            leftIcon="mail-outline"
          />

          <Input
            label="Phone Number"
            placeholder="e.g. +91 98765 43210"
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
    marginBottom: 16,
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
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
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
});

