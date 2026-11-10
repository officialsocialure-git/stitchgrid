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
import { authService } from "../../src/services/auth.service";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRequestReset = async () => {
    if (!identifier.trim()) {
      setErrorMessage("Please enter your email or registered phone number.");
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await authService.forgotPassword(identifier.trim());
      setSuccessMessage(res.message || "Password reset instructions sent. Please check your email or SMS.");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Could not find an account with that identifier.";
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

        <Text style={styles.headerTitle}>Reset Password</Text>
        <Text style={styles.headerSubtitle}>
          Enter your registered email or phone and we'll send you recovery instructions.
        </Text>

        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={Colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {successMessage ? (
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={48} color={Colors.success} style={{ marginBottom: 12 }} />
            <Text style={styles.successTitle}>Instructions Sent!</Text>
            <Text style={styles.successText}>{successMessage}</Text>
            <Button
              title="Return to Sign In"
              onPress={() => router.replace("/(auth)/login")}
              size="lg"
              style={{ marginTop: 20, width: "100%" }}
            />
          </View>
        ) : (
          <View style={styles.formCard}>
            <Input
              label="Email or Phone Number"
              placeholder="e.g. buyer@company.com"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              keyboardType="email-address"
              leftIcon="mail-outline"
            />

            <Button
              title="Send Reset Link"
              onPress={handleRequestReset}
              loading={loading}
              size="lg"
              style={{ marginTop: 8 }}
            />
          </View>
        )}
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
    marginBottom: 24,
    lineHeight: 20,
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
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
  },
  successText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});

