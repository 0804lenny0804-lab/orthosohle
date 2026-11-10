# Aktiver Entwicklungsbereich

Eine neue Patienten-Webapp ist hier noch nicht implementiert. Der [alte GitLab-Code](../context/legacy/README.md) ist die Grundlage ihrer Weiterentwicklung; seine Übernahme und Überarbeitung stehen aus. Der frühere neue Webapp-/Auth-Versuch ist unter `archive/2026-10-29/before-mobile-restart` archiviert.

Die Zielstruktur umfasst eine Webapp mit gemeinsamem Backend und daraus erzeugten Android- und iOS-Apps sowie ein separates Firmwareprojekt für das Waveshare-Armband. Konkrete Codeordner entstehen mit der jeweiligen Implementierung. Die Verpackungstechnologie und Geräteanbindung sind noch zu wählen und auf Hardware zu prüfen.

[Technische Ziele und Abnahme](../context/requirements.md) · [Aktueller Kontext](../context/context.md) · [Arbeitsregeln](../AGENTS.md)

## Lokaler ESP32-Simulator-Durchstich

[simulator-bridge](simulator-bridge/README.md) ist ein lokaler Browser-Prototyp: Er erzeugt synthetische Schrittwerte nach dem Muster des archivierten Simulators und schreibt sie per Web Bluetooth an das Waveshare-Display. Die zugehörige Arduino-Firmware liegt unter [firmware/esp32s3-display-receiver](firmware/esp32s3-display-receiver/). Dies ist ein Desktop-/Chromium-Hardwaretest, keine Integration in die neue Patienten-Webapp und kein unterstützter iPhone-BLE-Pfad.
