# Aktive Web-App-Basis

Dieser Bereich ist eine erste Kopie der bisherigen Vue-3-/Vite-Web-App aus `context/legacy/orthopaul/local-comm/frontend`. Quellstand und Assets wurden für den Neustart übernommen; an der Funktion wurde in diesem Schritt nichts geändert. Die Originalreferenz bleibt unverändert und ist über das Manifest prüfbar.

## Lokal installieren und bauen

Voraussetzung ist Node.js gemäß `package.json` (`^20.19.0 || >=22.12.0`) und npm. Im Repository-Root:

```bash
npm ci --prefix code/webapp
npm run dev --prefix code/webapp
npm run build --prefix code/webapp
```

Der Entwicklungsserver ist standardmäßig unter `http://localhost:5173` erreichbar. Für API-Aufrufe kann `VITE_API_URL` gesetzt werden; der bestehende Standard `http://localhost:3000` funktioniert nicht als Adresse eines entfernten Mobilgeräts.

Erstprüfung am 06.11.2026: `npm ci` und `npm run build` erfolgreich mit Node 24.19.0 und npm 11.9.0. Das bestätigt nur den Web/PWA-Build, keine APK, IPA oder Gerätefunktion.

## Grenzen des übernommenen Prototyps

- Dieser Vue/Vite-Build erzeugt eine Web-App/PWA, keine APK oder IPA.
- Es gibt noch keine native Verpackung, Signierung oder Zielgeräte-Buildpipeline.
- Bluetooth verwendet Web Bluetooth und ist kein nachgewiesener BLE-Weg für iOS oder native WebViews.
- Nutzer-ID `1`, API-Aufrufe und bestehende Push-/Cache-Konfiguration sind Prototypverhalten und nicht für echte Patienten-/Gesundheitsdaten freigegeben.
- Simulation und echte Gerätedaten müssen vor einer Produktnutzung klar getrennt werden.

Die nächsten Arbeiten sind in [Projektkontext](../../context/context.md), [Anforderungen](../../context/requirements.md) und [Backlog](../../context/backlog.csv) maßgeblich. Für weitere Migrationsschritte gelten [AGENTS.md](../../AGENTS.md) und die [Agentenrollen](../../context/agents/).
