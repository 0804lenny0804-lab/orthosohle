# Entscheidungsprotokoll

Nur relevante, dauerhaft wirksame Entscheidungen aufnehmen: Datum, Entscheidung, Grund und Konsequenz. Kleine lokale Implementierungsdetails gehören in Code/Commit. Offene Optionen stehen im Kontext, nicht als beschlossene Entscheidung hier. Frühere Einträge bei Ablösung erhalten und Nachfolger nennen; einzelne ADR-Dateien erst bei tatsächlichem Umfangsbedarf.

## 20.10.2026 – Ausgangsstruktur (ersetzt bezüglich Dokumentationsaufteilung)

**Entscheidung:** Ein gemeinsames OrthoSohle-Repository mit getrennten Zielbereichen für Web, API, Armband und Sohle; ZIP-Quellstand unverändert als Referenz importieren. Vue/Express zunächst als Basis behalten, keine vollständige Neuschreibung.

**Grund:** Vorhandenen funktionalen Prototyp weiterverwenden und Hardware/UI/Persistenz sauber trennen.

**Konsequenz:** Zielmodule werden in kleinen Schritten migriert; Referenz bleibt prüfbar. Ursprüngliches Detailgerüst mit CONTRIBUTING, separatem PROJECT_STATE/HANDOFF und ADR-Verzeichnis ist durch die folgende Vereinfachung ersetzt; historische Ausführung in Git erhalten.

## 20.10.2026 – Schlanke OrthoSohle-Arbeitsgrundlage (akzeptiert)

**Entscheidung:** AGENTS.md ist die einzige maßgebliche Arbeitsregeldatei. docs/context.md bündelt aufbereitetes Projektwissen, Stand und aktuelle Übergabe; diese Datei bündelt relevante Entscheidungen. Aufgaben bleiben im Backlog, Fachgrenzen in architecture.md, Belege/Originalquellen in bestehenden Ablagen. Keine zusätzlichen Skill-/Agenten-/Standardordner oder CI-/Vorlagengerüste ohne konkreten Bedarf.

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

**Entscheidung:** Root auf code/, docs/ und scripts/ sowie AGENTS/README reduzieren. Ursprünglichen Referenzcode bytegleich nach code/orthopaul verschieben. Platzhalter für Apps, Firmware, Verträge, Hardware und Systemtests entfernen. Dokumente einheitlich benennen: context, decisions, backlog, analysis; Quellen unter sources, Nachweise unter checks.

**Grund:** Nutzer meldet unvereinbarte leere Ordner und fordert eine übersichtliche, vollständig nutzbare Arbeitsgrundlage. Frühere geplante Zielstrukturen hatten noch keinen tatsächlichen Codeinhalt.

**Konsequenz:** Ersetzt die bisherigen konkreten Zielpfade und das separate architecture-Dokument; fachliche Grenzen bleiben in AGENTS und der Analyse erhalten. Neue Module/Hardwareablagen erst bei ihrer Umsetzung anlegen. CSV ist der einzige Backlog, Manifest das einzige Dateiinventar; generierte Markdownkopie, leere Zeiterfassung und doppelte Inventarliste entfallen. Originalquellen und Quellinhalt bleiben unverändert. Einstieg über README mit tatsächlichen Befehlen und erstem C03-Arbeitsauftrag. Keine Produktmigration oder neue Funktion behaupten.

## 20.10.2026 – Produktziel und Arzt-/Patientenmodell (akzeptierte Kernvorgaben)

**Entscheidung:** Software auf Basis der bisherigen App umfassend zu einem produktreifen Frontend-/Backendsystem mit Arzt-/Patientenkonten, Sicherheit und DSGVO-Vorkehrungen weiterentwickeln. Nutzer bestätigt: Patient nimmt Einladung eines geprüften Arztes an; Arzt legt medizinische Belastungsgrenze fest, Patient sieht und bestätigt die Geräteübernahme; iPhone und Android sind Ziel der ersten Produktversion.

**Grund:** Ausdrücklicher neuer Produktauftrag und Antworten auf die drei Kernfragen.

**Konsequenz:** Konkrete Anforderungen und offene Detailentscheidungen werden in [requirements.md](requirements.md) gepflegt. Ziel ist keine Behauptung aktueller Einsatzreife. Einsatzform, Behandlermodell, Datenweg, Freigaben und Aufwand sind noch zu klären; alten Semesterbacklog nicht ungeprüft als ausreichenden Produktplan übernehmen. Kein Framework-, Hosting- oder Hardwarewechsel beschlossen.
