# Arbeitsbereich WATCH – Apple-Watch-Client und weitere Plattformen

Stand: 20.10.2026. **Von Beginn an mitgeplant, noch nicht implementiert oder als kompatibel nachgewiesen.** Nutzer bestätigt verfügbare Testgeräte: iPhone, Android-Handy, Waveshare-Armband und Apple Watch. Daraus ergibt sich Apple Watch als erste konkret zu prüfende zusätzliche Watchplattform. Wear OS bleibt eine spätere Erweiterung ohne zugesagte Modellunterstützung.

## Abgrenzung und gemeinsame Grundlage

Das Waveshare ESP32-S3-Touch-LCD-1.28 ist die Hardwarebasis des eigenständigen Warnarmbands. Seine lokale Warnkette steht in [requirements.md](requirements.md). WATCH ist ein eigener Arbeitsbereich desselben Produkts: gemeinsam spezifizieren, früh auf Apple Watch testen und mit Handy-App/Backend abstimmen. Die frühere Einordnung ausschließlich als späteres Folgeprojekt ist damit abgelöst.

Gemeinsame Daten-/Planversionen, Nutzer-/Gerätezuordnung und Datenschutzanforderungen aus der Produktspezifikation wiederverwenden. Kein zweites Backend, keine eigene Patientenverwaltung und keine parallel gepflegten Therapiepläne. watchOS benötigt plattformspezifische Anbindung; ein eigener Client ist nicht durch responsive Webdarstellung ersetzt. Ein Client darf vom Handy abhängen, muss das aber sichtbar machen. Er ersetzt die eigenständige Waveshare-Warnfunktion nicht ohne ausdrückliche neue Entscheidung.

## Bestand und offene Voraussetzungen

| Gerät / Voraussetzung | Aktueller Kenntnisstand |
|---|---|
| iPhone | Laut Nutzer verfügbar; Modell und iOS-Version offen |
| Android-Handy | Laut Nutzer verfügbar; Modell und Android-Version offen |
| Apple Watch | Laut Nutzer verfügbar; Modell, watchOS-Version und Kopplung mit dem Test-iPhone offen |
| Waveshare-Armband | Laut Nutzer verfügbar; exakte Boardrevision und Zusatzhardware ungeprüft |
| macOS/Xcode | Kein eigener macOS-Zugang; GitHub Actions mit temporärem macOS-/Xcode-Runner ist als Buildweg vorgesehen, im OrthoSohle-Repository noch nicht eingerichtet oder erprobt |
| AltServer | Laut Nutzer auf Windows installiert; soll eine heruntergeladene unsignierte iPhone-IPA mit dem Apple-Account signieren und per USB installieren; der konkrete Ablauf ist in diesem Projekt noch nicht erprobt |
| Wear-OS-Uhr | Bisher nicht als verfügbar genannt; keine reale Abnahme möglich |

Verfügbarkeit ist eine Nutzerangabe, kein durchgeführter Hardware-/Verbindungstest. Kein Simulator als Ersatz für reale Hintergrund-/Haptik-/BLE-Abnahme. Vereinbarter iPhone-Erprobungsweg: GitHub Actions baut den iPhone-Code in einem temporären macOS-Runner mit Xcode und erzeugt eine unsignierte IPA. Diese wird heruntergeladen; AltServer auf Windows signiert sie mit dem Apple-Account und installiert sie per USB auf das iPhone. AltStore auf dem iPhone ist laut Nutzer dafür nicht erforderlich. Bei kostenloser Signierung muss die Installation üblicherweise nach sieben Tagen erneuert werden. Dieser Ablauf ist im OrthoSohle-Repository noch nicht umgesetzt oder praktisch geprüft; Signierung und Geräteeinsatz zuerst mit einer kleinen Test-App verifizieren. Konkrete SDK-/Deploymentversionen nach Gerätebestand wählen.

Der iPhone-Ablauf belegt noch keinen Apple-Watch-Build oder Watch-Installationsweg. watchOS-Targets und Companion-Verteilung haben zusätzliche Anforderungen; Erzeugung des passenden Watch-Artefakts, Signierung, Kopplung und Installation auf der realen Uhr müssen gesondert geprüft werden. Debugging auf echten gekoppelten Geräten bleibt Bestandteil der Abnahme.

Apple-Watch-Codebau ist mit dem geplanten GitHub-Actions-Weg grundsätzlich zu erproben; reale Installation und Abnahme bleiben bis zum Nachweis des Watch-spezifischen Ablaufs offen. Anforderungsklärung, Protokoll-/Testdatenentwurf sowie Android-/Waveshare-Arbeit bleiben möglich. Keine Simulator-/Sideload-Erfolge ohne tatsächlich gebauten und auf der Uhr getesteten Client behaupten.

## Früher Funktionsvorschlag – noch abzustimmen

Erster kleiner Client: aktuelle kg-Belastung, bestätigte Grenze, Verbindungs-/Datenalterstatus und ein klarer Test für haptisches Feedback. Der Arzt bleibt für die medizinische Grenze verantwortlich; die Watch erhält keine unabhängige Änderungsberechtigung. Welche Warnfunktion für die erste Version zugesagt wird, erst nach echten Tests entscheiden.

Erster zu prüfender Datenweg: Sohle → iPhone → Apple-Watch-Client. Das ist ein Machbarkeitsvorschlag, keine beschlossene Transportbibliothek oder Zusage für gesperrtes Telefon/geschlossene Apps. Foreground, Hintergrund, Abbruch und Wiederverbindung separat testen. Direkter BLE-Empfang der Watch wäre eine eigene Option mit gesonderter Komplexität, nicht automatisch Teil des ersten Clients. Keine beliebig vielen BLE-Verbindungen an der Sohle voraussetzen.

## Meilensteine – in die Plattformplanung integriert

| ID | Ergebnis | Abnahme / Einordnung |
|---|---|---|
| WATCH-01 | Apple-Watch-Funktionsumfang und Abhängigkeiten festlegen | Anzeige/Warnung/Konfiguration, Telefonabhängigkeit und Abnahmekriterien in M0 bestimmt |
| WATCH-02 | GitHub-Actions- und Geräteweg praktisch erproben | Kleine iPhone-Test-App per macOS-Runner bauen, IPA über AltServer installieren; watchOS-Target, Signierung und echte Watchinstallation gesondert nachweisen; Modelle/OS erfassen |
| WATCH-03 | Früher Datenweg auf echter Apple Watch | kg, Qualität, Datenalter und Planversion mit Testdaten sichtbar; Abbruch erkennbar, Teil von M1 |
| WATCH-04 | Gemeinsamen Client ausbauen | Reale Sitzungsdaten über denselben Plan-/Nutzerkontext; Haptik-/Hintergrundgrenzen belegt, abgestimmt mit M3–M5 |
| WATCH-05 | Apple-Watch-Unterstützung abnehmen | Unterstützte Geräte/Versionen, Funktionen, Abhängigkeiten und Testnachweise vor gemeinsamer M7-Abnahme dokumentiert |
| WATCH-06 | Wear OS oder weitere Modelle ergänzen | Erst nach expliziter Auswahl, Testhardware und neuer Schätzung; gemeinsame Verträge wiederverwenden |

Der alte Smartwatch-PoC B16 im Semesterbacklog ist bei der Neuschätzung in diese Aufgaben zu überführen, nicht zusätzlich zu zählen. Aufwand, verbindlicher Releaseumfang und Termine bleiben offen; die alte Appschätzung ist keine Zusage für native Watch-/Companionentwicklung. Keine neuen Codeordner oder Abhängigkeiten, bevor eine echte Implementierungsaufgabe beginnt.
