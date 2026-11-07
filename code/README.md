# Aktiver Entwicklungsbereich – Vue-Web-App als Ausgangspunkt

Auf Nutzerauftrag vom 06.11.2026 wird der vorhandene Vue-/Vite-Web-App-Prototyp als Ausgangspunkt weitergeführt. Die erste aktive Kopie liegt unter [webapp](webapp/README.md); die Referenz bleibt unverändert unter `context/legacy/orthopaul/local-comm/frontend`. Die frühere zusätzliche Vue-/Express-/Auth-Implementierung ist laut Projektgeschichte unter Git-Tag `archive/2026-10-29/before-mobile-restart` archiviert; der Tag ist in dieser Arbeitskopie nicht verfügbar. Der aktuelle Backend-Durchstich liegt unter `api/`.

## Lokaler Identitäts-Durchstich

`api/` enthält Better Auth 1.7.18, Express 5.3.0 und better-sqlite3 13.0.3 mit Lockfile. Voraussetzung: Node 22.12+; tatsächlich geprüft mit Node 24.19.0 und npm 11.9.0. Die SQLite-Bibliothek benötigt eine passende native Binärdatei oder Buildwerkzeuge.

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

Die Better-Auth-Routen liegen unter `/api/auth/`; `GET /api/me` liefert ausschließlich die eigene authentifizierte ID oder `401`. Es gibt noch keine Gesundheitsdatenroute und keine neue Web-Anmeldemaske. Der Loopback-Prototyp erlaubt synthetische E-Mail-/Passwortkonten ohne Mailverifikation; Verifikation, Reset-Mail, Arzt-MFA, Google/Apple und mobile Sessions sind weitere Schritte. Implizites Account-Linking und Cookie-Sessioncache sind deaktiviert; der Server prüft Sessions gegen SQLite. Ratenbegrenzung liegt ebenfalls in SQLite; derzeit teilt lokaler Verkehr ohne vertrauenswürdigen IP-Header einen Pfad-Bucket. Keine frei gesetzten Proxyheader als Lösung vertrauen. HTTP ohne Secure-Cookie ist hier auf den expliziten lokalen Betrieb begrenzt; Hosting/TLS ist nicht eingerichtet.

```bash
npm test --prefix code/api
```

Vier HTTP-/Konfigurationstests mit automatisch entfernter temporärer DB prüfen fehlende Session, Registrierung/Login, falsches Passwort, `200` mit Session, `401` beim Replay nach Logout, persistente Konten/Sessions nach Neuerzeugung der API-/SQLite-Instanzen und abgewiesenen Fremd-Origin. Das ist kein Browser-, Geräte- oder vollständiger Sicherheitsnachweis.

Referenzen für die verwendete Integration (abgerufen 07.11.2026): [Better Auth Express](https://better-auth.com/docs/integrations/express), [programmatische Migrationen](https://better-auth.com/docs/concepts/database#programmatic-migrations), [Sessions](https://better-auth.com/docs/concepts/session-management), [Account-Linking](https://better-auth.com/docs/concepts/users-accounts#account-linking).

## Geplanter Zuschnitt

- Vue-Web-App als gemeinsame UI-Basis; später native Verpackung für Android (APK) und iOS (IPA) prüfen und bauen.
- Patienten-App für iOS und Android: Geräteanbindung, Sitzungen und verständlicher lokaler Zustand.
- Gemeinsames Backend: Identität, Betreuungsrechte, Therapiepläne und zugeordnete Messdaten.
- Webportal für Ärzte: Zugriff auf zugeordnete Patienten über dieselbe Backend-API.

Das ist die Zielrichtung, keine implementierte Verbindung. Gemeinsame API-Verträge, Einheiten, Planversionen und Rechte gewährleisten später die fachliche Kompatibilität. Mobile Geheimnisse gehören in geschützten Gerätespeicher; Browser- und App-Anmeldung brauchen jeweils einen passenden sicheren Ablauf. Medizinische Regeln werden serverseitig maßgeblich gepflegt; die unabhängige lokale Warnfunktion braucht einen versionierten Gerätevertrag und eigene Tests.

Die bestehende Vue-/Vite-Basis bleibt erhalten. Die PWA-Konfiguration selbst erstellt keine APK/IPA. Eine native Verpackung (zum Beispiel Capacitor) und native BLE-Integration sind noch nicht ausgewählt. Better Auth wurde am 07.11.2026 als Auth-Basis gewählt; SQLite dient zunächst dem lokalen Nachweis. Für IPA sind macOS/Xcode und Signierung nötig. Vor realen Patientendaten müssen insbesondere feste Nutzer-ID, Service-Worker-API-Cache und fehlende Zustände aus dem Prototyp überarbeitet werden. Erste aktive Kopie zunächst reproduzierbar starten/builden; anschließend Funktionen in kleinen, reviewbaren Schritten trennen und plattformfähig machen. Ohne Hardware nur synthetische Eingaben als solche prüfen.

Neue Module erst mit konkretem Code anlegen. Maßgeblich bleiben [Regeln](../AGENTS.md), [Produktanforderungen](../context/requirements.md) und [aktueller Kontext](../context/context.md). Der [alte GitLab-Code](../context/legacy/README.md) bleibt unveränderte Referenz.
