#include <ArduinoBLE.h>
#include "HX711.h"

#define DOUT 2
#define SCK  3

HX711 scale;

const char* SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const char* CHAR_UUID    = "12345678-1234-1234-1234-1234567890cd";

BLEService weightService(SERVICE_UUID);
BLEFloatCharacteristic weightKgChar(CHAR_UUID, BLERead | BLENotify);

struct CalPoint { long raw; float kg; };

// Wichtig: RAW wird mit mehr Gewicht "negativer" → Punkte nach RAW sortieren (mehr negativ zuerst)
const CalPoint cal[] = {
  { -1028776, 25.0f },
  { -1008489, 22.5f },
  {  -991450, 20.0f },
  {  -975652, 17.5f },
  {  -965974, 15.0f },
  {  -951923, 12.5f },
  {  -936304, 10.0f },
  {  -925965,  7.5f },
  {  -905416,  5.0f },
  {  -893161,  2.5f },
  {  -882278,  0.0f }
};

float rawToKg(long raw) {
  // außerhalb clampen
  if (raw <= cal[0].raw) return cal[0].kg;                       // schwerer als max
  if (raw >= cal[sizeof(cal)/sizeof(cal[0]) - 1].raw) return 0;  // leichter als 0

  // Segment finden und linear interpolieren
  for (size_t i = 0; i < (sizeof(cal)/sizeof(cal[0]) - 1); i++) {
    long r1 = cal[i].raw;
    long r2 = cal[i+1].raw;
    if (raw >= r1 && raw <= r2) {
      float k1 = cal[i].kg;
      float k2 = cal[i+1].kg;

      float t = (float)(raw - r1) / (float)(r2 - r1);  // 0..1
      return k1 + t * (k2 - k1);
    }
  }
  return 0;
}

void setup() {
  Serial.begin(9600);
  //while (!Serial) {}

  scale.begin(DOUT, SCK);

  if (!BLE.begin()) while (1) {}

  BLE.setLocalName("ScaleBLE");
  BLE.setAdvertisedService(weightService);
  weightService.addCharacteristic(weightKgChar);
  BLE.addService(weightService);

  weightKgChar.writeValue(0.0f);
  BLE.advertise();
}

void loop() {
  BLEDevice central = BLE.central();
  if (!central) return;

  while (central.connected()) {
    long raw = scale.read_average(15);
    float kg = rawToKg(raw);
    if (kg < 0) kg = 0;

    weightKgChar.writeValue(kg);
    delay(200);
  }
}
