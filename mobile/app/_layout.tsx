import React, { useEffect } from "react";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { View, Text, Image, Linking, StyleSheet } from "react-native";
import { Colors } from "../src/constants/colors";
import { Button } from "../src/components/common/Button";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

/**
 * Headless route synchronizer that handles role and session transitions
 * AFTER the root layout has mounted and initial boot on index has completed.
 */
function RouteSynchronizer() {
  const { token, isLoading, isSupplier, isAdmin, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  const isNavigationReady = Boolean(rootNavigationState?.key);

  useEffect(() => {
    // Crucial lifecycle check: Never navigate before root navigation is mounted
    if (!isNavigationReady || isLoading) {
      return;
    }

    const firstSegment = segments[0];
    const inAuthGroup = firstSegment === "(auth)";
    const onIndexRoute = !firstSegment || firstSegment === "index";

    // Let IndexScreen handle the initial boot from root "/"
    if (onIndexRoute) {
      return;
    }

    if (!token) {
      // If user is on any protected route without a token, redirect to login
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      // If user has a token but is on auth screens (login/register), redirect to role dashboard
      if (inAuthGroup) {
        if (isAdmin) {
          router.replace("/");
        } else if (isSupplier) {
          router.replace("/(supplier)/dashboard");
        } else {
          router.replace("/(buyer)/dashboard");
        }
      }
    }
  }, [isNavigationReady, token, isLoading, segments, isSupplier, isAdmin]);

  // If Admin user logs in while on any screen other than index, show the overlay notice
  if (!isLoading && token && isAdmin && segments[0] !== "index") {
    return (
      <View style={[StyleSheet.absoluteFill, styles.centerContainer, { zIndex: 999 }]}>
        <View style={styles.adminCard}>
          <Image
            source={require("../assets/stitchgrid-logo.png")}
            style={{ width: 200, height: 45, marginBottom: 16 }}
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

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          {/* Root navigator is ALWAYS mounted unconditionally on the first render */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(buyer)" />
            <Stack.Screen name="(supplier)" />
            <Stack.Screen name="(shared)" />
          </Stack>
          <RouteSynchronizer />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
    padding: 24,
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
