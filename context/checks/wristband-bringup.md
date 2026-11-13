# Waveshare-Armband: erste Inbetriebnahme

Begonnen: 27.10.2026. Aufgabe C03 im [Backlog](../backlog.csv), anschließend erster Teil von A03/A04. Ziel dieser kleinen Etappe: konkretes Board identifizieren und danach eine minimale Firmware bauen, die einen festen, ausdrücklich als Test bezeichneten Wert auf dem Display zeigt.

## Bisher belegt

- Nutzer berichtet am 12.11.2026, dass ein Testdisplaycode auf seinem Waveshare ESP32-S3-Touch-LCD-1.28 funktioniert. Foto, Revision, konkreter Sketch und Toolchain liegen hier nicht als unabhängiger Nachweis vor.
- Der hier angelegte Firmwarecode ist ein hosttestbarer Messvertragskern; keine Gerätefirmware wurde hier gebaut oder geflasht.
- Kein physischer Gerätezugriff aus diesem Workspace nachgewiesen. Es wurde hier nichts geflasht.
- Herstellerdokumentation wurde am 12.11.2026 geprüft: GC9A01A (240×240), CST816S über I2C, Display über SPI, GPIO2 für Beleuchtung und GPIO6/7 für SDA/SCL.

## Nächster Hardwareabgleich

1. Vollständigen Modell-/Revisionsaufdruck auf Vorder- und Rückseite sowie das getestete Display-Skript und die Toolchain sichern.
2. Vorhandene Zusatzteile erfassen: Akku, Vibrationsmotor, Treiber und Verkabelung. Unbekannte Zusatzverdrahtung nicht voraussetzen.
3. USB-Gerätenamen/COM-Port unter Windows notieren und Wiederherstellungsweg für die bekannte Display-Firmware sichern, bevor neue Firmware geflasht wird.
4. Board-Schaltplanrevision dem Herstellerdokument und tatsächlicher Platine zuordnen. Display-/Touch-Konfiguration anhand des funktionierenden Nutzer-Tests übernehmen, nicht pins oder Treiber vermuten.

Diese Beobachtungen hier nach Eingang ergänzen; unbekannte Werte bleiben unbekannt.

## Nächster Geräte-Schritt

- Funktionierendes Displaybeispiel als Grundlage in ein reproduzierbares Firmwareprojekt überführen und mit synthetischen, sichtbar markierten Werten bauen.
- Danach Touch-Start und direkte BLE-Verbindung mit einer Sohle im Scan-/Statusmodus erproben, bevor lokale Warnung oder Synchronisierung freigegeben wird.
- Build- und Uploadbefehle samt Toolchain/Revision dokumentieren. Vor jedem ersten Upload die bekannte Firmware und ihren Wiederherstellungsweg sichern.

Abnahme für den ersten Geräte-Schritt: Build erfolgreich; Touchbedienung und BLE-Verbindung mit korrektem Status am echten Board; Messalter/Fehler sind sichtbar. Nachweis enthält Datum, Commit, Boardrevision, Toolchain, Sohle/Sketch, Ergebnis und Grenzen. Hosttests oder Kompilierung allein erfüllen die Geräteabnahme nicht.

## Erster BLE-Anzeige-Durchstich (12.11.2026)

Im Projekt `code/firmware/waveshare` wurde ein Arduino/PlatformIO-Durchstich hinzugefügt. Er verwendet die bekannte Service-UUID `12345678-1234-1234-1234-1234567890ab`, probiert zuerst die v1-Characteristic `...90ce` und fällt auf Legacy-Float32 `...90cd` zurück. Für v1 werden Paketdecoder und Sequenzprüfung des Hostkerns wiederverwendet. Der Bildschirm zeigt Verbindungsstatus, kg-Wert, Alter, Messqualität und ungültige Pakete. Bei veralteten Daten bleibt das Alter sichtbar; diese Etappe blendet keinen Therapieplan ein und erzeugt keinen Warnalarm.

Die PlatformIO-Konfiguration und ein vollständiger Arduino-IDE-Sketchordner sind in der Firmware-README verlinkt. Der PlatformIO-Lauf konnte die ESP32-S3-Toolchain wegen `HTTPClientError` beim Paketabruf nicht installieren; der Arduino-IDE-Sketch wurde hier ebenfalls nicht gebaut. Die beiden vorhandenen Hosttests wurden direkt mit g++ 14.2.0 und strikten Warnungen erfolgreich gebaut und ausgeführt. Aus dieser Umgebung kann nicht auf das Board geflasht oder eine reale BLE-Sohle bereitgestellt werden. Es gibt daher noch keinen Nachweis für Firmwarekompilieren, BLE-Empfang, Wiederverbindung oder Anzeige auf Hardware. Touchabfrage ist nicht Teil dieses Durchstichs. Die bestehende Sohle sendet laut Quellstand weiterhin nur Legacy-Float32; v1 braucht einen gesondert umgesetzten Sohlensender.

## Aktueller Stand

Laut Nutzer funktioniert ein früherer Displaytest auf dem Board. Exakte Revision, USB-Prüfung und die Abnahme der neuen BLE-Firmware bleiben offen. Keine Arbeitsstunden oder Messergebnisse als geleistet erfasst.
