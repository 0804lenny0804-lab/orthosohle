import { StyleSheet, Text, View } from "react-native";
import { InfoCard } from "../components/InfoCard";
import { ActionButton } from "../components/ActionButton";
import { colors } from "../theme";

export function OverviewScreen({ onStartDemo }: { onStartDemo: () => void }) {
  return (
    <View style={styles.layout}>
      <InfoCard title="Dein Therapieplan">
        <Text style={styles.headline}>Noch kein Plan hinterlegt</Text>
        <Text style={styles.body}>
          Eine ärztlich vorgegebene Belastungsgrenze ist noch nicht verfügbar.
          Es wird keine Belastungsfreigabe angezeigt.
        </Text>
      </InfoCard>
      <InfoCard title="Dein Gerät">
        <Text style={styles.headline}>Nicht verbunden</Text>
        <Text style={styles.body}>Aktuelle Belastung: nicht verfügbar</Text>
        <Text style={styles.body}>Grenzwertübernahme: nicht bestätigt</Text>
      </InfoCard>
      <InfoCard title="App kennenlernen">
        <Text style={styles.body}>
          Teste einen Ablauf mit manuell erzeugten Demo-Werten. Es findet keine
          Messung statt.
        </Text>
        <ActionButton label="Demo-Sitzung öffnen" onPress={onStartDemo} />
      </InfoCard>
    </View>
  );
}
const styles = StyleSheet.create({
  layout: { gap: 18 },
  headline: { fontSize: 19, fontWeight: "600", color: colors.text },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24 },
});
