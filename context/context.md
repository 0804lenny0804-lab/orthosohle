# OrthoSohle – aktueller Projektkontext

Stand: 29.10.2026. Regeln ausschließlich in [AGENTS.md](../AGENTS.md); Start und Dateien der aktiven Anwendung in [code/README.md](../code/README.md).

## Ziel und aktueller Schwerpunkt

Ärzte-/Patientensystem für nachvollziehbare Teilbelastung mit unabhängiger Armbandwarnung. Aktueller Auftrag: sauberer Neustart für installierbare iOS-/Android-App plus kompatibles Webportal. Das ausgewählte Waveshare-Armband ist laut Nutzer noch nicht vorhanden. Historischer Sohlenaufbau und verfügbare Smartphone-/Watchgeräte sind in [project-background.md](project-background.md) eingeordnet.

## Belegter Softwarestand

- [Altbestand](legacy/README.md): 51 unveränderte Dateien aus dem GitLab-ZIP mit [Manifest](legacy/manifest.json); ursprünglicher GitLab-Commit unbekannt. Referenz, keine Produktfreigabe.
- Nutzerauftrag: Implementierung von null neu beginnen und den bisherigen neuen Webapp-/Auth-Code entfernen. Dieser Stand ist unter Git-Tag `archive/2026-10-29/before-mobile-restart` gesichert.
- Neuer unabhängiger mobiler Prototyp unter code/mobile: React Native/Expo/TypeScript, native Übersicht und manuelle Demo-Sitzung. Keine Anmeldung, API, neue Datenhaltung oder Geräteverbindung. Regeln, Kontext, Anforderungen und Altbestand bleiben erhalten.
- Zielrichtung: native Plattformzugriffe im iOS-/Android-Patientenclient, gemeinsame Backend-API und webbasiertes Ärzteportal. Mobile Arbeitsgrundlage React Native/Expo Development Builds gewählt; Auth-Stack und Hosting offen.

## Nachweise und Grenzen

Die acht Auth-/API-Tests und der Webbuild des archivierten Versuchs sind historische Nachweise dieses entfernten Versuchs. Sie belegen keine Funktionen des Neustarts. Neue Prüfungen: TypeScript, zwei Fachlogiktests und erfolgreiche Android-/iOS-Bundleexports; native Installation und Gerätebedienung noch nicht nachgewiesen. Repositorystruktur, Links, Backlog und Originaldateien ebenfalls geprüft. Native Installation, BLE, Hintergrundbetrieb, Watch, Datenschutz-/Betriebs- und Einsatzfreigaben bleiben offen.

Offener Freigabeblocker: npm audit meldet acht transitive Expo-Toolchainbefunde (fünf niedrig, drei hoch); reguläres audit fix reicht nicht. Details und Advisories im Code-Einstieg. Keine sichere/produktreife Toolchain behaupten.

## Nächster konkreter Schritt

Erfolgreich gebaute unsignierte iPhone-Release-IPA lokal unter Windows mit AltServer signieren/installieren und Appstart ohne Metro prüfen. Android-Development-Build folgt separat. Hier fehlen Android-SDK und Xcode. Anschließend tatsächlichen BLE-/Hintergrundpfad prüfen. Die Demo ist ausschließlich synthetisch und flüchtig. Start-/Buildanleitung in code/README.md. App und Webportal erhalten dieselben versionierten API-Verträge; gemeinsame Datenbasis allein garantiert noch keine korrekten Rechte oder Synchronisierung.

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

Der historische 600-Personenstunden-Plan ist keine belastbare Schätzung des erweiterten Produktumfangs. Offene Aufgaben und neue Schätzungen werden im Backlog gepflegt. Lokale Gitstände und Branches ergeben sich aus Git, nicht aus vorweggenommenen Commitangaben hier.


Aktueller iPhone-Auftrag: macOS-26-GitHub-Runner plus AltServer unter Windows. Workflow und Buildskript eingerichtet; nativer Run 40881122888 erfolgreich, IPA als Artifact vorhanden. Nachweis und Download in [checks/iphone-test-build.md](checks/iphone-test-build.md). Geräteinstallation noch nicht nachgewiesen. Keine Apple-Zugangsdaten im Repository oder GitHub erforderlich. Der GitHub-Connector dient zur Laufprüfung; gh-CLI hat in dieser Umgebung keine gültige GitHub-API-Anmeldung.
