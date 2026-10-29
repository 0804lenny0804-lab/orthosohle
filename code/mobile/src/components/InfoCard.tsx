import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

type Props = { title: string; children: ReactNode };
export function InfoCard({ title, children }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    gap: 12,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
});
