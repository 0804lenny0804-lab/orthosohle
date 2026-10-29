# OrthoSohle 2.0 — Projektkontext und Arbeitsauftrag für Codex

> Stand: 20. Oktober 2026. Dieses Dokument ist als Startkontext für einen neuen Codex-Chat oder als Grundlage für eine `AGENTS.md`-Datei gedacht. **Planungsannahmen sind keine bestätigten Implementierungsdetails.** Vor Änderungen das Repository analysieren.

## 1. Projektüberblick

**OrthoSohle** ist ein prototypisches Rehabilitationssystem für Personen, die nach einer Verletzung, Fraktur oder Operation ein Bein nur bis zu einer ärztlich vorgegebenen Belastungsgrenze belasten sollen. Eine intelligente Schuhsohle soll die **tatsächliche aufgebrachte Belastung möglichst präzise in Kilogramm** messen. Die Informationen sollen für Patienten unmittelbar verständlich und zugänglich sein und eine Warnung bei Grenzüberschreitung ermöglichen.

Projektmotto aus der bisherigen Präsentation: **„besser stehen, gehen, leben.“**

Grundprinzip: **Messsohle → Messwerte → visuelle und haptische Rückmeldung → Auswertung in der Web-App.**

Die absolute Gewichts-/Kraftbelastung, angezeigt als kilogrammäquivalente Belastung (kg), ist eine **zwingende Kernanforderung**. Relative Druckverteilungen, bloßes Erkennen von Schritten oder eine KI-Schätzung ohne belegte Genauigkeit sind kein Ersatz. Physikalisch wird Kraft in N gemessen; die kg-Anzeige benötigt eine klar dokumentierte Umrechnung/Kalibrierung. Die Genauigkeit muss unter realistischen Belastungssituationen überprüft werden.

### Bereits aus der früheren Präsentation bekannt
- Es existiert ein **Prototyp einer intelligenten Sohle**.
- Präsentierte Komponenten: **Wägezelle, HX711, Arduino BLE**.
- Ursprüngliche Idee: kontinuierliche Belastungswerte an Smartphone übertragen; Warnung bei Grenzüberschreitung.
- In der ursprünglichen Projektpräsentation wurden als künftige Schritte die Integration der Technik in die Sohle, Patientenfeedback und ein **Warnarmband** genannt.
- Eine **Web-App existiert nach Aussage des Projektteams bereits** und soll weiterentwickelt werden. Ihre tatsächlichen Funktionen, ihr Code, Framework, Backend und Datenmodell sind **nicht verifiziert**.

**Wichtig:** Die Präsentation beschreibt einen älteren Projektstand. Nicht annehmen, dass die oben genannten Bauteile oder die Datenübertragung in der aktuellen Revision unverändert sind. Aktuelles Repo, Firmware und Hardware-Bestandsliste prüfen.

## 2. Neuer Projektrahmen

- Projektname: **OrthoSohle 2.0**.
- Team: **2 Personen**.
- Umfang: **10 ECTS pro Person = 300 Stunden pro Person = 600 tatsächliche Personenstunden**.
- Für die **gemeinsame Grobplanung** nutzt das Team bewusst eine Übersicht mit **300 Planungsstunden**. Diese 300 Stunden sind ein abstrahierter Projektplan und **nicht** die tatsächliche Summe der Team-Personenstunden. Für eine formale Zeiterfassung müssen die realen 600 Personenstunden korrekt erfasst werden. Prozentuale Verteilungen können proportional auf 600 Stunden übertragen werden.
- Zeitraum: **15.10.2026 bis 28.01.2027**.
- Abschluss: **Media Night**, bei der OrthoSohle vor Publikum präsentiert wird; Vorbereitung von Vorführung, Stand/Material und Präsentationskonzept ist Teil des Aufwands.
- Zusätzlich: **schriftliche Hausarbeit/Projektbericht** als Leistungsnachweis, ebenfalls im Aufwand berücksichtigen.

### Prioritäten
1. **Armband: höchste Priorität**. Eigenständiges, tragbares Gerät mit Display, Bluetooth, Vibrationswarnung und Akku.
2. **Web-App: zweite Priorität**. Produktnahe Plattform mit Nutzerkonten, Datenbank, Device Management, ansprechendem Dashboard sowie perspektivisch Smartwatch-Unterstützung.
3. **Sohle: explizit zurückgestellt.** Bestehenden funktionierenden Messprototyp als Datenquelle verwenden. Nur unbedingt nötige Anpassungen für Schnittstellen/Kommunikation; kein grundlegendes Redesign der Sensorik.
4. **Integration und Qualitätssicherung**, damit eine verlässliche End-to-End-Demonstration möglich ist.
5. **Hausarbeit und Media Night** als konkrete Deliverables.

## 3. Vereinbarte grobe Zeitverteilung

| Arbeitspaket | Anteil | Planungsstunden (300er-Sicht) | Entspricht Personenstunden (600er-Sicht) |
| --- | ---: | ---: | ---: |
| A. Eigenständiges Armband | **45 %** | **135 h** | **270 h** |
| B. Web-App / Plattform | **30 %** | **90 h** | **180 h** |
| C. Planung, Analyse, Recherche | **10 %** | **30 h** | **60 h** |
| D. Integration, Tests und Optimierung | **10 %** | **30 h** | **60 h** |
| E. Hausarbeit, Media Night, Abschluss | **5 %** | **15 h** | **30 h** |
| **Summe** | **100 %** | **300 h** | **600 h** |

**Vorsicht:** 15 Planungsstunden bzw. 30 echte Personenstunden für Hausarbeit *und* Media Night sind knapp. Als Ausgangswert aus der zuletzt abgestimmten Übersicht beibehalten, aber nach Klärung der konkreten Hochschulanforderungen neu schätzen und gegebenenfalls Stunden verlagern.

## 4. Arbeitspaket A — Armband (Priorität 1)

### Ziel
Ein kleines eigenständiges Wearable, das Belastungswerte direkt von der OrthoSohle empfängt, **die aktuelle Belastung in kg auf einem Display zeigt** und **beim Überschreiten der konfigurierten Grenze haptisch vibriert**. Unmittelbare Warnung soll **nicht** von einer geöffneten Web-App oder einer permanent verfügbaren Smartphone-Verbindung abhängig sein.

### Muss-Funktionen
- BLE-Verbindung mit der Sohle oder einer technisch sinnvoll begründeten lokalen Empfängereinheit.
- Empfang, Validierung und Anzeige aktueller Belastungswerte mit nachvollziehbarer Einheit und Zeitstempel.
- Konfigurierbare Belastungsgrenze; Grenzwert lokal auf dem Armband vorhanden, damit Warnungen auch ohne Internet funktionieren.
- Vibrationsalarm bei Grenzüberschreitung, inklusive sinnvollem Hysterese-/Entprellungs- und Wiederholungsverhalten.
- Anzeige von Verbindungsstatus, Fehlerzustand und Akkustand.
- Verhalten bei fehlenden, ungültigen und veralteten Messwerten: **klarer Störungsstatus, keine scheinbar aktuelle sichere Zahl**.
- Akkubetrieb, sichere Ladeschaltung und sinnvolle Energiesparstrategie.
- Tragbare Bauform/Gehäuse, grundlegende Bedienbarkeit.
- Dokumentierte Firmware, reproduzierbarer Build und Hardware-Pinbelegung.

### Optionale Funktionen
- Warnstufen (z. B. Annäherung an die Grenze), unterschiedliche Vibrationsmuster.
- Display-Energiesparmodus und Wake-up-Interaktion.
- Anzeige des Grenzwerts sowie Minimalmenü.
- Firmwareupdate-Konzept.

### Hardwareauswahl ist noch OFFEN
Keine erfundenen Beschlüsse: Mikrocontroller/SoC, BLE-Topologie, Display, Vibrationsmotor, Treiber, Akku, Ladeelektronik, Gehäusematerial und exakte Komponenten sind noch zu ermitteln. Bitte nicht ohne Bestandsaufnahme auf ein bestimmtes Board oder Bauteil festlegen. Entscheidungen hinsichtlich Strombedarf, Größe, BLE-Stack, Entwicklungsaufwand und Beschaffbarkeit begründen.

## 5. Arbeitspaket B — Web-App (Priorität 2)

### Ziel
Vorhandene Web-App in Richtung **produktnahe Beta-Version** entwickeln, ohne fälschlich eine medizinische Zulassung oder vollständige Marktreife zu behaupten.

### Priorisierte Funktionen
1. **Nutzerkonten:** Registrierung, Login, Logout, Passwortzurücksetzung, Nutzerprofil, gegebenenfalls E-Mail-Verifikation, sichere Session-Verwaltung.
2. **Backend und Datenbank:** nutzerbezogene Speicherung von Profilen, Geräten, Einstellungen und Belastungssitzungen; strikt getrennte Zugriffsrechte.
3. **Dashboard:** responsives und verständliches UI mit aktuellem Gewicht in kg, Grenzwert, Verbindungsstatus und Belastungsanzeige.
4. **Geräteverwaltung:** Gerät hinzufügen/koppeln, zuordnen, umbenennen, entfernen; Status und Firmwareversion soweit vom Gerät unterstützt.
5. **Belastungsverlauf:** Sitzungen speichern, Verlaufskurven, Grenzüberschreitungen und grundlegende Statistiken anzeigen.
6. **Einstellungen:** individueller Grenzwert und Warnparameter; nachvollziehbarer Synchronisierungsweg zum Armband.
7. **Smartwatch-Kompatibilität:** explizites Projektziel, aber bei begrenzter Kapazität zuerst **eine** Plattform prototypisch anbinden und Erweiterbarkeit vorsehen. Apple Watch/watchOS und Wear OS verlangen im Regelfall unterschiedliche native Implementierungen und sind nicht durch responsive Web-Oberfläche allein gelöst.
8. **Qualität:** Fehleranzeigen, Ladezustände, verständliche Erstinbetriebnahme, mobile Darstellung, Datenschutz, Basis-Tests, Deployment einer Testversion.

### Smartwatch-Strategie
- Zu unterscheiden: **selbst entwickeltes OrthoSohle-Armband** (Hauptgerät) vs. **existierende Apple-/Wear-OS-Smartwatch** (zusätzlicher Client).
- Zuerst klären, ob Messdaten **direkt per BLE**, **über Smartphone-Gateway** oder **über Backend** zur Watch gelangen sollen. Die Warnzuverlässigkeit hängt stark vom gewählten Weg und Hintergrundbeschränkungen ab.
- Plattform nach verfügbarer Testhardware, Entwicklergeräten, Betriebssystemen und Aufwand auswählen. Kein Versprechen vollständiger Apple-Watch- und Wear-OS-Unterstützung in 90 Planungsstunden.
- Falls Smartwatch im Semester nicht belastbar umgesetzt werden kann, sauberer Proof-of-Concept plus dokumentierte Erweiterungsarchitektur.

### Technik-Stack ist OFFEN
Nicht voraussetzen, dass React, Vue, Next.js, Firebase, Supabase, PostgreSQL oder ein bestimmter Host bereits verwendet werden. Repo analysieren und bestehende funktionierende Architektur nach Möglichkeit erhalten. Bestehenden Auth-Provider wiederverwenden, falls vorhanden; keine eigene unsichere Passwort-Kryptografie implementieren.

## 6. Arbeitspaket C — Planung (30 Planungsstunden)

- Ist-Aufnahme: bestehende Hardware, Firmware, Web-App, technische Schulden, Abhängigkeiten.
- Anforderungen und Abnahmekriterien priorisieren: Muss/Soll/Kann.
- End-to-End-Architektur inklusive Datenfluss und Geräte-Rollen festlegen.
- BLE-Protokoll / versioniertes Nachrichtenformat spezifizieren.
- Komponentenrecherche und begründete Architekturentscheidungen.
- Arbeitsteilung, Meilensteine, Zeit-/Kostenrisiken und Teststrategie.
- Git-/Branch-/Issue-/Dokumentationskonventionen.

## 7. Arbeitspaket D — Integration & Tests (30 Planungsstunden)

- Integration bestehender Sohle mit neuem Armband und Web-/Smartwatch-Datenweg.
- Prüfung von Einheiten, Grenzwerten, Synchronisierung, Messwertalter und Zeitstempeln.
- Tests für Verbindungsabbruch, Neustart, Wiederverbindung, niedrigen Akku und ungültige Daten.
- Messung von Warnlatenz, Kommunikationsstabilität und Funkreichweite.
- Bedienbarkeitstests und Demo-Durchläufe.
- Grundlegende Sicherheits- und Zugriffsrechtstests für die Web-App.
- Prüfen, ob die bestehende Sohle verlässlich genügend genaue Messwerte liefert; **keine** unbelegte klinische Genauigkeitsbehauptung. Eine erweiterte Sensorevaluation ist nachrangig und nicht als eigener Entwicklungsschwerpunkt budgetiert.

## 8. Arbeitspaket E — Hausarbeit & Media Night (15 Planungsstunden)

**Hausarbeit / Projektbericht:** Ausgangslage, Problem, Anforderungen, Systemarchitektur, Auswahlentscheidungen, Implementierung, Tests, Ergebnisse, Grenzen, Ausblick; Screenshots, Messungen und Quellen dokumentieren. Genauen Umfang und Abgabekriterien bei der Betreuung verifizieren.

**Media Night:** funktionsfähige, wiederholbare Demo; Stand-/Präsentationskonzept; verständliche Kurzbeschreibung/Pitch; Bildschirmansichten, Armband-Prototyp, eventuelle Plakate/QR-Code/Video; stabiler Fallback mit Testdaten für den Fall eines Funkproblems; genügend Stromversorgung; Probevorführung. Datum der Media Night ist **nicht separat bestätigt**; Projektende ist 28.01.2027. Kein konkretes Eventdatum erfinden.

## 9. Projektzeitraum und grober Ablauf

**15.10.2026 – 28.01.2027** (Semesterprojekt):

- **15.10.–31.10.:** Anforderungen, Bestandsaufnahme, Architektur und Arbeitsaufteilung.
- **01.11.–20.11.:** Armband-Konzept, Bauteilauswahl, erste Hardware- und BLE-Prototypen; parallele Analyse der Web-App.
- **21.11.–18.12.:** Armband-Hauptentwicklung, Display, Warnlogik, Akkukonzept; Backend/Nutzerkonten beginnen.
- **19.12.–12.01.:** Web-App-Kernfunktionen, Dashboards, Datenhaltung, Geräteverwaltung; Smartwatch-PoC nach Kapazität.
- **13.01.–21.01.:** End-to-End-Integration, Stabilisierung, Testfälle und Nutzerfeedback.
- **22.01.–28.01.:** Hausarbeit fertigstellen; Media-Night-Demo, Vorführmaterialien und Abschluss.

Die Phasen dürfen sich überlappen; insbesondere Integration und Dokumentation sollten nicht erst in der letzten Woche beginnen. Die oben genannten Termine sind Planvorschläge, nicht bestätigte Hochschulmeilensteine.

## 10. Systemarchitektur — Entwurfsrichtung

```text
                  [bestehende Messsohle]
                     | Messwerte (kg), Sequenz, Zeit, Qualität/Status
                     | BLE (Spezifikation zu prüfen)
                     v
           [OrthoSohle-Armband / lokal]
           - Anzeige aktuelle Belastung
           - individuell konfigurierte Grenze
           - Vibrationswarnung, Fehlermeldungen
                     |
                     | optionaler, zu definierender Daten-/Konfigurationspfad
                     v
       [Smartphone-Gateway oder anderer BLE-Client]
                     |
                     v
              [Backend / Datenbank]
                     ^
                     |
              [Web-App Dashboard]
         Konto, Geräte, Sitzungen, Verlauf

   [optionaler Smartwatch-Client] <-- via geprüften direkten oder Gateway-Pfad
```

Die genaue BLE-Verbindungstopologie muss anhand der tatsächlichen Hardware und Anforderungen festgelegt werden. Ein Gerät kann nicht automatisch beliebig viele BLE-Verbindungen parallel bedienen. Die Speicherung von Sitzungsdaten setzt außerdem einen definierten Upload-Pfad voraus. **Keine fiktive direkte Kommunikation der Browser-Web-App mit jeder beliebigen Uhr oder Sohle voraussetzen.**

## 11. Akzeptanzkriterien (Definition of Done für Beta-Prototyp)

### Armband
- Aufbauen, einschalten, selbstständig koppeln bzw. nachvollziehbar koppeln.
- Ein aktueller, gültiger Wert wird **in kg** angezeigt.
- Bei einer im Testfall eingestellten Grenze (z. B. 20 kg als reiner **Testwert**, keine Therapieempfehlung) wird bei reproduzierbarer Überschreitung eine haptische Warnung ausgelöst.
- Nach Datenverlust/Verbindungsabbruch erscheint ein Fehlerstatus; keine veraltete Messung wird als sicherer Istzustand interpretiert.
- Akkubetrieb und tragbares Gehäuse sind demonstrierbar.

### Web-App
- Nutzer kann Konto anlegen, sich anmelden und abmelden.
- Daten und Geräte sind nutzerspezifisch geschützt.
- Belastung und eingestellter Grenzwert werden nachvollziehbar dargestellt.
- Mindestens eine nutzerbezogene Messsitzung mit Verlauf kann gespeichert und wieder geöffnet werden.
- Geräteverwaltung ist für die implementierte Hardware konsistent nutzbar.
- Mobile Oberfläche ist gebrauchstauglich.

### Gesamtsystem
- Demonstration einer Messung von Sohle über Armband bis zur App bzw. ausdrücklich ausgewiesenen Datenübertragung.
- Geprüftes Verhalten bei Überschreitung, Verbindungsabbruch und Wiederherstellung.
- Technische Grenzen einschließlich Messgenauigkeit und Warnlatenz sind offen dokumentiert.
- Media-Night-Vorführung und Hausarbeit sind vorbereitet.

## 12. Technische und regulatorische Leitplanken

- **Teilbelastung und absolutes Gewicht haben Vorrang** vor Spielereien wie Schrittzählung, KI, hübschen Animationen oder dünneren Sensoren.
- Keine medizinische Wirksamkeit, klinische Sicherheit, präzise Genauigkeit oder Zertifizierung behaupten, solange sie nicht nachgewiesen ist.
- Das System ist vorerst ein **Forschungs-/Beta-Prototyp**, kein zugelassenes Medizinprodukt. Potenziell relevant: EU-MDR, Risikomanagement, Software-Lebenszyklus, Datenschutz bei gesundheitsbezogenen Daten; regulatorische Anforderungen gesondert fachlich prüfen.
- Eine echte rehabilitative Nutzung mit medizinisch vorgegebenen Grenzen erfordert ausreichend verlässliche Sensorik und Warnkette. Demo nicht als Freigabe für unbeaufsichtigte Patientenanwendung darstellen.
- Datensparsamkeit, Rollen/Zugriffsschutz, sichere Authentifizierung, Verschlüsselung, keine Secrets ins Repo.
- BLE-Nachrichten validieren; Einheit, Zeitstempel und Paketversion festlegen; Fail-Safe bei stale readings.
- Automatisierte Tests und kleine, überprüfbare Commits bevorzugen; keine unnötige Komplett-Neuschreibung.

## 13. Was Codex beim Start tun soll

1. **Repository vollständig inventarisieren**: Struktur, Branch-Status, Frameworks, Abhängigkeiten, Firmware, Build-Skripte, aktuelle Funktionen, offene TODOs und Dokumentation.
2. **Bekanntes und Unbekanntes sauber unterscheiden**: Die Planung beschreibt Ziele; ob sie bereits implementiert sind, bestimmt ausschließlich der tatsächliche Code/Hardwarestand.
3. **Gap-Analyse** erstellen: aktuelle Umsetzung versus OrthoSohle-2.0-Ziele.
4. **Konkreten Backlog** mit Epics, User Stories, Tasks, Abnahmekriterien, Abhängigkeiten, Aufwand und Priorität anlegen.
5. **Architekturvorschlag** für Armband-Firmware/BLE, Backend/Web-App, Gerätezuordnung, Datenfluss und Smartwatch-PoC erstellen, bevorzugt passend zum bestehenden Stack.
6. **Nächste implementierbare Schritte** wählen: zunächst belastbare BLE-Schnittstelle und Armband-MVP, parallel minimale Auth-/Datenbasis der Web-App.
7. Erst danach Änderungen programmieren, testen und knapp dokumentieren. Vor irreversiblen Architekturentscheidungen konkrete Blocker benennen.

## 14. Offene Fakten, nicht halluzinieren

- Repository-URL und aktueller Projektordner.
- Tatsächlicher Firmware-Code, Board und verwendete Bibliotheken.
- Aktuelle Sohlensensorik und experimentell erreichte Messgenauigkeit.
- Aktuelles Web-App-Framework, Hosting, Backend und Datenbank.
- Bestehende Benutzerverwaltung und Funktionen.
- Welche Apple-/Android-Geräte, Smartwatches, Boards und Messgeräte verfügbar sind.
- Budget für Hardware und Hosting.
- Konkrete formale Anforderungen an Hausarbeit und Media Night.
- Exakte BLE-GATT-Services/Characteristics und Messfrequenz.
- Eindeutige End-to-End-Kopplungsarchitektur.

## 15. Prompt zum direkten Start in Codex

> Wir entwickeln **OrthoSohle 2.0**. Lies bitte zuerst diese Kontextdatei und analysiere anschließend das komplette Repository. Priorität 1 ist ein eigenständiges **BLE-Armband mit kg-Anzeige, Akku und Vibrationswarnung**; Priorität 2 eine **produktnahe Web-App** mit Nutzerkonten, Datenbank, Dashboard, Geräteverwaltung, Belastungsverläufen und einem realistischen Smartwatch-PoC. Die bestehende Messsohle soll **nicht grundlegend weiterentwickelt** werden. Projektlaufzeit 15.10.2026–28.01.2027, zwei Personen mit insgesamt 600 echten Personenstunden; wir verwenden für die gemeinsame Übersicht bewusst einen normierten 300-Stunden-Plan: Armband 135 h, App 90 h, Planung 30 h, Integration/Tests 30 h, Hausarbeit/Media Night 15 h. Verwechsle Ziele nicht mit vorhandenem Code. Erstelle zuerst (1) eine Ist-Analyse, (2) eine Gap-Analyse, (3) die passende Systemarchitektur und (4) einen priorisierten, schrittweise umsetzbaren Backlog mit Akzeptanzkriterien. Beginne nicht mit einem großen Rewrite. Achte besonders auf präzise absolute Belastung in kg, ausfallsicheres Warnverhalten, Datenschutz, und klare Trennung zwischen Beta-Prototyp und Medizinprodukt.
