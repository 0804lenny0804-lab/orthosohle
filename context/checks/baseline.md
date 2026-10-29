# Referenzprüfung – 20.10.2026

Quelle: orthopaul-main.zip, siehe [Herkunft](../sources/README.md). Tests wurden vor dem Import in `/workspace/reference/orthopaul-main` mit Node 24.19.0 durchgeführt, nicht auf Hardware oder einem öffentlichen Deployment.

## Geprüft

- Frontend: `npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/scratch/npm-cache`, danach `npm run build`; erfolgreich inklusive Service Worker.
- Backend: `npm ci --no-audit --no-fund --cache /workspace/scratch/npm-cache`; anschließend Server mit temporärem SQLITE_DIR und isoliertem Port gestartet und wieder beendet.
- HTTP-Smoke-Checks: [Ergebnisse](api-results.json). Grenzwertantwort verschachtelt; negative Grenze akzeptiert; Lesen/Schreiben und Laufstart ohne Anmeldung möglich; nicht existente Lauf-ID meldet erfolgreiches Ende.
- Zwei synthetische StepDetector-Sequenzen direkt in Node ausgeführt, jeweils ein Peak. Kein belastbarer Gang-/Genauigkeitstest.

## Aktueller Einstieg

Reproduzierbare Installations-, Build- und lokale Startbefehle stehen ausschließlich in [code/README.md](../../code/README.md). Die obigen Kommandos beschreiben die historische Prüfung, keine zweite laufend gepflegte Startanleitung. Für Tests nur isolierte Testdatenbanken und keine echten Push-Subscriptions verwenden.

## Erneute Startprüfung nach Bereinigung – 20.10.2026

Auf Linux mit Node v24.19.0 in einer isolierten Kopie der neuen Struktur unter /workspace/scratch/orthosohle-start-check:

- Alle drei npm-Projekte über die neuen context/legacy/orthopaul-Pfade mit npm ci und beschreibbarem Cache installiert: erfolgreich.
- Produktionsbuild des Frontends einschließlich Service Worker: erfolgreich.
- Gemeinsames Root-Dev-Skript mit isoliertem SQLITE_DIR und USE_LOCAL=true gestartet. Frontend auf localhost:5173 lieferte index.html, API /api/peaks auf localhost:3000 eine JSON-Liste. Anschließend die gestartete Prozessgruppe beendet, temporäre Datenbank entfernt.
- Repository-Checker, drei Regressionstests (gültiger Stand, defekter Code-Dokumentationslink, geänderte Originaldatei) und Diff-Whitespaceprüfung erfolgreich. Originaldateien nach Verschiebung gegen Manifest geprüft.

Keine neuen Abhängigkeiten oder Testdatenbanken im eigentlichen Repository. PowerShell-Befehle, reale Hardware und BLE nicht ausgeführt. Der Startcheck ist ein Smoke-Test, kein UI-/Medizinproduktnachweis.

## Grenzen

Kein Beleg für Hardwarefunktion, klinische Genauigkeit, Akkulaufzeit, BLE-Rate, echte Nutzertrennung oder Hintergrundwarnung. Die Struktureinrichtung führt keine Produktmigration durch; diese Tests werden dadurch nicht zu Tests aktiver Produktmodule.
