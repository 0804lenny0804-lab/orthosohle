# Waveshare-Firmware

Dieser Ordner enthält den testbaren C++-Messkern und den ersten Arduino-
Firmwaredurchstich für das Waveshare ESP32-S3-Touch-LCD-1.28. Das Board sucht
automatisch nach der Sohle, verbindet sich mit dem vorhandenen BLE-Dienst,
abonniert bevorzugt den entworfenen v1-Messframe und fällt auf die alte
Float32-Characteristic zurück. Display und Status werden laufend aktualisiert.
Die erste Etappe startet die Suche automatisch; Touchbedienung, Warnplan,
Motor, Flashpuffer und WLAN/Backend-Sync sind noch nicht implementiert.

## Firmware bauen und flashen

Das Firmwareprojekt verwendet PlatformIO Core `6.2.0`, Espressif32-Plattform
`6.8.1`, Arduino-GFX `1.5.4` und das im Arduino-ESP32-Core enthaltene
`BLEDevice.h`. Der ESP32-Board-Datensatz `esp32s3usbotg` wird für die
S3-Arduino-Toolchain verwendet; Flash/PSRAM sind im Projekt auf die
Waveshare-Bestückung (16 MB Flash, 2 MB OPI-PSRAM) gesetzt. Der USB-Anschluss
des Boards ist integriert; externe Display-/Touchverdrahtung wird nicht
benötigt.

Mit PlatformIO:

```bash
pio run -d code/firmware/waveshare -e waveshare-esp32-s3-touch-lcd-128
pio run -d code/firmware/waveshare -e waveshare-esp32-s3-touch-lcd-128 -t upload --upload-port COMx
pio device monitor -d code/firmware/waveshare -b 115200 --port COMx
```

`COMx` durch den Port des eigenen Boards ersetzen. Für den ersten Flash den
funktionierenden bisherigen Displaytest sichern, damit er bei Bedarf wieder
aufgespielt werden kann. Der Build überschreibt die Boardfirmware erst beim
separaten `upload`-Befehl.

Das Display nutzt den GC9A01A über SPI (GPIO8 DC, GPIO9 CS, GPIO10 SCK,
GPIO11 MOSI, GPIO14 RST, GPIO2 Backlight); Touch ist in dieser Etappe noch
nicht abgefragt. Diese Onboard-Signale kommen aus dem offiziellen
[ESP32-S3-Touch-LCD-1.28-Pinheader im Espressif-Arduino-Core](https://github.com/espressif/arduino-esp32/blob/master/variants/waveshare_esp32s3_touch_lcd_128/pins_arduino.h).

## Messformat zwischen Sohle und Armband

Die Firmware sucht den bestehenden Dienst `12345678-1234-1234-1234-1234567890ab`.
Sie bevorzugt dessen geplante v1-Mess-Characteristic
`12345678-1234-1234-1234-1234567890ce` und fällt auf die bestehende
Legacy-Characteristic `12345678-1234-1234-1234-1234567890cd` zurück. Der
aktuelle Sohlensketch stellt bislang nur die Legacy-Characteristic bereit.

Die bisherige Sohle sendet eine little-endian IEEE-754-Float32-Characteristic
in kg. Der Decoder akzeptiert ausschließlich genau vier Bytes, endliche Werte
ab 0 kg und behandelt Werte ab 25 kg als `range_limit`. Der gesicherte alte
Sketch begrenzt Werte oberhalb seiner Kalibrierung auf 25 kg; am Armband ist
daher nicht erkennbar, ob 25 kg echt oder geklemmt sind. Solche Messungen sind
keine gültige Grundlage für eine Entwarnung.

Für eine korrigierte Sohle ist ein neuer, eigener BLE-Characteristic-Payload
vorgesehen. Die bestehende Float-Characteristic bleibt für alte Browserclients
unverändert:

| Byte(s) | Inhalt |
|---|---|
| 0–1 | ASCII `OS` |
| 2 | Protokollversion `1` |
| 3–6 | uint32 Sequenznummer, little-endian |
| 7–10 | Float32 kg, little-endian |
| 11 | Flags: Bit 0 Kalibriergrenze/Überbereich, Bit 1 Sensorfehler; übrige Bits müssen 0 sein |

Die zwölf Bytes müssen vollständig vorhanden sein. Unbekannte Versionen,
Flags, nicht-endliche oder negative Gewichte und falsche Paketlängen werden
abgewiesen. Eine Sequenznummer dient nur der Wiederholungs-/Altpaketerkennung
innerhalb einer BLE-Verbindung; eine Sender-Neustartkennung fehlt noch und ist
vor dauerhafter Synchronisierung im Protokoll zu ergänzen. Der Empfänger setzt
den Tracker beim Neuverbinden zurück.

V1 ist ein BLE-Transportvertrag, noch kein vollständiger Speicher- oder
Backendvertrag. Zeitbasis, Boot-/Sitzungs-ID, persistenter ACK, Planversionen,
Geräteauthentifizierung und Upload-Endpunkte folgen als eigene Schritte.
Der aktuelle Architekturentwurf für Netzwerk-Upload und Planübernahme steht
in [sync-contract.md](sync-contract.md); er ist noch keine API-Implementierung.

## Lokaler Überwachungszustand

`local_monitor` bildet gültigen bestätigten Plan, aktuelle/frische Probe,
Messqualität und konfigurierte Grenzvergleichsart auf einen lokalen Zustand
ab. Fehlender/abgelaufener/unbestätigter oder zeitlich nicht prüfbarer Plan,
fehlende/veraltete Messung, Sensorfehler und Kalibriergrenze sind jeweils
eigene Fehlerzustände und führen nicht zu „im grünen Bereich“. Für die aktuelle
25-kg-Kalibrierung weist der Kern Planlimits ab 25 kg zurück. Grenzwert und
Vergleichsart kommen aus dem Plan; Hysterese, Verzögerung und maximale
Datenalter müssen vor Einsatz fachlich festgelegt und im Aufrufer konfiguriert
werden. Der Kern setzt keinen Motor und trifft keine medizinische
Einsatzentscheidung.

## Hosttests des Messkerns

Mit CMake und einem C++17-Compiler:

```bash
cmake -S code/firmware/waveshare -B /tmp/orthosohle-waveshare-build
cmake --build /tmp/orthosohle-waveshare-build
ctest --test-dir /tmp/orthosohle-waveshare-build --output-on-failure
```

Falls CMake nicht installiert ist, beide Testprogramme direkt bauen:

```bash
g++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  -Icode/firmware/waveshare/include \
  code/firmware/waveshare/src/measurement_contract.cpp \
  code/firmware/waveshare/src/local_monitor.cpp \
  code/firmware/waveshare/test/measurement_contract_test.cpp \
  -o /tmp/measurement-contract-test
/tmp/measurement-contract-test

g++ -std=c++17 -Wall -Wextra -Wpedantic -Werror \
  -Icode/firmware/waveshare/include \
  code/firmware/waveshare/src/measurement_contract.cpp \
  code/firmware/waveshare/src/local_monitor.cpp \
  code/firmware/waveshare/test/local_monitor_test.cpp \
  -o /tmp/local-monitor-test
/tmp/local-monitor-test
```

Hosttests ersetzen keinen Firmware-Build, keinen echten BLE-Empfang und keinen
Display-/Touchtest am Board. Ein erfolgreicher Arduino-Build beweist ebenfalls
noch keine Funkverbindung oder funktionierende Anzeige auf dem echten Gerät.
