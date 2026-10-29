# Aktiver Entwicklungsbereich – Neustart

Der neue Anwendungscode wurde auf Nutzerauftrag entfernt. Die vorherige Vue-/Express-/Auth-Implementierung ist über den Git-Tag `archive/2026-10-29/before-mobile-restart` wieder auffindbar. Aktuell gibt es hier keine ausführbare neue Anwendung und keine gewählte mobile Toolchain.

## Geplanter Zuschnitt

- Patienten-App für iOS und Android: Geräteanbindung, Sitzungen und verständlicher lokaler Zustand.
- Gemeinsames Backend: Identität, Betreuungsrechte, Therapiepläne und zugeordnete Messdaten.
- Webportal für Ärzte: Zugriff auf zugeordnete Patienten über dieselbe Backend-API.

Das ist die Zielrichtung, keine implementierte Verbindung. Gemeinsame API-Verträge, Einheiten, Planversionen und Rechte gewährleisten später die fachliche Kompatibilität. Mobile Geheimnisse gehören in geschützten Gerätespeicher; Browser- und App-Anmeldung brauchen jeweils einen passenden sicheren Ablauf. Medizinische Regeln werden serverseitig maßgeblich gepflegt; die unabhängige lokale Warnfunktion braucht einen versionierten Gerätevertrag und eigene Tests.

Framework, Auth-Lösung, Datenbank und Hosting vor der nächsten Implementierung anhand der mobilen Anforderungen neu bewerten. Erste Abnahme: installierbarer iOS-/Android-Durchstich und nachgewiesener BLE-/Hintergrundpfad, soweit Hardware verfügbar. Ohne Hardware nur synthetische Eingaben als solche prüfen.

Neue Module erst mit konkretem Code anlegen. Maßgeblich bleiben [Regeln](../AGENTS.md), [Produktanforderungen](../context/requirements.md) und [aktueller Kontext](../context/context.md). Der [alte GitLab-Code](../context/legacy/README.md) bleibt unveränderte Referenz.
