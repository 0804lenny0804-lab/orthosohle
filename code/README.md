# Aktiver Entwicklungsbereich

## Mobile Patienten-App

[mobile/package.json](mobile/package.json): erster React-Native-/Expo-Prototyp mit TypeScript. Unabhängig vom archivierten Vue-Versuch neu aufgebaut. Aktuell: Übersicht mit fehlendem Plan/Gerät und manuell bedienbare Demo-Sitzung. Keine Anmeldung, API, Datenbank, BLE-Verbindung oder Warnfunktion. Demo-Daten liegen ausschließlich im Arbeitsspeicher; Zurückgehen zur Übersicht oder ein App-Neustart verwirft sie.

## Installation und Prüfungen

Node 24.3+ und npm. Aus dem Repository-Root:

```bash
npm ci --prefix code/mobile
npm run typecheck --prefix code/mobile
npm test --prefix code/mobile
npm run export --prefix code/mobile
```

Export erzeugt JavaScript-/Asset-Bundles für iOS und Android, keine installierbare APK/IPA. Generierte Dateien, native Projektordner, Zugangsdaten und Signaturschlüssel sind ignoriert. Das Grundprojekt basiert auf dem offiziellen Expo-Template `expo-template-blank-typescript@58.0.30`; Lizenz liegt unter mobile/template-license.txt. Paketversionen sind im Lockfile festgehalten.

## Auf einem Gerät starten

Ein eigener Development Build ist vorgesehen; Expo Go ist nicht die Grundlage für den späteren BLE-Pfad. Android benötigt zunächst Android Studio/SDK und ein per USB erreichbares Testgerät oder einen Emulator. Im Verzeichnis code/mobile ausführen:

```bash
npm run android
npm start
```

`expo run:android` erzeugt das native Projekt lokal und baut/installiert den Development Client; `npm start` startet Metro für diesen installierten Client. Gerät und Entwicklungsrechner müssen den Metro-Server erreichen können. iOS lokal benötigt macOS, Xcode und passende Signierung; dort `npm run ios`. Diese nativen Schritte sind in der aktuellen Linux-Umgebung ohne Android-SDK/Xcode nicht ausgeführt. Noch keine APK/IPA oder Geräteabnahme vorhanden.

Alternativ ist [eas.json](mobile/eas.json) für einen Development Build und eine interne Android-Test-APK vorbereitet. Ein EAS-Build benötigt Expo-Konto, Projektzuordnung und gegebenenfalls Signierung. Es wurde kein Cloudprojekt angelegt und kein Build hochgeladen. Vor einem Cloudbuild Quellcodeübertragung, Konto und Kosten bewusst festlegen. Store-Releases benötigen eigene Identitäten, App-Icons, Signierung, Metadaten und weitere Prüfungen; `de.orthosohle.prototype` ist zunächst eine lokale Prototypkennung.

## Dateiverantwortlichkeiten

| Datei | Aufgabe |
|---|---|
| mobile/index.ts | Native App registrieren |
| mobile/App.tsx | Seitenrahmen, Safe Areas und Wechsel Übersicht/Demo |
| mobile/src/screens/OverviewScreen.tsx | Patientenübersicht mit ausdrücklich fehlendem Plan und Gerät |
| mobile/src/screens/DemoSessionScreen.tsx | Demo-Bedienung und flüchtiger UI-Zustand |
| mobile/src/domain/demo-session.ts | Reine, plattformunabhängige Demo-Sitzungsübergänge und Validierung |
| mobile/src/components/InfoCard.tsx | Gemeinsame Kartendarstellung |
| mobile/src/components/ActionButton.tsx | Gemeinsamer zugänglicher Button |
| mobile/src/theme.ts | Gemeinsame Gestaltungswerte |
| mobile/tests/demo-session.test.mjs | Fachliche Grenzfälle und unveränderte Eingaben nachweisen |
| mobile/app.json | Native Expo-Konfiguration und Prototypkennungen |
| mobile/eas.json | Noch nicht ausgeführte interne Buildprofile |

## Nächste technische Abnahme

Erst eine echte Installation auf Android und iOS nachweisen; danach BLE-Transport und Verhalten bei Gerätesperre/Verbindungsabbruch prüfen. Keine Bibliothek verspricht allein zuverlässigen Hintergrundempfang. BLE-Bibliothek und Berechtigungen erst mit konkretem Gerätepfad einführen; die App fragt bisher keine Sensor-/Bluetoothberechtigungen an. Apple Watch braucht zusätzlich native watchOS-Arbeit.

Backend und Ärzteportal werden über gemeinsame versionierte API-Verträge angebunden. Es gibt noch keinen Server oder gemeinsam benutztes Paket. Auth-/Datenbank-/Hostingwahl bleibt offen. [Regeln](../AGENTS.md), [Anforderungen](../context/requirements.md) und [Kontext](../context/context.md) bleiben maßgeblich; [Altcode](../context/legacy/README.md) ist nur Referenz.


## Offene Sicherheitsbefunde der Toolchain

`npm audit --omit=dev` meldet am 29.10.2026 acht transitive Befunde (fünf niedrig, drei hoch) zu deepmerge und zod im Expo-Werkzeugbaum. Reguläres `npm audit fix` beseitigt sie nicht; die vorgeschlagene erzwungene SDK-Rückstufung wurde nicht ausgeführt. Keine ungeprüften Major-Overrides setzen. Vor Freigabe gepatchte kompatible Versionen oder eine geprüfte alternative Lösung nachweisen. Quellen: https://github.com/advisories/GHSA-gcqx-w48m-w2h4 und https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 . Die Einordnung in Tooling bedeutet keine pauschale Entwarnung für verarbeitete Eingaben. Der Prototyp verarbeitet nur eigene synthetische Daten und ist nicht freigegeben.


## iPhone-Testversion über GitHub Actions und AltServer

[Workflow](../.github/workflows/iphone-test.yml) baut auf einem macOS-26-Runner eine **unsignierte Release-IPA für echte iPhones**. [Buildskript](../scripts/build-iphone-test.sh) erzeugt das native Expo-Projekt, installiert Pods, archiviert ohne Apple-Signierung und verpackt Payload/OrthoSohle.app. Das JS-Bundle ist enthalten; für diese Testversion läuft auf dem iPhone kein Metro-Server. Quellstand, minimale iOS-Version und SHA-256 liegen im Artifact neben der IPA. Keine Apple-Zugangsdaten oder Zertifikate an GitHub übergeben.

Auslösung: Push relevanter Dateien auf lenni/code, Pull Request nach main oder manueller Workflowstart (manuell erst nach Verfügbarkeit des Workflows auf dem Standardbranch). Workflow heißt „iPhone test IPA“. Erfolgreichen Run öffnen, Artifact `OrthoSohle-iPhone-unsigned-<Commit>` herunterladen und ZIP entpacken. Erst ein tatsächlich erfolgreiches Artifact ist ein Buildnachweis.

Unter Windows: iPhone per USB verbinden, Rechner vertrauen und AltServer starten; passende Apple-Gerätetreiber/iTunes-/iCloud-Voraussetzungen gemäß installierter AltServer-Version beachten. Bei unterstützter AltServer-Version mit gedrückter Umschalttaste das Tray-Menü öffnen und „Sideload .ipa“ wählen, IPA auswählen und den Apple-Account **ausschließlich lokal in AltServer** verwenden. Falls dieser Menüpunkt fehlt, die konkrete AltServer-Version prüfen; nicht annehmen, dass „Install AltStore“ unsere IPA installiert. Geräteinstallation und Signierung sind getrennte Schritte vom GitHub-Build. Gegebenenfalls Entwicklerprofil in iOS bestätigen und Entwicklermodus aktivieren. Kostenlose Signierung gilt typischerweise sieben Tage; Apple-Limits und kompatible iOS-Version anhand build-info.txt prüfen.

Die App enthält nur die Demo und ist keine Store-/medizinische Freigabe. Apple-Watch-Installation ist nicht Bestandteil dieses Workflows. Externe Referenzen: https://altstore.io/ und https://faq.altstore.io/ . Der lokale Windows-/Geräteschritt kann aus dieser Linux-Umgebung nicht ausgeführt werden.

Erster nativer Build erfolgreich: [Testversion herunterladen](https://github.com/0804lenny0804-lab/orthosohle/actions/runs/40881122888/artifacts/12900003975) (Artifact bis 05.11.2026). [Prüfnachweis und Grenzen](../context/checks/iphone-test-build.md). Die IPA ist unsigniert; erst AltServer signiert sie lokal.
