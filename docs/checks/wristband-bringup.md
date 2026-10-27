# Waveshare-Armband: erste Inbetriebnahme

Begonnen: 27.10.2026. Aufgabe C03 im [Backlog](../backlog.csv), anschließend erster Teil von A03/A04. Ziel dieser kleinen Etappe: konkretes Board identifizieren und danach eine minimale Firmware bauen, die einen festen, ausdrücklich als Test bezeichneten Wert auf dem Display zeigt.

## Bisher belegt

- Nutzer nennt Waveshare ESP32-S3-Touch-LCD-1.28 als vorhandene Hardwarebasis.
- Exakte Revision, aktuelle Firmware, Zusatzhardware und USB-Erkennung sind noch nicht erhoben.
- Kein physischer Gerätezugriff aus diesem Workspace nachgewiesen. Es wurde nichts geflasht.
- Hersteller-Wiki am 27.10.2026 erneut mit HTTP 403 nicht abrufbar. Deshalb wurden keine Display-Pins oder Treiberkonfigurationen daraus übernommen.

## Nächste Erhebung am Gerät

1. Vollständigen Modell-/Revisionsaufdruck auf Vorder- und Rückseite ablesen; ähnliche Modelle mit abweichendem Displaycontroller nicht gleichsetzen.
2. Vorhandene Zusatzteile nennen: Akku, Vibrationsmotor, Motortreiber und Verkabelung. Für den ersten Displaytest genügt die USB-Versorgung; unbekannte Zusatzverdrahtung vorher erfassen.
3. Board mit einem USB-Datenkabel an Windows anschließen. Den Gerätenamen und gegebenenfalls COM-Port im Geräte-Manager sowie den Zustand des Displays notieren. Noch keine Firmware überschreiben.
4. Aktuelle Firmwarequelle bzw. vorhandene Hersteller-Demo sichern, sofern verfügbar. Hersteller-Schaltplan und passendes Displaybeispiel für genau diese Variante beschaffen und Herkunft dokumentieren.

Diese Beobachtungen hier nach Eingang ergänzen; unbekannte Werte bleiben unbekannt.

## Eng begrenzter Firmware-Schritt danach

- Verifizierte Board-/Displaykonfiguration und nachvollziehbare, festgelegte Toolchain verwenden.
- Neuen tatsächlichen Firmwarecode unter code/ anlegen, Originalcode unverändert lassen.
- Auf dem Display „TEST“ und einen festen kg-Testwert anzeigen. Noch keine BLE-Verbindung oder medizinische Warnlogik.
- Build- und Uploadbefehle mit konkreten Versionen dokumentieren. Vor dem ersten Upload vorhandene Firmware und Wiederherstellungsweg berücksichtigen.

Abnahme: Build erfolgreich; Upload auf genau das erfasste Board; Testkennzeichnung und Wert nach Neustart auf dem echten Display lesbar. Nachweis enthält Datum, Commit, Boardrevision, Toolchain, Ergebnis und gegebenenfalls Foto. Kompilierung allein erfüllt die Geräteabnahme nicht.

## Aktueller Stand

Vorbereitung der Erhebung erfolgt. Boardidentifikation, USB-Prüfung, Firmwarebuild und Displayabnahme stehen aus. Keine Arbeitsstunden oder Messergebnisse als geleistet erfasst.
