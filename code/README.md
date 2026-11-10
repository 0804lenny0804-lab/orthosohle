# Aktiver Entwicklungsbereich – Vue-Web-App als Ausgangspunkt

Auf Nutzerauftrag vom 06.11.2026 wird der vorhandene Vue-/Vite-Web-App-Prototyp als Ausgangspunkt weitergeführt. Die erste aktive Kopie liegt unter [webapp](webapp/README.md); die Referenz bleibt unverändert unter `context/legacy/orthopaul/local-comm/frontend`. Die frühere zusätzliche Vue-/Express-/Auth-Implementierung ist laut Projektgeschichte unter Git-Tag `archive/2026-10-29/before-mobile-restart` archiviert; der Tag ist in dieser Arbeitskopie nicht verfügbar. Der aktuelle Backend-Durchstich liegt unter `api/`.

## Lokaler Identitäts-Durchstich

`api/` enthält Better Auth 1.7.18, Express 5.3.0 und better-sqlite3 12.11.1 mit Lockfile. Voraussetzung: Node 22.12+; tatsächlich geprüft mit Node 24.19.0 und npm 11.9.0. better-sqlite3 13.0.3 fiel unter Windows bei `npm ci` in einen Visual-Studio-Buildtools-Pfad; deshalb ist die lokale Version auf 12.11.1 festgesetzt. Der Windows-Installationsweg mit passendem Vorabpaket muss auf dem Zielrechner noch bestätigt werden.

Im Repository-Root installieren und eine lokale Konfiguration anlegen:

```bash
npm ci --prefix code/api
cp code/api/.env.example code/api/.env
```

In `code/api/.env` ein zufälliges `BETTER_AUTH_SECRET` mit mindestens 32 Zeichen setzen; keine echten Gesundheitsdaten verwenden. Ein Secret ohne Ausgabe in Terminal/Logs kann nach dem Kopieren so erzeugt werden:

```bash
node --input-type=module -e 'import { chmodSync, readFileSync, writeFileSync } from "node:fs"; import { randomBytes } from "node:crypto"; const p="code/api/.env"; writeFileSync(p, readFileSync(p,"utf8").replace(/^BETTER_AUTH_SECRET=$/m, "BETTER_AUTH_SECRET="+randomBytes(48).toString("base64url")), {mode:0o600}); chmodSync(p,0o600);'
npm run migrate --prefix code/api
npm start --prefix code/api
```

Der Server bindet ausschließlich `127.0.0.1`; Basisadresse standardmäßig `http://127.0.0.1:3000`. `LOCAL_AUTH_ENABLED=true` und ein explizites Secret sind Pflicht. Die Standard-DB liegt unter `code/api/data/local/auth.sqlite` und wird von Git ausgeschlossen; alternativ einen absoluten `AUTH_DATABASE_PATH` setzen. Schemaänderungen laufen bewusst separat über Better Auths Migrationsfunktion, nicht beim Serverstart. Sie ist ein lokaler Entwicklungsweg, noch kein abgenommener Produktions-Migrations-/Rollbackprozess.

Die Better-Auth-Routen liegen unter `/api/auth/`; `GET /api/me` liefert eigene ID, Anzeigename, E-Mail und Verifikationsstatus oder `401`; keine Tokens. Die Web-App besitzt einen lokalen Kontobereich; Gesundheitsdatenrouten und fachliche Kontozuordnung fehlen weiterhin. Der Loopback-Prototyp erlaubt synthetische E-Mail-/Passwortkonten mit lokaler E-Mail-Bestätigung und Passwortreset. Reset-Links werden nur im privaten lokalen Test-Mailausgang abgelegt, nicht echt versendet. Arzt-MFA, Google/Apple und mobile Sessions sind weitere Schritte. Implizites Account-Linking und Cookie-Sessioncache sind deaktiviert; der Server prüft Sessions gegen SQLite. Ratenbegrenzung liegt ebenfalls in SQLite; derzeit teilt lokaler Verkehr ohne vertrauenswürdigen IP-Header einen Pfad-Bucket. Keine frei gesetzten Proxyheader als Lösung vertrauen. HTTP ohne Secure-Cookie ist hier auf den expliziten lokalen Betrieb begrenzt; Hosting/TLS ist nicht eingerichtet.

```bash
npm test --prefix code/api
```

Vierzehn HTTP-/Konfigurationstests mit automatisch entfernter temporärer DB prüfen Registrierung/Login/Logout, Sessionpersistenz und Replay, E-Mail-Verifikation mit Ablauf, Parallelaufrufen und Replay, generische Reset-Anfragen, Passwortreset mit Tokenfehler, Ablauf, Wiederverwendung und Widerruf aller Sessions sowie Herkunftsprüfung. Das ist kein vollständiger Sicherheitsnachweis.

Referenzen für die verwendete Integration (abgerufen 07.11.2026): [Better Auth Express](https://better-auth.com/docs/integrations/express), [programmatische Migrationen](https://better-auth.com/docs/concepts/database#programmatic-migrations), [Sessions](https://better-auth.com/docs/concepts/session-management), [Account-Linking](https://better-auth.com/docs/concepts/users-accounts#account-linking).

## Web-App mit lokalem Kontobereich starten

Nach der API-Migration und bei laufendem API-Server in einem zweiten Terminal:

```bash
npm ci --prefix code/webapp
npm run dev --prefix code/webapp
```

Öffnen: `http://127.0.0.1:5173/#account`. Vite bindet lokal an Port 5173 und beendet sich bei belegtem Port, statt den Ursprung still zu ändern. Relative Kontoaufrufe nach `/api/auth` und `/api/me` werden ausschließlich zum lokalen Backend auf `http://127.0.0.1:3000` weitergeleitet. Beide Standardports für diesen Startweg beibehalten. Der Backendparameter `AUTH_WEB_ORIGIN=http://127.0.0.1:5173` ist explizit auf einen HTTP-Loopback-Ursprung begrenzt; keine CORS-Wildcards werden freigegeben. Nach Änderung der Backendkonfiguration den API-Server neu starten.

Unter **Konto** ein ausschließlich synthetisches Testkonto erstellen. Den Verifikationslink lokal öffnen und anschließend anmelden. Für Passwortreset einen Resetlink anfordern und aus dem privaten lokalen Test-Mailausgang öffnen. Neuladen prüft die vorhandene Cookie-Session erneut serverseitig; Abmelden und Passwortänderung widerrufen bestehende Sitzungen. Tokens werden nicht im LocalStorage abgelegt und Reset-Tokens vor Folgeanfragen aus der URL entfernt; Formpasswörter werden nach jedem abgeschickten Versuch gelöscht. Nicht erreichbarer Server und unbestätigter Sessionstatus sind eigene Zustände mit erneuter Prüfung. Die bestehende Messoberfläche bleibt ein ausdrücklich gekennzeichneter, noch keinem Konto zugeordneter Prototyp.

Die Anmeldemaske bietet Registrierung, Bestätigungslink, Login, Logout, Sessionprüfung und Passwortreset im lokalen Testbetrieb. Es gibt keine echte Mailzustellung, Google-/Apple-Anmeldung oder Arzt-MFA. Die PWA-Konfiguration enthält keinen API-Runtime-Cache; der vorhandene Service Worker übernimmt nur den Asset-Precache. Auslieferung eines gebauten Frontends mitsamt API unter einem Origin ist noch nicht eingerichtet; `vite preview` richtet keinen Entwicklungsproxy ein.

Die übernommene Mess-/Demooberfläche ist nicht mit dem Konto verbunden. Testwerte und Läufe bleiben flüchtig in der Browser-Sitzung und werden bei Login, Logout oder Kontowechsel verworfen. Nicht vorhandene Fach- und Push-Endpunkte werden nicht mehr aufgerufen; lokale Vorschauaktionen melden keine Serverspeicherung. Beim ersten App-Start werden bekannte Altwerte mit der früheren festen ID aus dem lokalen Browser-Speicher entfernt. Das ist nur eine Bereinigung der Prototypdaten, kein Datenschutz für zuvor kopierte oder exportierte Daten.

## Lokale Test-E-Mail-Bestätigung

Registrierung schreibt einen Bestätigungslink ausschließlich in den privaten lokalen Mailausgang: standardmäßig `code/api/data/local/auth.sqlite.mail-outbox/`, bei anderem Datenbankpfad direkt unter `<AUTH_DATABASE_PATH>.mail-outbox/`. Diese Ablage liegt bei den Standardwerten unter der ignorierten lokalen Datenablage. Sie wird nie per HTTP angeboten. JSON-Datei lokal öffnen und `verificationURL` im Browser aufrufen; keine Links oder Tokens in normale Logs, Screenshots oder Git kopieren. Es wird keine echte E-Mail versendet. Dateien haben unter POSIX Modus 0600, der Ausgang 0700; Windows-Zugriffsrechte separat prüfen. Lokale Testmails nach Benutzung löschen.

Der Link verwendet die lokale API direkt und führt ausschließlich zum konfigurierten Konto-Ursprung zurück; dadurch läuft der sensible Link nicht durch Vites Fehlerprotokollierung. `Referrer-Policy: no-referrer` schützt den Rücksprung. Der Konto-Tab zeigt den serverseitigen Status und bietet erneutes Anfordern/Prüfen. Fehler beim Bestätigen erscheinen generisch und werden aus der Callback-URL entfernt. Es wird keine neue Session durch Verifikation erstellt. Ein unverifiziertes Konto kann weiterhin nur seine Identität prüfen; es existiert keine fachliche Gesundheitsdatenfreigabe.

Better Auth 1.7.18 verwendet für diese Links standardmäßig ein Ablauf-JWT, das von sich aus wiederholt Erfolg liefern kann. Deshalb speichert dieser begrenzte Durchstich zusätzlich ausschließlich den SHA-256-Fingerabdruck des von Better Auth ausgegebenen Tokens in dessen bestehender Verification-Ablage. Vor der Bibliotheksprüfung wird ein gültiger Ausgabemarker mit `consumeVerificationValue` atomar verbraucht; `reserveVerificationValue` verhindert Wiederverwendung auch bei parallelem Neuerstellen desselben Markers. Die Signaturprüfung und Kontoverifikation bleiben bei Better Auth. Links gelten höchstens eine Stunde; fehlgeschlagene Verarbeitung verbraucht den Nachweis vorsorglich, dann neu anfordern. Diese internen Adapter-APIs sind an die fixierte Version gebunden und brauchen bei Updates erneute Prüfung. Keine eigene Token-Signatur oder zusätzliche Anmeldesession.

```bash
npm test --prefix code/api
node --test code/webapp/test/account-callback.test.js
npm run build --prefix code/webapp
```

Tests ergänzen gültige/falsche/abgelaufene Nachweise, Replay und parallelen Verbrauch, private Dateirechte sowie Callbackfehler. Echte Mailzustellung und Browser-/Geräteabnahme sind eigenständige Nachweise. Quelle: [Better Auth Email](https://better-auth.com/docs/concepts/email), abgerufen am 07.11.2026; Einmalverbrauch zusätzlich gegen die installierten Adapter-/Routentypen der Version 1.7.18 geprüft.

## Geplanter Zuschnitt

- Vue-Web-App als gemeinsame UI-Basis; später native Verpackung für Android (APK) und iOS (IPA) prüfen und bauen.
- Patienten-App für iOS und Android: Geräteanbindung, Sitzungen und verständlicher lokaler Zustand.
- Gemeinsames Backend: Identität, Betreuungsrechte, Therapiepläne und zugeordnete Messdaten.
- Webportal für Ärzte: Zugriff auf zugeordnete Patienten über dieselbe Backend-API.

Das ist die Zielrichtung, keine implementierte Verbindung. Gemeinsame API-Verträge, Einheiten, Planversionen und Rechte gewährleisten später die fachliche Kompatibilität. Mobile Geheimnisse gehören in geschützten Gerätespeicher; Browser- und App-Anmeldung brauchen jeweils einen passenden sicheren Ablauf. Medizinische Regeln werden serverseitig maßgeblich gepflegt; die unabhängige lokale Warnfunktion braucht einen versionierten Gerätevertrag und eigene Tests.

Die bestehende Vue-/Vite-Basis bleibt erhalten. Die PWA-Konfiguration selbst erstellt keine APK/IPA. Eine native Verpackung (zum Beispiel Capacitor) und native BLE-Integration sind noch nicht ausgewählt. Better Auth wurde am 07.11.2026 als Auth-Basis gewählt; SQLite dient zunächst dem lokalen Nachweis. Für IPA sind macOS/Xcode und Signierung nötig. Vor realen Patientendaten müssen insbesondere feste Nutzer-ID, Service-Worker-API-Cache und fehlende Zustände aus dem Prototyp überarbeitet werden. Erste aktive Kopie zunächst reproduzierbar starten/builden; anschließend Funktionen in kleinen, reviewbaren Schritten trennen und plattformfähig machen. Ohne Hardware nur synthetische Eingaben als solche prüfen.

Neue Module erst mit konkretem Code anlegen. Maßgeblich bleiben [Regeln](../AGENTS.md), [Produktanforderungen](../context/requirements.md) und [aktueller Kontext](../context/context.md). Der [alte GitLab-Code](../context/legacy/README.md) bleibt unveränderte Referenz.

## Eigenes Profil

Im Kontobereich lässt sich der Anzeigename ändern. `POST /api/auth/update-user` mit `{ name }` verwendet Better Auths geprüfte Sitzung; der Browser übermittelt keinen Eigentümer. `/api/me` liest den gespeicherten Namen derselben Identität. Namen werden serverseitig getrimmt und auf 1–100 Zeichen begrenzt. Ein Zwei-Konten-Test prüft Isolation, Fremd-Origin, anonyme/widerrufene Sitzungen und Persistenz über einen API-Neustart. Die Anmeldung hat eine eigenständige Ansicht; nach Anmeldung stehen Desktop-Seitenleiste und mobile untere Navigation bereit. Fachliche Messdaten sind weiterhin nur flüchtig.
