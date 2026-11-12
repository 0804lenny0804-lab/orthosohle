# OrthoSohle 2.0 – Bestandsaufnahme, Architektur und Semesterplan

Hinweis zur späteren Struktureinrichtung: Der analysierte Quellstand ist inzwischen dauerhaft und unverändert unter `context/legacy/orthopaul/` im Repository gesichert. Die folgende Bestandsaufnahme beschreibt den damaligen Analysezeitpunkt; der aktuelle Stand steht in `context/context.md`.

Stand: 20. Oktober 2026. Grundlage: vollständig gelesene ORTHOSOHLE_CODEX_CONTEXT.md, orthopaul-main.zip und extrahierter Text der Hausarbeit vom 15. Februar 2026. Der PDF-Text wurde inhaltlich herangezogen; Abbildungen, Schaltbilder und deren elektrische Details wurden nicht visuell verifiziert. Anforderungen stammen aus dem damaligen Auftrag und Kontext. Anweisungen und Musterbefehle in Repository/Anhängen wurden als Dokumentinhalt behandelt, insbesondere wurde der Force-Push aus der Template-README nicht ausgeführt. Der Datenweg- und Gatewayentwurf in Abschnitt 6 wurde am 12.11.2026 durch die Nutzerentscheidung Sohle→Armband direkt und Armband→Backend selbst über WLAN/TLS abgelöst; siehe [aktuelle Anforderungen](requirements.md) und [Entscheidung](decisions.md).

## 1. Aussagekraft und Ausgangsstand

Die ZIP enthält 51 Dateien (602.898 Bytes unkomprimiert), jedoch keine Git-Historie. Branchname im ZIP-Namen ist kein Beleg für aktuellen GitLab-Stand oder Commit. Quellcode liegt separat unter `/workspace/reference/orthopaul-main`; das Arbeitsrepository `/workspace/orthosohle` enthielt zuvor nur eine README. Der Referenzcode wurde nicht in die neue Anwendung übernommen oder fachlich verändert. Installation und Build erzeugten lediglich node_modules/dist im Referenzordner. Kein Hardwarezugriff, kein klinischer Nachweis und kein Test des bestehenden öffentlichen Deployments.

**Ergebnis:** Ein substanzieller Einzelbenutzer-Webprototyp existiert. Das Armband ist noch nicht implementiert. Der Code eignet sich als Weiterentwicklungsbasis, benötigt aber zuerst Korrekturen der Messwertpersistenz, Grenzwert-API und Datenzuordnung. Eine vollständige Neuschreibung ist aus dem vorliegenden Stand nicht begründet.

## 2. Ist-/Gap-Analyse

| Bereich | Im Code vorhanden | Fehlend oder unvollständig |
|---|---|---|
| Sohlen-Firmware | ArduinoBLE, HX711 an DOUT 2/SCK 3, Mehrpunktinterpolation, kg-Float per BLE | Reproduzierbarer Firmware-Build, aktuelle Board-/Lib-Versionen, Status/Sequenz/Gerätezeit, Überbereich, Sensor-Timeout, rekonfigurierbare Kalibrierung |
| BLE | Eigenes Service und Characteristic, READ/NOTIFY, Browser-Pairing, Verbindungsanzeige | Validierung von Länge/NaN/Bereich, Datenalter, globaler Verbindungsstatus, automatische Wiederverbindung, nachgewiesene Mehrfachverbindung |
| Armband | Keine Armband-Firmware, BOM oder Gehäusedateien | Vollständiges Gerät inklusive Display, Warnlogik, Akku, Bedienung und Gehäuse |
| Live-Web-App | Vue-Komponenten, Bootstrap, Chart.js, kg-Anzeige in Bluetoothansicht, Verlauf und Grenzlinie | Zentrale aktuelle kg-Anzeige mit gültig/stale/gestört, garantierter Warnpfad, konsequente Zustandsführung |
| Warnung | Toast, navigator.vibrate, Notifications, Web-Push-Code | Unabhängigkeit von Browser und Smartphone, Hysterese, abgesichertes Fehlerverhalten |
| Konfiguration | Limit und Schrittziel in SQLite/LocalStorage | API-Vertrag korrekt auslesen, echte Offline-Synchronisierung, lokaler Armbandwert und bestätigte Übertragung |
| Persistenz | SQLite-Tabellen für Peaks, Schritte, Läufe, Limits, Einstellungen, Push | BLE-Ereignisupload, Nutzer-/Geräte-/Sitzungszuordnung, Messverlauf je Sitzung, Migrationen |
| Historie | Zeitfilter, Peak- und Schrittchart, Durchschnitt, Ausreißer, Läufe/Feedback | Fachlich korrekte Datenbasis, Grenzwert am Zeitraumstart, echte Überschreitungsstatistik |
| Konten | Teilweise user_id, häufig fest 1 | Registrierung, Login, Logout, Reset, Profil, Sessions, serverseitige Autorisierung |
| Geräteverwaltung/Watch | Browser-Geräteauswahl | Persistente Geräteverwaltung und Smartwatch-Client |
| PWA/Deployment | Manifest, eigener Service Worker, Vercel-Origin und Railway-Konfiguration | Geprüfte Browsermatrix, belastbarer Offline-Upload, Umgebungsdokumentation, reproduzierbares Deployment |
| Qualität | Lockfiles, erfolgreicher Produktionsbuild | Test-Suite, CI, Projekt-README, dokumentierter Firmware-Build und Betriebschecks |

## 3. Bestehende Architektur

```text
HX711 → Arduino-Sketch: Kalibrierung → BLE Float32 (4 Byte, little endian)
  → Bluetooth.vue → App.vue.onRawValue
      → rawValues (max. 300) → LiveChart / Toastwarning
      → StepDetector → Schrittzähler / lokale Peakliste (max. 20)

SimulationControl.vue → gleicher Live-Eingang
                     → zusätzlich JEDER Rohwert als POST /api/peaks

Vue/axios → Express REST → SQLite
  Historie, Grenzwerte, Schrittziel, Laufstart/-ende und Feedback
Express → Web-Push; täglicher Cronjob
Socket.IO vorhanden, aber kein implementierter Messwert-Datenstrom
```

Frontend: Vue 3.5, Vite 7, Bootstrap 5, Chart.js 4, Axios. Backend: Node/Express 5, sqlite/sqlite3, web-push, node-cron, Socket.IO. Zusätzlich better-sqlite3 installiert, jedoch im Anwendungscode nicht verwendet. Root-Startskript nutzt concurrently/nodemon; keine npm-Workspaces. Unter local-comm liegt ein weiteres Lockfile ohne package.json. README ist größtenteils GitLab-/Vue-Vorlage. Firmware liegt sachfremd unter frontend/src/components.

SQLite ist für einen kleinen Beta-Betrieb zunächst ausreichend, sofern Besitzmodell, Backups, Migrationen und Deployment mit persistentem Volume sauber umgesetzt werden. Ein Wechsel auf PostgreSQL oder ein anderes Frontend ist aktuell keine notwendige Vorbedingung. Auth-Auswahl nach Hosting und Teamkenntnissen; etablierte Bibliothek/Provider verwenden.

## 4. Technische Befunde, priorisiert

### P0 – Messgrenzen und Warnkette

1. **Messwert wird bei 25 kg abgeschnitten.** `arduinocode.ino:19,34`: höchster Kalibrierpunkt 25 kg; größere Rohlast wird als exakt 25 kg zurückgegeben. Bei Limit 25 kg löst `val > limit` dann auch bei höherer Last keinen Alarm aus. Oberhalb des belegten Bereichs muss ein expliziter Überbereich gelten; keine erfundenen Kalibrierpunkte ergänzen. Betrifft notwendige Schnittstellenkorrektur, kein Sensor-Redesign.
2. **Gesamtbeinbelastung nicht nachgewiesen.** Die Hausarbeit beschreibt Fersensensorik und vernachlässigte Vor-/Mittelfußkräfte (S. 39). Eine kg-Kalibrierung des Sensors belegt keine vollständige vertikale Beinlast beim Abrollen. Bestehenden Prototyp nutzen, aber diese Grenze als Abnahmerisiko führen. Falls Vergleichstests scheitern, Demonstrationsumfang transparent begrenzen und Aufwand/Scope neu entscheiden; nicht stillschweigend die Kernanforderung ersetzen.
3. **5 Hz sind nicht nachgewiesen.** `read_average(15)` läuft vor `delay(200)`. Bei blockierendem HX711-Lesen kommen die Erfassungszeiten zur Pause hinzu. Bei 10 Samples/s wären rechnerisch etwa 1,7 s/Zyklus, bei 80 Samples/s etwa 0,39 s, jeweils zuzüglich Aufwand. HX711-Modus und Bibliotheksversion fehlen; reale Rate messen. Hardwareseitige Mittelung kann kurzzeitige Spitzen zusätzlich abschwächen.
4. **Keine globale Ausfallanzeige.** Bluetooth.vue setzt beim Disconnect nur seine eigene kg-Anzeige auf null. App.vue und Charts behalten Daten; ein Timeout bei noch verbundener, aber schweigender Sohle fehlt. Empfangsdaten werden ohne Längen-/Endlichkeitsprüfung dekodiert. Es gibt keinen nachgewiesenen robusten Hintergrund-Warnpfad. Service Worker und Push allein sichern den fortgesetzten BLE-Empfang bei gesperrtem Smartphone nicht.

### P1 – Produktnahe App und Datenkorrektheit

5. **Keine Authentifizierung/Autorisierung.** API-Aufrufe können Daten lesen, Grenzwerte schreiben, Läufe verändern und Push-Funktionen verwenden. user_id in Request-Parametern ist keine Identität; CORS kein Zugriffsschutz. Peaks, Schritte, Runs und Limit-Historie besitzen keine Nutzer-/Gerätebesitzer. Vor Nutzung mehrerer Konten beide Ebenen korrigieren.
6. **Grenzwert-API liefert falsche Form.** db.get liefert `{limit_value:20}`; server.js:170 verschachtelt das erneut. Laufzeittest: `{"limit_value":{"limit_value":20}}`. App.vue erwartet eine Zahl. Nach Neuladen drohen unwirksame Vergleiche/fehlerhafte Grenzlinie. Server soll die Zahl bzw. einen ausdrücklich fehlenden Grenzwert liefern.
7. **BLE-Daten werden nicht persistiert.** App.vue.onPeak aktualisiert nur Browserzustand; keine POSTs für Peaks/Schritte. SimulationControl schickt hingegen jeden Rohwert an /api/peaks. Backend erkennt keine Peaks. Historie mischt damit eine falsche Ereignissemantik; echte Messungen können fehlen. Einheitliche Pipeline und getrennte Quellenkennung einführen.
8. **Läufe sind keine vollständigen Messsitzungen.** Tabellen für Peaks/Schritte besitzen keine run_id. RunFeedbackWindow sendet den globalen Schrittzähler statt der Differenz seit Laufstart. peaksCount ist als Attribut übergeben, aber nicht als Prop verarbeitet/gesendet; Backend verwendet 0. Lokale Messliste ist ohnehin auf 20 begrenzt. Zähler und Sitzungsbezug explizit modellieren.
9. **Offline-Synchronisierung nur angekündigt.** Pending-Flags werden gesetzt, aber kein Wiederholungsmechanismus liest sie aus. Server-Laden kann lokale Änderungen überschreiben. Eigenes injectManifest-SW enthält Precaching/Push, aber keine POST-Outbox; workbox.runtimeCaching in vite.config ersetzt keine Routing-Implementierung im eigenen SW. Queue, Retry, Idempotenz und Konfliktstrategie fehlen.
10. **Historische Auswertung verzerrt.** PeakChart blendet <=12 kg aus; niedrige individuelle Grenzwerte werden dadurch unzureichend abgebildet. Limit-Historie lädt nur Änderungen seit Filterbeginn und kennt den zuvor gültigen Wert nicht. Ausreißer sind `> Durchschnitt × 1,5`, keine Grenzüberschreitungen. Ein pauschaler „optimaler“ Bereich Grenze minus 3 kg ist fachlich nicht begründet und sollte ohne Anforderungsbeleg nicht so bezeichnet werden.
11. **Schritterkennung und Eingangsraten passen nicht belegt zusammen.** smoothN=4, MIN_WINDOW=8, MAX_WINDOW=40; anfangs übergebener threshold=15 wird nicht genutzt. Mindestfenster ist samplebasiert; gleiche Bewegung ergibt bei anderer Frequenz andere Ergebnisse. Direkter JS-Smoke-Test erkannte zwei konstruierte Belastungsverläufe, ist aber keine Gangvalidierung. Warnung unabhängig vom Schrittabschluss auslösen.
12. **Weitere Robustheit:** Server akzeptiert negative Limits; nicht existente Lauf-ID meldet erfolgreiches Beenden. Datenbank wird beim Import vor dotenv.config geöffnet, weshalb SQLITE_DIR aus server/.env zu spät käme; echte Prozessvariable funktioniert. SQL-Indexdatei wird nicht von initDB eingebunden. Fehler bei DB-Init werden geloggt, Server startet trotzdem. Doppelte saveLimit/saveStepGoal-Definitionen außerhalb von methods, fehlende Notification-Feature-Prüfung im Toast-Warnpfad, nicht existierender Notification-Iconpfad und unvollständiges Listener-/Chart-Cleanup erschweren Wartung.

## 5. Hausarbeit und Code unterscheiden

| Hausarbeit | ZIP-Befund / Konsequenz |
|---|---|
| Nano 33 BLE, KERN CK 30-Y1, HX711, PowerBoost 500 | Historisch dokumentierter Aufbau, aktuelle Bestandsliste vor Bestellung prüfen. Text nennt widersprüchlich 5-V-Lithium-Akku und Abbildung 3,7-V-LiPo; tatsächliche Versorgung ermitteln. |
| Kalibrierung bis 30 kg; Abweichungen ca. 0,1–0,6 kg (S. 16) | Sketch nur bis 25 kg. Vergleichswerte sind berichtete Versuche ohne beigefügte Rohreihen/Unsicherheitsanalyse; keine universelle Genauigkeitszusage. |
| Baseline-Detektor mit 400-ms-Refraktärzeit (S. 24–25) | ZIP verwendet idle/collecting, samplebasierte Fenster und Entlastungs-Cooldown. Dokumentation/Quellstand stimmen hier nicht überein. |
| Ereignisbasierte Speicherung erkannter Peaks | BLE-Persistenz fehlt; Simulator speichert Rohwerte. |
| Offline-Pufferung und zuverlässige Warnung bei Display aus | Kein vollständiger Synchronisationspfad im Code; Tests mit einem Pixel sind keine plattformübergreifende Garantie. |
| Cloud-Datenbank als Zukunftsschritt | Server enthält bereits SQLite-Persistenz und Railway-Volume-Konfiguration. Dauerhaftigkeit und aktueller Hostingzustand sind ungeprüft. |

## 6. Zielarchitektur und Entwicklungsplan Armband

```text
Historischer Entwurf vom 20.10.2026 (durch Nutzerauftrag vom 12.11. ersetzt):
Sohle → BLE → Armband → optionaler Browser-Gateway → API
```

Diese damalige Gateway-Alternative ist nicht die gewählte Architektur. Maßgeblich ist nun Sohle→Armband direkt per BLE und Armband→gemeinsames Backend selbst über WLAN/TLS. Gleichzeitigen BLE-/WLAN-Betrieb und Wiederverbindung auf der Zielhardware nachweisen.

Armbandmodule: BLE-Transport; Decoder/Validierung; Messzustand mit monotonic receivedAt; Konfigurationsspeicher; Warnautomat; Display/Bedienung; Motor-Treiber; Energieverwaltung. Zustände mindestens Start, Suche, aktuelle gültige Messung, Überschreitung, Daten veraltet/Verbindung weg, Sensorfehler und Akku kritisch. Fehlende Daten sind kein Nullwert.

Protokollentwurf: Versionskennung, Sequenz, monotone Gerätezeit, kg bzw. dokumentierte Festkommaeinheit, Qualitäts-/Überbereichsflags. Backend speichert zusätzlich Empfangszeit, Geräte-ID und Sitzungs-ID. Ohne Echtzeituhr Gerätezeit nicht als UTC ausgeben. Grenzwertschreiben bekommt Konfigurationsversion und ACK; UI unterscheidet Soll und bestätigten Istwert. Lokal eingegebene Grenze bleibt ohne Internet nutzbar. Vor finaler Auswahl Pin-/Spannungsplan, Motorstrom/Anlaufstrom und Akku-/Ladekonzept prüfen.

1. Hardwarebestand, echte Messrate und Protokoll prüfen; BOM auswählen/beschaffen.
2. Reproduzierbares Firmwareprojekt; Display und Legacy-BLE-Wert auf Tischaufbau.
3. Protokollstatus, lokale persistente Grenze und Motor-Warnung; Warngrenzfälle testen.
4. Ausfallanzeige, Wiederverbindung und Armband-eigener WLAN-/Backendpfad. Der alte Gatewayvorschlag ist historisch.
5. Akku, Strommessung, Gehäuse und Trage-/Bedienversuch.
6. Warnlatenz, Laufzeit und Funkstabilität messen. Konkrete Zielwerte vor Umsetzung vereinbaren; derzeit keine gemessene Zusage.

## 7. Entwicklungsplan Web-App

Vue/Vite/Express zunächst erhalten. Kleine Korrekturen und Messpipeline vor neuen Ansichten. Komponenten weiterverwenden, aber Transport, Messzustand, Sessionverwaltung und API-Aufrufe aus App.vue schrittweise in testbare Module auslagern.

1. Limit-API, Inputvalidierung, klare fehlende/stale Messzustände korrigieren.
2. BLE/Simulation über dieselbe Pipeline mit source=real/demo; Samples, Peaks und Warnereignisse unterscheiden.
3. Schema erweitern: authentifizierte Nutzer, Gerätebesitz, Sessions, Messdaten/Ereignisse, angewendete Grenzwertversion. Unzugeordnete Altdaten nicht automatisch beliebigem neuen Konto zuschlagen.
4. Etablierte Auth-Lösung; Registrierung/Login/Logout, Reset und Profil. Serverseitige Session-/Besitzprüfung für sämtliche Daten- und Push-Routen; zwei Nutzer gegeneinander testen.
5. Geräteverwaltung und Armband-Upload integrieren. Keine Aussage „synchronisiert“, bevor dauerhafte Geräte-/Serverbestätigung eingegangen ist.
6. Aktuelle kg-Anzeige, Status und Sitzungsverlauf vervollständigen; historische Grenzen korrekt zuordnen. Minimaler Trendverlauf und Grenzüberschreitungen müssen pro Sitzung wiederabrufbar sein, nicht nur eine Laufzusammenfassung.
7. Upload-Outbox, Duplikatschutz und Konfliktbehandlung; mobile/PWA-Fehlerzustände; Testdeployment mit TLS, Backup/Restore und Datenlöschung.
8. Eine Watch-Plattform anhand realer Testhardware auswählen. Begrenzter PoC für Anzeige/Datenweg, Erweiterungsarchitektur dokumentieren. Keine zweite unabhängige Warnkette versprechen.

## 8. Stunden, Arbeitsteilung und Termine

| Paket | Planungsstunden | Tatsächliche Personenstunden |
|---|---:|---:|
| A Armband | 135 | 270 |
| B Web-App | 90 | 180 |
| C Analyse/Planung | 30 | 60 |
| D Integration | 30 | 60 |
| E Hausarbeit/Media Night | 15 | 30 |
| Gesamt | 300 | 600 |

Zwei Personen mit je 300 Stunden, nicht 300 Stunden zusammen. Über 15 Wochen entspricht das etwa 20 Personenstunden pro Person/Woche; Weihnachtszeit und bisher verbrauchte Stunden anhand echter Zeiterfassung berücksichtigen. Person 1 führt Armband, Person 2 Web-App; Hardware/BLE-Spike und Integration gemeinsam. Bei paralleler Arbeit echte Einzelzeiten erfassen.

| Zieltermin | Reviewbares Ergebnis |
|---|---|
| 31.10.2026 | Bestand, Builds, Messplan, Rollen, offene Hochschulanforderungen und Aufwand abgestimmt |
| 20.11.2026 | BLE-/Display-Tischprototyp; BOM beschafft; Topologie nachgewiesen; Web-Datenfehler eingegrenzt/korrigiert |
| 18.12.2026 | Lokale Warnung, persistente Grenze und Fehlerstatus am Armband; Konten-/Datenbasis; früher Ende-zu-Ende-Versuch |
| 12.01.2027 | Tragbarer Akkuprototyp; nutzerbezogene Messsitzung bis Web-Verlauf; Watch nur nach Kapazität |
| 21.01.2027 | Kritische Tests abgeschlossen, Grenzen dokumentiert, Demo-Stand eingefroren |
| 28.01.2027 | Projektabschluss, Hausarbeit und Vorführmaterial fertig; Media-Night-Termin gesondert bestätigen |

Das Abschlussbudget von 30 Personenstunden ist riskant. Berichtsgliederung und Belegsammlung beginnen im Oktober; relevante Testprotokolle entstehen im jeweiligen Paket. Das ersetzt nicht die Abschlussarbeit. Sobald Umfang/Abgabetermin bekannt sind, E neu schätzen. Erste Kürzungen: Smartwatch-PoC, zusätzliche Push-/Score-Funktionen, optischer Zusatzumfang. Sohlendesign, Mehrplattform-Watch und Therapeutenportal gehören nicht in den Kernumfang. Demo braucht klar gekennzeichnete Testdaten als Fallback, Stromversorgung, Kurzpitch und wiederholbare Probe.

## 9. Prüfung und nächste Schritte

Erfolgreich durchgeführt:
- Frontend-Abhängigkeiten aus Lockfile installiert; `npm run build` einschließlich Service Worker erfolgreich mit Node 24.19.0. Der erste Installationsversuch scheiterte am nicht schreibbaren Standardcache; mit Workspace-Cache erfolgreich, kein Quellcodeproblem.
- Backend-Abhängigkeiten installiert; Server mit isolierter temporärer SQLite-Datenbank gestartet und beendet.
- Lokale HTTP-Checks: Limit schreiben/lesen, negativen Grenzwert akzeptiert, Peak ohne Anmeldung speichern/lesen, Lauf ohne Anmeldung starten, nicht existierenden Lauf scheinbar erfolgreich beenden.
- StepDetector direkt mit zwei synthetischen Sequenzen ausgeführt; beide lieferten einen Peak. Nur Funktions-Smoke-Test, keine Genauigkeits-/Ganganalyse.

Nicht geprüft: echte Sohle/Armband, Firmwarekompilierung (keine festgelegte Board-/Bibliothekskonfiguration), BLE-/Browserlaufzeit, reale Hintergrundwarnung, Akkulaufzeit, öffentliche Deployments. Keine bestehende Test-Suite vorhanden; npm test im Backend ist ein absichtlich fehlschlagender Platzhalter. Kein Dependency-Sicherheitsaudit durchgeführt.

Die konkreten HTTP-Ergebnisse sind in `context/checks/api-results.json` abgelegt. Der Backlog in `context/backlog.csv` enthält 57 Aufgaben mit Abnahme, Abhängigkeiten und exakt 300/600 Stunden. Priorisierte nächste Schritte: Quellstand sichern, tatsächliche Hardware feststellen, reale Zykluszeit/Überbereich messen, BLE-Topologie nachweisen; parallel Grenzwert-API und Messwertpersistenz korrigieren. Erst anschließend endgültige Komponenten-/Hostingentscheidungen treffen.

## 10. Messpfad und Speicherabschätzung (10. November 2026)

### Belegter Pfad und Grenzen der Aussage

Der analysierte Legacy-Sketch unter `context/legacy/orthopaul/local-comm/frontend/src/components/arduinocode.ino` ruft `scale.read_average(15)` auf, wandelt den Wert in kg um und schreibt ihn mit `BLEFloatCharacteristic` als Float32 an eine BLE-Characteristic. Danach folgt `delay(200)`. Die Web-BLE-Seite (`.../src/components/Bluetooth.vue`) liest mit `getFloat32(0, true)`, also 4 Byte little-endian, und vergibt den Zeitstempel erst beim Empfang mit der Smartphone-Uhr. Die aktive Frontend-Komponente (`.../src/App.vue`) hält bis zu 300 empfangene Werte im Arbeitsspeicher; `onPeak` hält lokal höchstens 20 erkannte Peaks. Für echte BLE-Messwerte ist in diesem Pfad kein dauerhafter Upload belegt. Die Legacy-API schreibt unter `/api/peaks` dagegen `peak_value`, ISO-Zeitstempel und `day` in `step_loads`; dies ist kein Sample-Verlauf. Diese Befunde beschreiben allein den archivierten Prototyp, nicht eine aktuelle Geräteverbindung.

**10 Hz ist eine Rechenannahme, keine belegte Senderate.** 200 ms Verzögerung ergäben idealisiert höchstens 5 Zyklen/s, noch ohne `read_average(15)`, BLE und Programmlaufzeit. Das Lesen blockiert potenziell. Die tatsächliche Rate kann aus dem Sketch daher nicht abgeleitet werden. Zudem enthält das bestehende Protokoll weder Sequenznummer noch Gerätezeit noch Qualitäts-/Lückenflag; ein Empfangszeitstempel beweist weder Messzeitpunkt noch Vollständigkeit. Die 10-Hz-Szenarien unten sind ein hypothetischer Vergleich, z. B. für späteres Protokoll oder Hardware mit bestätigter Rate.

### Rechenmodell

Gezählt werden dezimale Bytes (1 MB = 1.000.000 Byte), ohne Datenbankseiten, Indizes, Transaktionsjournal/WAL, Metadaten, HTTP/BLE-Transport-Overhead oder Sicherungskopien. Für den belegten Messpayload gilt 4 Byte pro Sample. Für Vergleiche eines vollständigen, rekonstruierbaren Verlaufs wird zusätzlich ein **angenommenes logisches Recordformat von 13 Byte/Sample** gerechnet: Float32 kg (4), monotone Zeit in Millisekunden (4), Sequenznummer (4), Flags (1). Das ist ein Rechenformat, kein vorhandenes Schema und keine Vorhersage der SQLite-Dateigröße. Zeitbasis, Sequenzumlauf, Einheiten und Flags wären vor Implementierung festzulegen.

Bei hypothetischen 10 Samples/s entstehen 36.000 Samples/h. Vollständiger Rohpayload benötigt damit 10 × 3600 × 4 = 144.000 Byte/h; der angenommene Datensatz 10 × 3600 × 13 = 468.000 Byte/h.

| Hypothetische Sitzungsdauer | Samples | Float32-Payload (4 B/Sample) | Logische Datensätze (13 B/Sample) |
|---|---:|---:|---:|
| 1 Stunde | 36.000 | 144.000 B (0,144 MB) | 468.000 B (0,468 MB) |
| 8 Stunden | 288.000 | 1.152.000 B (1,152 MB) | 3.744.000 B (3,744 MB) |
| 24 Stunden | 864.000 | 3.456.000 B (3,456 MB) | 11.232.000 B (11,232 MB) |

Skalierung bei achtstündigen Sitzungen (nur logische Records, keine SQLite- oder Indexprognose):

| Nutzer × Sitzungen | Datensätze | Logische Recordbytes |
|---|---:|---:|
| 1 Nutzer × 1 Sitzung | 288.000 | 3.744.000 B (3,744 MB) |
| 100 Nutzer × je 10 Sitzungen | 288.000.000 | 3.744.000.000 B (3,744 GB) |
| 1.000 Nutzer × je 10 Sitzungen | 2.880.000.000 | 37.440.000.000 B (37,44 GB) |

Die lineare Rechnung lautet Nutzer × Sitzungen/Nutzer × Stunden/Sitzung × 3600 × Samples/s × Bytes/Sample. Bei tatsächlichen 5 Hz halbieren sich alle sampleabhängigen Ergebnisse; bei 1 Hz sind es ein Zehntel der 10-Hz-Rechnung. Das ändert nicht die Notwendigkeit, Peaks, Gaps und Sitzungszuordnung korrekt zu erfassen.

Ein hypothetischer Offlinepuffer mit demselben 13-Byte-Format benötigt bei 10 Hz 11.232.000 B (11,232 MB) je 24 h oder 78.624.000 B (78,624 MB) je sieben Tage, zuzüglich Queue-/Dateisystem-/Wiederholungsmetadaten. Nur die 4-Byte-Werte wären 3.456.000 B/Tag. Fehlende Verbindung, Wiederholung und Duplikatschutz müssen im Protokoll und in der Synchronisierung abgedeckt werden; Zeitstempel beim späteren Upload dürfen Lücken nicht verdecken. Diese Zahlen sind lokale Puffernutzdaten, keine gemessene Gerätespeichergrenze.

### Speicheroptionen und Datenverlust

| Variante | Kapazitätsmodell bei 10 Hz | Erhaltene Information / Risiken |
|---|---|---|
| Vollständiger Verlauf | Obergrenze der oben gerechneten logischen Records: 13 B/Sample. Alternativ 4 B/Sample allein für kg-Werte, dann fehlen Zeit, Sequenz und Status im Payload. | Bewahrt alle aufgenommenen Abtastwerte und erlaubt spätere Neuberechnung. Benötigt ein Protokoll mit Sequenz, Gerätezeit und Status, explizite Sitzung/Gerät/Nutzerzuordnung, dauerhaften lokalen Puffer und idempotenten Upload. Eine aufgezeichnete Folge kann trotzdem physikalische Spitzen verpassen, falls Sensor-/Senderate zu niedrig oder HX711-Mittelung glättend ist. Lücken sind durch Sequenznummer und Empfangszeit sichtbar zu machen, nicht durch Interpolation als echte Samples auszugeben. |
| Verlustfreie Komprimierung | Keine belastbare feste Reduktionsrate aus den Quellen ableitbar. Bei Kompression des 13-B-Records ist 13 B/Sample lediglich die unkomprimierte Referenz; komprimierte Größe ist anhand echter Daten zu messen. | Kann den Verlauf Bit-für-Bit bewahren, braucht aber Formatversion, Blockgrenzen, Fehlererkennung und Dekompressionspfad. Komprimierung darf nicht über fehlende Sequenzen hinweg Werte erfinden. Glatte/repetitive Daten können günstiger sein als stark verrauschte oder zufällige; konkrete Quote und CPU-/Energieaufwand sind Hardwaremessungen, keine Annahme. |
| Zeitaggregation, Beispiel 1-s-Buckets | Beispielhaft 16 B pro vollständiger Sekunde (Minimum, Maximum, Mittelwert als drei Float32 plus Samplecount als UInt32) gegenüber 130 B Rohrecords in derselben Sekunde: rechnerisch 87,7 % weniger. Bei 8 h: 28.800 Buckets / 460.800 B (0,4608 MB), plus Lücken-/Sitzungsmetadaten. | Max/Min je Sekunde bewahren den höchsten/niedrigsten abgetasteten Wert des Intervalls; Mittelwert allein täte das nicht. Samplecount zeigt teilweise fehlende Übertragung, muss aber fehlende und verspätete Samples mit Zeit/Sequenz eindeutig behandeln. Verloren gehen Reihenfolge und genauer Zeitpunkt innerhalb der Sekunde, Verlauf zwischen Extrema und spätere Möglichkeit, Ereignisse mit anderem Fenster neu auszuwerten. Ein kurzer Peak zwischen Abtastpunkten bleibt unsichtbar. Aggregation daher nur bei akzeptiertem Informationsverlust oder zusätzlich aufbewahrten Detailfenstern. |

Die 1-s-Bucket-Rechnung setzt gleich lange, vollständige Zeitfenster und exakt drei Float32 plus einen UInt32 voraus. Gaps brauchen eigene Status-/Zeitangabe; entstehen leere Buckets, ist das 16-Byte-Modell dafür keine vollständige Repräsentation. Das Beispiel bewahrt Peak-Amplitude nur im abgetasteten Signal und sagt nichts über geeignete fachliche Auswertefenster aus. Es ist keine medizinische Empfehlung.

### Vor einer Kapazitätsentscheidung nachzuweisen

1. Für vorhandene Hardware Boardtyp, HX711-Rate/Modus, Bibliotheksversion sowie Sensor- und Filterkonfiguration dokumentieren. Zeit vom Start des `read_average(15)`-Aufrufs bis zur nächsten Iteration mit monotoner Uhr messen, einschließlich BLE-Übertragung und realistischer Last; Verteilung (Minimum, Median, hohe Perzentile), fehlgeschlagene/ausgelassene Zyklen und Laufdauer protokollieren. Eine konfigurierte Delay-Zeit genügt nicht als Ratenbeleg.
2. Über repräsentative Dauer und Bewegungen Senderate, Sequenzlücken, BLE-Abbrüche, Wiederverbindung, Pufferüberlauf, Zeitstempelverhalten und Upload-Wiederholung prüfen. Rohdaten samt Aufbau, Firmware-/Bibliotheksständen und bekannten Grenzen sichern. Mit derzeitiger Sohle und fehlendem Armband liegen dazu keine Messergebnisse vor.
3. Vergleichsdaten für Spitzen erhalten: Rohreihe und 1-s-Aggregate parallel berechnen und feststellen, welche Sample-Extrema, kurzen Ereignisse und Lücken die jeweilige Verdichtung verliert. Falls Verlust nicht akzeptabel ist, Rohdaten vollständig oder in begründeten Detailfenstern zusätzlich aufbewahren. Grenzwert-/Warnereignisse separat als Ereignisse speichern, ohne sie mit Samples gleichzusetzen.
4. Für die Zielhardware dauerhaften Speicher, nutzbare Kapazität, Schreib-/Löschzyklen, Strombedarf, Flushverhalten bei Stromverlust und freie Reserven belegen; für Serverdaten konkretes DB-Schema, Indizes, Retention, WAL/Backups und reale Datenbankwachstumsrate mit synthetischen, eindeutig markierten Testdaten messen. Keine SQLite-Bytezahl lässt sich aus den vorliegenden Tabellen oder dem 13-Byte-Logikmodell herleiten.

**Entscheidung bleibt offen.** Die belegte Grundlage trägt einen Protokollentwurf und die Szenarien oben, aber weder die Annahme 10 Hz noch ein verlustbehaftetes Aggregations-/Aufbewahrungsziel, eine konkrete Kompressionsquote oder ein Datenbankkapazitätsbudget. Vor der Datenhaltungsentscheidung müssen reale Rate/Spitzen- und Gap-Verhalten, Hardwarepuffer und geplante Retention nachgewiesen sowie fachlich gewünschte Historienauflösung festgelegt werden.
