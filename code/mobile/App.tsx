import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ActionButton } from "./src/components/ActionButton";
import { OverviewScreen } from "./src/screens/OverviewScreen";
import { DemoSessionScreen } from "./src/screens/DemoSessionScreen";
import { colors } from "./src/theme";

export default function App() {
  const [screen, setScreen] = useState<"overview" | "demo">("overview");
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.brand}>OrthoSohle</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {screen === "overview"
              ? "Deine Belastung im Blick."
              : "Ein erster Testablauf."}
          </Text>
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Entwicklungsprototyp · nur Demo-Daten. Keine medizinische Nutzung.
            </Text>
          </View>
          {screen === "overview" ? (
            <OverviewScreen onStartDemo={() => setScreen("demo")} />
          ) : (
            <>
              <ActionButton
                label="Zur Übersicht"
                secondary
                onPress={() => setScreen("overview")}
              />
              <DemoSessionScreen />
            </>
          )}
          <Text style={styles.footer}>
            Keine Verbindung zu Gerät oder Backend.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 24,
    paddingTop: 36,
    gap: 22,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  brand: { color: colors.accent, fontSize: 20, fontWeight: "700" },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
  },
  notice: { backgroundColor: colors.notice, padding: 16, borderRadius: 10 },
  noticeText: { color: colors.noticeText, fontSize: 14, lineHeight: 21 },
  footer: { color: colors.muted, fontSize: 13 },
});
