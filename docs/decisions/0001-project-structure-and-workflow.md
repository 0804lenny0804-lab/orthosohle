# 0001 – Projektstruktur, Kontext und Arbeitsweise

- Datum: 2026-10-20
- Status: akzeptiert
- Grundlage: Nutzerauftrag, Projektstruktur sowie Verbindlichkeiten für Code, Arbeitsweise, Kontext, Dokumentation und Git einzurichten.

## Problem

Das neue Repository enthielt nur eine README, die Analyse war unversioniert. Der Quellstand aus GitLab liegt ausschließlich als ZIP ohne Commit-Historie vor. Neue Chats brauchen einen verlässlichen Einstieg; Planungsziele dürfen nicht als vorhandene Implementierung erscheinen.

## Entscheidung

Ein Repository mit getrennten Zielmodulen für Web, API und beide Firmwares. Den ZIP-Stand unverändert als lokale Referenz erhalten, aktive Migration in eigenständigen Arbeitsschritten. Vue/Vite und Express/SQLite zunächst als Ausgangsbasis erhalten, endgültige Hardware und Infrastruktur offenlassen.

AGENTS.md und CONTRIBUTING.md regeln Einstieg, Modulgrenzen, Abnahme, Prüfungen und Git. PROJECT_STATE ist der kompakte aktuelle Kontext. ADRs dokumentieren dauerhafte Entscheidungen, Backlog-CSV ist die maßgebliche Aufgabenliste, Markdown eine generierte Ansicht. Originalquellen und Prüfnachweise bleiben unterscheidbar.

Abgeschlossene beauftragte Änderungen lokal committen; kein automatischer Push, Merge oder Deployment. GitLab-Branchschutz und CI nicht als eingerichtet behaupten. Der aktuelle Branch work bleibt bestehen; Integrationsbranch und Remote-Konfiguration erst vor erster Integration verifizieren.

## Alternativen

- Alles im historischen local-comm-Verzeichnis weiterführen: schneller Start, aber Firmware/UI-Vermischung und unklare Produkt-/Referenzgrenze.
- Vollständige Neuschreibung: derzeit nicht durch den vorhandenen Vue-/Express-Stand begründet.
- Nur Chatkontext: nicht versionierbar, für Team und neue Sitzungen unzuverlässig.

## Folgen und erneute Prüfung

Produktmodule sind vorerst Gerüste und brauchen eigene Migration/Builds. Referenzkopie kostet weniger als 1 MB Quelltext; Herkunft wird durch Manifest gesichert. Struktur beim ersten Firmware-/Gateway-Spike prüfen, Änderungen durch Folge-ADR dokumentieren. Keine Hardware-/Hostingentscheidung aus diesem ADR ableiten.
