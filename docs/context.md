# OrthoSohle – Projektkontext und aktueller Stand

Aktualisiert: 20.10.2026. Mit [AGENTS.md](../AGENTS.md) lesen; Details über die Quellen unten nachladen. Nur OrthoSohle, keine allgemeine Projektvorlage.

## Ziel, Prioritäten und Rahmen

OrthoSohle soll eine vorgegebene Teilbelastung als kalibrierte kg-Belastung kontrollierbar machen. Ein eigenständiges Armband soll aktuelle Werte anzeigen, lokal eine persistente Grenze prüfen und bei Überschreitung vibrieren. Warnung unabhängig von Smartphone und Internet. Fehlende, ungültige oder veraltete Werte brauchen einen klaren Störungsstatus; sie sind kein sicherer Nullwert.

Prioritäten: **Armband zuerst, Web-App danach**, Integration und Abschluss laufend berücksichtigen. Bestehende Sohle als Datenquelle nutzen; nur notwendige Mess-/Kommunikationskorrekturen, kein Sensor-Redesign. Smartwatch nur begrenzter PoC nach Kapazität. Forschungs-/Beta-Prototyp; vollständige Beinlast, Genauigkeit und klinische Sicherheit sind nicht nachgewiesen.

Zwei Personen, 15.10.2026–28.01.2027: 600 echte Personenstunden. Normierte 300-Stunden-Sicht: Armband 135, App 90, Planung 30, Integration 30, Hausarbeit/Media Night 15. Abschlussbudget knapp. Hochschulanforderungen, Abgabetermin und separates Media-Night-Datum noch bestätigen. Vorgeschlagene Meilensteine: 20.11. Tischprototyp, 18.12. lokale Warnung, 12.01. integrierte Sitzung, 21.01. Stabilisierung; keine bestätigten Hochschultermine.

## Tatsächlich verfügbar

- [Codegrundlage](../code/README.md): unveränderter ZIP-Stand unter code/orthopaul, 51 Dateien mit Herkunft/Prüfsummen. Vue/Vite/Bootstrap/Chart.js; Express/SQLite; ArduinoBLE/HX711-Sketch. Kein ursprünglicher GitLab-Commit enthalten.
- Web-Referenz: BLE-Auswahl, Livechart, Smartphonewarnung, Konfiguration, Simulation, Schritt-/Peak-Erkennung, Historie und Lauf-Feedback.
- Neue Armband-/Web-/Backendmodule noch nicht implementiert. Es gibt keine Platzhalter-Codebereiche mehr; nur tatsächliche Quelldateien und Arbeitsunterlagen.
- [Backlog](backlog.csv): 57 geschätzte Aufgaben mit Priorität, Abhängigkeiten und Abnahme. C01 ist mit dokumentierter Quelle, Inventar und Stack abgenommen; alle übrigen Aufgaben sind offen, Verantwortliche noch zuordnen. Die Schätzungen sind keine geleisteten Stunden.

## Hardwarebestand – aktuell noch zu prüfen

Historisch laut Hausarbeit: Arduino Nano 33 BLE, HX711, KERN CK 30-Y1 und PowerBoost. Aktuelle Boardrevision, Versorgung, Verkabelung, geflashter Sketch und Bibliotheksstände sind unbekannt. Der Sketch definiert DOUT 2/SCK 3; das ist kein Nachweis des realen Aufbaus. Armbandkomponenten sind nicht ausgewählt.

**Nächste Erhebung C03:** tatsächliche Teile/Revisionen, Pins/Spannungen, Fotos bzw. Beobachtungsquelle, verfügbare Testgeräte und Firmwareversion hier ergänzen. Eigene Hardwaredateien erst anlegen, sobald echte umfangreichere Unterlagen entstehen. Keine historischen Angaben als aktuelle Bestandsliste übernehmen.

## Bekannte technische Lücken und Entwurfsrichtung

- Firmware begrenzt oberhalb ihres Kalibrierbereichs auf 25 kg; Überbereichsstatus fehlt. 15 HX711-Messungen plus 200-ms-Pause ergeben keine belegten 5 Hz.
- Fersensensorik erfasst die Gesamtbeinlast beim Abrollen nicht nachweislich. In der Hausarbeit berichtete statische Abweichungen ca. 0,1–0,6 kg sind keine allgemeine Genauigkeitszusage.
- Limit-API liefert ein verschachteltes Objekt statt Zahl. BLE-Ereignisse werden nicht gespeichert, Simulation speichert Rohwerte als Peaks.
- Auth/Besitzprüfung, vollständige Geräte-/Sitzungszuordnung und Offline-Synchronisierung fehlen. Browser-/Push-Warnung ist keine gesicherte unabhängige Warnkette.
- Entwurfsrichtung: Sohle → BLE → Armband mit lokaler Warnung → optional Gateway → authentifizierte API → Datenbank/Web. Gleichzeitige BLE-Rollen, Upload und bestätigte Grenzwertsynchronisierung müssen nachgewiesen werden. Vorhandenen Vue-/Express-Stack möglichst erhalten; UI, Transport, Fachlogik und Speicherung trennen.
- Noch offen: Messrate, BLE-Topologie, Gateway, Armband-BOM/Ladung/Gehäuse, Auth/Hosting, Hardwarebudget und Watch-Testplattform. Vor endgültiger Auswahl prüfen und konkret besprechen.

## Wissen und Nachweise abrufen

| Gesuchte Information | Maßgebliche Datei |
|---|---|
| Arbeitsablauf, DRY/Ponytail, Git und Dokumentationspflege | [AGENTS.md](../AGENTS.md) |
| Codepfade, Installations-/Startbefehle und Grenzen | [code/README.md](../code/README.md) |
| Aufgaben, Status, Verantwortliche, Aufwand und Abnahme | [backlog.csv](backlog.csv) |
| Ausführliche Ist-/Gap-Analyse, Architektur und Semesterplan | [analysis.md](analysis.md) |
| Relevante Beschlüsse und Gründe | [decisions.md](decisions.md) |
| Historischer Testkontext und HTTP-Ergebnisse | [checks/baseline.md](checks/baseline.md), [api-results.json](checks/api-results.json) |
| Originalkontext, Hausarbeit und Ponytail-Quelle | [sources/README.md](sources/README.md) |

Referenzprüfungen 20.10.: Produktionsbuild inkl. Service Worker und isolierter Backendstart erfolgreich; Limit-Fehler und ungeschützte Zugriffe reproduziert. Zwei synthetische Detektorsequenzen erkannten Peaks, keine Gangvalidierung. Nach der Ordnerbereinigung wurden Installation aller drei npm-Projekte, Frontend-Produktionsbuild und gemeinsamer Frontend-/Backend-Dev-Start in einer isolierten Linux-Kopie erneut geprüft; keine neue Produktfunktion implementiert. Ungeprüft: Hardware, Firmwarekompilierung, reale BLE-Verbindung, Akku, Warnlatenz, Hintergrundverhalten und aktuelle Deployments.

## Übergabe und unmittelbar nächste Arbeit

Die bisher spekulativen Apps-/Firmware-/Hardware-/Vertrags-/Testordner wurden entfernt. Tatsächlicher Code steht unter code/, Wissen unter docs/, Werkzeuge unter scripts/. Doppeltes Quellinventar und generierte Backlogansicht entfallen; CSV und Manifest sind jeweils maßgeblich. Originalquellen und alle 51 Quelldateien bleiben erhalten. Repo-Checks und zugehörige Tests vor jedem Abschluss ausführen, Ergebnis im Abschlussbericht nennen.

**Jetzt startklar:** C03 Hardwarebestand anhand realer Beobachtungen erfassen; konkreter Auftrag und Abnahme in der Root-README. Danach C05 BLE-Rollen prüfen. Unabhängig möglich: C02 einen echten Codebereich reproduzierbar migrieren, danach B01–B03 Datenfehler beheben. Für diese Arbeiten nötige fehlende Hardwareinformationen erfragen; keine Firmware/Bauteilwahl erraten.

## Git und Zusammenarbeit auf mehreren Geräten

Lokaler Arbeitsbranch bei Einrichtung: work; origin vorhanden. Gewünschte GitHub-Zentrale noch nicht verbunden, Ziel-URL/Zugang fehlen. Keine Pushes/Merges/Remote-Wechsel oder verifizierte CI/Branchschutzregeln. Git ist für aktuellen Commit und lokale Änderungen maßgeblich.

Nach tatsächlicher GitHub-Einrichtung: jeden PC separat klonen, Root-README/AGENTS/Kontext lesen und Voraussetzungen prüfen. Nur Commit + Push und Clone/Pull synchronisieren versionierte Dateien. Chat, lokale DB, Secrets, Pakete, Pairings und laufende Prozesse kommen nicht mit. Vor Pull eigenen Status prüfen, passenden Branch fetch/pull --ff-only; bei Divergenz nichts verwerfen/erzwingen. Ohne erfolgreichen Fetch keine Remote-Aktualität behaupten.
