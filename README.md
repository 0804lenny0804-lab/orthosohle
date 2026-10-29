# OrthoSohle 2.0

## Hier anfangen

1. [Arbeitsregeln](AGENTS.md) lesen.
2. [Projektkontext](docs/context.md) öffnen: aufbereitetes Wissen, Iststand und nächster Schritt.
3. Für den aktuellen Softwareauftrag [Anforderungen und Meilensteine](docs/requirements.md) lesen. Umsetzungsaufgaben im [Backlog](docs/backlog.csv) führen; bei Bedarf [Code-Einstieg](code/README.md) oder [Detailanalyse](docs/analysis.md) lesen.

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
  requirements.md    Produktanforderungen und Softwaremeilensteine
  watch-compatibility.md  Apple-Watch-Planung und weitere Watchplattformen
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

## Aktueller Arbeitsauftrag

**Arbeitsgrundlage liegt auf `main`; Umsetzung erfolgt schrittweise.** [requirements.md](docs/requirements.md) enthält das Ärzte-/Patientenprodukt mit Abnahmekriterien und Meilensteinen M0–M8. Arzt-Einladung, medizinische Planhoheit, iPhone/Android, beaufsichtigter Pilot und ein verantwortlicher Arzt mit Arztwechsel sind bestätigt; Waveshare ESP32-S3-Touch-LCD-1.28 ist die Hardwarebasis des Warnarmbands. Uploadverhalten und konkreter unabhängiger Armbandpfad sind noch nachzuweisen. iPhone, Android, Waveshare und Apple Watch sind laut Nutzer verfügbar. Der Apple-Watch-Client wird im [Arbeitsbereich WATCH](docs/watch-compatibility.md) von Beginn an mit der Handy-App geplant; Wear OS bleibt vorerst Erweiterung. GitHub Actions/macOS-Runner plus AltServer sind als iPhone-Build-/Installationsweg vorgesehen; sie sind in diesem Repository noch nicht erprobt. Apple-Watch-Build und Installation müssen getrennt nachgewiesen werden. Umfang und alter Backlog müssen neu geschätzt werden; keine bereits erfolgte Produkt-/Sicherheitsfreigabe behaupten.

Technisch parallel nötig: C03 tatsächlichen Hardware-/Firmwarebestand und C05 BLE-Rollen prüfen. Dafür den Hardwareabschnitt des [Projektkontexts](docs/context.md) anhand realer Teile/Revisionen, Pins/Spannungen und Firmwarequellen ergänzen; ältere Hausarbeit allein reicht nicht. Code-Start und bekannte Grenzen stehen im [Code-Einstieg](code/README.md).

## Anderes Gerät / GitHub

Das GitHub-Repository `0804lenny0804-lab/orthosohle` ist als `origin` verbunden. Der Teamablauf: `main` ist der Integrationsbranch, jede Person arbeitet auf einem eigenen Branch `Lenni/<branchname>` oder `Paul/<branchname>`, Änderungen gehen per Pull Request nach `main`. Details und Schutzregeln stehen in [AGENTS.md](AGENTS.md). Auf einem weiteren Gerät Repository klonen, diese README und AGENTS.md lesen, Projektkontext laden und die oben genannten Prüfungen ausführen. Beim Gerätewechsel: auf dem ersten Gerät bewusst committen/pushen, auf dem zweiten lokalen Status prüfen und den passenden Branch mit fetch/pull --ff-only aktualisieren. Kein Überschreiben divergierter Arbeit. Chatverläufe, lokale DB, Zugangsdaten, installierte Pakete und Prozesse werden nicht über Git synchronisiert.
