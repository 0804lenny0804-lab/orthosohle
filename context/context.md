# OrthoSohle – aktueller Projektkontext

Stand: 10.11.2026. Regeln ausschließlich in [AGENTS.md](../AGENTS.md); Start und Dateien der aktiven Anwendung in [code/README.md](../code/README.md).

## Ziel und aktueller Schwerpunkt

Ärzte-/Patientensystem für nachvollziehbare Teilbelastung mit unabhängiger Armbandwarnung. Aktueller Auftrag: die alte Webapp als Grundlage zu einer produktreifen Webapp weiterentwickeln und daraus installierbare Android- und iOS-Apps erzeugen. Ein zweites Projekt entwickelt eigene Software für das Waveshare-Armband mit eigener Verbindung zur Sohle und Anbindung an App, Daten und Backend. Das ausgewählte Waveshare-Armband ist laut Nutzer noch nicht vorhanden. Historischer Sohlenaufbau und verfügbare Smartphone-/Watchgeräte sind in [project-background.md](project-background.md) eingeordnet.

## Belegter Softwarestand

- [Altbestand](legacy/README.md): 51 unveränderte Dateien aus dem GitLab-ZIP mit [Manifest](legacy/manifest.json); ursprünglicher GitLab-Commit unbekannt. Referenz, keine Produktfreigabe.
- Nutzerauftrag: Implementierung von null neu beginnen und den bisherigen neuen Webapp-/Auth-Code entfernen. Dieser Stand ist unter Git-Tag `archive/2026-10-29/before-mobile-restart` gesichert.
- Aktuell kein neuer ausführbarer Anwendungscode, keine Anmeldung und keine neue Datenhaltung. code/ enthält den Einstieg zum Neuaufbau. Regeln, Kontext, Anforderungen und Altbestand bleiben erhalten.
- Zielrichtung: gemeinsame Webapp für Patienten und Ärzte, daraus APK und IPA; eigenes Waveshare-Firmwareprojekt. Verpackung, native Schnittstellen, Auth, Hosting und konkrete Geräteverbindungen sind offen. Der Altbestand ist die Entwicklungsgrundlage; seine Übernahme in code/ steht noch aus.

## Nachweise und Grenzen

Die acht Auth-/API-Tests und der Webbuild des archivierten Versuchs sind historische Nachweise dieses entfernten Versuchs. Sie belegen keine Funktionen des Neustarts. Aktuell prüfbar: Repositorystruktur, Dokumentationslinks, Backlog und unveränderte Originaldateien. Hardware, mobile Buildkette, BLE, Hintergrundbetrieb, Watch, Datenschutz-/Betriebs- und Einsatzfreigaben bleiben offen.

## Nächster konkreter Schritt

Altbestand anhand der Produktanforderungen als Entwicklungsgrundlage übernehmen und eine reproduzierbare lokale Startkette herstellen. Anschließend Web-zu-Android/iOS-Weg einschließlich BLE, Hintergrundverhalten und Signierung evaluieren sowie den Geräte- und Backendvertrag für beide Projekte konkretisieren. Hardwarepfade auf echten Geräten nachweisen.

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

Dieser Chat arbeitet ab der Strukturintegration ausschließlich auf `lenni/code`; `paul/code` ist Pauls Arbeitsbranch. Integration nach `main` erfolgt per Pull Request gemäß AGENTS.md.

Das Backlog ist softwareseitig neu geplant. Die Schätzungen sind vorläufige echte Personenstunden für die aufgeführten Arbeitsschritte, keine belastbare Gesamtschätzung bis zur Produktfreigabe; nach den ersten Spikes nachschärfen. Hardwarebeschaffung und Bau sind nicht Teil dieses Backlogs; Geräteprüfungen bleiben abhängig von verfügbaren Geräten. Der historische 600-Personenstunden-Plan ist keine belastbare Schätzung des erweiterten Produktumfangs. Offene Aufgaben und neue Schätzungen werden im Backlog gepflegt. Lokale Gitstände und Branches ergeben sich aus Git, nicht aus vorweggenommenen Commitangaben hier.
