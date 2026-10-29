import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
};
export function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  label: { fontWeight: "600", fontSize: 16, color: "#fff" },
  secondaryLabel: { color: colors.accent },
  dimmed: { opacity: 0.6 },
});
