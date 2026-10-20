# Dokumentationsindex

## Verbindlicher Einstieg

| Datei | Zweck / Pflegeanlass |
|---|---|
| ../AGENTS.md | Kurze Regeln für jede Arbeitssitzung |
| ../CONTRIBUTING.md | Zusammenarbeit, Git und Definition of Done |
| context/PROJECT_STATE.md | Aktueller belegter Stand, offene Fragen und nächste Schritte; bei relevantem Abschluss aktualisieren |
| architecture.md | Ablagen und Modulgrenzen; bei Strukturänderung mit ADR ändern |
| decisions/ | Dauerhafte Entscheidungen mit Status und Begründung |
| ORTHOSOHLE_BACKLOG.csv | Maßgebliche Aufgabenliste: Status, Verantwortliche, Abnahmenachweis, Abhängigkeiten und Schätzung |
| ORTHOSOHLE_BACKLOG.md | Lesbare, aus CSV generierte Ansicht; nicht separat bearbeiten |
| context/WORK_LOG.csv | Tatsächliche Einzelzeiten und Arbeitsergebnisse; keine automatische Zeiterfindung |

## Nachweise und Abschluss

- [Bestandsaufnahme vom 20.10.2026](ORTHOSOHLE_BESTAND_UND_PLAN.md): historischer Analysezeitpunkt, kein automatisch aktueller Status.
- [API-Prüfergebnisse](ORTHOSOHLE_PRUEFERGEBNISSE.json) und [Prüfkontext](testing/REFERENCE_BASELINE.md).
- [Prüfberichtsvorlage](testing/TEMPLATE.md), [Berichtsablage](report/README.md), [Media-Night-Ablage](media-night/README.md).
- [Quellen und Herkunft](references/README.md), [Referenzcode](../reference/README.md).

## Kontextpflege

1. PROJECT_STATE kurz halten: Ziel, Iststand, letzte Prüfungen, Entscheidungen, Blocker, nächste Schritte. Keine vollständigen Chatprotokolle oder Kopien sämtlicher Anforderungen.
2. Aussagen als implementiert/geprüft, nur im Referenzcode vorhanden, geplant oder offen kennzeichnen. Datum und Beleg/Dateipfad nennen. Historische Dokumente nicht nachträglich als neuen Iststand umschreiben.
3. Pro Information eine maßgebliche Ablage: Aufgaben in CSV, Entscheidungen in ADR, Iststand in PROJECT_STATE, Messnachweise in testing. Von anderen Stellen dorthin verlinken.
4. Beim Sitzungsende relevante Änderungen am gleichen Commit wie die zugehörige Arbeit sichern. Bei Unterbrechung ausdrücklich notieren, was unvollständig ist und welcher Schritt als Nächstes ansteht.
5. Neue Chats beginnen mit AGENTS.md → CONTRIBUTING.md → PROJECT_STATE.md → betroffener Modul-README/ADR. Quellen nur bei Bedarf erneut lesen; aktuelle Nutzeraufträge bleiben maßgeblich.
6. Veraltete Entscheidungen durch neuen ADR ablösen, den alten als ersetzt markieren. Vorschläge nicht als Teamentscheidung ausgeben.
7. Keine Secrets, Kontozugänge oder identifizierbaren Gesundheitsdaten in Kontext, Logs oder Testbelegen speichern.
