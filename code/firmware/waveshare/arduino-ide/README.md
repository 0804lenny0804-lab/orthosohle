# Arduino IDE-Sketch

Öffne `OrthoSohle_BLE_Display/OrthoSohle_BLE_Display.ino` in der Arduino IDE.
Der vollständige Sketchordner muss erhalten bleiben: Die IDE kompiliert die
C++-Dateien unter `src/`; `include/measurement_contract.hpp` enthält den
gemeinsam genutzten BLE-Paketdecoder. Kopiere nicht nur `main.cpp` in ein
leeres Sketchfenster, sonst fehlen diese lokalen Dateien.

Installiere in der Arduino IDE außerdem:

- das Boardpaket **esp32 by Espressif Systems** (der passende ESP32-S3-Boardtyp
  muss ausgewählt sein),
- **GFX Library for Arduino** von Moon On Our Nation.

`BLEDevice.h` kommt mit dem Espressif-ESP32-Boardpaket; NimBLE wird nicht
verwendet. Der Sketch nutzt die integrierten Displayanschlüsse des Boards.
Der BLE-Client-Callback wird mit der aktuellen Ein-Parameter-API registriert;
dieser Aufruf ist auch mit dem älteren PlatformIO-Core kompatibel.

Die Implementierung liegt maßgeblich in `../src/main.cpp` und der
Paketdecoder in `../src/measurement_contract.cpp`. Die Dateien in diesem
Sketchordner sind Kopien davon, damit die Arduino IDE sie direkt bauen kann.
Bei Änderungen an diesen Quelldateien die Arduino-Kopien synchron halten.

Ein Arduino-IDE-Build dieser Sketchstruktur wurde in der Entwicklungsumgebung
noch nicht ausgeführt. Der PlatformIO-Build und der Test auf echter Hardware
sind ebenfalls offen.
