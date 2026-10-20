# Ponytail – verwendete Grundsätze

Quelle: [DietrichGebert/ponytail, SKILL.md](https://github.com/DietrichGebert/ponytail/blob/main/skills/ponytail/SKILL.md), abgerufen am 20.10.2026. Lizenzangabe in der Datei: MIT. Keine Skill-Installation; folgende Zusammenfassung ist eine sinngemäße Auswahl für OrthoSohle, kein aktivierter Skill und keine automatische Übernahme späterer Änderungen.

SHA-256 der gelesenen Datei: `9badd22a32e19cb884e46dfa8d3aae82bb81dfa5484105b8b4f0262df823a509`.

- Vor Änderungen betroffenen Code und alle Aufrufer, Tests, Fixtures und Konfigurationen erfassen.
- Die kleinste Änderung wählen, die den gesamten Auftrag erfüllt; keine ungefragten Zusatzfunktionen.
- Vorhandene Projektbausteine und Konventionen, dann Standardmittel, dann bereits installierte Abhängigkeiten nutzen. Keine neue Abhängigkeit für wenige Zeilen.
- Keine Wrapper, Abstraktionen oder Flexibilität auf Vorrat; verständliche Einfachheit vor cleverer Kürze. Überflüssiges eher entfernen als erweitern.
- Fehlerursache einmal an der richtigen gemeinsamen Stelle korrigieren. Beim Verschieben Validierung und Fehlerbehandlung erhalten.
- Neue nichttriviale Logik braucht einen kleinen aussagekräftigen Test; triviale Änderungen keine künstlichen Tests.
- Eingabevalidierung, Schutz vor Datenverlust, Sicherheit, Barrierefreiheit, Hardwarekalibrierung und Anforderungen nicht zugunsten kurzer Implementierung streichen.
- Bewusste Abkürzungen direkt mit Grenze und Auslöser für eine spätere Verbesserung dokumentieren (`shortcut: …`). Ergebnisse knapp und mit tatsächlichen Prüfgrenzen erklären.

DRY ist zusätzlich ausdrücklich vom Nutzer vorgegeben: Wissen und fachliche Regeln haben eine maßgebliche Stelle. Gleiche Bedeutung nicht unabhängig mehrfach pflegen; gemeinsame Implementierung nur bei tatsächlich gemeinsamer Verantwortung. Nicht jede ähnlich aussehende Zeile rechtfertigt eine gekoppelte Abstraktion.

Verbindliche Umsetzung für das Projekt: [AGENTS.md](../../AGENTS.md). Die Quelle wird bei Bedarf nachgeschlagen, nicht bei jedem Sitzungsstart vollständig geladen. Skill-Level, Aktivierungskommandos und automatische Agentendelegation werden nicht übernommen.
