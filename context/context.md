# OrthoSohle – aktueller Projektkontext

Stand: 10.11.2026. Regeln ausschließlich in [AGENTS.md](../AGENTS.md); Start und Dateien der aktiven Anwendung in [code/README.md](../code/README.md).

## Ziel und aktueller Schwerpunkt

Ärzte-/Patientensystem für nachvollziehbare Teilbelastung mit unabhängiger Armbandwarnung. Aktueller Auftrag: sauberer Neustart für installierbare iOS-/Android-App plus kompatibles Webportal. Das ausgewählte Waveshare-Armband ist laut Nutzer noch nicht vorhanden. Historischer Sohlenaufbau und verfügbare Smartphone-/Watchgeräte sind in [project-background.md](project-background.md) eingeordnet.

## Belegter Softwarestand

- [Altbestand](legacy/README.md): 51 unveränderte Dateien aus dem GitLab-ZIP mit [Manifest](legacy/manifest.json); ursprünglicher GitLab-Commit unbekannt. Referenz, keine Produktfreigabe.
- Nutzerauftrag vom 06.11.2026: nah am bestehenden Web-App-Build weiterarbeiten, diesen schrittweise verbessern und als Basis für APK/IPA verwenden.
- Erste aktive Kopie des bisherigen Vue-/Vite-Frontends liegt unter `code/webapp`; der unveränderte Ausgangscode liegt weiterhin unter `context/legacy/orthopaul/local-comm/frontend`. Diese erste Übernahme enthält noch keine Funktionserweiterung oder native Verpackung.
- Verifikation 06.11.2026: aktives Frontend vollständig bytegleich zur Legacy-Quelle übernommen; `npm ci` und `npm run build --prefix code/webapp` mit Node 24.19.0 erfolgreich. Das ist ausschließlich ein Web/PWA-Buildnachweis.
- Erster Verbesserungsschritt: Bluetooth-Ansicht zeigt fehlende Web-Bluetooth-Unterstützung und sperrt die Auswahl; der Web-Build war erfolgreich, Browser- und Gerätetest stehen noch aus. Die übrige Verbindung nutzt weiterhin den bisherigen Web-Bluetooth-Pfad.
- Live-Diagramm: feste 40-kg-Achsgrenze entfernt; die Grenzlinie erhält auch bei weniger als zwei Messwerten zwei Positionen. Web-Build und synthetische Prüfung der Datenreihen und Chart.js-Skala erfolgreich; Canvas-/Browserprüfung steht aus. Ein einzelner Messpunkt bleibt bislang unsichtbar.
- Die PWA allein erzeugt keine APK/IPA. Better Auth ist als Auth-Basis gewählt; native Verpackung, mobile BLE-Anbindung, Push und Hosting sind noch offen. Alte Demoaufrufe mit fester Nutzer-ID wurden entfernt; Testwerte sind flüchtige Browser-Vorschau und werden beim Identitätswechsel zurückgesetzt. Echte Fachdaten-API und Datenbesitz fehlen weiterhin.
- Zielrichtung bleibt: gemeinsame Web-Oberfläche/API-Basis, installierbarer Patientenclient und Ärzteportal. Die Migration erfolgt in kleinen, modularen und unabhängigen Review-Schritten gemäß [Agentenablauf](../AGENTS.md) und [Rollen](agents/).

## Nachweise und Grenzen

Die acht Auth-/API-Tests und der Webbuild des archivierten Versuchs sind historische Nachweise dieses entfernten Versuchs. Sie belegen keine Funktionen des Neustarts. Aktuell prüfbar: Repositorystruktur, Dokumentationslinks, Backlog und unveränderte Originaldateien. Hardware, mobile Buildkette, BLE, Hintergrundbetrieb, Watch, Datenschutz-/Betriebs- und Einsatzfreigaben bleiben offen.

## Systembild und offener Funktionsumfang

Das übergeordnete [Systembild](requirements.md#systembild-und-verantwortlichkeiten) führt Verantwortlichkeiten und Datenflüsse zusammen. Konto- und Sessionzustände sind als fachlicher Entwurf in [requirements.md](requirements.md#konto--und-sessionzustände) beschrieben: erlaubte/verbotene Aktionen, Übergänge und offene Session-/Recoveryregeln. Der lokale API-/Web-Durchstich umfasst Registrierung, E-Mail-Bestätigung, Passwortanmeldung, serverseitige Sessionprüfung, Logout und Passwortreset mit privatem lokalen Test-Mailausgang. Echte Zustellung und fachliche Autorisierung stehen noch aus.

Das [Betreuungsmodell](requirements.md#betreuungszustände-und-arztwechsel) beschreibt Einladungen getrennt von Beziehungen, ausdrückliche Annahme, Ende und atomaren Arztwechsel sowie spätere Negativnachweise. Rechte nach Ende, Planfortgeltung und Aufbewahrung bleiben offen; technische Umsetzung steht aus.

Das [minimale fachliche Datenmodell](requirements.md#datenzuordnung-und-minimales-fachliches-datenmodell) beschreibt Datenzuordnung, Kardinalitäten und Integritätsregeln für Identität, Profile, Betreuung, Geräte, Pläne, Messungen sowie Audit-/Datenschutzvorgänge. Technische Zuordnung bedeutet kein rechtliches Dateneigentum; Speicherung, Migrationen und offene Aufbewahrungsregeln sind noch nicht implementiert.

Der [Auth-Vergleich](requirements.md#auth-optionen-vergleich-und-empfehlung) wurde durch die Nutzerwahl Better Auth vom 07.11.2026 konkretisiert. Lokaler API-Durchstich unter `code/api`: Better Auth 1.7.18, Express 5.3.0 und better-sqlite3 12.11.1, persistente Konten/Sessions, explizite lokale Freigabe und Secretpflicht, Loopback-Bindung, implizites Linking und Cookiecache aus. Dreizehn API-Tests prüfen Anmeldung, Session, Einmal-Verifikation und Passwortreset einschließlich Widerruf. Nach einem Windows-Installationsfehler mit better-sqlite3 13.0.3 wurde auf 12.11.1 gewechselt; der Installationsweg wurde vom Nutzer unter Windows-PowerShell ausgeführt. SQLite bleibt lokale Prototyp-Persistenz. Lokale Test-Mailverifikation ist ergänzt; weiterhin keine reale Mailzustellung, Fachrechte, Social- oder mobile Anmeldung; kein Produktionsnachweis.

Sichtbarer Web-Durchstich: modularer Konto-Tab mit synthetischer Registrierung, E-Mail-Bestätigung, Login, serverseitiger Sessionprüfung, Logout und Reset. Featuremodule trennen Fetch-Transport, zentralen flüchtigen Sessionzustand und Vue-Darstellung. Enger lokaler Vite-Proxy und expliziter Backend-Web-Origin verbinden beide; keine Tokens im LocalStorage. Lade-/Serverfehler sind sichtbar, abgeschickte Passwörter werden gelöscht und die Messoberfläche als noch nicht kontozugeordnet gekennzeichnet. Dreizehn API- und zwei Webtests sowie Produktionsbuild sind erfolgreich. Chromium-Browserprüfung bei 360/390 px und 1440 px bestätigt keinen horizontalen Überlauf; Navigation Back/Forward folgt dem Browserzustand.

Lokale Verifikation ist implementiert: privater Datei-Mailausgang neben der SQLite-Datei, serverseitiger Verifikationsstatus im Konto-Tab, erneutes Anfordern und sicherer Rücksprung ohne Tokens im Profil oder normalen Logs. Better Auth prüft seine JWTs; zusätzliche gehashte Ausgabemarker und atomare Bibliotheks-Consume-/Reserveoperationen erfüllen den lokalen Replay-Schutz. Passwortreset verwendet einen einmaligen, ablaufenden Nachweis und widerruft vorhandene Sessions. Das erteilt keine Fachrechte und erzeugt keine neue Session. API-Tests decken gültige/falsche/abgelaufene Links, gleichzeitigen Replay, Reset und Sessionwiderruf ab; Callbackfehler werden generisch angezeigt und aus der URL entfernt. Reale Mailzustellung, SSO und Geräteabnahme stehen aus.

Abgeschlossen am 10.11.2026: Legacy-Demoaufrufe ohne Fach-API entfernt, bekannte feste Browser-IDs und globale gespeicherte Läufe bereinigt, Einstellungen/Messwerte/Feedback auf flüchtigen Arbeitsspeicher begrenzt und Zustand bei Login/Logout/Kontowechsel zurückgesetzt. Sechs Webtests, dreizehn API-Tests, Produktionsbuild, Projektprüfung und unabhängiger Review bestanden. Zwei synthetische Konten wurden im Browser gegeneinander geprüft: B erhielt weder Grenzwert noch aktiven Lauf von A; keine alten API-Routen wurden aufgerufen. Bluetooth-Teardown ist implementiert, aber nicht mit einem realen Gerät geprüft.

Kontobereich abgeschlossen am 10.11.2026: Anzeigename wird kontoabhängig über Better Auth gespeichert und über /api/me gelesen. 14 API- und 7 Webtests, Browserablauf Registrierung/Bestätigung/Login/Profil/Neuladen/Reset/Logout sowie mobile und Desktopdarstellung geprüft. Wiederholte Testbanner entfernt, ursprüngliche Markenfarbe und Desktop-Seitenleiste/mobile untere Navigation umgesetzt. Das fachliche Patientenprofil wurde anschließend als eigener Datenanker mit Eigentümerzuordnung umgesetzt; Messsitzungen bleiben weiterhin flüchtig. Produktive E-Mail-/SSO-Provider bleiben bis zu verfügbaren Zugängen externe Prüfpunkte.

Patientenprofil-Paket vom 10.11.2026 abgeschlossen: Ein verifiziertes Konto kann ausdrücklich genau ein eigenes Patientenprofil einrichten. SQLite speichert UUID, eindeutigen Konto-Fremdschlüssel und Erstellzeit. Die Migration läuft mit `npm run migrate --prefix code/api`; bestehende Konten/Sessions bleiben erhalten. GET/POST `/api/patient-profile` bestimmen den Besitzer aus der Session, POST verlangt den konfigurierten Origin und ausschließlich `{}`. 16 API- und 7 Webtests, Build und Projektprüfung bestanden. Browsernachweis mit zwei Konten: eigene unterschiedliche Profile, Wiedererkennung nach Neuladen, verspätete Antwort von A wird beim Wechsel zu B verworfen, kein Überlauf bei 390/1440 px. Unabhängiger Review durchgeführt. Nächster Schritt: Geräte- und Messsitzungsmodell mit klarer Quelle, Zeitbezug und Zuordnung auf diesem Profil aufbauen; Arztfreigabe und klinische Profilfelder bleiben offen.

## Navigation ohne doppelte Pflege

| Inhalt | Maßgebliche Stelle |
|---|---|
| Regeln und Git-Ablauf | [AGENTS.md](../AGENTS.md) |
| Projektziel, Rahmen, Hardware und historische Grenzen | [project-background.md](project-background.md) |
| Anforderungen und M0–M8 | [requirements.md](requirements.md) |
| Beschlüsse und Historie | [decisions.md](decisions.md) |
| Aufgaben, Status und bisherige Schätzungen | [backlog.csv](backlog.csv) |
| Detailanalyse des Altbestands | [analysis.md](analysis.md) |
| Alte Quellen / Code / Prüfbelege | [sources](sources/README.md), [legacy](legacy/README.md), [checks](checks/baseline.md) |
| Zusätzlicher Watch-Arbeitsbereich | [watch-compatibility.md](watch-compatibility.md) |
| Aktiver Anwendungscode, Installation und Datenfluss | [code/README.md](../code/README.md) |

Dieser Chat arbeitet ab der Strukturintegration ausschließlich auf `lenni/code`; `paul/code` ist Pauls Arbeitsbranch. Integration nach `main` erfolgt per Pull Request gemäß AGENTS.md.

Der historische 600-Personenstunden-Plan ist keine belastbare Schätzung des erweiterten Produktumfangs. Offene Aufgaben und neue Schätzungen werden im Backlog gepflegt. Lokale Gitstände und Branches ergeben sich aus Git, nicht aus vorweggenommenen Commitangaben hier.

### Übergabe 10.11.2026 – Rollen und Messhistorie

Das bestehende Patientenprofil bleibt eine explizite persönliche Zuordnung; seine Karte erklärt den Zweck und dass die Einrichtung allein keinen fremden Zugriff erteilt. Folgepakete mit Abnahmekriterien stehen in `context/requirements.md` unter „Folgepakete ab Patientenprofil“. Der Nutzer bezeichnet mit Therapeut den behandelnden Arzt; das Arztprüfverfahren ist offen. Für die gewünschte umfassende Gewichtshistorie ist die angenommene Senderate von 0,1 Sekunden unbestätigt; Messrate, Speicherbedarf und Erhalt von Spitzen und Lücken sind vor dem Speicherentwurf zu untersuchen. Nächster Schritt: Rollenklärung und Messratenanalyse anhand verfügbarer Hardware beziehungsweise Protokolldaten.

Der Legacy-BLE-Float wird nun separat validiert; Bluetooth und Simulation übergeben Wert und lokalen Empfangszeitpunkt gemeinsam an Liveanzeige und Schrittlogik. Die theoretische Speicheranalyse steht in [analysis.md](analysis.md#10-messpfad-und-speicherabschätzung-10-november-2026). Tatsächliche Gerätefrequenz, Verluste und Speicherkosten bleiben ungeprüft; das Messratenpaket ist ohne Hardwaremessung nicht abgeschlossen.
