# OrthoSohle 2.0

Gemeinsame Arbeitsgrundlage für das Semesterprojekt OrthoSohle. Projektwissen und aktueller Stand: [docs/context.md](docs/context.md).

## In einem neuen Chat oder auf einem anderen Gerät

1. Repository-Ordner öffnen, `git status --short --branch` und `git log -5 --oneline` prüfen.
2. [AGENTS.md](AGENTS.md) und [Projektkontext einschließlich Übergabe](docs/context.md) lesen.
3. Nur die betroffene Modul-README, [Architektur](docs/architecture.md), [Aufgabe](docs/ORTHOSOHLE_BACKLOG.md) und relevante [Entscheidungen](docs/decisions.md) nachladen.

## Ablagen

```text
AGENTS.md             Verbindliche Arbeitsregeln, DRY und Ponytail-Grundsätze
README.md             Einstieg und Wegweiser
docs/
  context.md          Aufbereitetes Wissen, Iststand, offene Fragen, Übergabe
  decisions.md        Relevante Entscheidungen mit Begründung
  architecture.md     Fachliche Modulgrenzen
  references/         Originalunterlagen und Quellen
  testing/            Tatsächliche Prüfnachweise
  ORTHOSOHLE_*        Vorhandene Analyse, Backlog und Ergebnisse
  WORK_LOG.csv        Tatsächliche Einzelzeiten
apps/web/             Web-App (Zielmodul, noch nicht migriert)
apps/api/             Backend (Zielmodul, noch nicht migriert)
firmware/bracelet/    Eigenständiges Warnarmband (noch nicht implementiert)
firmware/insole/      Notwendige Anpassungen der bestehenden Sohle
contracts/            Versionierte BLE-/API-Verträge
hardware/             BOM, Pinpläne und Gehäuse
tests/system/         Modulübergreifende Prüfungen
scripts/              Repository-Werkzeuge
reference/orthopaul/  Unveränderter historischer Code aus der ZIP
```

## Prüfen

Python 3.9+ genügt für die Repositoryprüfung, keine zusätzlichen Pakete:

```bash
python3 scripts/check_project.py
python3 -m unittest discover -s scripts -p 'test_*.py'
git diff --check
```

Backlog nur in der CSV bearbeiten; Markdown mit `python3 scripts/check_project.py --write-backlog` erzeugen. Produktmodule haben noch keine ausführbaren Builds. Für den historischen Prototyp existiert ein [Prüfkontext](docs/testing/REFERENCE_BASELINE.md).

GitHub-Synchronisierung ist noch nicht eingerichtet. Dateien werden erst mit Commit/Push und Clone/Pull zwischen Geräten übertragen; Chats, lokale DB und Zugangsdaten bleiben getrennt. Details zum aktuellen Git-Stand und Gerätewechsel stehen im Projektkontext.
