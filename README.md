# OrthoSohle 2.0

## Hier anfangen

1. [Arbeitsregeln](AGENTS.md) lesen.
2. [Projektkontext](docs/context.md) öffnen: aufbereitetes Wissen, Iststand und nächster Schritt.
3. Eine Aufgabe aus dem [Backlog](docs/backlog.csv) bearbeiten; bei Bedarf [Code-Einstieg](code/README.md) oder [Detailanalyse](docs/analysis.md) lesen.

## Struktur

```text
AGENTS.md            Arbeitsregeln – einzige maßgebliche Regeldatei
README.md            Dieser Einstieg
code/                Tatsächlich vorhandener Code mit Startanleitung
  README.md          Codeübersicht, Installation, Betrieb und Grenzen
  manifest.json      Herkunft und Prüfsummen des Originalcodes
  orthopaul/         Unveränderte Codegrundlage aus GitLab-ZIP
docs/                Projektwissen und Arbeitsunterlagen
  context.md         Ziel, Iststand, offene Fragen und aktuelle Übergabe
  decisions.md       Relevante Entscheidungen mit Gründen
  backlog.csv        Aufgaben mit Priorität, Abhängigkeiten und Abnahme
  analysis.md        Ausführliche Bestandsaufnahme und Semesterplanung
  sources/           Originalunterlagen und Ponytail-Quellennotiz
  checks/            Tatsächlich ausgeführte Prüfungen und Ergebnisse
scripts/             Repositoryprüfung und deren Tests
```

Es gibt keine leeren Produktmodule. Neue Ordner entstehen erst mit echtem Code oder tatsächlichen Unterlagen. Der bestehende Code bleibt zunächst vollständig unter code/orthopaul; zukünftige Module werden bei ihrer ersten Umsetzung unter code/ angelegt. Kein Code wurde durch diese Bereinigung als produktfähig erklärt.

## Arbeitsgrundlage prüfen

Voraussetzungen: Git und Python 3.9+, keine zusätzlichen Python-Pakete. Im Repository-Root ausführen:

```bash
python3 scripts/check_project.py
python3 -m unittest discover -s scripts -p 'test_*.py'
git diff --check
```

Die Prüfung kontrolliert Dateien/Links, Backlog-Abhängigkeiten und 300/600-Stunden-Budget sowie den unveränderten Originalcode. Der [Code-Einstieg](code/README.md) beschreibt den gesonderten Node-Build und lokalen Betrieb.

## Erster konkreter Arbeitsauftrag

**C03: Hardwarebestand und Firmwarestand abgleichen**, als erster kleiner Schritt:

- Tatsächlich vorhandenes Board, Sensor, HX711, Versorgung und Verkabelung erfassen.
- Geflashten Sketch und Bibliotheks-/Boardversionen feststellen; Unsicherheiten ausdrücklich offenlassen.
- Ergebnis zunächst im Abschnitt „Hardwarebestand“ des Projektkontexts festhalten. Erst bei echten Fotos, Pinplänen oder einer Stückliste eine eigene Hardwareablage anlegen.
- Abnahme: dokumentierter aktueller Bestand mit Quelle/Foto/Beobachtung. Die ältere Hausarbeit allein erfüllt diese Abnahme nicht. Danach C05 zur BLE-Topologie.

Unabhängig davon kann C02 die Migration des vorhandenen Codes vorbereiten; [Codeübersicht](code/README.md) und bekannte Fehler beachten. Nicht mehrere Produktbaustellen gleichzeitig eröffnen.

## Anderes Gerät / GitHub

GitHub ist noch nicht verbunden; Ziel-URL und Zugang fehlen. Nach tatsächlicher Einrichtung Repository klonen, diese README und AGENTS.md lesen, Projektkontext laden und die oben genannten Prüfungen ausführen. Beim Gerätewechsel: auf dem ersten Gerät bewusst committen/pushen, auf dem zweiten lokalen Status prüfen und den passenden Branch mit fetch/pull --ff-only aktualisieren. Kein Überschreiben divergierter Arbeit. Chatverläufe, lokale DB, Zugangsdaten, installierte Pakete und Prozesse werden nicht über Git synchronisiert.
