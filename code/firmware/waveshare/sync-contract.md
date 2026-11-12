# Armband-Backend-Vertrag (Entwurf v1)

Dieser Entwurf beschreibt die notwendige Synchronisationssemantik. Er ist noch
nicht in `code/api` implementiert und stellt keinen erreichbaren Dienst bereit.
Die aktuellen Messsitzungsrouten nehmen ausschließlich Browser-Cookies an und
dürfen nicht als Geräte-API veröffentlicht werden.

## Identität und Zeit

- `deviceId` ist eine stabile UUID, die einer Person serverseitig zugeordnet
  wird. Eigentümer werden nie aus einem Geräte-Body übernommen.
- `bootId` ist bei jedem Gerätestart neu und zufällig; `sessionId` beginnt
  durch ausdrückliche lokale Bedienung neu. `sequence` läuft innerhalb einer
  Sitzung monoton. Der Schlüssel eines Eintrags ist
  `(deviceId, bootId, sessionId, sequence)`.
- Die Armband-`sequence` zählt jeden empfangenen/aufgezeichneten Eintrag und
  bleibt von der Quellsequenz der Sohle getrennt. Für BLE-v1 werden
  `sourceConnectionId` (neue zufällige ID pro BLE-Verbindung) und
  `sourceSequence` (uint32 aus dem Sohlenframe) mitgespeichert. Bei Legacy-v0
  ist `sourceSequence: null`; fehlende Samples der Sohle sind dort nicht
  rekonstruierbar. Ein gemeldeter Sequenzsprung wird als explizites
  `lossEvent` mit erwarteter und beobachteter Quellsequenz hochgeladen.
- BLE-v1 hat noch keine `sourceBootId`. Beginnt die Sohle Sequenznummern ohne
  neue BLE-Verbindung erneut bei null, kann das Armband diese Senderneustart-
  situation nicht zuverlässig von alten Paketen unterscheiden. Vor der
  dauerhaften Geräteintegration ist daher ein Folgeframe mit Quellstart-ID
  erforderlich. Das Backend muss beide Sequenzräume getrennt speichern.
- `elapsedMs` ist monotone Zeit seit `bootId`, nie UTC. `observedAt` ist UTC
  oder `null`; `timeQuality` ist `synced` oder `unknown`. Bei unbekannter Uhr
  dürfen UI und Datenbank keine UTC-Zeit aus `elapsedMs` erfinden.
- `quality` ist `valid`, `range_limit`, `sensor_fault` oder `invalid`. Ein
  geklemmter Messwert bleibt als `range_limit` erhalten, ist aber keine
  gültige Belastung. Synthetische Daten müssen als solche getrennt bleiben.

Beispiel eines Datensatzes:

```json
{
  "bootId": "00000000-0000-4000-8000-000000000001",
  "sessionId": "00000000-0000-4000-8000-000000000002",
  "sequence": 42,
  "sourceConnectionId": "00000000-0000-4000-8000-000000000003",
  "sourceSequence": 314,
  "elapsedMs": 18325,
  "observedAt": null,
  "timeQuality": "unknown",
  "kilograms": 12.4,
  "quality": "valid",
  "planVersion": 7
}
```

## Upload und dauerhafte Bestätigung

Vorgeschlagener Endpunkt: `PUT /api/device/v1/{deviceId}/batches/{batchId}`.
Eine Anfrage enthält Protokollversion `1`, höchstens 100 Datensätze sowie
explizite Sequenzlücken-/Verlustereignisse. Clientauthentifizierung und TLS
sind zwingend; konkrete Erstbindung, Schlüsselablage, Zertifikatsrotation und
Widerruf müssen vor Implementierung festgelegt und geprüft sein. Cookies,
Browser-Origin als Geräteschutz oder ein ungeschützter lokaler HTTP-Endpunkt
sind keine Geräteauthentifizierung.

- `batchId` bleibt bei jeder Wiederholung derselben unveränderten Anfrage
  identisch. Gleicher Schlüssel mit anderem Inhalt ergibt `409`; identischer
  Retry liefert dieselbe dauerhafte Bestätigung.
- Der Server prüft Gerät, Eigentümer, Payload, Sequenzen und Größenlimits
  serverseitig. Alle Datensätze eines Batches werden atomar gespeichert;
  bestätigt wird erst nach erfolgreichem Commit auf dauerhaftem Speicher.
- Erfolgsantwort enthält die expliziten bestätigten Schlüssel und
  Verlustbereiche. Das Gerät löscht/markiert ausschließlich diese Einträge
  als bestätigt. Timeout, Verbindungsabbruch, 5xx oder unvollständige Antwort
  bedeutet ausstehend und wird idempotent wiederholt.
- Fehlercodes unterscheiden ungültige Daten, widerrufenes/fremdes Gerät,
  Versionkonflikt, zu großen Batch und temporären Serverfehler. Ein
  Fremdgerätezugriff erhält keine Daten und keine Planinformation.

## Planabruf und Gerätebestätigung

- Das Gerät fragt authentifiziert nach der neuesten für genau dieses Gerät
  freigegebenen Planversion und seiner aktuellen Empfangsbestätigung.
- Ein Plan enthält unveränderliche Version, Patient-/Gerätebezug,
  Grenzwert in kg, Vergleichsart, Erstellzeit, Autor, `validFrom` und optional
  `validUntil`. IDs und Versionen werden nicht durch spätere Änderungen
  überschrieben.
- Gerät prüft Schema, Eigentümer-/Gerätebezug, Wertebereich, Zeitgültigkeit
  und Version. Es schreibt den vollständigen Plan in einen inaktiven
  Flash-Slot, prüft den Inhalt zurück und aktiviert ihn atomar erst nach
  dauerhaftem Schreiben. Ungültiger, älterer, abgelaufener oder unvollständig
  geschriebener Plan ändert den aktiven Plan nicht.
- `POST /api/device/v1/{deviceId}/plans/{version}/applied` wird erst nach
  erfolgreicher Aktivierung gesendet und enthält Planhash, Firmwareversion,
  `bootId` sowie Zeitqualität. Die API bestätigt die persistierte Annahme.
  App zeigt „angewendet“ ausschließlich aus dieser Gerätequittung; bis dahin
  bleibt die Planversion ausstehend. Ein App-Klick ist kein Geräte-ACK.
- Wird eine neuere Version widerrufen oder veröffentlicht, prüft das Gerät
  beim nächsten erreichbaren Abgleich erneut. Verhalten bei Ablauf ohne Uhr,
  Planwiderruf offline und voller Flashpartition muss vor Freigabe spezifiziert
  werden; es darf keine Entwarnung aus einem unbekannten Planstatus entstehen.

## Sicherheit und Betriebsgrenzen

TLS prüft mindestens Serverzertifikat und Hostnamen; kein unsicherer Fallback.
Ein Gerätecredential ist einzeln zuordnungsfähig, widerrufbar und nur zum
Lesen des eigenen Plans sowie zum Schreiben eigener Geräteereignisse berechtigt.
Geheimnisse gehören nicht in Quellcode, Beispielkonfiguration, Logs oder Git.
Die konkrete sichere Erstbindung und der Schutz gespeicherter Credentials auf
dem ESP32 sind noch offen. Bis zu deren Implementierung bleibt der
Synchronisationspfad außer Betrieb.

Batchgröße 100 ist ein vorläufiger API-Entwurfswert, kein gemessener
Flash-/Netzwerkgrenzwert. Kapazität, Messrate, Laufzeit und Wear-Levelling
werden anhand der realen Senderate und Partitionierung festgelegt.
