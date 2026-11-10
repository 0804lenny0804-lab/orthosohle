# OrthoSohle – aktueller Projektkontext

Stand: 10.11.2026. Regeln ausschließlich in [AGENTS.md](../AGENTS.md); Start und Dateien der aktiven Anwendung in [code/README.md](../code/README.md).

## Ziel und aktueller Schwerpunkt

Ärzte-/Patientensystem für nachvollziehbare Teilbelastung mit unabhängiger Armbandwarnung. Aktueller Auftrag: die alte Webapp als Grundlage zu einer produktreifen Webapp weiterentwickeln und daraus installierbare Android- und iOS-Apps erzeugen. Ein separates Firmwareprojekt entwickelt die Waveshare-Armbandsoftware mit eigener Verbindung zur Sohle und Anbindung an App, Daten und Backend. Nutzer bestätigt den erfolgreichen Displaytest am ESP32-S3-Touch-LCD-1.28; BLE-Empfang des neuen Prototyps steht noch aus. Historischer Sohlenaufbau und verfügbare Smartphone-/Watchgeräte sind in [project-background.md](project-background.md) eingeordnet.

## Belegter Softwarestand

- [Altbestand](legacy/README.md): 51 unveränderte Dateien aus dem GitLab-ZIP mit [Manifest](legacy/manifest.json); ursprünglicher GitLab-Commit unbekannt. Referenz, keine Produktfreigabe.
- Nutzerauftrag: Implementierung von null neu beginnen und den bisherigen neuen Webapp-/Auth-Code entfernen. Dieser Stand ist unter Git-Tag `archive/2026-10-29/before-mobile-restart` gesichert.
- Die neue Patienten-Webapp und Datenhaltung sind noch nicht implementiert. Ein enger Desktop-/Chromium-BLE-Durchstich liegt unter `code/simulator-bridge/` und `code/firmware/esp32s3-display-receiver/`: Legacy-ähnliche synthetische Schrittwerte werden zum Waveshare-Display geschrieben. Er ist kein iPhone-BLE-Pfad. Der Altbestand bleibt die Grundlage der Webapp-Weiterentwicklung.
- Zielrichtung: gemeinsame Webapp für Patienten und Ärzte, daraus installierbare Android- und iOS-Apps sowie separates Waveshare-Firmwareprojekt. Verpackung, native Schnittstellen, Auth, Hosting und produktive Geräteverbindungen bleiben offen.

## Nachweise und Grenzen

Der einfache Display- und USB-Serielltest ist laut Nutzer am 10.11.2026 erfolgreich. Der neue BLE-Durchstich ist noch nicht auf Hardware gebaut oder getestet. Die acht Auth-/API-Tests und der Webbuild des archivierten Versuchs sind historische Nachweise des entfernten Versuchs. Hardware-BLE, mobile Buildkette, Hintergrundbetrieb, Datenschutz-/Betriebs- und Einsatzfreigaben bleiben offen.

## Nächster konkreter Schritt

Zuerst den BLE-Durchstich aus `code/simulator-bridge/README.md` mit dem Board prüfen. Danach den Altbestand anhand der Anforderungen als Webapp-Grundlage übernehmen und eine reproduzierbare lokale Startkette herstellen. Den Web-zu-Android/iOS-Weg einschließlich nativer BLE-Schnittstelle und Hintergrundverhalten evaluieren; Geräte- und Backendvertrag für Webapp und Firmwareprojekt konkretisieren.

## Navigation ohne doppelte Pflege

| Inhalt | Maßgebliche Stelle |
|---|---|
| Regeln und Git-Ablauf | [AGENTS.md](../AGENTS.md) |
| Projektziel, Rahmen, Hardware und historische Grenzen | [project-background.md](project-background.md) |
| Anforderungen und M0–M8 | [requirements.md](requirements.md) |
| Beschlüsse und Historie | [decisions.md](decisions.md) |
| Aufgaben, Status und bisherige Schätzungen | [backlog.csv](backlog.csv) |
| Detailanalyse des Altbestands | [analysis.md](analysis.md) |
| Alte Quellen / Code / Prüfbelege | [sources](sources/README.md), [legacy](legacy/README.md), [checks](checks/baseline.md) |
| Zusätzlicher Watch-Arbeitsbereich | [watch-compatibility.md](watch-compatibility.md) |
| Aktiver Anwendungscode, Installation und Datenfluss | [code/README.md](../code/README.md) |

Dieser Arbeitsstand liegt auf `paul/code` gemäß aktuellem Nutzerauftrag. Integration nach `main` erfolgt per Pull Request gemäß AGENTS.md.

Das Backlog ist softwareseitig neu geplant. Die Schätzungen sind vorläufige echte Personenstunden für die aufgeführten Arbeitsschritte, keine belastbare Gesamtschätzung bis zur Produktfreigabe; nach den ersten Spikes nachschärfen. Hardwarebeschaffung und Bau sind nicht Teil dieses Backlogs; Geräteprüfungen bleiben abhängig von verfügbaren Geräten. Der historische 600-Personenstunden-Plan ist keine belastbare Schätzung des erweiterten Produktumfangs. Offene Aufgaben und neue Schätzungen werden im Backlog gepflegt. Lokale Gitstände und Branches ergeben sich aus Git, nicht aus vorweggenommenen Commitangaben hier.
