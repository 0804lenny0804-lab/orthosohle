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


## Neue lokale Webapp-Grundlage

[webapp](webapp/package.json) ist der erste neue implementierte Produktbereich mit Vue/Vite und Express. Der Originalcode bleibt unverändert. Dies ist zunächst eine schreibgeschützte Patientenansicht: Plan laden, kein Plan, API-Fehler und fehlendes Gerät werden explizit dargestellt. Lokale Testkonten mit Better Auth und SQLite sind angebunden; keine echte Patientendatenhaltung, keine BLE-/Warnfunktion oder Gerätebestätigung. Demo-Plan ausdrücklich synthetisch; nicht als ärztlich angelegter Plan ausgegeben.

Node 22.12+ (aktuell mit Node 24 geprüft); better-sqlite3 benötigt ein passendes natives Binary oder eine Buildumgebung. Installation aus dem Repository-Root:

```bash
npm ci --prefix code/webapp
```

Vor dem Start AUTH_SECRET mit mindestens 32 zufälligen Zeichen nur lokal setzen. Erzeugen mit `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Ausgabe nicht ins Repository oder Chat kopieren. In Bash `export AUTH_SECRET='<lokaler Wert>'` und `export AUTH_DEV_MODE=true`; in PowerShell `$env:AUTH_SECRET='<lokaler Wert>'` und `$env:AUTH_DEV_MODE='true'`. Variablen im API-Terminal setzen.

Zwei Terminals aus dem Repository-Root:

```bash
npm run server --prefix code/webapp
npm run dev --prefix code/webapp
```

Weboberfläche: http://127.0.0.1:5173. API: http://127.0.0.1:3001/api/plan, Vite leitet /api lokal weiter. Ohne Konfiguration zeigt die App keinen Plan. Für den synthetischen Beispielplan API in Bash mit `DEMO_MODE=true npm run server --prefix code/webapp` starten; in PowerShell zuvor `$env:DEMO_MODE="true"` setzen. Die [.env.example](webapp/.env.example) dokumentiert Prozessvariablen, wird nicht automatisch geladen. Der Vite-Proxy erwartet API-Port 3001; bei anderem PORT Proxy ebenfalls anpassen.

```bash
npm test --prefix code/webapp
npm run build --prefix code/webapp
```

API und Vite binden lokal an Loopback. Ausschließlich http://127.0.0.1:5173 verwenden; localhost ist ein anderer Origin. API startet nur mit AUTH_DEV_MODE=true und verweigert NODE_ENV=production. Better Auth erstellt im lokalen Testbetrieb das Schema beim Start. Die SQLite-Datei liegt unter data/local/auth.db relativ zum Prozess-Arbeitsverzeichnis und wird nicht versioniert. Beim ersten Start ein synthetisches Testkonto anlegen. E-Mail-Verifikation, Versand und Reset sind noch nicht eingerichtet. Kein Patient kann sich über ein Profilfeld zum Arzt machen; Arztfunktionen fehlen bisher vollständig.

 Keine Produktionsbereitstellung: dist ist ein Frontend-Build und benötigt später einen geschützten API-/Hostingpfad. Fachliche Autorisierung, persistente Pläne und Arztfunktionen folgen als eigene Arbeitspakete.


### Verantwortlichkeiten und Datenfluss der neuen Webapp

| Datei | Verantwortung |
|---|---|
| webapp/src/main.js | Vue starten und globales Stylesheet laden |
| webapp/src/App.vue | Seitenrahmen und Zusammensetzung der Ansichten |
| webapp/src/components/TherapyPlan.vue | Plan laden und Lade-, Fehler-, Leer- bzw. Planzustand darstellen |
| webapp/src/components/DeviceStatus.vue | Aktuell noch nicht verbundenes Gerät ausdrücklich darstellen |
| webapp/src/components/SessionHistory.vue | Aktuell leere Sitzungshistorie darstellen |
| webapp/src/api.js | HTTP-Abruf und Prüfung des Planantwort-Vertrags |
| webapp/src/style.css | Gemeinsame Gestaltung und responsive Darstellung |
| webapp/server/index.js | Prozesskonfiguration prüfen und lokalen HTTP-Server starten |
| webapp/server/app.js | Express-App mit schreibgeschütztem synthetischem Planendpunkt erstellen |
| webapp/server/app.test.js | HTTP-Vertrag und Ablehnung fehlerhafter Planantworten nachweisen |
| webapp/vite.config.js | Vue-Build und lokalen API-Proxy konfigurieren |

Datenfluss: TherapyPlan → api.loadPlan → /api/plan → Express → synthetische Antwort → Vertragsprüfung → Darstellung. Auth nutzt eine lokale SQLite-Datenbank und HttpOnly-/SameSite-Cookies. Keine Analytics, externen Schriftarten oder echten Patientenidentitäten. Der Demo-Wert steht ausschließlich in der lokalen API. Das ist kein Nachweis einer abgeschlossenen Datenschutz- oder Sicherheitsprüfung. Der nächste Auth-Schritt muss echte Identität, geprüfte Arztrolle und Betreuungsbeziehung serverseitig zusammenführen; ein UI-Rollenumschalter wäre kein Berechtigungsmodell.


### Lokale Auth-Verantwortlichkeiten

- src/auth-client.js: Better-Auth-Client am gleichen Origin; keine eigene Tokenablage.
- src/components/AccountAccess.vue: Eingabe für Testkonto/Anmeldung und verständliche Fehler.
- server/auth/create-auth.js: Bibliothekskonfiguration und lokale Schemaerstellung.
- server/auth/require-session.js: serverseitige Identitätsprüfung für geschützte API-Aufrufe.
- server/auth/auth.test.js: echter HTTP-Ablauf mit isolierter In-Memory-Datenbank, fremdem Origin und widerrufener Session.

Der Browser sendet Auth-Aufrufe über /api/auth an den Vite-Proxy. Better Auth prüft Passwort und Origin, speichert Sitzungen in SQLite und setzt das Sessioncookie. /api/plan prüft dieses Cookie serverseitig; fehlende Auth-Konfiguration sperrt den Endpunkt. Abmelden widerruft die Sitzung in der Datenbank, nicht nur im Browser.

Grenzen: lokale HTTP-Cookies sind für Loopback konfiguriert; produktiver HTTPS-/Proxybetrieb ist nicht eingerichtet. Die Bibliothek nutzt ohne vertrauenswürdig ermittelte Client-IP einen gemeinsamen Rate-Limit-Bucket; derzeitiger lokaler Testbetrieb, noch kein geprüfter verteilter Missbrauchsschutz. Für Produktion persistenten Rate-Limit-Speicher und Proxy-Vertrauenskette prüfen. Schemaänderungen vor echtem Betrieb als geprüfte Migrationen ausführen; derzeit automatische lokale Initialisierung. Kein Schutz-/DSGVO-Gesamtnachweis aus dieser Integration ableiten.
