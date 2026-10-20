# Projektstatus – Einstieg für jede Sitzung

Aktualisiert: 20.10.2026. Dieser Stand beschreibt das Repository, nicht den ungeprüften Stand auf GitLab oder der Hardware. Commit und Branch mit Git abfragen; keine manuell nachgeführte HEAD-ID.

## Ziel und feste Prioritäten

1. Eigenständiges BLE-Armband: aktuelle kg-Anzeige, lokale persistente Belastungsgrenze, Vibration, Ausfallstatus, Akku und Gehäuse.
2. Produktnahe Web-Beta mit Konten, geschützten Geräte-/Sitzungsdaten und nachvollziehbarer Synchronisierung.
3. Bestehende Sohle als Quelle; nur erforderliche Mess-/Schnittstellenkorrekturen. Warnung unabhängig von Smartphone/Internet.

15.10.2026–28.01.2027, zwei Personen, insgesamt 600 reale Personenstunden. Normierte Planung: A 135, B 90, C 30, D 30, E 15 = 300 Planungsstunden. Abschlussbudget nach Hochschulklärung überprüfen. Media-Night-Datum und Hausarbeitsumfang noch nicht bestätigt.

## Implementiert / im Repository vorhanden

- Projektstruktur, verbindliche Arbeitsregeln, Kontextablagen, Vorlagen und Repository-Checker eingerichtet.
- Historischer Referenzcode aus ZIP unverändert unter `reference/orthopaul`; Herkunft und Datei-Prüfsummen in `reference/manifest.json`. Aktueller GitLab-Commit unbekannt.
- Kontextdatei und ältere Hausarbeit dauerhaft unter `docs/references` gesichert.
- Analyse und 57 geschätzte Backlogaufgaben vorhanden. Die CSV ist die maßgebliche Aufgabenliste; Markdown wird generiert.
- Aktive Produktmodule `apps/web`, `apps/api`, `firmware/bracelet`, `firmware/insole` enthalten bisher nur Status-/Struktur-READMEs. Keine Migration oder Produktfunktion abgeschlossen.

## Nur im Referenzcode vorhanden / bekannte Grenzen

Vue/Vite + Express/SQLite, ArduinoBLE/HX711, Livechart, Simulation, Lauf-/Historienoberfläche, Warnungen und PWA-Grundstruktur. Armband, Auth und Geräteverwaltung fehlen. Bekannte Befunde: 25-kg-Sättigung, verschachtelte Limit-API, fehlender BLE-Ereignisupload, Simulationsrohwerte als Peaks, ungeschützte API, keine vollständige Offline-Queue. Keine dieser Lücken durch die Struktureinrichtung behoben.

Details: [Bestandsaufnahme](../ORTHOSOHLE_BESTAND_UND_PLAN.md). Historische Hardware laut Hausarbeit: Nano 33 BLE, HX711, KERN CK 30-Y1; aktueller Aufbau und vollständige Beinlastmessung ungeprüft.

## Letzte Prüfungen

- Referenzanalyse 20.10.2026: Frontend-Produktionsbuild inkl. SW erfolgreich; Backend mit temporärer SQLite-DB gestartet; Limit-API-Fehler und ungeschützte Datenzugriffe reproduziert. [Prüfkontext](../testing/REFERENCE_BASELINE.md).
- Projektgerüst: Checker prüft Pflichtdateien, Markdown-Verweise, CSV/Markdown-Konsistenz, Budget/Abhängigkeiten und unveränderten Referenzbestand. Aktuelle Ausführung vor jedem Abschluss erforderlich.
- Ungeprüft: Hardware, reale BLE-Topologie, Firmwarekompilierung, tatsächliche Warnlatenz, Akkulaufzeit, Browser-Hintergrundverhalten und aktuelle Deployments.

## Entscheidungen und offene Fragen

- Akzeptiert: [ADR 0001](../decisions/0001-project-structure-and-workflow.md) zu Struktur, Regeln und Kontextablage.
- Offen: Board/Display/Motor/Akku/Ladung/Gehäuse, HX711-Rate, Auth-Provider, Gateway, BLE-Rollen, Watch-Plattform, Hardwarebudget, Personen-/Aufgabenzuordnung und Hochschultermine.
- Git: Lokaler Branch bei Einrichtung `work`, Remote `origin` vorhanden. Referenz-Import ist keine Verbindung zur ursprünglichen GitLab-Historie. GitLab-CI-Konfiguration für den Repository-Checker vorhanden, aber noch nicht auf dem Remote ausgeführt. Kein Push/Merge/Branchschutz im Zuge der Einrichtung vorgenommen. Remote-Default und Zugriffsrechte vor Integration prüfen.

## Nächste Schritte

1. C03/C05: tatsächlichen Hardwarebestand, geflashte Firmware, Messrate und BLE-Rollen prüfen; Person/Termin zuordnen.
2. C02: Referenz schrittweise in aktive Web-/API-Module übernehmen und dort reproduzierbare Builds samt Konfiguration herstellen.
3. B01–B03: Limit-Vertrag und einheitlichen real/demo-Datenweg mit Regressionstests korrigieren.
4. C04/C06: konkrete Abnahmewerte und versioniertes Mess-/Konfigurationsprotokoll festlegen; dann A01/A03.
5. C07: tatsächliche Zeitkonten, Verantwortliche und Hochschulanforderungen klären.

## Übergabe

Die letzte Arbeit richtet Struktur und Zusammenarbeit ein, ändert keine Produktlogik. Backlogstatus bleibt offen, solange die jeweilige vollständige Abnahme fehlt. Keine gemessenen Personenstunden aus einer Schätzung ableiten. Kontext-, Struktur- und Backlogänderungen gemeinsam mit der zugehörigen Arbeit aktualisieren.
