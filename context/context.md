# OrthoSohle – aktueller Projektkontext

Stand: 10.11.2026. Regeln ausschließlich in [AGENTS.md](../AGENTS.md); Start und Dateien der aktiven Anwendung in [code/README.md](../code/README.md).

## Ziel und aktueller Schwerpunkt

Ärzte-/Patientensystem für nachvollziehbare Teilbelastung mit unabhängiger Armbandwarnung. Aktueller Auftrag: sauberer Neustart für installierbare iOS-/Android-App plus kompatibles Webportal. Das ausgewählte Waveshare-Armband ist laut Nutzer noch nicht vorhanden. Historischer Sohlenaufbau und verfügbare Smartphone-/Watchgeräte sind in [project-background.md](project-background.md) eingeordnet.

## Belegter Softwarestand

- [Altbestand](legacy/README.md): 51 unveränderte Dateien aus dem GitLab-ZIP mit [Manifest](legacy/manifest.json); ursprünglicher GitLab-Commit unbekannt. Referenz, keine Produktfreigabe.
- Nutzerauftrag: Implementierung von null neu beginnen und den bisherigen neuen Webapp-/Auth-Code entfernen. Dieser Stand ist unter Git-Tag `archive/2026-10-29/before-mobile-restart` gesichert.
- Aktuell keine neue Patienten-App, Anmeldung oder Datenhaltung. Ein enger Desktop-/Chromium-BLE-Durchstich liegt nun unter `code/simulator-bridge/` und `code/firmware/esp32s3-display-receiver/`: Legacy-ähnliche synthetische Schrittwerte werden zum Waveshare-Display geschrieben. Er ist kein iOS-Pfad und keine Integration in eine Patienten-App.
- Zielrichtung: native Plattformzugriffe im iOS-/Android-Patientenclient, gemeinsame Backend-API und webbasiertes Ärzteportal. Kein mobiles Framework, neuer Auth-Stack oder Hosting ausgewählt.

## Nachweise und Grenzen

Der einfache Display- und USB-Serielltest ist laut Nutzer am 10.11.2026 erfolgreich. Der neue BLE-Durchstich ist noch nicht auf Hardware gebaut oder getestet. Die acht Auth-/API-Tests und der Webbuild des archivierten Versuchs sind historische Nachweise des entfernten Versuchs. Hardware-BLE, mobile Buildkette, Hintergrundbetrieb, Datenschutz-/Betriebs- und Einsatzfreigaben bleiben offen.

## Nächster konkreter Schritt

Zuerst den BLE-Durchstich aus `code/simulator-bridge/README.md` am Board bauen und prüfen. Danach mobile Zielarchitektur anhand BLE, Offlineablage, sicherer Anmeldung/Deep Links, iOS-/Android-Build und Watch-Anbindung auswählen. Die Patienten-App und das Webportal erhalten später dieselben versionierten API-Verträge; gemeinsame Datenbasis allein garantiert noch keine korrekten Rechte oder Synchronisierung.

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

Der historische 600-Personenstunden-Plan ist keine belastbare Schätzung des erweiterten Produktumfangs. Offene Aufgaben und neue Schätzungen werden im Backlog gepflegt. Lokale Gitstände und Branches ergeben sich aus Git, nicht aus vorweggenommenen Commitangaben hier.
