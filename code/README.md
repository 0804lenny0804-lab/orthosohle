# Vorhandener Code – Einstieg

## Status und Orientierung

orthopaul/ enthält die 51 Dateien aus der hochgeladenen GitLab-ZIP unverändert, einschließlich ihrer ursprünglichen Verzeichnisnamen und Template-READMEs. Quelle: [GitLab OrthoPaul](https://gitlab.mi.hdm-stuttgart.de/orthosohle/orthopaul.git). Originalcommit unbekannt; manifest.json enthält ZIP- und Datei-Prüfsummen. Alte Template-Anweisungen sind keine aktuellen Arbeitsaufträge.

| Bereich | Tatsächlicher Pfad | Aufgabe |
|---|---|---|
| Web-App | [orthopaul/local-comm/frontend](orthopaul/local-comm/frontend/package.json) | Vue/Vite, UI und Web Bluetooth |
| Backend | [orthopaul/local-comm/server](orthopaul/local-comm/server/server.js) | Express, SQLite und Web-Push |
| Sohlensketch | [arduinocode.ino](orthopaul/local-comm/frontend/src/components/arduinocode.ino) | HX711, kg-Umrechnung und ArduinoBLE |
| Gemeinsamer Dev-Start | [Root-package.json](orthopaul/package.json) | concurrently und nodemon |

Es gibt noch keine neue Armband-Firmware, Geräteverwaltung oder Benutzerkonten. Der Code ist eine untersuchte Ausgangsbasis mit [bekannten Fehlern](../docs/analysis.md), keine abgenommene Produktversion.

## Voraussetzungen und Installation

Node gemäß frontend/package.json: ^20.19.0 oder >=22.12.0; bisher geprüft mit Node 24.19.0. npm und für sqlite3 gegebenenfalls eine native C/C++-Buildumgebung. Befehle aus dem Repository-Root ausführen:

```bash
npm ci --prefix code/orthopaul
npm ci --prefix code/orthopaul/local-comm/frontend
npm ci --prefix code/orthopaul/local-comm/server
npm run build --prefix code/orthopaul/local-comm/frontend
```

Bei nicht beschreibbarem npm-Cache einen eigenen beschreibbaren Pfad per --cache wählen. Ein Build bestätigt weder Hardwarefunktion noch Warnzuverlässigkeit. Der Backend-Testbefehl ist bisher nur ein fehlschlagender Platzhalter.

## Lokaler Betrieb des ursprünglichen Prototyps

Auf Linux/macOS/Bash mit isolierter temporärer Testdatenbank starten:

```bash
mkdir -p /tmp/orthosohle-dev
SQLITE_DIR=/tmp/orthosohle-dev USE_LOCAL=true npm run dev --prefix code/orthopaul
```

Frontend: http://localhost:5173, API: http://localhost:3000. In PowerShell die Variablen vor dem gleichen npm-Befehl setzen (diese Variante wurde in der Linux-Prüfumgebung nicht ausgeführt):

```powershell
New-Item -ItemType Directory -Force "$env:TEMP/orthosohle-dev" | Out-Null
$env:SQLITE_DIR = "$env:TEMP/orthosohle-dev"
$env:USE_LOCAL = "true"
npm run dev --prefix code/orthopaul
```

Das Verzeichnis enthält eine lokale Test-DB und gehört nicht in Git. SQLITE_DIR als Prozessvariable setzen: der Altcode lädt .env für den Datenbankpfad zu spät. Frontend nutzt ohne VITE_API_URL standardmäßig localhost:3000. Für lokalen Build/Start sind keine VAPID-Schlüssel erforderlich; Push bleibt ohne Konfiguration deaktiviert. Keine echten Patientendaten verwenden oder ungeschützten Altserver veröffentlichen. Eine entfernte HTTPS-Webseite mit BLE verlangt gesondert geprüfte Browser-/Netzbedingungen; localhost-Start belegt keinen Smartphone-Betrieb.

## Weiterarbeiten

- Recherche/Prüfungen am vorhandenen Code möglich; Mess-/Firmwareänderungen setzen tatsächliche Hardwarekenntnis voraus.
- Erste Migration (C02) als abgegrenzte Aufgabe: genau einen tatsächlich nutzbaren Bereich unter code/ übernehmen, Build/Start dokumentieren und prüfen. Dabei bekannte Fehler nicht mit einer reinen Verschiebung vermischen.
- Neue Modulnamen erst bei konkretem Inhalt wählen; keine leeren Web-/API-/Firmware-/Hardwareordner vorsorglich erzeugen.
- README und manifest.json sichern Herkunft; das zusätzliche Quellinventar ist entfallen, da es dieselben Dateinamen doppelt führte. Den historischen Originalbestand nur bewusst mit neuer Herkunft/Prüfsumme ersetzen.
