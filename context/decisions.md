# Entscheidungsprotokoll

Nur relevante, dauerhaft wirksame Entscheidungen aufnehmen: Datum, Entscheidung, Grund und Konsequenz. Kleine lokale Implementierungsdetails gehören in Code/Commit. Offene Optionen stehen im Kontext, nicht als beschlossene Entscheidung hier. Frühere Einträge bei Ablösung erhalten und Nachfolger nennen; einzelne ADR-Dateien erst bei tatsächlichem Umfangsbedarf.

## 20.10.2026 – Ausgangsstruktur (ersetzt bezüglich Dokumentationsaufteilung)

**Entscheidung:** Ein gemeinsames OrthoSohle-Repository mit getrennten Zielbereichen für Web, API, Armband und Sohle; ZIP-Quellstand unverändert als Referenz importieren. Vue/Express zunächst als Basis behalten, keine vollständige Neuschreibung.

**Grund:** Vorhandenen funktionalen Prototyp weiterverwenden und Hardware/UI/Persistenz sauber trennen.

**Konsequenz:** Zielmodule werden in kleinen Schritten migriert; Referenz bleibt prüfbar. Ursprüngliches Detailgerüst mit CONTRIBUTING, separatem PROJECT_STATE/HANDOFF und ADR-Verzeichnis ist durch die folgende Vereinfachung ersetzt; historische Ausführung in Git erhalten.

## 20.10.2026 – Schlanke OrthoSohle-Arbeitsgrundlage (akzeptiert)

**Entscheidung:** AGENTS.md ist die einzige maßgebliche Arbeitsregeldatei. context/context.md bündelt aufbereitetes Projektwissen, Stand und aktuelle Übergabe; diese Datei bündelt relevante Entscheidungen. Aufgaben bleiben im Backlog, Fachgrenzen in architecture.md, Belege/Originalquellen in bestehenden Ablagen. Keine zusätzlichen Skill-/Agenten-/Standardordner oder CI-/Vorlagengerüste ohne konkreten Bedarf.

**Grund:** Nutzerauftrag: nur OrthoSohle, DRY, einfache abrufbare Wissensbasis und Ponytail-Grundsätze statt überentwickeltem Kontextsystem.

**Konsequenz:** Doppelte Regeln/Statusdateien zusammenführen, Verweise und Prüfskript mitziehen. Originalquellen und Referenzcode bleiben unverändert. Neue Trennung erst bei erkennbarem Verantwortungs-/Umfangsproblem. Bestehende Produktbereiche bleiben bestehen, keine zusätzliche code/-Ebene.

## 20.10.2026 – Entscheidungsfreiheit und Abschluss (akzeptiert)

**Entscheidung:** Kleine technische Entscheidungen innerhalb einer vereinbarten Aufgabe autonom treffen; größere Änderungen an Architektur, Hardware, Umfang und Abhängigkeiten vorher konkret besprechen. Relevante Dokumentation aktualisieren, passende Prüfungen ausführen und abgeschlossene Arbeit lokal committen. Push/Merge/Deployment getrennt beauftragen.

**Grund:** Ausdrückliche Nutzerantworten zu beiden Punkten; Fortschritt ohne unnötige Bestätigungsschleifen und mit nachvollziehbarem Stand.

**Konsequenz:** Verbindliche laufende Arbeitsregel in AGENTS.md; dieses Protokoll hält nur Beschluss und Herkunft fest. GitHub ist als künftige zentrale Ablage gewünscht, aber noch nicht eingerichtet.

## 20.10.2026 – Ponytail ohne Installation (akzeptiert)

**Entscheidung:** Ponytails Grundsätze sinngemäß mit DRY anwenden; keine Skillinstallation und keine Skill-Level-/Aktivierungsverwaltung.

**Grund:** Expliziter Nutzerauftrag und gelesene Originalquelle.

**Konsequenz:** Kleinste vollständige Änderung, Wiederverwendung und bedarfsgerechte Prüfungen in AGENTS.md festgeschrieben; [Quellennotiz](sources/ponytail.md) hält Herkunft und Auswahl fest. Prüfungen, Validierung und Hardwarekalibrierung dürfen nicht für Kürze entfallen.

## 20.10.2026 – Nur tatsächlichen Bestand als Ordner führen (akzeptiert)

**Entscheidung:** Root auf code/, context/ und scripts/ sowie AGENTS/README reduzieren. Ursprünglichen Referenzcode bytegleich nach context/legacy/orthopaul verschieben. Platzhalter für Apps, Firmware, Verträge, Hardware und Systemtests entfernen. Dokumente einheitlich benennen: context, decisions, backlog, analysis; Quellen unter sources, Nachweise unter checks.

**Grund:** Nutzer meldet unvereinbarte leere Ordner und fordert eine übersichtliche, vollständig nutzbare Arbeitsgrundlage. Frühere geplante Zielstrukturen hatten noch keinen tatsächlichen Codeinhalt.

**Konsequenz:** Ersetzt die bisherigen konkreten Zielpfade und das separate architecture-Dokument; fachliche Grenzen bleiben in AGENTS und der Analyse erhalten. Neue Module/Hardwareablagen erst bei ihrer Umsetzung anlegen. CSV ist der einzige Backlog, Manifest das einzige Dateiinventar; generierte Markdownkopie, leere Zeiterfassung und doppelte Inventarliste entfallen. Originalquellen und Quellinhalt bleiben unverändert. Einstieg über README mit tatsächlichen Befehlen und erstem C03-Arbeitsauftrag. Keine Produktmigration oder neue Funktion behaupten.

## 20.10.2026 – Produktziel und Arzt-/Patientenmodell (akzeptierte Kernvorgaben)

**Entscheidung:** Software auf Basis der bisherigen App umfassend zu einem produktreifen Frontend-/Backendsystem mit Arzt-/Patientenkonten, Sicherheit und DSGVO-Vorkehrungen weiterentwickeln. Nutzer bestätigt: Patient nimmt Einladung eines geprüften Arztes an; Arzt legt medizinische Belastungsgrenze fest, Patient sieht und bestätigt die Geräteübernahme; iPhone und Android sind Ziel der ersten Produktversion.

**Grund:** Ausdrücklicher neuer Produktauftrag und Antworten auf die drei Kernfragen.

**Konsequenz:** Konkrete Anforderungen und offene Detailentscheidungen werden in [requirements.md](requirements.md) gepflegt. Ziel ist keine Behauptung aktueller Einsatzreife. Einsatzform, Behandlermodell, Datenweg, Freigaben und Aufwand sind noch zu klären; alten Semesterbacklog nicht ungeprüft als ausreichenden Produktplan übernehmen. Kein Framework-, Hosting- oder Hardwarewechsel beschlossen.

## 20.10.2026 – Pilot, Arztwechsel und Watch-Folgeprojekt (akzeptierte Abgrenzung)

**Entscheidung:** Beaufsichtigter Pilot zuerst, reguläre Versorgung nach Freigabe; genau ein verantwortlicher Arzt je Patient mit unterstütztem Arztwechsel. Nutzer bestätigt den lokalen Pfad Sohle → Handy und bestimmt Waveshare ESP32-S3-Touch-LCD-1.28 als Hardwarebasis des eigenständigen Warnarmbands. Kompatibilität mit weiteren gängigen Smartwatches wird als eigenes Folgeprojekt vorgemerkt.

**Grund:** Antworten auf Einsatz-/Betreuungsfragen und ausdrücklicher Auftrag zur Vormerkung der Watch-Kompatibilität.

**Konsequenz:** Kernanforderungen angepasst, [WATCH](watch-compatibility.md) als eigene abrufbare Beschreibung gesichert. Waveshare ist Hauptprojekt/Armbandbasis. Noch keine Entscheidung über Handy-Backend-Upload, Hintergrundbetrieb, Gerätepuffer oder konkrete zusätzliche Watchmodelle. Kein neuer Chat/Remote/Repo angelegt und keine Watch-Kompatibilität behauptet.

## 20.10.2026 – Apple Watch von Beginn an mitplanen (aktuelle Planung)

**Entscheidung:** Die frühere rein nachgelagerte Einordnung der Watch-Clients wird für Apple Watch abgelöst. App/Backend, eigenes Waveshare-Armband und zusätzlicher Watch-Client werden gemeinsam spezifiziert; erste zusätzliche Zielplattform ist Apple Watch auf Basis der laut Nutzer vorhandenen Geräte (iPhone, Android-Handy, Waveshare-Armband, Apple Watch).

**Grund:** Nutzer möchte Watch-Clients direkt berücksichtigen und hat die verfügbare Testhardware bestätigt.

**Konsequenz:** Früher Apple-Watch-Durchstich in M1, gemeinsame Verträge und abgestimmte Umsetzung; Wear OS später ohne universelle Modellzusage. Details in [WATCH](watch-compatibility.md). Exakte Geräte-/OS-Versionen sind noch offen; Nutzer hat fehlenden macOS-Zugang und installierten AltServer bestätigt. AltServer ersetzt nicht Xcode/watchOS-Toolchain; nativen Apple-Build-/Installationsweg organisieren, bis dahin Blocker für den realen Apple-Client; keine native Toolchain, Transportbibliothek, Releasefrist oder Hardwarefunktion als bereits vorhanden behaupten. Bestehende Aufwandsschätzung bleibt neu zu prüfen.

## 27.10.2026 – Teamarbeit über persönliche Branches und Pull Requests (akzeptiert)

**Entscheidung:** `main` ist der Integrationsbranch. Lenni und Paul arbeiten auf persönlichen Aufgabenbranches im Schema `Lenni/<branchname>` bzw. `Paul/<branchname>`. Änderungen werden per Pull Request nach `main` eingebracht.

**Grund:** Nutzer arbeitet mit einem Kollegen zusammen und möchte Änderungen schrittweise und nachvollziehbar integrieren.

**Konsequenz:** Verbindlicher Ablauf steht in [AGENTS.md](../AGENTS.md) und wird in der README kurz erklärt. Die anschließende Prüfung ergab, dass `origin` bereits auf `0804lenny0804-lab/orthosohle` zeigt; `origin/main` ist erreichbar, enthält aber noch nicht die lokalen Projektgrundlagen. Technische Branch-Schutzregeln und CI bleiben ungeprüft.


## 29.10.2026 – Webapp vor Armband-Inbetriebnahme

**Entscheidung:** Nutzer priorisiert den Start mit der Webapp und korrigiert den Hardwarebestand: Das Armband ist noch nicht vorhanden.

**Konsequenz:** Lokale Vue-/Express-Grundlage mit schreibgeschützter Patientenansicht und klar gekennzeichnetem synthetischem Plan. Noch keine Auth-/Hostingentscheidung oder echte Datenspeicherung. Armbandanforderungen bleiben bestehen; deren reale Abnahme ist bis zur Hardwareverfügbarkeit offen.


## 29.10.2026 – Lokaler Auth-Durchstich

**Arbeitsentscheidung:** Better Auth mit better-sqlite3 für Testkonto, Anmeldung, datenbankgestützte Session und Widerruf in der lokalen Vue-/Express-Webapp. Nutzer hat die angekündigte Auswahl und Integration mit „go“ beauftragt. Keine Hosting-/Providerbindung oder Produktionsfreigabe.

**Grund:** Etablierte Bibliothek statt eigener Passwort-/Sessionkryptografie, gleicher Origin und lokal nachvollziehbare Datenhaltung. Arztprüfung und Betreuungsrechte bleiben fachliche Backendregeln.

**Konsequenz:** Node 22.12+; native SQLite-Abhängigkeit und regelmäßige Sicherheitsupdates berücksichtigen. Start ausdrücklich lokal freigeben und Secret setzen. E-Mail-Verifikation/Reset, Arzt-MFA/Recovery, persistenter Missbrauchsschutz, fachliche Autorisierung, Migrations-/Betriebsfreigaben noch offen. Referenzen: https://www.better-auth.com/docs/integrations/express und https://www.better-auth.com/docs/concepts/session-management ; implementierte API-Exports anhand installierter Version geprüft, HTTP-Verhalten mit isolierter SQLite getestet.


## 29.10.2026 – Drei dauerhafte Branches und klare Ablage

**Entscheidung:** Nutzer bestätigt ausdrücklich Personenbranches pushen und per Pull Request nach main integrieren. Dauerhafte Namen: lenni/code, paul/code und main. Dies ersetzt die frühere Regel mit wechselnden Aufgabenbranches. Alte Branchstände werden vor Namensbereinigung über Archiv-Tags erhalten; kein fremder ungemergter Stand wird stillschweigend integriert.

**Ablage:** Regeln bleiben in AGENTS.md; Projektwissen, Planung, Prüfbelege und unveränderter Altcode liegen unter context/. Unter code/ liegt ausschließlich der aktive Entwicklungsbereich. Produktive Einsatzfähigkeit folgt daraus nicht. context/context.md enthält einen kompakten aktuellen Stand statt angehängter widersprüchlicher Übergaben; Hintergrund liegt in project-background.md, Beschlusshistorie bleibt hier erhalten.

**Ergänzender Nutzerauftrag:** Den geordneten Gesamtstand jetzt auf main integrieren; anschließend diesen Chat ausschließlich auf lenni/code fortsetzen. Dieser einmalige Integrationsauftrag umfasst den bisherigen lokalen Webapp-/Auth-Stand und die Strukturänderung; künftige Integrationen bleiben im Pull-Request-Ablauf.


## 29.10.2026 – Neustart der Implementierung für mobile Zielarchitektur

**Nutzerauftrag:** Bisherige neue Implementierung aus main entfernen und von null beginnen. Regeln, Projektwissen und historische Referenz bleiben als Arbeitsgrundlage erhalten; kein Umschreiben der Git-Historie. Vollständiger Stand vor Entfernung unter `archive/2026-10-29/before-mobile-restart` gesichert.

**Konsequenz:** code/webapp inklusive neuer Auth-Implementierung entfernt. Frühere Stackentscheidungen gelten als archivierter Versuch, nicht als verbindliche Architektur des Neustarts. Zielrichtung: installierbare Patienten-App und Webportal über gemeinsame Backend-API; mobile Framework-, Auth- und Hostingwahl noch offen. Bestehende Test-/Buildnachweise sind historisch. Neue Umsetzung ausschließlich auf lenni/code; Entfernung per Pull Request nach main.


## 29.10.2026 – React Native/Expo als mobile Arbeitsgrundlage

**Arbeitsentscheidung nach Startauftrag:** Erster mobiler Durchstich mit React Native, Expo Development Builds und TypeScript. Kein Wiederaufnehmen des Vue-Clients, keine neue Backend-/Auth-/Hostingentscheidung.

| Kriterium | React Native / Expo | Flutter |
|---|---|---|
| Team-/Sprachaufwand | JavaScript-/TypeScript-Anschluss an bisherigen Kontext; React muss gelernt werden | Neue Sprache Dart und Flutter-Widgetmodell |
| iOS und Android | Gemeinsamer Client mit nativen Projekten | Gemeinsamer Client mit nativen Projekten |
| BLE und Hintergrund | Native Module/Development Build nötig; reale Plattformtests erforderlich | Plugins/native Ergänzungen nötig; dieselben Plattformgrenzen prüfen |
| Webportal und API | TypeScript kann Vertragsarbeit erleichtern; derzeit kein gemeinsames Paket nötig | Gemeinsame API trotz anderer Sprache möglich |
| Apple Watch | Zusätzlicher nativer watchOS-Client | Zusätzlicher nativer watchOS-Client |

**Grund:** Für den kleinen ersten Durchstich vermeidet TypeScript eine weitere Sprache und erlaubt isolierte Fachlogiktests. Flutter wird dadurch nicht als technisch ungeeignet bewertet. Native BLE-/Hintergrundeignung noch nicht nachgewiesen; wenn der Geräteversuch scheitert, Architektur vor weiterer Produktentwicklung neu bewerten.

**Umsetzung/Quelle:** Offizielles npm-Paket expo-template-blank-typescript@58.0.30 als minimale Grundlage, Abhängigkeiten passend zum Template und Expo bundledNativeModules.json. Quelle https://www.npmjs.com/package/expo-template-blank-typescript ; abgerufen 29.10.2026. Dateien modular, keine echten Nutzerdaten, keine Netzwerk-/Geräteanbindung im Prototyp. Buildprofile vorbereitet, aber keine Cloudregistrierung oder Signierung ausgeführt.
