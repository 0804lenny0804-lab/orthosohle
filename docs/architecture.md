# Zielstruktur und Modulgrenzen

Status: akzeptierte Strukturvereinbarung, ADR 0001. Dies legt Ablagen und Verantwortlichkeiten fest; Hardware, Gateway, Auth-Provider und endgültige BLE-Topologie sind noch offen.

| Modul | Verantwortung | Darf nicht enthalten |
|---|---|---|
| apps/web | UI, API-Client, Gateway-Adapter für explizit unterstützte Browser | SQL, Server-Secrets, einzige verlässliche Warnfunktion |
| apps/api | Auth/Autorisierung, API-Validierung, Geräte-/Sitzungsverwaltung, Datenzugriff | Browserzustand, direkte Abhängigkeit vom Vibrationsalarm |
| firmware/bracelet | BLE-Empfang, Decoder, lokale Konfiguration, Warnung, Anzeige, Energie | Internetabhängigkeit der Warnentscheidung |
| firmware/insole | Bestehende Sensoranbindung, Kalibrierung, Messstatus und BLE-Ausgabe | Unbeauftragtes Sensor-Redesign oder Web-UI |
| contracts | BLE-/API-Spezifikation, Versionen, Fehlerfälle, synthetische Fixtures | Zugangsdaten, Patientenmessungen, Framework-/Hardwarekopplung |
| hardware | Stücklisten, Revisionen, Pins, Spannungen, Gehäuse, Aufbau | Unbelegte Bauteil-/Ladeannahmen |
| tests/system | Modulübergreifende Prüfabläufe und synthetische Testdaten | Reale personenbezogene Gesundheitsdaten |

## Innere Struktur, sobald Code migriert wird

- Web: `src/features/<feature>/` mit zugehörigen Komponenten und Tests; `src/services/` für Transport/API, `src/domain/` für frameworkarme Mess-/Sitzungslogik. Globale App-Komponente bleibt Zusammensetzung, kein Sammelort für sämtliche Logik.
- API: `src/routes/`, `src/services/`, `src/domain/`, `src/db/` und `migrations/`. Eingabeprüfung an der Grenze; Nutzeridentität aus geprüfter Session, Besitzprüfung vor Datenzugriff. SQL nicht in UI oder Route verstreuen.
- Firmware: `src/` und passende `include/`/Testablage des gewählten Buildsystems. Hardwaretreiber, BLE-Transport, Decoder, Konfigurationsspeicher und Warnautomat getrennt. Buildsystem erst nach Board-/Toolchain-Prüfung festlegen; nicht vorsorglich PlatformIO oder ein Board erzwingen.
- Tests möglichst beim Modul; systemweite Prüfungen unter `tests/system/`. Einheit/Sequenz/Status und Grenzwertversion über Modulgrenzen durch Verträge festlegen, nicht durch duplizierte magische Zahlen.
- Jedes Modul hat genau eine README mit tatsächlichem Status, Voraussetzungen, Einstieg, Konfiguration und Prüfungen. Zusätzliche Ordner erst bei echtem Inhalt anlegen.

## Migration des Referenzcodes

1. Ausgangsstand und Prüfsummen unter reference/README.md sichern; bekannte Fehler nicht als produktfähige Funktion übernehmen.
2. Framework-/Paketgrundlage gezielt in apps/web und apps/api übernehmen. Installationsbefehle und Lockfiles mitführen, Pfadänderungen getrennt prüfen.
3. Firmware aus dem alten Komponentenverzeichnis in ein eigenständiges Firmwareprojekt überführen; Board und Bibliotheken pinnen, sobald bekannt.
4. Verhaltensänderungen in eigenen nachvollziehbaren Schritten. Pro Schritt Build/Vertrags-/Regressionstest nach Risiko ausführen.
5. Erst nach dokumentierter Abnahme aktive Zielmodule als implementiert kennzeichnen. Historische Referenz bleibt unverändert.

## Daten- und Warnpfad

Sohle → lokales BLE → Armband → optional Gateway → authentifizierte API → Datenbank → Web-App. Gleichzeitig nötige BLE-Rollen experimentell nachweisen. Die Web-App kann Daten ohne eigene BLE-Unterstützung anzeigen. Ungültige/veraltete Daten und Sensorüberbereich haben einen expliziten Zustand. Gerätezeit und UTC-Empfangszeit nicht verwechseln. Grenzwertänderungen erst nach Geräte-ACK als angewendet darstellen.
