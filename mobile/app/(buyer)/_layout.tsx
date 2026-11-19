import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "../../src/constants/colors";

export default function BuyerTabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "ios" ? 28 : 12);
  const tabHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: tabHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="rfqs"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "document-text" : "document-text-outline"} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "cube" : "cube-outline"} size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={size} color={color as string} />
          ),
        }}
      />

      {/* Auxiliary screens accessible via navigation but hidden from bottom tab bar */}
      <Tabs.Screen
        name="suppliers"
        options={{
          tabBarButton: () => null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          tabBarButton: () => null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="samples"
        options={{
          tabBarButton: () => null,
          tabBarStyle: { display: "none" },
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          tabBarButton: () => null,
          tabBarStyle: { display: "none" },
        }}
      />
    </Tabs>
  );
}

