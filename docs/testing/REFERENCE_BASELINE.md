# Referenzprüfung – 20.10.2026

Quelle: orthopaul-main.zip, siehe [Herkunft](../references/README.md). Tests wurden vor dem Import in `/workspace/reference/orthopaul-main` mit Node 24.19.0 durchgeführt, nicht auf Hardware oder einem öffentlichen Deployment.

## Geprüft

- Frontend: `npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/scratch/npm-cache`, danach `npm run build`; erfolgreich inklusive Service Worker.
- Backend: `npm ci --no-audit --no-fund --cache /workspace/scratch/npm-cache`; anschließend Server mit temporärem SQLITE_DIR und isoliertem Port gestartet und wieder beendet.
- HTTP-Smoke-Checks: [Ergebnisse](../ORTHOSOHLE_PRUEFERGEBNISSE.json). Grenzwertantwort verschachtelt; negative Grenze akzeptiert; Lesen/Schreiben und Laufstart ohne Anmeldung möglich; nicht existente Lauf-ID meldet erfolgreiches Ende.
- Zwei synthetische StepDetector-Sequenzen direkt in Node ausgeführt, jeweils ein Peak. Kein belastbarer Gang-/Genauigkeitstest.

## Reproduktion des historischen Builds

Aus dem Repository-Root, Node gemäß frontend/package.json (historisch ^20.19 oder >=22.12):

```bash
npm ci --prefix reference/orthopaul/local-comm/frontend
npm run build --prefix reference/orthopaul/local-comm/frontend
npm ci --prefix reference/orthopaul/local-comm/server
```

Bei einem nicht schreibbaren npm-Standardcache einen beschreibbaren Cache per `--cache` wählen. Für Backendtests SQLITE_DIR als Prozessvariable auf ein leeres temporäres Verzeichnis setzen; der Altcode liest .env für den DB-Pfad zu spät. Keine bestehenden Datenbanken überschreiben und keine echten Push-Subscriptions verwenden. Der Backend-Testscript ist nur ein Fehlerplatzhalter.

## Grenzen

Kein Beleg für Hardwarefunktion, klinische Genauigkeit, Akkulaufzeit, BLE-Rate, echte Nutzertrennung oder Hintergrundwarnung. Die Struktureinrichtung führt keine Produktmigration durch; diese Tests werden dadurch nicht zu Tests aktiver Produktmodule.
