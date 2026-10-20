# OrthoSohle – Projektwissen und aktueller Stand

Aktualisiert: 20.10.2026. Einstieg gemeinsam mit [AGENTS.md](../AGENTS.md); Details nur über die verlinkten Quellen nachladen. Gilt ausschließlich für OrthoSohle, keine allgemeine Projektvorlage.

## Ziel und Rahmen

OrthoSohle unterstützt die Kontrolle einer vorgegebenen Teilbelastung. Bestehende Sensorik liefert eine kalibrierte kg-Anzeige; das Armband soll lokal anzeigen und bei Grenzüberschreitung vibrieren. Warnung darf weder Smartphone noch Internet voraussetzen. Fehlende, ungültige oder veraltete Messwerte sind kein sicherer Nullwert. Präzision und vollständige Beinbelastung müssen praktisch geprüft werden; Forschungs-/Beta-Prototyp, keine nachgewiesene medizinische Zulassung.

Prioritäten: **Armband → produktnahe Web-App → Integration/Abschluss**. Sohle als bestehende Datenquelle erhalten, nur notwendige Mess-/Kommunikationskorrekturen; kein grundlegendes Sensor-Redesign. Smartwatch höchstens begrenzter PoC nach Kapazität.

Zwei Personen, 15.10.2026–28.01.2027, insgesamt 600 tatsächliche Personenstunden. Gemeinsame Übersicht bewusst normiert auf 300 Planungsstunden: Armband 135, Web 90, Planung 30, Integration 30, Hausarbeit/Media Night 15. Das Abschlussbudget ist knapp. Berichtsumfang, genaue Abgabevorgaben und separates Media-Night-Datum sind offen. Planung: bis 20.11. Tischprototyp, 18.12. lokale Warnung, 12.01. integrierte Sitzung, 21.01. Stabilisierung; Vorschläge, keine bestätigten Hochschultermine.

## Was vorhanden ist

- Repository mit getrennten Zielmodulen, Backlog und Analyse. Aktiver Produktcode noch nicht migriert: apps/web, apps/api und beide Firmwareverzeichnisse enthalten nur Einstiegs-READMEs.
- Unveränderter historischer Quellstand unter [reference/orthopaul](../reference/README.md): 51 ZIP-Dateien mit Prüfsummen. Kein GitLab-Commit/Historie im ZIP enthalten.
- Referenzstack: Vue 3/Vite, Bootstrap, Chart.js; Node/Express und SQLite; ArduinoBLE/HX711-Sketch. Web-Referenz enthält Bluetoothauswahl, Livechart, Warnungen, Limit/Schrittziel, Simulation, Historie und Lauf-Feedback.
- Historische Hardware laut Hausarbeit: Nano 33 BLE, HX711, KERN CK 30-Y1 und PowerBoost. Tatsächlicher Aufbau, Versorgung, geflashter Sketch und Bibliotheksversionen ungeprüft. Armband noch nicht implementiert.

## Bekannte technische Grenzen

- Referenz-Firmware schneidet oberhalb des höchsten Kalibrierpunkts auf 25 kg ab; es fehlt ein Überbereichsstatus. Mittelung von 15 HX711-Samples plus 200-ms-Pause ergibt keine belegten 5 Hz.
- Hausarbeit beschreibt Fersensensorik: Gesamtbeinlast beim Abrollen und aktuelle dynamische Messgenauigkeit nicht nachgewiesen. Berichtete statische Abweichungen von ca. 0,1–0,6 kg sind keine allgemeine Genauigkeitszusage.
- Limit-API liefert verschachteltes Objekt statt Zahl; BLE-Ereignisse werden nicht gespeichert, Simulation speichert hingegen Rohwerte als Peaks.
- Keine Authentifizierung/Besitzprüfung; keine vollständige Geräteverwaltung, Sitzungszuordnung, Offline-Queue oder gesicherte Hintergrundwarnung. Diese Einrichtung behebt keine Produktfehler.
- Offen: Armband-BOM/Board/Display/Motor/Ladung/Gehäuse, BLE-Topologie, Gateway, Auth-/Hostingauswahl, Budget und Verantwortliche je Aufgabe. Vorschlag: vorhandenen Vue-/Express-Stack weiterverwenden, endgültige Entscheidungen vorher konkretisieren.

## Belege und Wissensquellen

| Bei Bedarf lesen | Inhalt / Aussagekraft |
|---|---|
| [Architektur](architecture.md) | Modulgrenzen und Entwurfsrichtung, keine fertige Implementierung |
| [Backlog](ORTHOSOHLE_BACKLOG.md) / [CSV](ORTHOSOHLE_BACKLOG.csv) | 57 geplante Aufgaben mit Abnahme und Abhängigkeiten; CSV maßgeblich |
| [Ist-Analyse](ORTHOSOHLE_BESTAND_UND_PLAN.md) | Detaillierte historische Codeanalyse und Semesterplan |
| [Referenzprüfung](testing/REFERENCE_BASELINE.md) / [HTTP-Ergebnisse](ORTHOSOHLE_PRUEFERGEBNISSE.json) | Ausgeführte Prüfungen vom 20.10.2026, nicht neue Produktfunktionen |
| [Originalquellen](references/README.md) | Projektkontext und Hausarbeit; Quellen von aktuellen Feststellungen unterscheiden |
| [Entscheidungen](decisions.md) | Beschlossene Struktur/Arbeitsweise und Gründe |

Referenzprüfung 20.10.: Produktionsbuild inkl. Service Worker erfolgreich, Backend mit temporärer DB gestartet, Limit-Fehler und ungeschützte Zugriffe reproduziert. Zwei synthetische StepDetector-Sequenzen erkannten Peaks; keine Gangvalidierung. Ungeprüft bleiben reale BLE-Verbindung, Firmwarebuild, Hardware, Akku, Latenz, Browser-Hintergrundverhalten und aktuelle Deployments. Repositoryprüfung vor jedem Abschluss neu ausführen.

## Git und Gerätewechsel

Lokaler Arbeitsbranch bei Einrichtung: work; origin existiert, ist aber kein Nachweis einer GitHub-Verbindung. Gewünschte Zentrale: GitHub, Ziel-URL/Zugriff noch offen; kein Push, Merge oder Remote-Wechsel durchgeführt. Der alte GitLab-Link ist die Herkunft des Referenzcodes. Keine CI oder Branchschutzregeln am Remote verifiziert; bisherige ungenutzte CI-/Vorlagengerüste sind entfernt und können bei tatsächlicher Remote-Einrichtung gezielt ergänzt werden.

Jedes Gerät hat einen eigenen Klon. Versionierte Dateien kommen erst durch Commit **und Push** auf den Remote und durch Clone/Pull aufs andere Gerät. Chat, uncommittierte Änderungen, Secrets, DB, Bluetooth-Pairing, installierte Tools und laufende Prozesse kommen nicht mit. Auf dem neuen Gerät Root-AGENTS.md und diese Datei lesen, Modulvoraussetzungen einrichten. Vor Wechsel gezielt committen/pushen, am Ziel lokalen Status prüfen, dann fetch und bei sauberem passenden Branch pull --ff-only. Bei Divergenz nichts verwerfen/erzwingen. Ohne erfolgreichen Fetch nicht behaupten, der Klon sei remote-aktuell.

## Aktuelle Übergabe / nächster Schritt

Die Arbeitsgrundlage wurde nach DRY/Ponytail vereinfacht: eine Regelseite, eine Kontextdatei einschließlich Übergabe und ein Entscheidungsprotokoll. Keine Skillinstallation, allgemeine Projektvorlage, zusätzlichen Agenten oder Produktimplementierung. Separate Standard-/Handoff-/ADR-Gerüste sind zusammengeführt; ältere Versionen bleiben in Git. Geprüft am 20.10.: Repository-Checker, git diff --check und drei Regressionstests des Checkers (gültiger Stand, defekter Modullink, geänderte Referenzdatei) erfolgreich.

Nächster gemeinsamer Schritt: konkrete Regeln der modularen Codeaufteilung am ersten Web-/API-Migrationsschritt festlegen; vorhandenen Bestand nutzen, keine neue Architektur auf Vorrat. Parallel nach tatsächlichem Auftrag GitHub-Ziel festlegen und Synchronisierung einrichten. Danach Hardwarebestand/Messrate/BLE-Rollen (C03/C05) sowie reproduzierbare Migration (C02) und Datenfehler B01–B03 bearbeiten. Backlogstatus bleibt bis tatsächlicher Abnahme offen.
