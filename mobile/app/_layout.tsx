import React from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { View, ActivityIndicator, Text, Image, Linking, StyleSheet } from "react-native";
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

function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, token, activeMembership, isLoading, isBuyer, isSupplier, isAdmin, logout } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  React.useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!token) {
      if (!inAuthGroup) {
        router.replace("/(auth)/login");
      }
    } else {
      if (isAdmin) {
        // Admin is handled via the dedicated Web Admin notice below
        return;
      }
      if (inAuthGroup) {
        if (isSupplier) {
          router.replace("/(supplier)/dashboard");
        } else {
          router.replace("/(buyer)/dashboard");
        }
      }
    }
  }, [token, isLoading, activeMembership, segments, isBuyer, isSupplier, isAdmin]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Image
          source={require("../assets/stitchgrid-logo.png")}
          style={{ width: 220, height: 50, marginBottom: 20 }}
          resizeMode="contain"
        />
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  // Admin users are directed to the Web Admin console per architecture directives
  if (token && isAdmin) {
    return (
      <View style={styles.centerContainer}>
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

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          <RouteGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(buyer)" />
              <Stack.Screen name="(supplier)" />
              <Stack.Screen name="(shared)" />
            </Stack>
          </RouteGuard>
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "600",
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

