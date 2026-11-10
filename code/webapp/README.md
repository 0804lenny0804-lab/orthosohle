# Aktive Web-App-Basis

Dieser Bereich ist eine erste Kopie der bisherigen Vue-3-/Vite-Web-App aus `context/legacy/orthopaul/local-comm/frontend`. Quellstand und Assets wurden für den Neustart übernommen; inzwischen sind die dokumentierten UI-Korrekturen und der lokale Kontobereich hinzugekommen. Die Originalreferenz bleibt unverändert und ist über das Manifest prüfbar.

## Lokal installieren und bauen

Voraussetzung ist Node.js gemäß `package.json` (`^20.19.0 || >=22.12.0`) und npm. Im Repository-Root:

```bash
npm ci --prefix code/webapp
npm test --prefix code/webapp
npm run dev --prefix code/webapp
npm run build --prefix code/webapp
```

Der Entwicklungsserver ist unter `http://127.0.0.1:5173` erreichbar (fester lokaler Port). Der neue Bereich `#account` verwendet ausschließlich relative Kontoaufrufe über den Vite-Proxy zum Backend. API-Konfiguration, Migration und Start stehen maßgeblich in [code/README.md](../README.md#web-app-mit-lokalem-kontobereich-starten). Für API-Aufrufe kann `VITE_API_URL` gesetzt werden; der bestehende Standard `http://localhost:3000` funktioniert nicht als Adresse eines entfernten Mobilgeräts.

Erstprüfung am 06.11.2026: `npm ci` und `npm run build` erfolgreich mit Node 24.19.0 und npm 11.9.0. Das bestätigt nur den Web/PWA-Build, keine APK, IPA oder Gerätefunktion.

## Grenzen des übernommenen Prototyps

- Dieser Vue/Vite-Build erzeugt eine Web-App/PWA, keine APK oder IPA.
- Es gibt noch keine native Verpackung, Signierung oder Zielgeräte-Buildpipeline.
- Bluetooth verwendet Web Bluetooth und ist kein nachgewiesener BLE-Weg für iOS oder native WebViews.
- Demo-Messwerte, Einstellungen und Läufe bleiben nur flüchtig im Arbeitsspeicher. Sie werden beim Konto-Wechsel zurückgesetzt und nicht mit dem Better-Auth-Konto gespeichert.
- Die aktiven Fachendpunkte für Limits, Messwerte, Läufe und Push existieren noch nicht. Simulations-/Konfigurationsaktionen melden deshalb keine Server-Synchronisierung.
- Historische Browserwerte mit der früheren festen Nutzer-ID und der gemeinsame aktive Lauf werden beim App-Start aus dem lokalen Speicher entfernt. Das löscht nur bekannte OrthoSohle-Prototypschlüssel.
- Simulation und echte Gerätedaten müssen vor einer Produktnutzung klar getrennt werden.

Die nächsten Arbeiten sind in [Projektkontext](../../context/context.md), [Anforderungen](../../context/requirements.md) und [Backlog](../../context/backlog.csv) maßgeblich. Für weitere Migrationsschritte gelten [AGENTS.md](../../AGENTS.md) und die [Agentenrollen](../../context/agents/).
