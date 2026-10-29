# Unsigned iPhone test build – 29.10.2026

## Aufbau und Quelle

- Anwendung: React Native/Expo-Demo unter code/mobile, ausschließlich synthetische Daten.
- Branch: lenni/code; Workflow-Quellcommit 3de9e569d36f0901bc447e7004814d562d9863c2.
- PR-Test baut temporären Mergecommit 89539bc043695b35eb37a40d3992c6bbf2c05e65.
- GitHub-Runner macOS 26, Xcode 26.6 (17F113), Node 24.22.1 laut Buildlog.
- [Pull Request 7](https://github.com/0804lenny0804-lab/orthosohle/pull/7), [Run 40881122888](https://github.com/0804lenny0804-lab/orthosohle/actions/runs/40881122888), Job 123472590519.

## Erwartung und Beobachtung

Erwartet: ohne Apple-Account eine unsignierte Release-IPA für echte iPhones erstellen, JS-Bundle einbetten und als GitHub-Artifact anbieten.

Beobachtet: Abhängigkeiten, TypeScript, zwei Demo-Logiktests und Repositoryprüfung erfolgreich. Xcode meldet ARCHIVE SUCCEEDED. Buildskript hat App-Bundle, main.jsbundle und arm64-Executable vor dem Verpacken geprüft. Job und Artifactupload erfolgreich abgeschlossen. Das ist ein Buildnachweis, kein Nachweis einer auf einem iPhone gestarteten App.

[Artifact herunterladen](https://github.com/0804lenny0804-lab/orthosohle/actions/runs/40881122888/artifacts/12900003975): 7.800.054 Bytes; Artifact-ZIP-SHA256 `1fe6d14f4e87f549bd92de66b565c61e251d39de201be2c62f438d9a22cfee1b`. Verfügbar bis 05.11.2026 laut GitHub. Enthält laut erfolgreichem Upload OrthoSohle-unsigned.ipa und build-info.txt. Letztere enthält die tatsächliche minimale iOS-Version und IPA-Prüfsumme; nicht aus einzelnen Deploymenttargets von Pods ableiten.

## Grenzen und nächste Abnahme

GitHub-Metadaten und fertiges Buildlog wurden über Connector geprüft. Lokaler Abruf der vom Downloadtool ausgegebenen temporären Datei-URL wurde mit HTTP 403 abgewiesen; kein zusätzliches lokales Entpacken/Plist-Lesen behauptet. Der GitHub-Artifactlink ist der Benutzerdownload.

Windows-PC und iPhone sind nicht mit dieser Sitzung verbunden; kein lokales Terminal angehängt. Daher AltServer-Version, tatsächliches iPhone/iOS, Signierung, Installation und Appstart nicht selbst geprüft. Diese Angaben bleiben unbekannt. Keine Apple-Zugangsdaten an GitHub oder Chat übermittelt.

Nächste Abnahme: Artifact unter Windows herunterladen/entpacken, lokale AltServer-Signierung, USB-Installation und Appstart ohne Metro. Entwicklerprofil/Entwicklermodus sowie iOS-Kompatibilität am tatsächlichen Gerät prüfen. Die zuvor dokumentierten Expo-Toolchain-Sicherheitsbefunde und sämtliche Produkt-/BLE-/Hintergrund-/Watchfreigaben bleiben offen.

## Installationsrückmeldung

Nutzer meldet „could not install in this time“. Vollständiger Wortlaut, Fehlercode und Stelle (AltServer oder iPhone) noch unbekannt. Installation damit nicht abgenommen; erfolgreicher GitHub-Build belegt keine erfolgreiche Signierung oder Installation. Vor erneutem Build vollständige Meldung und Installationsschritt erfassen. Keine Ursache als bestätigt behandeln.
