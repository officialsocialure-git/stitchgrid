import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Colors } from "../../constants/colors";

export type BadgeVariant = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = "primary",
  size = "md",
  style,
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case "success":
        return { bg: Colors.successLight, text: Colors.successText, border: Colors.successBorder };
      case "warning":
        return { bg: Colors.warningLight, text: Colors.warningText, border: Colors.warningBorder };
      case "danger":
        return { bg: Colors.dangerLight, text: Colors.dangerText, border: Colors.dangerBorder };
      case "info":
        return { bg: Colors.infoLight, text: Colors.infoText, border: Colors.infoBorder };
      case "neutral":
        return { bg: Colors.surfaceSubtle, text: Colors.textSecondary, border: Colors.border };
      case "primary":
      default:
        return { bg: Colors.primaryLight, text: Colors.primary, border: Colors.borderPrimary };
    }
  };

  const colors = getBadgeStyle();
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingVertical: isSmall ? 2 : 4,
          paddingHorizontal: isSmall ? 8 : 10,
          borderRadius: 8,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: colors.text,
            fontSize: isSmall ? 11 : 12,
            fontWeight: "700",
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
});

