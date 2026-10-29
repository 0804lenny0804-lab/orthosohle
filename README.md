# OrthoSohle

## Einstieg

1. [Arbeitsregeln](AGENTS.md): Zusammenarbeit, Modularität, DRY/Ponytail und Qualität.
2. [Projektkontext](context/context.md): Ziel, belegter Stand, offene Fragen und nächster Schritt.
3. [Aktiver Entwicklungsbereich](code/README.md): aktuelle Anwendung, Installation und lokale Startbefehle.

## Ablage

```text
AGENTS.md             Verbindliche Regeln
context/              Projektwissen und Nachweise
  context.md          Kompakter aktueller Stand und Navigation
  requirements.md     Produktanforderungen und Abnahme
  decisions.md        Entscheidungen mit Gründen und Historie
  backlog.csv         Aufgaben, Status und bisherige Schätzungen
  analysis.md         Detailanalyse des Altbestands
  watch-compatibility.md  Zusätzlicher Watch-Arbeitsbereich
  legacy/             Unveränderter Altcode, Manifest und alte Startanleitung
  sources/            Originalunterlagen
  checks/             Ausgeführte Prüfungen und Grenzen
code/                 Aktiver Entwicklungsbereich
  README.md           Installation, Start, Datenfluss und Grenzen
scripts/              Repositoryprüfung und deren Tests
```

„Aktiver Entwicklungsbereich“ bezeichnet den neuen Produktcode; eine Produktionsfreigabe ist damit nicht verbunden. Aktuell liegt ein neuer React-Native-/Expo-Prototyp unter code/mobile; native Geräteinstallation und BLE sind noch ungeprüft. Regeln, Anforderungen und Referenzcode bleiben erhalten.

## Prüfungen

Im Repository-Root mit Git, Python 3.9+:

```bash
python3 scripts/check_project.py
python3 -m unittest discover -s scripts -p 'test_*.py'
git diff --check
```

Die Repositoryprüfung kontrolliert Links, Backlog und die unveränderten Originaldateien. Die historische 600-Personenstunden-Schätzung deckt den erweiterten Produktumfang nicht belastbar ab. Aktuelle Grenzen und Startkonfiguration stehen im Code-Einstieg.

## Git und Gerätewechsel

Es gibt drei dauerhafte Branches: `lenni/code`, `paul/code` und `main`. Der genaue Integrationsablauf steht ausschließlich in [AGENTS.md](AGENTS.md). Vor Synchronisierung lokalen Status und Remote-Stand prüfen. Zugangsdaten, lokale Datenbanken, installierte Pakete und Chatverläufe werden nicht durch Git übertragen.
