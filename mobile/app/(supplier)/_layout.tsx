import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, StyleSheet } from "react-native";
import { Colors } from "../../src/constants/colors";

export default function SupplierTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#5B13EC",
        tabBarInactiveTintColor: "#64748B",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E2E8F0",
          height: Platform.OS === "ios" ? 88 : 68,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="buyer-requests"
        options={{
          title: "Buyer Requests",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "My Orders",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={focused ? styles.activeTabPill : undefined}>
              <Ionicons name={focused ? "cube" : "cube-outline"} size={22} color={color as string} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarBadge: 3,
          tabBarBadgeStyle: {
            backgroundColor: "#5B13EC",
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: "700",
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            lineHeight: 16,
          },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={22} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color as string} />
          ),
        }}
      />

      {/* Auxiliary screens accessible via navigation but hidden from bottom tab bar */}
      <Tabs.Screen
        name="my-offers"
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
        name="production"
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

const styles = StyleSheet.create({
  activeTabPill: {
    backgroundColor: "#F1ECFE",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});

