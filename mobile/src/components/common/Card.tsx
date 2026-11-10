import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from "react-native";
import { Colors } from "../../constants/colors";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: "elevated" | "outlined" | "flat";
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = "outlined",
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case "elevated":
        return styles.elevated;
      case "flat":
        return styles.flat;
      case "outlined":
      default:
        return styles.outlined;
    }
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={[styles.base, getVariantStyle(), style]}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.base, getVariantStyle(), style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
  },
  elevated: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  flat: {
    backgroundColor: Colors.surfaceSubtle,
  },
});
