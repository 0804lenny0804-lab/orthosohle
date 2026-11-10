# Simulationswerte an das Waveshare-Display senden

Dieser lokale Prototyp übernimmt die synthetische Schrittwellenform aus dem archivierten `SimulationControl.vue` und sendet jeden kg-Wert per Web Bluetooth an das ESP32-S3-Touch-LCD-1.28. Die Seite stellt keine Verbindung zur Sohle und keinem Backend her.

## Voraussetzungen

- Windows-PC mit aktuellem Chrome oder Edge (Web Bluetooth wird nicht von jedem Browser unterstützt)
- ESP32-S3-Touch-LCD-1.28 mit der Firmware aus `../firmware/esp32s3-display-receiver/`
- Arduino IDE mit ESP32 von Espressif sowie den Bibliotheken `GFX Library for Arduino` und `NimBLE-Arduino`
- Computer und ESP32 in BLE-Reichweite

## Start

1. In Arduino IDE das Espressif-ESP32-Boardpaket installieren und als Board `ESP32S3 Dev Module` auswählen.
2. In der Bibliotheksverwaltung `GFX Library for Arduino` und `NimBLE-Arduino` installieren.
3. `../firmware/esp32s3-display-receiver/esp32s3-display-receiver.ino` öffnen, den COM-Port auswählen und auf das Board laden. Im seriellen Monitor sollte `BLE-Empfaenger bereit: OrthoSohle-Armband-Demo` erscheinen.
4. Im Repository-Root einen lokalen Webserver starten: `python -m http.server 8000`.
5. In Chrome oder Edge `http://localhost:8000/code/simulator-bridge/` öffnen.
6. **ESP32 verbinden** drücken und `OrthoSohle-Armband-Demo` auswählen.
7. **Simulation starten** drücken. Das Board zeigt `DEMO`, Verbindungszustand und empfangenen synthetischen kg-Wert. Nach **Simulation stoppen** zeigt es nach zwei Sekunden ohne neuen Wert `DATEN ALT`.

Die Seite enthält eine eigenständige Übernahme der Wellenformlogik aus dem Legacy-Simulator. Im Neustart gibt es noch keine Patienten-App, in die sie eingebunden werden könnte. Der zentrale BLE-Sendepunkt ist `sendValueToBoard(value)`; eine spätere App kann denselben Vertrag aus ihrem Simulator aufrufen.

Die explizite Geräteauswahl erfordert einen sicheren Browserkontext; `localhost` erfüllt diese Voraussetzung. Der Rechner ist bei diesem Test BLE-Central, das Board BLE-Peripheral. Die UUIDs unterscheiden sich vom Legacy-Sohlendienst, damit dessen Verbindung nicht versehentlich ausgewählt wird.

## Grenze

Das ist ein lokaler Desktop-/Chromium-Prototyp für synthetische Daten. Er ist nicht in die gelöschte Patienten-App integriert und kein iPhone-/iOS-BLE-Nachweis. Der neue Anwendungscode und seine mobile Toolchain sind noch nicht ausgewählt. Die gezeigten Zahlen sind Testdaten und keine Mess- oder Therapiewerte.
