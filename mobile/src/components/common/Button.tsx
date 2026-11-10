import React from "react";
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress = () => {},
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const getButtonStyles = (): ViewStyle => {
    switch (variant) {
      case "primary":
        return { backgroundColor: disabled ? Colors.border : Colors.primary };
      case "secondary":
        return { backgroundColor: disabled ? Colors.surfaceSubtle : Colors.primaryLight };
      case "outline":
        return {
          backgroundColor: "transparent",
          borderWidth: 1.5,
          borderColor: disabled ? Colors.border : Colors.primary,
        };
      case "ghost":
        return { backgroundColor: "transparent" };
      case "danger":
        return { backgroundColor: disabled ? Colors.border : Colors.danger };
      default:
        return { backgroundColor: Colors.primary };
    }
  };

  const getTextStyles = (): TextStyle => {
    switch (variant) {
      case "primary":
      case "danger":
        return { color: "#FFFFFF" };
      case "secondary":
      case "outline":
      case "ghost":
        return { color: disabled ? Colors.textMuted : Colors.primary };
      default:
        return { color: "#FFFFFF" };
    }
  };

  const getSizeStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (size) {
      case "sm":
        return {
          container: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
          text: { fontSize: 13, fontWeight: "600" },
        };
      case "lg":
        return {
          container: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 16 },
          text: { fontSize: 16, fontWeight: "700" },
        };
      case "md":
      default:
        return {
          container: { paddingVertical: 11, paddingHorizontal: 16, borderRadius: 14 },
          text: { fontSize: 14, fontWeight: "600" },
        };
    }
  };

  const sizeStyle = getSizeStyles();

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        sizeStyle.container,
        getButtonStyles(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#FFFFFF" : Colors.primary}
        />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={size === "sm" ? 16 : 18}
              color={getTextStyles().color}
              style={{ marginRight: 6 }}
            />
          )}
          <Text style={[styles.text, sizeStyle.text, getTextStyles(), textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: "System",
  },
  disabled: {
    opacity: 0.65,
  },
});
