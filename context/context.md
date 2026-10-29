# OrthoSohle – aktueller Projektkontext

Stand: 29.10.2026. Regeln ausschließlich in [AGENTS.md](../AGENTS.md); Start und Dateien der aktiven Anwendung in [code/README.md](../code/README.md).

## Ziel und aktueller Schwerpunkt

Ärzte-/Patientensystem für nachvollziehbare Teilbelastung mit unabhängiger Armbandwarnung. Aktueller Auftrag: Webapp zuerst. Das ausgewählte Waveshare-Armband ist laut Nutzer noch nicht vorhanden. Historischer Sohlenaufbau und verfügbare Smartphone-/Watchgeräte sind in [project-background.md](project-background.md) eingeordnet.

## Belegter Softwarestand

- [Altbestand](legacy/README.md): 51 unveränderte Dateien aus dem GitLab-ZIP mit [Manifest](legacy/manifest.json); ursprünglicher GitLab-Commit unbekannt. Vue/Express/SQLite und Arduino-Sketch dienen als Referenz, keine Produktfreigabe.
- Aktiver Code: code/webapp. Vue-/Express-Grundlage mit getrennten Plan-, Geräte- und Historienkomponenten; lokale Testkonten und datenbankgestützte Sessions über Better Auth/SQLite.
- Testregistrierung, Anmeldung und serverseitige Abmeldung implementiert. Planendpunkt verlangt eine gültige Session und liefert ausschließlich synthetischen Demo-Plan oder fehlenden Plan. Keine echten Gesundheitsdaten, Arztfunktionen, Planpersistenz oder Geräteanbindung.
- E-Mail-Verifikation ist für Anmeldung erforderlich. Verifikations-/Reset-Links liegen ausschließlich in geschützter lokaler Mail-Testablage. Reset widerruft bestehende Sitzungen.
- Start nur im ausdrücklich freigegebenen lokalen Auth-Testbetrieb. Externer Mailversand, Arzt-MFA/Recovery, fachliche Rechte, Produktionsmigrationen und Hosting bleiben offen.

## Nachweise und Grenzen

Acht Node-Tests prüfen unter anderem unberechtigten Planzugriff, fremden Origin und widerrufene Sitzung sowie E-Mail-Verifikation, abgelaufene/erneut verwendete Reset-Tokens und geschützte lokale Testnachrichten. Frontend-Produktionsbuild erfolgreich; Produktionsabhängigkeiten laut npm audit am 29.10.2026 ohne bekannte Schwachstellen. Das ist kein unabhängiger Sicherheitsnachweis. Browserbedienung, Hardware, BLE, Smartphone-Hintergrundbetrieb und Watch sind ungeprüft. Anforderungen ACC-01–04 und M2 noch nicht vollständig abgenommen.

Die Struktur trennt Regeln, Kontext/Altbestand und aktiven Code. Verschieben ändert keine Originaldatei; die Manifestprüfung bleibt maßgeblich. Ältere Verweise innerhalb unveränderter Quellen beschreiben deren damaligen Stand.

## Nächster konkreter Schritt

Browserablauf für Verifikation/Reset prüfen; danach geprüfte Arztrolle, MFA und Betreuungsbeziehung umsetzen. Vor realem Betrieb Versand-/Hostingmodell, Verantwortlichkeiten, Datenschutz und Freigaben festlegen. Das Armband wartet auf Hardwareverfügbarkeit.

## Navigation ohne doppelte Pflege

| Inhalt | Maßgebliche Stelle |
|---|---|
| Regeln und Git-Ablauf | [AGENTS.md](../AGENTS.md) |
| Projektziel, Rahmen, Hardware und historische Grenzen | [project-background.md](project-background.md) |
| Anforderungen und M0–M8 | [requirements.md](requirements.md) |
| Beschlüsse und Historie | [decisions.md](decisions.md) |
| Aufgaben, Status und bisherige Schätzungen | [backlog.csv](backlog.csv) |
| Detailanalyse des Altbestands | [analysis.md](analysis.md) |
| Alte Quellen / Code / Prüfbelege | [sources](sources/README.md), [legacy](legacy/README.md), [checks](checks/baseline.md) |
| Zusätzlicher Watch-Arbeitsbereich | [watch-compatibility.md](watch-compatibility.md) |
| Aktiver Anwendungscode, Installation und Datenfluss | [code/README.md](../code/README.md) |

Dieser Chat arbeitet ab der Strukturintegration ausschließlich auf `lenni/code`; `paul/code` ist Pauls Arbeitsbranch. Integration nach `main` erfolgt per Pull Request gemäß AGENTS.md.

Der historische 600-Personenstunden-Plan ist keine belastbare Schätzung des erweiterten Produktumfangs. Offene Aufgaben und neue Schätzungen werden im Backlog gepflegt. Lokale Gitstände und Branches ergeben sich aus Git, nicht aus vorweggenommenen Commitangaben hier.
