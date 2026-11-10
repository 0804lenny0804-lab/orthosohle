#include <Arduino_GFX_Library.h>
#include <NimBLEDevice.h>
#include <cmath>
#include <cstdlib>

// Waveshare ESP32-S3-Touch-LCD-1.28 integrated display wiring.
constexpr int LCD_BACKLIGHT = 2;
constexpr int LCD_DC = 8;
constexpr int LCD_CS = 9;
constexpr int LCD_SCLK = 10;
constexpr int LCD_MOSI = 11;
constexpr int LCD_RESET = 14;

// Dedicated test protocol. These UUIDs intentionally differ from the sole's
// legacy service UUIDs (12345678-...-90ab / 12345678-...-90cd).
static const char* SERVICE_UUID = "e6a70001-7b3c-4f21-9d10-2a5c6e8f0001";
static const char* VALUE_UUID = "e6a70002-7b3c-4f21-9d10-2a5c6e8f0001";

Arduino_DataBus* displayBus = new Arduino_ESP32SPI(
    LCD_DC, LCD_CS, LCD_SCLK, LCD_MOSI, GFX_NOT_DEFINED);
Arduino_GFX* display = new Arduino_GC9A01(displayBus, LCD_RESET, 0, true);

NimBLECharacteristic* valueCharacteristic = nullptr;
volatile bool clientConnected = false;
volatile bool hasReading = false;
volatile float latestKg = 0.0f;
volatile uint32_t lastReadingMs = 0;
float displayedKg = -1.0f;
bool displayedConnected = false;
bool displayedStale = false;

class ReceiverServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer*, NimBLEConnInfo&) override {
    clientConnected = true;
  }

  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override {
    clientConnected = false;
    NimBLEDevice::startAdvertising();
  }
};

class ReadingCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic,
               NimBLEConnInfo&) override {
    const std::string payload = characteristic->getValue();
    if (payload.empty() || payload.size() > 16) {
      return;
    }

    char buffer[17] = {};
    payload.copy(buffer, payload.size());
    char* end = nullptr;
    const float kg = strtof(buffer, &end);

    if (end == buffer || *end != '\0' || !std::isfinite(kg) ||
        kg < 0.0f || kg > 1000.0f) {
      return;
    }

    latestKg = kg;
    lastReadingMs = millis();
    hasReading = true;
  }
};

void drawScreen(float kg, bool connected, bool stale) {
  display->fillScreen(0x0000);
  display->setTextColor(0xFFFF);
  display->setTextSize(2);
  display->setCursor(56, 35);
  display->print("DEMO");

  display->setTextSize(1);
  display->setCursor(34, 75);
  display->print(connected ? "APP VERBUNDEN" : "APP GETRENNT");

  if (stale) {
    display->setTextColor(0xF800);
    display->setTextSize(2);
    display->setCursor(50, 125);
    display->print("DATEN ALT");
    return;
  }

  if (!hasReading) {
    display->setTextColor(0xFFE0);
    display->setTextSize(2);
    display->setCursor(65, 125);
    display->print("WARTEN");
    return;
  }

  display->setTextColor(0x07E0);
  display->setTextSize(3);
  display->setCursor(45, 125);
  display->print(kg, 1);
  display->print(" kg");

  display->setTextColor(0xFFFF);
  display->setTextSize(1);
  display->setCursor(45, 175);
  display->print("SYNTHETISCHER TESTWERT");
}

void setup() {
  Serial.begin(115200);

  pinMode(LCD_BACKLIGHT, OUTPUT);
  digitalWrite(LCD_BACKLIGHT, HIGH);

  if (!display->begin()) {
    Serial.println("Displaystart fehlgeschlagen");
    while (true) {
      delay(100);
    }
  }

  drawScreen(0.0f, false, false);

  NimBLEDevice::init("OrthoSohle-Armband-Demo");
  NimBLEServer* server = NimBLEDevice::createServer();
  server->setCallbacks(new ReceiverServerCallbacks());

  NimBLEService* service = server->createService(SERVICE_UUID);
  valueCharacteristic = service->createCharacteristic(
      VALUE_UUID,
      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  valueCharacteristic->setCallbacks(new ReadingCallbacks());
  service->start();

  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->start();

  Serial.println("BLE-Empfaenger bereit: OrthoSohle-Armband-Demo");
}

void loop() {
  static uint32_t lastDrawMs = 0;
  const uint32_t now = millis();

  if (now - lastDrawMs >= 100) {
    lastDrawMs = now;

    const bool connected = clientConnected;
    const bool stale = hasReading && now - lastReadingMs > 2000;
    const float kg = latestKg;

    if (connected != displayedConnected || stale != displayedStale ||
        (hasReading && kg != displayedKg)) {
      displayedConnected = connected;
      displayedStale = stale;
      displayedKg = kg;
      drawScreen(kg, connected, stale);

      if (hasReading && !stale) {
        Serial.printf("Empfangen: %.1f kg\n", kg);
      }
    }
  }

  delay(5);
}
