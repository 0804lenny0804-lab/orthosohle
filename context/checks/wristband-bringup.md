# Waveshare-Armband: erste Inbetriebnahme

Begonnen: 27.10.2026. Aufgabe C03 im [Backlog](../backlog.csv), anschließend erster Teil von A03/A04. Ziel dieser kleinen Etappe: konkretes Board identifizieren und danach eine minimale Firmware bauen, die einen festen, ausdrücklich als Test bezeichneten Wert auf dem Display zeigt.

## Bisher belegt

- Boardmodell durch Nutzerangabe am 10.11.2026 bestätigt: Waveshare ESP32-S3-Touch-LCD-1.28 mit GC9A01-Display und CST816S-Touch.
- Nutzer berichtet am 10.11.2026, dass ein einfacher Testwert bereits auf dem integrierten Display angezeigt wurde. Quellstand, Bibliotheksversionen und verwendete Boardoption wurden nicht mitgeliefert; dies ist ein Nutzerbericht und kein hier reproduzierter Hardwaretest.
- USB-Serielltest lief laut Nutzer. Exakte Revision, aktuell geflashter Sketch sowie Zusatzhardware sind noch nicht erhoben.
- Ein neuer BLE-Empfänger und Browser-Simulator sind unter `code/firmware/esp32s3-display-receiver/` und `code/simulator-bridge/` vorbereitet. Noch nicht auf dem echten Board kompiliert oder über BLE erprobt.
- Hersteller-Wiki am 27.10.2026 erneut mit HTTP 403 nicht abrufbar. Deshalb wurden keine Display-Pins oder Treiberkonfigurationen daraus übernommen.

## Nächste Erhebung am Gerät

1. Revision und Zusatzteile (Akku, Vibrationsmotor, Motortreiber) erfassen, sobald für diese Funktionen relevant.
2. Den vorhandenen Displaytest sichern/notieren, dann die BLE-Empfängerfirmware gemäß Code-README aufspielen.
3. Den lokalen Browser-Simulator in Chrome/Edge öffnen und synthetische Werte vom PC zum Display übertragen.
4. Build-/BLE-Fehler und tatsächliche Board-/Libraryversionen festhalten. Danach Datenvertrag und BLE-Topologie mit der realen Sohle prüfen.

Diese Beobachtungen hier nach Eingang ergänzen; unbekannte Werte bleiben unbekannt.

## Abnahmegrenze des BLE-Durchstichs

- Bestehende Boardskizze lässt sich mit festgehaltenen Bibliotheks-/Boardversionen bauen und auf das Board laden.
- Browser verbindet sich als BLE-Central mit dem ESP32-Peripheral; BLE-Dienst und Characteristic sind getrennt von den Legacy-Sohlen-UUIDs.
- Synthetische Werte aus dem Simulator erscheinen mit `DEMO`-Kennzeichnung auf dem Display; bei ausbleibenden Werten erscheint `DATEN ALT`.
- Kein echter Sohlenwert, Warnpfad, App-Integration, iOS-Unterstützung oder medizinischer Nachweis ist damit abgenommen.

Abnahmebeleg erst nach realem Build und Gerätetest ergänzen: Datum, Commit, Boardrevision, Toolchain, Ergebnis und gegebenenfalls Foto. Kompilierung allein erfüllt die Geräteabnahme nicht.

## Aktueller Stand

Displaytest und USB-Serielltest laut Nutzer erfolgreich. Der neue BLE-Durchstich ist implementiert, aber Hardwarebuild und Funkübertragung stehen aus. Keine Arbeitsstunden oder weiteren Messergebnisse als geleistet erfasst.
