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

`PHYSICIAN_REVIEW_NOTIFY_EMAIL` ist eine optionale, aber für neue Anträge notwendige explizite Empfängeradresse für lokale Kontrollbenachrichtigungen. Die Beispielkonfiguration enthält die vom Nutzer gewünschte Adresse. Ohne diese Einstellung startet der API-Server weiterhin, bestehende Anträge bleiben abrufbar; ein neuer Antrag antwortet `503 notification_recipient_not_configured`, ohne ihn zu speichern. Arztprüfungsanträge werden lokal als `pending` gespeichert; sie ändern weder Konto-Rolle noch Arztberechtigung. `GET /api/physician-review` liefert `{review:null}` oder `{review:{status:"pending",requestedAt,notificationStatus}}`. Ein verifiziertes Konto kann mit Same-Origin JSON `POST /api/physician-review` und exakt `{}` seinen eigenen Antrag idempotent anlegen. Keine Benutzer-/Konten-ID wird vom Client angenommen. `notificationStatus` ist `pending`, bis eine Benachrichtigungsdatei atomar in der privaten Outboxmaterialisierung liegt, danach `materialized`; letzteres bedeutet ausdrücklich **nicht**, dass eine E-Mail versendet wurde. Wiederholtes `POST {}` versucht eine fehlgeschlagene Materialisierung erneut. Ein persistierter Antrag mit noch nicht materialisierter Benachrichtigung antwortet mit `503` und zeigt den Retry-Zustand; Wiederholung verwendet dieselbe DB-Outbox-Absicht und denselben Dateischlüssel.

Der lokale Kontrollhinweis enthält nur Antragsreferenz, Konto-E-Mail und Eingangszeit. Er enthält keinen Freigabelink oder Token. Eine Freigabe, Ablehnung, Arztaktion, MFA-geschützte Prüferidentität und der später vom Nutzer gewünschte Bestätigungslink für die Freigabe sind nicht implementiert. Vor einem solchen Link müssen Empfängeridentität, autorisierte Prüferidentität/MFA, Ablauf und eine ausdrückliche POST-Bestätigung geklärt und sicher umgesetzt werden; ein GET darf insbesondere keinen Statuswechsel auslösen. Es gibt keine SMTP-Konfiguration und keine Behauptung tatsächlicher Zustellung.

Der Server bindet ausschließlich `127.0.0.1`; Basisadresse standardmäßig `http://127.0.0.1:3000`. `LOCAL_AUTH_ENABLED=true` und ein explizites Secret sind Pflicht. Die Standard-DB liegt unter `code/api/data/local/auth.sqlite` und wird von Git ausgeschlossen; alternativ einen absoluten `AUTH_DATABASE_PATH` setzen. Schemaänderungen laufen bewusst separat über Better Auths Migrationsfunktion, nicht beim Serverstart. Sie ist ein lokaler Entwicklungsweg, noch kein abgenommener Produktions-Migrations-/Rollbackprozess.

Die Better-Auth-Routen liegen unter `/api/auth/`; `GET /api/me` liefert eigene ID, Anzeigename, E-Mail, Verifikationsstatus und `twoFactorEnabled` oder `401`; keine Tokens. Das eingebaute Better-Auth-1.7.18-Plugin `twoFactor` stellt optionales TOTP bereit. Die Konto-UI verlangt das Passwort zum Einrichten und aktiviert den Faktor erst nach gültigem TOTP. Aktivierte Konten erhalten beim Passwortlogin noch keine nutzbare Session: Better Auth stellt eine kurzlebige Challenge aus, die der Client durch TOTP oder einen einmaligen Recoverycode abschließt. Recoverycodes werden serverseitig verschlüsselt durch Better Auth gespeichert; die UI zeigt sie einmalig und hält sie nur flüchtig, ohne Browserpersistenz. Eine explizite SQLite-Migration installiert einen Trigger, der alte Sessions atomar beim Wechsel auf aktiviert entfernt. Ein Better-Auth-Postcheck prüft vor der Passwortlogin-Antwort den aktuellen DB-Status und löscht eine Session, die eine konkurrierende Anfrage noch ohne 2FA-Flag erstellt hatte; dieser verspätete Login antwortet dann mit `401 TWO_FACTOR_REQUIRED` und ohne Sessioncookie. Der ausdrückliche Migrationsbefehl `npm run migrate --prefix code/api` wendet das Plugin-Schema und den Trigger an; der normale Serverstart migriert nicht. Das ist ein lokaler Durchstich und keine Arztrollen-/Produktfreigabe. Google/Apple und mobile Sessions bleiben weitere Schritte. Implizites Account-Linking und Cookie-Sessioncache sind deaktiviert; der Server prüft Sessions gegen SQLite. Ratenbegrenzung liegt ebenfalls in SQLite; derzeit teilt lokaler Verkehr ohne vertrauenswürdigen IP-Header einen Pfad-Bucket. Keine frei gesetzten Proxyheader als Lösung vertrauen. HTTP ohne Secure-Cookie ist hier auf den expliziten lokalen Betrieb begrenzt; Hosting/TLS ist nicht eingerichtet.

```bash
npm test --prefix code/api
```

HTTP-/Konfigurationstests mit automatisch entfernter temporärer DB prüfen Registrierung/Login/Logout, Sessionpersistenz und Replay, TOTP-Enrollment mit Passwort und Verifikation, falschen/korrekten Login-Code ohne/vor Session, einmalige Recoverycodes und Replay, parallele Sessions und Passwortlogin bei Aktivierung, atomaren Sessionwiderruf samt künstlichem Datenbankfehler/Rollback, fehlerhafte Credentials und Fremd-Origin sowie Sessionverhalten nach Neustart und die explizite Migration, E-Mail-Verifikation mit Ablauf, Parallelaufrufen und Replay, generische Reset-Anfragen, Passwortreset mit Tokenfehler, Ablauf, Wiederverwendung und Widerruf aller Sessions, Herkunftsprüfung sowie zwei-kontogetrennte Arztantragszustände und Outbox-Retry. Das ist kein vollständiger Sicherheitsnachweis.

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

## Patientenprofil einrichten

Nach dem Aktualisieren des Codes die API stoppen, im Projektordner `npm run migrate --prefix code/api` ausführen und die API neu starten. Die Migration ergänzt die bestehende SQLite-Datei um `patient_profile`; Konten und Sessions bleiben erhalten. Der normale Start führt keine Migration aus. Eine fehlende Tabelle führt beim Start zu einem Fehler statt zu einer stillen Schemaänderung.

Im Kontobereich kann ein verifiziert angemeldetes Konto mit „Patientenprofil einrichten“ ausdrücklich ein eigenes Profil anlegen. Es enthält nur eine interne UUID, eine eindeutige Fremdschlüsselzuordnung zur Konto-ID und die Erstellzeit. Keine weiteren persönlichen oder medizinischen Angaben werden abgefragt; Arztfreigaben und Betreuungsrechte entstehen dadurch nicht.

`GET /api/patient-profile` liefert `{ profile: null }` oder das eigene Profil mit `id` und `createdAt`. `POST /api/patient-profile` akzeptiert nur `{}` als JSON mit dem konfigurierten Web-Origin und legt genau ein Profil je verifizierter Konto-Session an. Ein erneuter Aufruf liefert dasselbe Profil. Der Browser sendet keinen Eigentümer; fremde IDs und Rollenfelder werden abgewiesen. Die Zuordnung bildet später den Bezugspunkt für Geräte und Messsitzungen. Auth-Konten mit verknüpftem Profil können wegen des Fremdschlüssels nicht unbemerkt gelöscht werden; ein fachlicher Löschprozess ist gesondert umzusetzen.

## Lokaler Messsitzungsdurchstich

Nach Aktualisieren des Codes die API stoppen, im Projektordner `npm run migrate --prefix code/api` ausführen und danach den API-Server neu starten. Dieselbe idempotente lokale Migration ergänzt die SQLite-Datei um Sitzungen und Sekundenintervalle; sie entfernt oder verändert bestehende Konten, Sessions und Patientenprofile nicht. Der normale API-Start migriert nicht automatisch. Eine fehlende Tabelle wird als Fehler sichtbar.

Die API nimmt nur abgeschlossene Sitzungen mit einer gültigen, verifizierten Konto-Session und dem eigenen eingerichteten Patientenprofil an. Für synthetische lokale Entwicklung ein synthetisches Testkonto und ausdrücklich `source: "simulation"` verwenden; tatsächliche BLE-Aufnahmen werden mit `source: "ble"` gekennzeichnet. Diese Kennzeichnung ist eine vom Client gelieferte Herkunftsangabe und kein Hardware- oder Qualitätsnachweis. Keine echten Gesundheitsdaten in Tests oder lokalen Beispielen verwenden. Eine Profilzuordnung erteilt keinen Arztzugriff und bedeutet keine Arztfreigabe.

`POST /api/measurement-sessions` verlangt JSON vom konfigurierten `AUTH_WEB_ORIGIN`. Der Body hat genau `sessionId`, `source`, `startedAt`, `endedAt` und `intervals`; jedes Intervall hat `timestamp`, `count`, `avg` und `max`. `sessionId` ist eine UUID, `source` ist `ble` oder `simulation`. `timestamp` ist die UTC-Sekunde des Browser-Empfangs, auf die das Frontend Samples aggregiert; `startedAt` und `endedAt` sind exakte Sitzungsgrenzen. Die API akzeptiert höchstens 3.600 Intervalle und höchstens eine Stunde pro Sitzung, mit einem JSON-Body-Limit von 1 MiB. Zeitstempel müssen geordnet sein. `count` ist eine positive Samplezahl; `avg` und `max` müssen endlich, nicht negativ und plausibel geordnet sein. Diese Checks beweisen weder Messvollständigkeit noch eine bestimmte Sensor- oder Senderate.

Ein identischer erneuter Upload mit derselben Session-ID liefert die bestehende Sitzung; geänderte Inhalte unter derselben ID führen zu HTTP 409. Bei Netzwerkfehlern hält das Frontend den ausstehenden Upload nur im Arbeitsspeicher. Wird der Tab geschlossen oder die Anwendung beendet, bevor der Server den Upload bestätigt hat, kann dieser lokale Upload verloren gehen. Es gibt noch keine dauerhafte Offline-Queue oder Resume-Funktion.

`GET /api/measurement-sessions?limit=50` liefert Zusammenfassungen der eigenen Sitzungen, neueste zuerst, mit maximal 50 Einträgen und optionalem `nextBefore`-Cursor (`before` als URL-kodiertes JSON-Objekt `{startedAt,id}`). `GET /api/measurement-sessions/:id` liefert die eigene Sitzung samt `samples` und `gaps`. Abstände über 1,5 Sekunden zwischen gespeicherten Browser-Empfangsintervallen erscheinen als Gaps. Das markiert nur einen Abstand in den empfangenen Daten; fehlende Empfangszeit beweist keinen Geräteverlust. Anfangs- und Endlücken sind mangels bestätigter Sollrate nicht bestimmbar. Es wird nicht interpoliert.

Dieser lokale SQLite-Durchstich und seine synthetischen Tests sind keine Produktionsfreigabe. Betrieb, Datenschutz- und Aufbewahrungsregeln, Löschung/Export, Backup/Restore, Offline-Verhalten, Hardwaremessrate und ein möglicher Arztzugriff sind weiterhin gesondert zu klären und zu prüfen.
