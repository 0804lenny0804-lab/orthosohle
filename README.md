# OrthoSohle 2.0

Semesterprojekt für eine intelligente Messsohle mit eigenständigem BLE-Warnarmband und ergänzender Web-App. Höchste Priorität: lokale kg-Anzeige und haptische Warnung am Armband. Laufzeit 15.10.2026–28.01.2027, zwei Personen, 600 tatsächliche Personenstunden; normierte Planung: 300 Stunden.

## Einstieg

1. [Arbeitsregeln](AGENTS.md) und [Zusammenarbeit](CONTRIBUTING.md) lesen.
2. [Aktuellen Projektstatus](docs/context/PROJECT_STATE.md) lesen.
3. [Architektur und Modulgrenzen](docs/architecture.md) sowie die betroffene Modul-README öffnen.
4. Aufgabe aus dem [Backlog](docs/ORTHOSOHLE_BACKLOG.md) wählen.

## Repository-Stand

Dieses Repository enthält Projektgerüst, Regeln, Planung und den unveränderten historischen Quellstand unter `reference/orthopaul`. Die Produktmodule unter `apps/` und `firmware/` sind vorbereitet, noch nicht implementiert. Der Referenzcode ist laut ZIP-Analyse ein Vue-/Express-/SQLite-Prototyp mit Arduino-Sketch. Seine Migration erfolgt in eigenen Aufgaben; ein ZIP-Import erhält keine GitLab-Historie.

```text
apps/web/             Web-App: Vue/Vite, Zielmodul
apps/api/             Backend: Express/SQLite, Zielmodul
firmware/bracelet/    Lokale Armband-Firmware, Zielmodul
firmware/insole/      Notwendige Anpassungen der bestehenden Sohle
contracts/            Versionierte BLE-/API-Verträge und Beispieldaten
hardware/             BOM, Pinpläne, Gehäuse und Aufbaudokumentation
tests/system/         Gemeinsame Ende-zu-Ende-Prüfungen
scripts/              Repository-Werkzeuge
docs/                 Kontext, Entscheidungen, Planung und Prüfnachweise
reference/orthopaul/  Unveränderter Quellstand aus orthopaul-main.zip
```

## Repository prüfen

Voraussetzung für die Gerüstprüfung: Python 3.9+ und Git, keine Anwendungsabhängigkeiten.

```bash
python3 scripts/check_project.py
git diff --check
```

Die GitLab-CI-Konfiguration führt dieselbe Gerüstprüfung aus; eine Remote-Pipeline wurde noch nicht gestartet. Für die Produktmodule existieren noch keine Build-/Startbefehle. Der historische Prototyp hat eigene package.json-Dateien; konkrete geprüfte Schritte stehen in [Referenzbetrieb](docs/testing/REFERENCE_BASELINE.md). Ein erfolgreicher Referenzbuild bestätigt keine funktionierende medizinische Warnkette.

[Dokumentationsindex](docs/README.md) · [Ist-Analyse](docs/ORTHOSOHLE_BESTAND_UND_PLAN.md) · [Quellen](docs/references/README.md)
