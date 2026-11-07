# OrthoSohle – aktueller Projektkontext

Stand: 07.11.2026. Regeln ausschließlich in [AGENTS.md](../AGENTS.md); Start und Dateien der aktiven Anwendung in [code/README.md](../code/README.md).

## Ziel und aktueller Schwerpunkt

Ärzte-/Patientensystem für nachvollziehbare Teilbelastung mit unabhängiger Armbandwarnung. Aktueller Auftrag: sauberer Neustart für installierbare iOS-/Android-App plus kompatibles Webportal. Das ausgewählte Waveshare-Armband ist laut Nutzer noch nicht vorhanden. Historischer Sohlenaufbau und verfügbare Smartphone-/Watchgeräte sind in [project-background.md](project-background.md) eingeordnet.

## Belegter Softwarestand

- [Altbestand](legacy/README.md): 51 unveränderte Dateien aus dem GitLab-ZIP mit [Manifest](legacy/manifest.json); ursprünglicher GitLab-Commit unbekannt. Referenz, keine Produktfreigabe.
- Nutzerauftrag vom 06.11.2026: nah am bestehenden Web-App-Build weiterarbeiten, diesen schrittweise verbessern und als Basis für APK/IPA verwenden.
- Erste aktive Kopie des bisherigen Vue-/Vite-Frontends liegt unter `code/webapp`; der unveränderte Ausgangscode liegt weiterhin unter `context/legacy/orthopaul/local-comm/frontend`. Diese erste Übernahme enthält noch keine Funktionserweiterung oder native Verpackung.
- Verifikation 06.11.2026: aktives Frontend vollständig bytegleich zur Legacy-Quelle übernommen; `npm ci` und `npm run build --prefix code/webapp` mit Node 24.19.0 erfolgreich. Das ist ausschließlich ein Web/PWA-Buildnachweis.
- Erster Verbesserungsschritt: Bluetooth-Ansicht zeigt fehlende Web-Bluetooth-Unterstützung und sperrt die Auswahl; der Web-Build war erfolgreich, Browser- und Gerätetest stehen noch aus. Die übrige Verbindung nutzt weiterhin den bisherigen Web-Bluetooth-Pfad.
- Live-Diagramm: feste 40-kg-Achsgrenze entfernt; die Grenzlinie erhält auch bei weniger als zwei Messwerten zwei Positionen. Web-Build und synthetische Prüfung der Datenreihen und Chart.js-Skala erfolgreich; Canvas-/Browserprüfung steht aus. Ein einzelner Messpunkt bleibt bislang unsichtbar.
- Die PWA allein erzeugt keine APK/IPA. Better Auth ist als Auth-Basis gewählt; native Verpackung, mobile BLE-Anbindung, Push und Hosting sind noch offen. Bestehende feste Nutzer-ID, API-Cache und Prototypzustände müssen vor Nutzung mit echten Gesundheitsdaten bearbeitet werden.
- Zielrichtung bleibt: gemeinsame Web-Oberfläche/API-Basis, installierbarer Patientenclient und Ärzteportal. Die Migration erfolgt in kleinen, modularen und unabhängigen Review-Schritten gemäß [Agentenablauf](../AGENTS.md) und [Rollen](agents/).

## Nachweise und Grenzen

Die acht Auth-/API-Tests und der Webbuild des archivierten Versuchs sind historische Nachweise dieses entfernten Versuchs. Sie belegen keine Funktionen des Neustarts. Aktuell prüfbar: Repositorystruktur, Dokumentationslinks, Backlog und unveränderte Originaldateien. Hardware, mobile Buildkette, BLE, Hintergrundbetrieb, Watch, Datenschutz-/Betriebs- und Einsatzfreigaben bleiben offen.

## Nächster konkreter Schritt

Das übergeordnete [Systembild](requirements.md#systembild-und-verantwortlichkeiten) führt Verantwortlichkeiten und Datenflüsse zusammen. Konto- und Sessionzustände sind als fachlicher Entwurf in [requirements.md](requirements.md#konto--und-sessionzustände) beschrieben: erlaubte/verbotene Aktionen, Übergänge und offene Session-/Recoveryregeln. Der lokale API-Durchstich implementiert jetzt synthetische E-Mail-/Passwortanmeldung; ein modularer Web-Kontobereich ist jetzt vorhanden; fachliche Autorisierung steht noch aus.

Das [Betreuungsmodell](requirements.md#betreuungszustände-und-arztwechsel) beschreibt Einladungen getrennt von Beziehungen, ausdrückliche Annahme, Ende und atomaren Arztwechsel sowie spätere Negativnachweise. Rechte nach Ende, Planfortgeltung und Aufbewahrung bleiben offen; technische Umsetzung steht aus.

Das [minimale fachliche Datenmodell](requirements.md#datenzuordnung-und-minimales-fachliches-datenmodell) beschreibt Datenzuordnung, Kardinalitäten und Integritätsregeln für Identität, Profile, Betreuung, Geräte, Pläne, Messungen sowie Audit-/Datenschutzvorgänge. Technische Zuordnung bedeutet kein rechtliches Dateneigentum; Speicherung, Migrationen und offene Aufbewahrungsregeln sind noch nicht implementiert.

Der [Auth-Vergleich](requirements.md#auth-optionen-vergleich-und-empfehlung) wurde durch die Nutzerwahl Better Auth vom 07.11.2026 konkretisiert. Erster lokaler API-Durchstich unter `code/api`: Better Auth 1.7.18, Express 5.3.0 und better-sqlite3 12.11.1, persistente Konten/Sessions, explizite lokale Freigabe und Secretpflicht, Loopback-Bindung, implizites Linking und Cookiecache aus. Acht API-Tests sind erfolgreich: Konfigurationsschutz, Registrierung/Login/Logout-Replay, Wiederöffnung der API-/SQLite-Instanzen sowie erlaubter Web-Origin und abgewiesener Fremd-Origin. Nach einem Windows-Installationsfehler mit better-sqlite3 13.0.3 wurde auf 12.11.1 gewechselt; erneute Windows-Installation ist noch zu bestätigen. Die SQLite-Daten werden temporär isoliert beziehungsweise unter ignorierter lokaler Ablage gespeichert. Lokale Test-Mailverifikation ist ergänzt; weiterhin keine reale Mailzustellung, Fachrechte, Social- oder mobile Anmeldung; kein Produktionsnachweis.

Sichtbarer Web-Durchstich: eigener Konto-Tab mit synthetischer Registrierung, Login, erneuter Sessionprüfung nach Neuladen und Logout. Featuremodule trennen Fetch-Transport, zentralen flüchtigen Sessionzustand und Vue-Darstellung. Enger lokaler Vite-Proxy und expliziter Backend-Web-Origin verbinden beide; keine Tokens im LocalStorage. Lade-/Serverfehler sind sichtbar, abgeschickte Passwörter werden gelöscht und die Messoberfläche als noch nicht kontozugeordnet gekennzeichnet. Fünf API-/Origin-Tests und der Web-Build sind erfolgreich; Browserprüfung steht noch aus.

Lokale Verifikation ist implementiert: privater Datei-Mailausgang neben der SQLite-Datei, serverseitiger Verifikationsstatus im Konto-Tab, erneutes Anfordern und sicherer Rücksprung ohne Tokens im Profil oder normalen Logs. Better Auth prüft seine JWTs; zusätzliche gehashte Ausgabemarker und atomare Bibliotheks-Consume-/Reserveoperationen erfüllen den lokalen Replay-Schutz. Das erteilt keine Fachrechte und erzeugt keine neue Session. API-Tests decken gültige/falsche/abgelaufene Links und gleichzeitigen Replay ab; Callbackfehler werden generisch angezeigt und aus der URL entfernt. Browser- und reale Mailzustellprüfung stehen aus.

Nächster einzelner Schritt: lokale Verifikationsoberfläche im Browser mit synthetischem Konto vollständig abnehmen (Registrierung, Link, Status, erneutes Anfordern/Fehler, Logout). Danach Passwortwiederherstellung separat spezifizieren und umsetzen.

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
