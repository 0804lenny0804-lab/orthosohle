# Waveshare-Firmwarekern

Dieser Ordner enthält den plattformunabhängigen C++-Messvertrag für das
ESP32-S3-Touch-LCD-1.28. Er lässt sich am Rechner ohne Arduino-Bibliotheken
bauen und testen. Eine Arduino-Firmware mit Display, Touch, BLE, WLAN und
Flashpuffer ist noch nicht Teil dieses Arbeitsschritts.

## Messformat zwischen Sohle und Armband

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

## Hosttests

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

Die Hosttests ersetzen keinen Arduino-Build, keinen BLE-Test und keinen
Display-/Touchtest am echten Board.
