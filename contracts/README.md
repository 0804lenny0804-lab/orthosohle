# Schnittstellenverträge

## Status

Protokollentwurf offen; noch kein v2-Vertrag beschlossen.

## Verantwortung

BLE-Payloads/API: Version, Einheit, Byte-Reihenfolge, Wertebereich, Zeitbasis, Sequenz, Status, Fehlerfälle und Konfigurations-ACK dokumentieren. Synthetische gültige/ungültige Fixtures mitführen.

## Einstieg und Prüfung

Legacy: Service 12345678-1234-1234-1234-1234567890ab, Characteristic 12345678-1234-1234-1234-1234567890cd; Float32 little endian, READ/NOTIFY. Keine Sequenz, Gerätezeit oder Qualität. Änderungen koordiniert versionieren; C06 ist die nächste Aufgabe.

Es gelten die Root-AGENTS.md und docs/architecture.md.
