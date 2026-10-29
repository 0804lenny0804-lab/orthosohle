# OrthoSohle 2.0 – Bestandsaufnahme, Architektur und Semesterplan

Hinweis zur späteren Struktureinrichtung: Der analysierte Quellstand ist inzwischen dauerhaft und unverändert unter `code/orthopaul/` im Repository gesichert. Die folgende Bestandsaufnahme beschreibt den damaligen Analysezeitpunkt; der aktuelle Stand steht in `docs/context.md`.

Stand: 20. Oktober 2026. Grundlage: vollständig gelesene ORTHOSOHLE_CODEX_CONTEXT.md, orthopaul-main.zip und extrahierter Text der Hausarbeit vom 15. Februar 2026. Der PDF-Text wurde inhaltlich herangezogen; Abbildungen, Schaltbilder und deren elektrische Details wurden nicht visuell verifiziert. Anforderungen stammen aus dem aktuellen Auftrag und Kontext. Anweisungen und Musterbefehle in Repository/Anhängen wurden als Dokumentinhalt behandelt, insbesondere wurde der Force-Push aus der Template-README nicht ausgeführt.

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
Sohle (Peripheral, Messung + Status)
  → BLE → Armband (Central, lokale Warnung, kg-Anzeige, Grenze im Flash)
              → optional zugleich Peripheral für Gateway
                  → unterstützter Browser/Smartphone-Client
                      → authentifizierte API → Datenbank → Vue-Dashboard
```

Das ist eine zu prüfende Entwurfsrichtung, keine feststehende Hardwareentscheidung. Früh einen Spike für gleichzeitigen BLE-Central-/Peripheral-Betrieb auf verfügbarer Hardware durchführen. Nicht voraussetzen, dass Sohle parallel Armband und Smartphone bedienen kann. Gateway nur für Upload/Konfiguration, nie Voraussetzung der Warnung. Für Semester-MVP kann bewusst ein unterstützter Chromium-Client am Laptop/Android mit explizit gestarteter Übertragung dienen; iPhone-Dashboard muss dadurch nicht selbst BLE unterstützen. Ein zusätzlicher nativer Gateway-Client benötigt eigene Schätzung und verdrängt bei Bedarf den Watch-PoC.

Armbandmodule: BLE-Transport; Decoder/Validierung; Messzustand mit monotonic receivedAt; Konfigurationsspeicher; Warnautomat; Display/Bedienung; Motor-Treiber; Energieverwaltung. Zustände mindestens Start, Suche, aktuelle gültige Messung, Überschreitung, Daten veraltet/Verbindung weg, Sensorfehler und Akku kritisch. Fehlende Daten sind kein Nullwert.

Protokollentwurf: Versionskennung, Sequenz, monotone Gerätezeit, kg bzw. dokumentierte Festkommaeinheit, Qualitäts-/Überbereichsflags. Backend speichert zusätzlich Empfangszeit, Geräte-ID und Sitzungs-ID. Ohne Echtzeituhr Gerätezeit nicht als UTC ausgeben. Grenzwertschreiben bekommt Konfigurationsversion und ACK; UI unterscheidet Soll und bestätigten Istwert. Lokal eingegebene Grenze bleibt ohne Internet nutzbar. Vor finaler Auswahl Pin-/Spannungsplan, Motorstrom/Anlaufstrom und Akku-/Ladekonzept prüfen.

1. Hardwarebestand, echte Messrate und Protokoll prüfen; BOM auswählen/beschaffen.
2. Reproduzierbares Firmwareprojekt; Display und Legacy-BLE-Wert auf Tischaufbau.
3. Protokollstatus, lokale persistente Grenze und Motor-Warnung; Warngrenzfälle testen.
4. Ausfallanzeige, Wiederverbindung und Gateway-Pfad.
5. Akku, Strommessung, Gehäuse und Trage-/Bedienversuch.
6. Warnlatenz, Laufzeit und Funkstabilität messen. Konkrete Zielwerte vor Umsetzung vereinbaren; derzeit keine gemessene Zusage.

## 7. Entwicklungsplan Web-App

Vue/Vite/Express zunächst erhalten. Kleine Korrekturen und Messpipeline vor neuen Ansichten. Komponenten weiterverwenden, aber Transport, Messzustand, Sessionverwaltung und API-Aufrufe aus App.vue schrittweise in testbare Module auslagern.

1. Limit-API, Inputvalidierung, klare fehlende/stale Messzustände korrigieren.
2. BLE/Simulation über dieselbe Pipeline mit source=real/demo; Samples, Peaks und Warnereignisse unterscheiden.
3. Schema erweitern: authentifizierte Nutzer, Gerätebesitz, Sessions, Messdaten/Ereignisse, angewendete Grenzwertversion. Unzugeordnete Altdaten nicht automatisch beliebigem neuen Konto zuschlagen.
4. Etablierte Auth-Lösung; Registrierung/Login/Logout, Reset und Profil. Serverseitige Session-/Besitzprüfung für sämtliche Daten- und Push-Routen; zwei Nutzer gegeneinander testen.
5. Geräteverwaltung und gewählten Gateway-Upload integrieren. Keine Aussage „synchronisiert“, bevor Gerätebestätigung eingegangen ist.
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

Die konkreten HTTP-Ergebnisse sind in `docs/checks/api-results.json` abgelegt. Der Backlog in `docs/backlog.csv` enthält 57 Aufgaben mit Abnahme, Abhängigkeiten und exakt 300/600 Stunden. Priorisierte nächste Schritte: Quellstand sichern, tatsächliche Hardware feststellen, reale Zykluszeit/Überbereich messen, BLE-Topologie nachweisen; parallel Grenzwert-API und Messwertpersistenz korrigieren. Erst anschließend endgültige Komponenten-/Hostingentscheidungen treffen.


## 10. Erneute Codeprüfung und empfohlene Umsetzungspakete – 29.10.2026

Die erneute Prüfung verwendet den aktuellen GitHub-Integrationsstand als Quelle, insbesondere `code/orthopaul/`. Der zuvor in diesem Chat betrachtete lokale Initialstand war veraltet. Eine Chat-Upload-Ablage ist keine Projektquelle. Die folgenden Pakete konkretisieren die Umsetzung der bestehenden Meilensteine in [requirements.md](requirements.md); sie sind Empfehlungen und keine neue Anforderungsliste oder Aufwandzusage. Die frühere Architektur und Semesterplanung in Abschnitten 6–8 wird bei Widersprüchen durch die bestätigten Smartphone-, Arztplan- und Watchanforderungen überholt.

### Was wiederverwendbar ist

Vue/Vite, die Chart-Komponenten und Express sind brauchbare technische Ausgangspunkte. Geräte-UUIDs, Kalibrierkurve und Schrittalgorithmus dokumentieren bisheriges Verhalten, benötigen aber eigene Validierung. Die bestehenden Datenbanktabellen eignen sich als Referenz für die bisherigen Funktionen; sie tragen das Ärzte-/Patientenmodell noch nicht. Deshalb schrittweise Migration in einen tatsächlich implementierten neuen Codebereich, während der Originalbestand unverändert bleibt. Kein Frameworkwechsel allein wegen des Neuaufbaus; native Smartphone-/Watch-Anbindung anhand des frühen Plattformtests auswählen.

### Im Quelltext erneut bestätigte Befunde

| Beleg im Originalcode | Konsequenz für die Umsetzung |
|---|---|
| `server/db.js:getLimit` liefert eine Zeile; `server/server.js:GET /api/limits/:userId` verpackt diese unter limit_value; `frontend/src/App.vue:loadLimit` übernimmt sie direkt | Vertrag vor UI-Übernahme korrigieren und mit fehlendem/gesetztem Grenzwert testen |
| `App.vue:onPeak` ändert nur lokale Listen/Zähler; `SimulationControl.vue:sendNext` sendet jeden Rohwert an /api/peaks | Gemeinsame Messpipeline; Rohwerte, Peaks und Warnereignisse getrennt modellieren; Demoquelle explizit kennzeichnen |
| `server/server.js` enthält keine Auth-Middleware; mehrere Stellen verwenden userId=1; `db.js` verknüpft Peaks/Schritte nicht mit Runs oder Besitzern | Neue Datenbasis und serverseitige Autorisierung vor Mehrbenutzerbetrieb; alte Endpunkte nicht als geschütztes Produkt übernehmen |
| `Bluetooth.vue:onCharacteristicChanged` liest Float32 ohne Paketprüfung; Disconnect meldet keinen globalen Messzustand | Decoder und Zustandsführung aus UI lösen; kurze/ungültige/veraltete Pakete sowie Abbruch explizit behandeln |
| `arduinocode.ino:rawToKg` klemmt auf 25 kg; loop mittelt 15 Messungen und wartet zusätzlich 200 ms | Überbereich und reale Messrate vor zuverlässiger Alarm-/Schritterkennung nachweisen |
| `history/PeakChart.vue:filteredPeaks` entfernt Werte bis einschließlich 12 kg; `stepdetector.js` verwendet samplebasierte Fenster | Keine unveränderte fachliche Übernahme; historische Bewertung mit Planversion und Algorithmustests bei relevanten Raten |

### Reihenfolge und Abnahme der Arbeitspakete

| Paket / vorhandene Zuordnung | Reviewbares Ergebnis | Abnahme / nächster kleiner Schritt |
|---|---|---|
| 1. Hardware und Plattformpfade — C03–C06, M0/M1, WATCH | Waveshare-Displaytest, nachgewiesene BLE-Rollen, iPhone-/Android-Empfang und früher Watch-Test | Zuerst Boardrevision/USB-Erkennung und minimalen Displaytest abschließen. Danach jeden Datenweg separat mit Ausfall/Gerätesperre prüfen; keine Hintergrundfähigkeit aus einem Vordergrundtest ableiten. |
| 2. Messvertrag und lokale Warnung — A07–A17, D01–D03 | Versionierter Mess-/Planvertrag, Überbereich, Datenalter, unabhängiger Warnautomat und Plan-ACK | Zuerst Decoder mit gültigem Float, kurzem Paket und NaN prüfen; dann versionierte Pakete und Stale-Übergang. Warnung ohne Telefon/Internet am echten Armband nachweisen. Medizinische Grenze nicht frei vom Patienten überschreibbar machen. |
| 3. Reproduzierbare Produktbasis — C02, M1 | Ein neuer lauffähiger Bereich mit fixierter Installation, Konfigurationsprüfung, CI und isolierten Testdaten | Zuerst einen minimalen vertikalen Durchstich implementieren; Originalmanifest bleibt unverändert. Build und Start sind technische Teilabnahmen. |
| 4. Identität und Betreuung — M2, ACC/REL | Geschützte Konten, Arztprüfung, Einladung, Annahme, Entzug und Arztwechsel | Zuerst serverseitige Identität integrieren; danach jede Datenroute mit zwei Ärzten/zwei Patienten auf Fremdzugriff prüfen. Eindeutige aktive Betreuung auch bei konkurrierenden Annahmen absichern. |
| 5. Gerätebindung und Therapieplan — M3, DEV/PLN | Gerätezuordnung, unveränderliche Planhistorie, getrennte Patientenbestätigung und Gerätebestätigung | Zuerst Planversion speichern/lesen; dann Transfer und ACK. Ausstehende, veraltete oder falsche ACKs dürfen keinen Erfolg anzeigen. |
| 6. Sitzungen und Offline-Upload — M4, DAT/HIS | Eindeutiger Nutzer-/Geräte-/Sitzungs-/Planbezug, real/demo, gepufferter idempotenter Upload | Zuerst eine synthetische Sitzung vollständig speichern und abrufen; dann doppelten Batch, Netzabbruch und Datenlücke prüfen. Upload darf die lokale Warnung nicht blockieren. |
| 7. Patienten- und Arztoberflächen — M5, UX/PAT/DOC | Onboarding, aktueller Zustand, Planübernahme, eigener Verlauf bzw. berechtigte Patientenübersicht | Erste Oberfläche entlang eines vollständigen Ablaufs bauen; anschließend Leer-, Offline-, Fehler- und Stale-Zustände sowie zugängliche Bedienung abnehmen. Bestehende Charts nur nach fachlicher Korrektur übernehmen. |
| 8. Betrieb und Pilotfreigabe — M6–M8 | Getrennte Umgebungen, Monitoring, Löschung/Export, Backup/Restore, Gesamtnachweis und definierter Pilot | Betrieb und Datenschutz ab M0 vorbereiten; Restore mit synthetischen Daten praktisch nachweisen. Technische Fertigstellung, Pilotfreigabe und reguläre Einsatzfreigabe getrennt abnehmen. |

Jedes Paket vor Implementierung in ca. 2–4 echte Personenstunden große Aufgaben mit konkretem Prüfergebnis schneiden. Größere Pakete sind keine einzelnen Tickets. Im bestehenden Backlog insbesondere A11 (freie lokale Grenzwerte), A18/B10 (angenommener Armband-Gatewaypfad) und B16 (später Watch-PoC) vor Umsetzung mit den inzwischen bestätigten Anforderungen abgleichen. Ein ausgewähltes Waveshare-Board erledigt A01/A02 nicht automatisch: Haptik, Energieversorgung und Gehäuse bleiben zu prüfen. Der alte 600-Stunden-Backlog darf nicht durch zusätzliche Produkttickets scheinbar weiterhin vollständig finanziert erscheinen. Erst verbleibenden Umfang und Aufwand schätzen, dann Semesterlieferung und spätere Produktarbeit zuordnen.

### Nachweisgrenzen dieser Prüfung

Erneute statische Quelltextprüfung, keine neue Hardware-, BLE-, Smartphone-, Watch- oder klinische Prüfung. Frühere Build-/API-Ergebnisse bleiben historische Nachweise und werden nicht als heute erneut ausgeführt dargestellt. Der unabhängige Library-Wissensindex konnte mangels Library-Werkzeugen nicht aktualisiert werden; maßgebliche Projektdokumentation liegt hier im Repository.
