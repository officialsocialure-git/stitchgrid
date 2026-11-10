import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Image, Text, Linking } from "react-native";
import { useRouter, useRootNavigationState } from "expo-router";
import { useAuth } from "../src/hooks/useAuth";
import { Colors } from "../src/constants/colors";
import { Button } from "../src/components/common/Button";

export default function IndexScreen() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const { token, isLoading, isSupplier, isAdmin, logout } = useAuth();

  // Navigation is only ready when the root layout navigation container has mounted
  const isNavigationReady = Boolean(rootNavigationState?.key);

  useEffect(() => {
    // STRICT LIFECYCLE CHECK:
    // 1. Navigation container MUST be mounted and ready
    // 2. Auth session restoration from secure storage MUST be finished
    if (!isNavigationReady || isLoading) {
      return;
    }

    if (!token) {
      router.replace("/(auth)/login");
    } else if (isAdmin) {
      // Admin accounts remain on IndexScreen displaying the Admin Web console notice
    } else if (isSupplier) {
      router.replace("/(supplier)/dashboard");
    } else {
      router.replace("/(buyer)/dashboard");
    }
  }, [isNavigationReady, isLoading, token, isSupplier, isAdmin]);

  // If Admin user is logged in, show the Admin notice card
  if (!isLoading && token && isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.adminCard}>
          <Image
            source={require("../assets/stitchgrid-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.adminTitle}>Admin Console on Web</Text>
          <Text style={styles.adminDesc}>
            The Admin Dashboard is exclusively accessible via the secure STITCHGRID Web Console.
          </Text>
          <Button
            title="Open Web Admin"
            onPress={() => Linking.openURL("https://stitchgrid-three.vercel.app/admin")}
            style={{ marginBottom: 12, width: "100%" }}
          />
          <Button
            title="Log Out"
            variant="outline"
            onPress={logout}
            style={{ width: "100%" }}
          />
        </View>
      </View>
    );
  }

  // Branded STITCHGRID launch screen shown while mounting and verifying session
  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/stitchgrid-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator size="small" color={Colors.primary} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 24,
  },
  logo: {
    width: 220,
    height: 50,
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
  adminCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    maxWidth: 360,
    width: "100%",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.text,
    marginBottom: 8,
  },
  adminDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
});
