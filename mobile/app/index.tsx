import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/hooks/useAuth";
import { Colors } from "../src/constants/colors";

export default function IndexScreen() {
  const router = useRouter();
  const { token, isLoading, isSupplier, isAdmin } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      router.replace("/(auth)/login");
    } else if (isAdmin) {
      // Handled in _layout
    } else if (isSupplier) {
      router.replace("/(supplier)/dashboard");
    } else {
      router.replace("/(buyer)/dashboard");
    }
  }, [token, isLoading, isSupplier, isAdmin]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.background,
  },
});

