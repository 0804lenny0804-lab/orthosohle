# OrthoSohle – Projektkontext und aktueller Stand

Aktualisiert: 29.10.2026. Mit [AGENTS.md](../AGENTS.md) lesen; Details über die Quellen unten nachladen. Nur OrthoSohle, keine allgemeine Projektvorlage.

## Ziel, Prioritäten und Rahmen

OrthoSohle soll eine vorgegebene Teilbelastung als kalibrierte kg-Belastung kontrollierbar machen. Ein eigenständiges Armband soll aktuelle Werte anzeigen, lokal eine persistente Grenze prüfen und bei Überschreitung vibrieren. Warnung unabhängig von Smartphone und Internet. Fehlende, ungültige oder veraltete Werte brauchen einen klaren Störungsstatus; sie sind kein sicherer Nullwert.

Aktueller Nutzerauftrag vom 29.10.2026: **Web-App jetzt zuerst**, da das Armband noch nicht vorhanden ist. Das löst die frühere Reihenfolge „Armband zuerst“ ab, Integration und Abschluss laufend berücksichtigen. Bestehende Sohle als Datenquelle nutzen; nur notwendige Mess-/Kommunikationskorrekturen, kein Sensor-Redesign. Apple-Watch-Kompatibilität wird im eigenen [Arbeitsbereich WATCH](watch-compatibility.md) von Beginn an mitgeplant und früh erprobt; Funktionsumfang und Budget noch klären. Wear OS bleibt eine spätere Erweiterung. Das Waveshare-Armband gehört dagegen zum Hauptprojekt. Ziel ist jetzt ein produktreifes Ärzte-/Patientensystem; der tatsächliche Stand bleibt ein Forschungs-/Beta-Prototyp. Vollständige Beinlast, Genauigkeit und klinische Sicherheit sind nicht nachgewiesen; produktiver/medizinischer Einsatz benötigt eigene Abnahme und Freigabe.

Zwei Personen, 15.10.2026–28.01.2027: 600 echte Personenstunden. Normierte 300-Stunden-Sicht: Armband 135, App 90, Planung 30, Integration 30, Hausarbeit/Media Night 15. Die bisherige Appschätzung deckt das zusätzliche Ärzteportal und vollständige Produkt-/Betriebsfreigaben nicht belastbar ab; nach Anforderungsklärung neu schätzen, keine Produktfreigabe zum Semesterende zusagen. Abschlussbudget knapp. Hochschulanforderungen, Abgabetermin und separates Media-Night-Datum noch bestätigen. Vorgeschlagene Meilensteine: 20.11. Tischprototyp, 18.12. lokale Warnung, 12.01. integrierte Sitzung, 21.01. Stabilisierung; keine bestätigten Hochschultermine.

## Bestätigtes Softwareziel

Software auf Basis der alten App umfassend überarbeiten: getrennte Arzt-/Patientenfunktionen, vollständiges Frontend/Backend, Sicherheit, Datenschutz und betreibbarer Produktstand. Patient bestätigt Einladung eines geprüften Arztes; Arzt legt medizinische Belastungsgrenze fest, Patient sieht/bestätigt Geräteübernahme; erste Produktversion für iPhone und Android. Technisches Geräte-ACK bleibt zusätzlich nötig. Bestätigt sind außerdem beaufsichtigter Pilot vor regulärem Einsatz und genau ein verantwortlicher Arzt je Patient mit Arztwechsel. Messwerte gehen von der Sohle ans Handy; der anschließende Upload zum Backend und seine Offline-/Hintergrundeigenschaften sind noch zu klären. Katalog, offene Detailentscheidungen und Meilensteine stehen ausschließlich in [requirements.md](requirements.md); Vorschläge dort sind noch keine implementierten oder sämtlich akzeptierten Funktionen.

## Tatsächlich verfügbar

- [Codegrundlage](../code/README.md): unveränderter ZIP-Stand unter code/orthopaul, 51 Dateien mit Herkunft/Prüfsummen. Vue/Vite/Bootstrap/Chart.js; Express/SQLite; ArduinoBLE/HX711-Sketch. Kein ursprünglicher GitLab-Commit enthalten.
- Web-Referenz: BLE-Auswahl, Livechart, Smartphonewarnung, Konfiguration, Simulation, Schritt-/Peak-Erkennung, Historie und Lauf-Feedback.
- Neue lokale Webapp-Grundlage unter code/webapp implementiert: Vue/Express, schreibgeschützte Planansicht, synthetischer Demo-Plan und explizite Lade-/Fehler-/Leerzustände. Keine Konten, echte Persistenz oder Geräteanbindung. Neue Armband-Firmware noch nicht implementiert.
- [Backlog](backlog.csv): 57 geschätzte Aufgaben mit Priorität, Abhängigkeiten und Abnahme. C01 ist mit dokumentierter Quelle, Inventar und Stack abgenommen; C02 steht mit der lokalen Webapp-Grundlage auf Review; C03 ist wegen fehlender Armbandhardware blockiert; übrige Aufgaben sind offen, Verantwortliche noch zuordnen. Die Schätzungen sind keine geleisteten Stunden.

## Hardwarebestand – aktuell noch zu prüfen

Historisch laut Hausarbeit: Arduino Nano 33 BLE, HX711, KERN CK 30-Y1 und PowerBoost. Aktuelle Boardrevision, Versorgung, Verkabelung, geflashter Sketch und Bibliotheksstände sind unbekannt. Der Sketch definiert DOUT 2/SCK 3; das ist kein Nachweis des realen Aufbaus. Bestätigte Hardwarebasis des Armbands: **Waveshare ESP32-S3-Touch-LCD-1.28**. Korrektur durch Nutzer am 29.10.2026: Das Armband ist noch nicht vorhanden; exakte Revision, Haptik/Motortreiber, Akku/Ladeschaltung und Gehäuse sind noch nicht verifiziert oder ausgewählt. Das ist eine Hardwareentscheidung, keine Bestätigung vorhandener/geeigneter Komplettausstattung. Das [Hersteller-Wiki](https://www.waveshare.com/wiki/ESP32-S3-Touch-LCD-1.28) war beim Abruf mit HTTP 403 nicht lesbar; keine konkreten Ausstattungsangaben daraus übernommen. ESP32-S3 ist grundsätzlich BLE-fähig; reale Verbindung/Parallelbetrieb noch testen.

**Nächste Erhebung C03:** tatsächliche Teile/Revisionen, Pins/Spannungen, Fotos bzw. Beobachtungsquelle, verfügbare Testgeräte und Firmwareversion hier ergänzen. Eigene Hardwaredateien erst anlegen, sobald echte umfangreichere Unterlagen entstehen. Keine historischen Angaben als aktuelle Bestandsliste übernehmen.

Laut Nutzer zusätzlich verfügbar: **iPhone, Android-Handy und Apple Watch**. Exakte Modelle, OS-Versionen und Apple-Watch-Kopplung sind offen; eigener macOS-Zugang fehlt. Vereinbarter iPhone-Weg: GitHub Actions baut mit temporärem macOS-/Xcode-Runner eine unsignierte IPA; AltServer auf Windows signiert sie mit dem Apple-Account und installiert sie über USB. AltStore auf dem iPhone ist laut Nutzer nicht erforderlich; kostenlose Signierung muss üblicherweise nach sieben Tagen erneuert werden. Dieser Ablauf wurde für OrthoSohle noch nicht praktisch geprüft. Die Apple-Watch-Artefakt- und Installationskette ist davon getrennt und bleibt zu erproben. Diese Angaben bestimmen Apple Watch als erste zusätzliche Watchplattform, belegen aber noch keine funktionierende Verbindung.

## Bekannte technische Lücken und Entwurfsrichtung

- Firmware begrenzt oberhalb ihres Kalibrierbereichs auf 25 kg; Überbereichsstatus fehlt. 15 HX711-Messungen plus 200-ms-Pause ergeben keine belegten 5 Hz.
- Fersensensorik erfasst die Gesamtbeinlast beim Abrollen nicht nachweislich. In der Hausarbeit berichtete statische Abweichungen ca. 0,1–0,6 kg sind keine allgemeine Genauigkeitszusage.
- Limit-API liefert ein verschachteltes Objekt statt Zahl. BLE-Ereignisse werden nicht gespeichert, Simulation speichert Rohwerte als Peaks.
- Auth/Besitzprüfung, vollständige Geräte-/Sitzungszuordnung und Offline-Synchronisierung fehlen. Browser-/Push-Warnung ist keine gesicherte unabhängige Warnkette.
- Bestätigter App-Pfad: Sohle → BLE → Handy → separat zu definierender Backend-Upload → Datenbank/Web. Die unabhängige Armbandwarnung bleibt erforderlich; direkter Empfang/Parallelverbindung zum Waveshare-Armband ist noch nicht nachgewiesen. Apple Watch wird parallel früh auf den Handy-Companionpfad geprüft; weitere Watchplattformen später. Gleichzeitige BLE-Rollen, Upload und bestätigte Grenzwertsynchronisierung müssen nachgewiesen werden. Vorhandenen Vue-/Express-Stack möglichst erhalten; UI, Transport, Fachlogik und Speicherung trennen.
- Noch offen: Messrate, BLE-Topologie, Gateway, Armband-BOM/Ladung/Gehäuse, Auth/Hosting, Hardwarebudget und konkrete Watch-/Buildversionen. Vor endgültiger Auswahl prüfen und konkret besprechen.

## Wissen und Nachweise abrufen

| Gesuchte Information | Maßgebliche Datei |
|---|---|
| Arbeitsablauf, DRY/Ponytail, Git und Dokumentationspflege | [AGENTS.md](../AGENTS.md) |
| Codepfade, Installations-/Startbefehle und Grenzen | [code/README.md](../code/README.md) |
| Produktanforderungen, Rollenabläufe und Freigabemeilensteine | [requirements.md](requirements.md) |
| Aufgaben, Status, Verantwortliche, Aufwand und Abnahme | [backlog.csv](backlog.csv) |
| Ausführliche Ist-/Gap-Analyse, Architektur und Semesterplan | [analysis.md](analysis.md) |
| Apple-Watch-Arbeitsbereich und spätere Watchplattformen | [watch-compatibility.md](watch-compatibility.md) |
| Relevante Beschlüsse und Gründe | [decisions.md](decisions.md) |
| Historischer Testkontext und HTTP-Ergebnisse | [checks/baseline.md](checks/baseline.md), [api-results.json](checks/api-results.json) |
| Originalkontext, Hausarbeit und Ponytail-Quelle | [sources/README.md](sources/README.md) |

Referenzprüfungen 20.10.: Produktionsbuild inkl. Service Worker und isolierter Backendstart erfolgreich; Limit-Fehler und ungeschützte Zugriffe reproduziert. Zwei synthetische Detektorsequenzen erkannten Peaks, keine Gangvalidierung. Nach der Ordnerbereinigung wurden Installation aller drei npm-Projekte, Frontend-Produktionsbuild und gemeinsamer Frontend-/Backend-Dev-Start in einer isolierten Linux-Kopie erneut geprüft; keine neue Produktfunktion implementiert. Ungeprüft: Hardware, Firmwarekompilierung, reale BLE-Verbindung, Akku, Warnlatenz, Hintergrundverhalten und aktuelle Deployments.

## Übergabe und unmittelbar nächste Arbeit

Aktiver Auftrag ist jetzt der Start mit der Webapp; Armbandhardware ist laut aktueller Nutzerkorrektur noch nicht vorhanden. Die frühere C03-Erhebung bleibt für später offen. Die neue lokale Grundlage unter [code/webapp](../code/webapp/package.json) trennt UI, API-Client und Express-API; Originalcode bleibt unverändert. Start und Grenzen stehen im [Code-Einstieg](../code/README.md).

Nächster konkreter Schritt: Konto-/Betreuungsmodell aus M2 mit einer begründet ausgewählten Auth-Lösung umsetzen; Auth-/Hostingwahl vorher konkret besprechen. Anschließend versionierte Planpersistenz und sichere Gerätebindung. Keine freie medizinische Grenzwertänderung im Patientenbereich. Die jetzige API liefert ausschließlich synthetische Daten oder einen fehlenden Plan; noch keine echte Nutzeridentität oder Datenspeicherung. Hardware, Smartphone-Hintergrundempfang und Watch sind weiterhin ungeprüft.

## Git und Zusammenarbeit auf mehreren Geräten

Vereinbarter Teamablauf: `main` als Integrationsbranch; persönliche Aufgabenbranches `Lenni/<branchname>` und `Paul/<branchname>`; Integration ausschließlich per Pull Request nach `main`. `origin` zeigt auf `https://github.com/0804lenny0804-lab/orthosohle.git`. Pull Request [#1](https://github.com/0804lenny0804-lab/orthosohle/pull/1) mit der Arbeitsgrundlage und PR [#3](https://github.com/0804lenny0804-lab/orthosohle/pull/3) mit dem ersten Armband-Arbeitspaket sind gemergt. CI und Branchschutz sind nicht geprüft. Git ist für lokalen Commit und Branch maßgeblich.

Auf jedem PC separat Repository klonen, Root-README/AGENTS/Kontext lesen und Voraussetzungen prüfen. Nur Commit + Push und Clone/Pull synchronisieren versionierte Dateien. Chat, lokale DB, Secrets, Pakete, Pairings und laufende Prozesse kommen nicht mit. Vor Pull eigenen Status prüfen, passenden Branch fetch/pull --ff-only; bei Divergenz nichts verwerfen/erzwingen. Ohne erfolgreichen Fetch keine Remote-Aktualität behaupten.

Prüfung der Webapp-Grundlage am 29.10.2026: vier Node-Tests für fehlenden/Demo-Plan, Schreibschutz, ungültige API-Antworten und HTTP-Fehler bestanden; Vite-Produktionsbuild, Repositoryprüfung und Diff-Prüfung erfolgreich. Browserbedienung und responsive Darstellung noch nicht praktisch geprüft. Zweite Person prüft vor Integration.
