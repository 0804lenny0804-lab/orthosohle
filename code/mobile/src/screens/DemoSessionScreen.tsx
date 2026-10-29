import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ActionButton } from "../components/ActionButton";
import {
  addDemoSample,
  endDemoSession,
  startDemoSession,
} from "../domain/demo-session";
import type { DemoSession } from "../domain/demo-session";
import { colors } from "../theme";

export function DemoSessionScreen() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const active = session !== null && session.endedAt === null;
  const latest = session?.samples.at(-1);
  const addSample = (kg: number) =>
    setSession((current) =>
      current ? addDemoSample(current, kg, Date.now()) : current,
    );
  return (
    <View style={styles.layout}>
      <InfoCard title="Demo-Sitzung">
        <Text style={styles.body}>
          Quelle: ausschließlich Demo · kein Sensor · keine Warnfunktion
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.value}>
          {latest ? `${latest.kg} kg` : "Kein Demo-Wert"}
        </Text>
        <Text style={styles.body}>
          {!session
            ? "Noch nicht gestartet"
            : active
              ? "Demo aktiv"
              : "Demo beendet"}
        </Text>
        {!active && (
          <ActionButton
            label={session ? "Neue Demo starten" : "Demo starten"}
            onPress={() => setSession(startDemoSession(Date.now()))}
          />
        )}
        {active && (
          <>
            <Text style={styles.body}>
              Einen synthetischen Wert hinzufügen:
            </Text>
            {[8, 18, 25].map((kg) => (
              <ActionButton
                key={kg}
                label={`${kg} kg hinzufügen`}
                secondary
                onPress={() => addSample(kg)}
              />
            ))}
            <ActionButton
              label="Demo beenden"
              onPress={() =>
                setSession((current) =>
                  current ? endDemoSession(current, Date.now()) : current,
                )
              }
            />
          </>
        )}
      </InfoCard>
      <InfoCard title="Lokale Zusammenfassung">
        <Text style={styles.body}>
          Demo-Messpunkte: {session?.samples.length ?? 0}
        </Text>
        <Text style={styles.body}>
          Nur im Arbeitsspeicher. Kein Upload und keine dauerhafte Speicherung.
          Eine neue Demo ersetzt diesen Verlauf.
        </Text>
        {session && (
          <ActionButton
            label="Demo-Daten verwerfen"
            secondary
            onPress={() => setSession(null)}
          />
        )}
      </InfoCard>
    </View>
  );
}
const styles = StyleSheet.create({
  layout: { gap: 18 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  value: { color: colors.text, fontSize: 36, fontWeight: "600" },
});
