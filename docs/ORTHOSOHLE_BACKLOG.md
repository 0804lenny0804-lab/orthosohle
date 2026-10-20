# OrthoSohle 2.0 – Semesterbacklog

Maßgeblich ist ORTHOSOHLE_BACKLOG.csv. Diese Ansicht wird mit `python3 scripts/check_project.py --write-backlog` erzeugt; nicht separat bearbeiten.

Ausgangsplanung: 20.10.2026. Alle Statusänderungen brauchen belegte Abnahme. Planungsstunden × 2 ergeben tatsächliche Personenstunden als Schätzung; geleistete Einzelzeiten separat in docs/WORK_LOG.csv erfassen. Aufgaben mit mehr als 4 Planungsstunden vor Beginn in kleinere Arbeitsschritte teilen.

A = Armband, B = Web-App, C = Analyse/Planung, D = Integration, E = Abschluss. Zuständigkeit je Aufgabe festlegen. Watch ist optional; Abschlussbudget nach Hochschulklärung neu schätzen.

| ID | Prio | Aufgabe | Plan-h / Personen-h | Abhängig von | Abnahme | Status | Verantwortlich | Nachweis |
|---|---|---|---|---|---|---|---|---|
| C01 | P0 | Quellstand und Inventar dokumentieren | 4 / 8 | — | ZIP-Prüfsumme, 51 Dateien, Stack und fehlende Git-Historie dokumentiert | Offen | Offen | — |
| C02 | P0 | Entwicklungsstart reproduzierbar beschreiben | 4 / 8 | C01 | Node-Version, Installationsschritte und .env.example für beide Dienste beschrieben | Offen | Offen | — |
| C03 | P0 | Hardwarebestand und Firmwarestand abgleichen | 4 / 8 | C01 | Boardrevision, Sensor, HX711-Rate, Versorgung und geflashter Sketch erfasst | Offen | Offen | — |
| C04 | P0 | Abnahmekriterien und Messplan festlegen | 4 / 8 | C03 | Messbereich, Datenalter, Warnlatenz und Laufzeit als zu prüfende Ziele vereinbart | Offen | Offen | — |
| C05 | P0 | BLE-Rollen und Gateway auswählen | 5 / 10 | C03 | Central/Peripheral-Rollen und benötigte gleichzeitige Verbindungen am Testaufbau nachgewiesen | Offen | Offen | — |
| C06 | P0 | Versioniertes Protokoll spezifizieren | 5 / 10 | C04;C05 | Payload, Einheit, Sequenz, Gerätezeit, Status, Grenzwertversion und ACK definiert | Offen | Offen | — |
| C07 | P0 | Semesterorganisation und Abschlussanforderungen klären | 4 / 8 | C01 | Zuständigkeiten, Zeiterfassung, Hochschultermine und Berichtsumfang dokumentiert | Offen | Offen | — |
| A01 | P1 | Armband-Komponenten vergleichen und auswählen | 6 / 12 | C03;C05 | BOM mit Strombedarf, Größe, BLE-Stack, Treiber und Lieferbarkeit begründet | Offen | Offen | — |
| A02 | P1 | Hardware bestellen und Ausweichlösung festlegen | 3 / 6 | A01 | Teile und Ersatzoption dokumentiert; Liefertermine erfasst | Offen | Offen | — |
| A03 | P1 | Firmwareprojekt und reproduzierbaren Build einrichten | 5 / 10 | A01 | Board- und Bibliotheksversionen fixiert; Test-Firmware buildbar | Offen | Offen | — |
| A04 | P1 | Display am Board in Betrieb nehmen | 6 / 12 | A03 | kg-Platzhalter und Status lesbar auf Zielhardware | Offen | Offen | — |
| A05 | P1 | BLE-Scan und Geräteauswahl implementieren | 6 / 12 | A03;C06 | Bekannte Sohle auswählbar; Fremdgeräte werden nicht automatisch übernommen | Offen | Offen | — |
| A06 | P1 | Legacy-Float32 empfangen und validieren | 6 / 12 | A05 | Nur Payload mit 4 Bytes und endlichem plausiblen kg-Wert akzeptiert | Offen | Offen | — |
| A07 | P1 | Versionierte Sohlenschnittstelle ergänzen | 8 / 16 | C06;A06 | Sequenz, Gerätezeit und Qualität übertragen; alter Client bleibt nutzbar oder Migration dokumentiert | Offen | Offen | — |
| A08 | P1 | Sättigung und Sensorfehler sichtbar übertragen | 6 / 12 | A07 | Überbereich ergibt Status statt scheinbar gültigem 25-kg-Wert; Sensor-Timeout geprüft | Offen | Offen | — |
| A09 | P1 | Zykluszeit und Warnpfad vermessen | 6 / 12 | A08 | HX711-Mittelung, Notify-Intervall und Gesamtverzögerung protokolliert | Offen | Offen | — |
| A10 | P1 | Aktuelle Belastung mit Einheit anzeigen | 6 / 12 | A04;A07 | Gültiger kg-Wert, Empfangszeit und Qualitätszustand sichtbar | Offen | Offen | — |
| A11 | P1 | Lokale Grenzwertbedienung implementieren | 6 / 12 | A10 | Grenze am Gerät einstellbar und Wertebereich geprüft | Offen | Offen | — |
| A12 | P1 | Grenzwert persistent speichern | 4 / 8 | A11 | Neustart behält Wert und Version; ungültige Konfiguration erkannt | Offen | Offen | — |
| A13 | P1 | Vibrationsmotor und Treiber in Betrieb nehmen | 6 / 12 | A01;A03 | Ansteuerung und Versorgung unter Last geprüft; definierte Testmuster | Offen | Offen | — |
| A14 | P1 | Warnzustandsautomat implementieren | 8 / 16 | A12;A13 | Überschreitung, Hysterese, Entprellung und Wiederholung mit Testsequenzen geprüft | Offen | Offen | — |
| A15 | P1 | Messwert-Timeout und Fehleranzeige umsetzen | 6 / 12 | A09;A10 | Nach definierter Frist keine aktuelle sichere Zahl; eigener Störungsstatus | Offen | Offen | — |
| A16 | P1 | Wiederverbindung und Neustart behandeln | 6 / 12 | A15 | Abbruch, Sohleneustart und Armbandneustart enden in definierten Zuständen | Offen | Offen | — |
| A17 | P1 | Grenzwertübertragung mit Bestätigung implementieren | 8 / 16 | C06;A12 | Nur bestätigte Version gilt als angewendet; Konflikt und Abbruch getestet | Offen | Offen | — |
| A18 | P1 | Gateway-BLE-Service und Sitzungsübertragung bauen | 8 / 16 | C05;A07 | Armband bleibt warnfähig, während Gateway Daten abholt; Puffergrenzen dokumentiert | Offen | Offen | — |
| A19 | P1 | Akku und Ladeelektronik integrieren | 6 / 12 | A01;A13 | Geeigneter Schutz/Ladeweg und Versorgung unter Funk-/Motorlast geprüft | Offen | Offen | — |
| A20 | P1 | Akkustand anzeigen und Energiesparen prüfen | 6 / 12 | A19;A14 | Akkustatus plausibel; Display-Schlaf beeinträchtigt Warnung nicht | Offen | Offen | — |
| A21 | P1 | Gehäuse und Armbandaufnahme prototypisieren | 7 / 14 | A19 | Tragbarer Aufbau mit zugänglicher Bedienung und Ladebuchse | Offen | Offen | — |
| A22 | P1 | Laufzeit, Pinplan und Bedienung dokumentieren | 6 / 12 | A20;A21 | Gemessene Laufzeit, Schalt-/Pinplan und Startanleitung vorhanden | Offen | Offen | — |
| B01 | P2 | Grenzwert-API-Rückgabe korrigieren | 3 / 6 | C02 | GET /api/limits liefert Zahl; Client und Vertragstest stimmen überein | Offen | Offen | — |
| B02 | P2 | Zentrale Messwertpipeline einführen | 5 / 10 | C06 | BLE und Simulation nutzen denselben validierten Eingang mit source-Kennung | Offen | Offen | — |
| B03 | P2 | Echte Ereignisse speichern und Simulation trennen | 5 / 10 | B02 | Ein erkannter Peak wird einmal gespeichert; Testdaten separat gekennzeichnet | Offen | Offen | — |
| B04 | P2 | Sitzungsdaten und Zähler korrigieren | 5 / 10 | B03 | Pro Lauf eigene Zähler; Messwerte besitzen Sitzungsbezug; Verlauf erneut abrufbar | Offen | Offen | — |
| B05 | P2 | Schema-Migrationen und Datenbesitz ergänzen | 6 / 12 | C02 | Nutzer, Geräte und Sitzungen über Fremdschlüssel zugeordnet; Migration geprüft | Offen | Offen | — |
| B06 | P2 | Auth-Lösung integrieren | 7 / 14 | B05 | Registrierung, Login, Logout und sichere Session mit bewährter Lösung funktionieren | Offen | Offen | — |
| B07 | P2 | Passwort-Reset und Profil ergänzen | 5 / 10 | B06 | Reset mit Ablauf/Einmalnutzung und minimales Profil funktionieren | Offen | Offen | — |
| B08 | P2 | API- und Push-Zugriffe schützen | 7 / 14 | B06 | Server bestimmt Identität; Nutzer A kann Daten von B nicht lesen/ändern | Offen | Offen | — |
| B09 | P2 | Gerätezuordnung implementieren | 6 / 12 | B08;C05 | Hinzufügen, umbenennen und entfernen mit Besitzprüfung | Offen | Offen | — |
| B10 | P2 | Gateway-Import für Messsitzungen anbinden | 7 / 14 | A18;B04;B09 | Gewählter Client importiert Armbanddaten authentifiziert und ohne Duplikate | Offen | Offen | — |
| B11 | P2 | Grenzwertsynchronisierung im UI darstellen | 5 / 10 | A17;B09 | Sollwert, bestätigter Gerätewert und ausstehende Übertragung unterscheidbar | Offen | Offen | — |
| B12 | P2 | Live-Dashboard mit Fehlerzuständen überarbeiten | 5 / 10 | B01;B02 | Aktuelle kg-Zahl, Datenalter, Grenze, Verbindung und Demoquelle sichtbar | Offen | Offen | — |
| B13 | P2 | Historienlogik korrigieren | 5 / 10 | B04 | Werte <=12 kg sichtbar; historisch wirksamer Grenzwert und Überschreitungen korrekt | Offen | Offen | — |
| B14 | P2 | Offline-Warteschlange implementieren | 5 / 10 | B10;B11 | Fehlerhafte Übertragung bleibt erhalten und wird idempotent wiederholt | Offen | Offen | — |
| B15 | P2 | PWA- und mobile Bedienung prüfen | 4 / 8 | B12;B14 | Icons, Installation, Lade-/Fehlerzustände und Browsermatrix dokumentiert | Offen | Offen | — |
| B16 | P3 | Eine Smartwatch-Plattform als PoC prüfen | 5 / 10 | B10 | Mit vorhandener Testhardware ein Datenweg demonstriert oder Machbarkeitsgrenze belegt | Offen | Offen | — |
| B17 | P2 | Testdeployment und Datenlebenszyklus dokumentieren | 5 / 10 | B08;B15 | TLS, erlaubte Origins, DB-Backup/Restore, Löschung und Konfiguration geprüft | Offen | Offen | — |
| D01 | P1 | Protokoll- und Warnlogik-Grenzfälle prüfen | 5 / 10 | A14;A15 | NaN, kurze Pakete, Überbereich, veraltete Sequenz und Grenzwerthysterese geprüft | Offen | Offen | — |
| D02 | P1 | Funkunterbrechung und Wiederherstellung prüfen | 5 / 10 | A16;A18 | Ausfall/Neustart in kompletter Warnkette reproduzierbar geprüft | Offen | Offen | — |
| D03 | P1 | Messgenauigkeit und Latenz einordnen | 5 / 10 | A09;C04 | Statische/dynamische Vergleichsmessungen und Grenzen mit Rohdaten dokumentiert | Offen | Offen | — |
| D04 | P2 | Nutzertrennung und Synchronisation prüfen | 5 / 10 | B08;B14 | Zwei Konten, Offline/Online und Konflikte mit bestätigten Ergebnissen | Offen | Offen | — |
| D05 | P2 | Bedienbarkeit und End-to-End-Demo testen | 5 / 10 | B10;B12;A22 | Mindestens eine echte Messsitzung von Sohle über Armband bis Verlauf reproduzierbar | Offen | Offen | — |
| D06 | P1 | Integrationsfehler beheben und Release einfrieren | 5 / 10 | D01;D02;D03;D04;D05 | Kritische Befunde behoben; reproduzierbarer Demo-Stand markiert | Offen | Offen | — |
| E01 | P1 | Berichtsgerüst und Belegsammlung anlegen | 3 / 6 | C07 | Kapitel, Quellen, Entscheidungen und Messprotokolle fortlaufend gesammelt | Offen | Offen | — |
| E02 | P1 | Ergebnisse und Grenzen ausformulieren | 4 / 8 | E01;D03 | Architektur, Umsetzung, Evaluation und Grenzen anhand Belegen beschrieben | Offen | Offen | — |
| E03 | P1 | Hausarbeit prüfen und abgabefertig machen | 3 / 6 | E02;D06 | Formalia, Quellen, Abbildungen und KI-Dokumentation nach Hochschulvorgabe geprüft | Offen | Offen | — |
| E04 | P1 | Demoablauf und Material vorbereiten | 3 / 6 | D05 | Pitch, Standmaterial, Stromversorgung und markierter Testdaten-Fallback vorhanden | Offen | Offen | — |
| E05 | P1 | Generalprobe und Abschluss sichern | 2 / 4 | E03;E04 | Demo mehrfach durchlaufen; Abgabe-/Eventtermine bestätigt; Artefakte gesichert | Offen | Offen | — |

**Summe: 300 Planungsstunden / 600 Personenstunden.**

Budget: A 135/270, B 90/180, C 30/60, D 30/60, E 15/30. Keine zusätzliche Reserve enthalten. Eine genehmigte Neuplanung muss CSV, Budgetvorgaben im Checker und Projektstatus gemeinsam ändern.
