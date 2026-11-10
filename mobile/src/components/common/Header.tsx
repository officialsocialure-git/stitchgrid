import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Colors } from "../../constants/colors";
import { useAuth } from "../../hooks/useAuth";
import { APP_NAME } from "../../constants/config";

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  rightAction,
}) => {
  const router = useRouter();
  const { activeMembership, isBuyer, isSupplier } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.leftRow}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <Image
            source={require("../../../assets/stitchgrid-symbol.png")}
            style={styles.brandSymbol}
            resizeMode="contain"
          />
        )}
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title || APP_NAME}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : !title ? (
            <Text style={styles.tagline}>GARMENT MANUFACTURING NETWORK</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.rightRow}>
        {rightAction ? (
          rightAction
        ) : (
          <>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {isSupplier ? "SUPPLIER" : isBuyer ? "BUYER" : "GUEST"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(shared)/notifications")}
              style={styles.iconButton}
            >
              <Ionicons name="notifications-outline" size={20} color={Colors.text} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leftRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    marginRight: 10,
    padding: 4,
  },
  brandSymbol: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  tagline: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  rightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight,
  },
  roleText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
  },
  iconButton: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
  },
});

