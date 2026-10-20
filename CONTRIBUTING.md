# Zusammenarbeit und Definition of Done

Diese Vereinbarungen gelten ab Einrichtung dieses Projektgerüsts. Neue Entscheidungen dürfen sie nachvollziehbar ändern. AGENTS.md ist der kurze Einstieg; dieses Dokument beschreibt den Arbeitsablauf für das Zweierteam.

## Eine Aufgabe bearbeiten

1. Aufgabe mit ID aus dem Backlog wählen. Verantwortliche Person, Ziel, Abnahme, Abhängigkeiten und Schätzung vor Beginn festhalten. Mit Hardwarebeschaffung früh beginnen. Pro Person höchstens eine Umsetzung gleichzeitig; blockierte Arbeit sichtbar markieren.
2. Größere Aufgaben in Arbeitsschritte von etwa 2–4 tatsächlichen Personenstunden teilen. Zeit im Plan nicht mit echter Einzelzeiterfassung verwechseln. Review und Checks gehören in die Schätzung.
3. Vom vereinbarten Integrationsstand einen kurzen Arbeitsbranch anlegen: `feat/A14-local-alert`, `fix/B01-limit-response`, `docs/project-workflow` oder `chore/build-setup`. Bei bereits vorgegebenem Codex-Branch diesen verwenden; keine laufende Arbeit durch Branchwechsel gefährden.
4. Kleinen vertikalen Teil umsetzen: Verhalten, passende Prüfung, relevante Dokumentation. Vorher/nachher und verbleibende Grenzen beschreiben.
5. Prüfen, selbst Diff lesen, Kontext/Backlog aktualisieren, gezielt stagen und committen. Vor externem Push/Merge muss der entsprechende Auftrag vorliegen.
6. Merge Request mit Vorlage erstellen, wenn Remote-Zugriff und Auftrag vorhanden sind. Zweite Person prüft; Autor beantwortet Befunde. Nach Merge Arbeitsbranch nach Teamabsprache löschen.

## Definition of Ready

Eine Aufgabe ist umsetzbar, wenn Ziel und Abnahme überprüfbar sind, nötige Informationen/Teile vorliegen und Abhängigkeiten erfüllt oder bewusst als Spike eingegrenzt sind. Ein Spike endet mit Entscheidung, Messung oder dokumentierter Machbarkeitsgrenze, nicht zwingend Produktcode.

## Definition of Done

- Beschriebenes Verhalten umgesetzt; Abnahme nachgewiesen oder Aufgabe ausdrücklich weiter offen.
- Relevante automatisierte Prüfungen erfolgreich; für Hardware manueller Prüfbericht mit Aufbau, Firmwarestand, Testfällen und Ergebnis. Keine ungeprüfte Warnkette als abgeschlossen deklarieren.
- Fehler-/Grenzfälle berücksichtigt, besonders Datenalter, Überbereich, Verbindungsabbruch und Nutzertrennung.
- Build/Start und Konfiguration nachvollziehbar; Schemaänderungen mit Migration und Rücksicherungsweg.
- Dokumentation, PROJECT_STATE und ggf. Verträge/ADR aktualisiert; keine Secrets oder personenbezogenen Messdaten im Diff.
- Review durch zweite Person vor Integration. Bei Warnlogik, Kalibrierung, Protokoll, Datenmigration und Autorisierung explizit die Risiko-/Fehlerfälle prüfen.
- Fokussierter Commit vorhanden; Reständerungen erklärt. „Erledigt“ erst bei erfüllter Abnahme, nicht nach bloßem Code-Schreiben.

## Git-Vereinbarung

- `main` ist der vorgeschlagene Integrations-/Demo-Branch. Der aktuelle lokale Arbeitsbranch heißt `work`; vorhandenen Remote-Default vor erster Integration prüfen. Kein pauschales Umbenennen, Überschreiben oder erzwungenes Angleichen.
- Kleine Commits mit `feat(scope): …`, `fix(scope): …`, `docs(scope): …`, `test(scope): …` oder `chore(scope): …`. Aufgaben-ID in Nachricht oder Beschreibung, wenn zutreffend.
- Vor Commit Diff, Status und Prüfungen ansehen. Konkrete Pfade stagen; keine fremden/unbekannten Änderungen mitnehmen. Generierte Builds, node_modules, lokale Datenbanken, Secrets und echte Patientendaten bleiben außerhalb von Git.
- `.env.example` enthält nur Variablennamen und harmlose Platzhalter. Lockfiles versionieren. Abhängigkeiten gezielt aktualisieren; keine beiläufigen Major-Upgrades.
- Keine veröffentlichten Commits umschreiben. Kein `push --force`, kein `reset --hard`, keine Bereinigung fremder Dateien. Remote-Konfiguration nur bei gezieltem Auftrag ändern.
- Eine GitLab-CI-Konfiguration für den Repository-Checker liegt vor; ihre Ausführung auf dem Remote ist ungeprüft. Branchschutz und Pflichtreview sind im GitLab-Projekt separat einzurichten. Dateien im Repository allein erzwingen diese Regeln serverseitig nicht. Derzeit sind keine solchen Remote-Einstellungen verifiziert.

## Semester-Rhythmus

- Wöchentlich ca. 20–30 Minuten: Fortschritt anhand von Demos/Abnahmen, reale Stunden, Hardwarelieferungen, Risiken und nächste Aufgaben besprechen; Aufwand auf C buchen.
- Mindestens alle zwei Wochen gemeinsam einen integrierten Stand zeigen; Integrationszeit auf D buchen. Nicht bis Januar mit End-to-End beginnen.
- Zuständigkeit je Aufgabe festlegen; Vorschlag: Person 1 führt Armband, Person 2 Web-App. Namen und tatsächliche Verfügbarkeit sind noch offen, diese Zuordnung ist keine bestätigte Personalentscheidung.
- Quellen, Fotos, Architekturentscheidungen und Messungen während der Arbeit sammeln. Hochschulvorgaben zu Hausarbeit/KI-Nutzung verifizieren und tatsächliche Nutzung dokumentieren.
- Bei Budgetüberschreitung zuerst optionale Watch-/Komfortfunktionen reduzieren. Pflichtwarnfunktion und belegte Grenzen nicht durch zusätzliche UI-Funktionen verdrängen.

## Dokumentationssprache

Projektdokumentation deutsch; Codebezeichner und Commit-Präfixe englisch. Unbekanntes als offen markieren, Vorschläge von akzeptierten Entscheidungen trennen. Keine ungemessenen Leistungszahlen oder erfundenen Termine/Implementierungen.
