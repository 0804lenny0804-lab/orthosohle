# Folgeprojekt WATCH – Kompatibilität mit gängigen Smartwatches

Stand: 20.10.2026. **Eigenes Folgeprojekt, vorgemerkt und nicht implementiert.** Auftrag: OrthoSohle später mit weiteren gängigen Smartwatches nutzbar machen. Kein neuer Codex-Chat und kein zusätzliches Repository angelegt; diese Datei ist die maßgebliche Projektbeschreibung.

## Abgrenzung zum Hauptprojekt

Das **Waveshare ESP32-S3-Touch-LCD-1.28 ist die bestätigte Hardwarebasis des eigenständigen Warnarmbands** und gehört zum Hauptprojekt. Dessen Anforderungen stehen in [requirements.md](requirements.md). Es ist kein optionaler zusätzlicher Watch-Client und wird hier nicht erneut spezifiziert.

Dieses Folgeprojekt betrifft andere Plattformen, insbesondere später auszuwählende Apple-Watch-/watchOS- und Wear-OS-Geräte. „Gängige Smartwatches“ ist keine Zusage für jedes Modell. Unterstützte Modelle, OS-Versionen und Funktionen werden einzeln nachgewiesen. Keine zusätzliche Entwicklung oder Budgetzusage innerhalb des bisherigen Semesterplans. Der bisherige Smartwatch-PoC B16 bleibt Teil der alten Planung und ist bei der Neuplanung durch die klare Kern-/Folgeprojektgrenze zu ersetzen, nicht zusätzlich parallel auszuführen.

## Ziel und Wiederverwendung

Je unterstützter Plattform festlegen, ob sie aktuelle kg-Werte, Status/Grenzwert und haptisches Feedback anzeigen bzw. ausgeben soll. Lokalen BLE-Empfang, Smartphone-Companion und Backendzugriff unterscheiden. „Anzeige kompatibel“ bedeutet noch keine unabhängige zuverlässige Warnung ohne Handy. Native watchOS-/Wear-OS-Clients sind nicht durch responsive Webdarstellung gelöst.

Gemeinsame Daten-/Planversionen, Nutzer-/Gerätezuordnung und Datenschutzanforderungen aus [requirements.md](requirements.md) wiederverwenden. Keine unabhängig duplizierte Therapielogik, kein zusätzliches Backend nur für die Uhr. Der vorhandene App-Pfad Sohle → Handy wird um einen geprüften Watchpfad ergänzt; keine beliebig vielen BLE-Verbindungen an der Sohle voraussetzen. Hintergrundbeschränkungen und Datenalter sichtbar behandeln. Ein Watchclient ersetzt das eigenständige Waveshare-Armband nur nach ausdrücklicher späterer Architektur-/Freigabeentscheidung.

## Vorgeschlagene Meilensteine

| ID | Ergebnis | Abnahme |
|---|---|---|
| WATCH-01 | Fähigkeiten und erste Plattform auswählen | Anzeige/Warnung/Konfiguration, Telefonabhängigkeit und Zielgeräte/OS benannt |
| WATCH-02 | Testhardware und Entwicklungszugang erfassen | Tatsächlich verfügbare Uhren/Smartphones, Entwicklergeräte und SDK-Voraussetzungen belegt |
| WATCH-03 | Einen Datenweg auf einer echten Uhr demonstrieren | kg-Wert mit Qualität, Alter und Planversion, Verbindungsabbruch sichtbar |
| WATCH-04 | Warn-/Konfigurationsverhalten prüfen | Kein Alarmversprechen ohne gemessenen Pfad; Soll-/Istgrenze, Neustart und Wiederverbindung geprüft |
| WATCH-05 | Nächste Plattform gezielt ergänzen | Gemeinsamen Vertrag wiederverwendet; gleiche Fachbedeutung bei plattformspezifischem Adapter |
| WATCH-06 | Kompatibilitätsmatrix veröffentlichen | Modell, OS/Clientversion, Funktionen, Abhängigkeiten und Testnachweise dokumentiert |

Offen: erste Plattform, konkrete Modelle, Mindestversionen, Funktionsumfang, Priorisierung, Aufwand, Termine und verantwortliche Person. Kein Codeordner, Skill oder zusätzlicher Agent für eine bloße Vormerkung nötig. Einstieg über den Link im [Projektkontext](context.md); erst bei Beauftragung eigene kleine Aufgaben schätzen.
