#include <Arduino.h>
#include <Arduino_GFX_Library.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>
#include <BLEDevice.h>
#include <BLEScan.h>
#include <BLERemoteCharacteristic.h>
#include <BLERemoteService.h>

#include <cstring>
#include <new>

#include "local_monitor.hpp"
#include "measurement_contract.hpp"

namespace {

constexpr char kServiceUuid[] = "12345678-1234-1234-1234-1234567890ab";
constexpr char kLegacyCharacteristicUuid[] = "12345678-1234-1234-1234-1234567890cd";
constexpr char kVersion1CharacteristicUuid[] = "12345678-1234-1234-1234-1234567890ce";
constexpr int kBacklightPin = 2;
constexpr uint32_t kScreenRefreshMs = 500;

constexpr uint16_t kBlack = 0x0000;
constexpr uint16_t kWhite = 0xFFFF;
constexpr uint16_t kGreen = 0x07E0;
constexpr uint16_t kYellow = 0xFFE0;
constexpr uint16_t kRed = 0xF800;
constexpr uint16_t kGrey = 0xC618;

enum class LinkState : uint8_t {
  starting,
  scanning,
  connecting,
  connected,
  service_missing,
  characteristic_missing,
  notify_unavailable,
  disconnected,
};

struct DisplaySnapshot {
  LinkState link = LinkState::starting;
  orthosohle::Measurement measurement{};
  uint32_t receivedAtMs = 0;
  bool hasMeasurement = false;
  bool invalidPacket = false;
};

portMUX_TYPE g_stateMux = portMUX_INITIALIZER_UNLOCKED;
DisplaySnapshot g_snapshot;
BLEAdvertisedDevice* g_foundDevice = nullptr;
BLEClient* g_client = nullptr;
BLERemoteCharacteristic* g_activeCharacteristic = nullptr;
orthosohle::SequenceTracker g_sequenceTracker;

Arduino_DataBus* g_displayBus = new Arduino_ESP32SPI(
    8 /* DC */, 9 /* CS */, 10 /* SCK */, 11 /* MOSI */, GFX_NOT_DEFINED /* MISO */);
Arduino_GFX* g_display = new Arduino_GC9A01(
    g_displayBus, 14 /* RST */, 0 /* rotation */, true /* IPS */);

DisplaySnapshot readSnapshot() {
  DisplaySnapshot copy;
  portENTER_CRITICAL(&g_stateMux);
  copy = g_snapshot;
  portEXIT_CRITICAL(&g_stateMux);
  return copy;
}

void setLinkState(LinkState state) {
  portENTER_CRITICAL(&g_stateMux);
  g_snapshot.link = state;
  portEXIT_CRITICAL(&g_stateMux);
}

void recordBadPacket() {
  portENTER_CRITICAL(&g_stateMux);
  g_snapshot.invalidPacket = true;
  portEXIT_CRITICAL(&g_stateMux);
}

void recordMeasurement(const orthosohle::Measurement& measurement) {
  portENTER_CRITICAL(&g_stateMux);
  g_snapshot.measurement = measurement;
  g_snapshot.receivedAtMs = millis();
  g_snapshot.hasMeasurement = true;
  g_snapshot.invalidPacket = false;
  portEXIT_CRITICAL(&g_stateMux);
}

void setActiveCharacteristic(BLERemoteCharacteristic* characteristic) {
  portENTER_CRITICAL(&g_stateMux);
  g_activeCharacteristic = characteristic;
  portEXIT_CRITICAL(&g_stateMux);
}

bool hasActiveCharacteristic() {
  portENTER_CRITICAL(&g_stateMux);
  const bool active = g_activeCharacteristic != nullptr;
  portEXIT_CRITICAL(&g_stateMux);
  return active;
}

const char* linkText(LinkState state) {
  switch (state) {
    case LinkState::starting:
      return "BLE startet";
    case LinkState::scanning:
      return "Suche Sohle";
    case LinkState::connecting:
      return "Verbinde";
    case LinkState::connected:
      return "BLE verbunden";
    case LinkState::service_missing:
      return "BLE-Dienst fehlt";
    case LinkState::characteristic_missing:
      return "Messwert fehlt";
    case LinkState::notify_unavailable:
      return "Notify fehlt";
    case LinkState::disconnected:
      return "BLE getrennt";
  }
  return "BLE-Fehler";
}

uint16_t linkColor(LinkState state) {
  switch (state) {
    case LinkState::connected:
      return kGreen;
    case LinkState::scanning:
    case LinkState::connecting:
      return kYellow;
    case LinkState::starting:
      return kGrey;
    default:
      return kRed;
  }
}

void drawScreen(const DisplaySnapshot& snapshot) {
  g_display->fillScreen(kBlack);
  g_display->setTextWrap(false);
  g_display->setTextSize(2);
  g_display->setTextColor(kWhite);
  g_display->setCursor(17, 18);
  g_display->println("OrthoSohle");

  g_display->setTextSize(1);
  g_display->setTextColor(linkColor(snapshot.link));
  g_display->setCursor(18, 57);
  g_display->println(linkText(snapshot.link));

  if (snapshot.hasMeasurement) {
    g_display->setTextSize(3);
    g_display->setTextColor(kWhite);
    g_display->setCursor(24, 92);
    g_display->print(snapshot.measurement.kilograms, 2);
    g_display->setTextSize(2);
    g_display->print(" kg");

    const uint32_t ageSeconds = (millis() - snapshot.receivedAtMs) / 1000;
    g_display->setTextSize(1);
    g_display->setTextColor(kGrey);
    g_display->setCursor(18, 137);
    g_display->print("Alter: ");
    g_display->print(ageSeconds);
    g_display->println(" s");

    g_display->setCursor(18, 154);
    switch (snapshot.measurement.quality) {
      case orthosohle::MeasurementQuality::range_limit:
        g_display->setTextColor(kRed);
        g_display->println("Messbereich >= 25 kg");
        break;
      case orthosohle::MeasurementQuality::sensor_fault:
        g_display->setTextColor(kRed);
        g_display->println("Sensorfehler");
        break;
      case orthosohle::MeasurementQuality::invalid:
        g_display->setTextColor(kRed);
        g_display->println("Wert ungueltig");
        break;
      case orthosohle::MeasurementQuality::valid:
        g_display->setTextColor(kGreen);
        g_display->println("Messwert empfangen");
        break;
    }
  } else {
    g_display->setTextSize(2);
    g_display->setTextColor(kYellow);
    g_display->setCursor(25, 103);
    g_display->println("Warte auf");
    g_display->setCursor(25, 129);
    g_display->println("Messwert");
  }

  g_display->setTextSize(1);
  g_display->setTextColor(kYellow);
  g_display->setCursor(18, 186);
  g_display->println("TEST: keine Planpruefung");

  if (snapshot.invalidPacket) {
    g_display->setTextColor(kRed);
    g_display->setCursor(18, 204);
    g_display->println("Paket ungueltig");
  }
}

void handleNotification(BLERemoteCharacteristic* characteristic,
                        uint8_t* bytes, size_t length, bool) {
  if (characteristic == nullptr || bytes == nullptr) {
    recordBadPacket();
    return;
  }

  const String uuid = characteristic->getUUID().toString();
  const bool isVersion1 = uuid.equalsIgnoreCase(kVersion1CharacteristicUuid);
  const orthosohle::Measurement measurement =
      isVersion1 ? orthosohle::decodeVersion1(bytes, length)
                 : orthosohle::decodeLegacyFloat32(bytes, length);

  if (measurement.quality == orthosohle::MeasurementQuality::invalid) {
    recordBadPacket();
    return;
  }
  if (measurement.has_sequence && !g_sequenceTracker.accept(measurement.sequence)) {
    recordBadPacket();
    return;
  }

  recordMeasurement(measurement);
}

class AdvertisedDeviceHandler final : public BLEAdvertisedDeviceCallbacks {
 public:
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if (!advertisedDevice.haveServiceUUID() ||
        !advertisedDevice.isAdvertisingService(BLEUUID(kServiceUuid))) {
      return;
    }

    portENTER_CRITICAL(&g_stateMux);
    const bool alreadyFound = g_foundDevice != nullptr;
    portEXIT_CRITICAL(&g_stateMux);
    if (alreadyFound) return;

    BLEAdvertisedDevice* match = new (std::nothrow) BLEAdvertisedDevice(advertisedDevice);
    if (match == nullptr) return;

    portENTER_CRITICAL(&g_stateMux);
    if (g_foundDevice == nullptr) {
      g_foundDevice = match;
      g_snapshot.link = LinkState::connecting;
      match = nullptr;
    }
    portEXIT_CRITICAL(&g_stateMux);
    delete match;
    BLEDevice::getScan()->stop();
  }
};

class ClientEventHandler final : public BLEClientCallbacks {
 public:
  void onDisconnect(BLEClient*) override {
    setActiveCharacteristic(nullptr);
    setLinkState(LinkState::disconnected);
  }
};

AdvertisedDeviceHandler g_advertisedDeviceHandler;
ClientEventHandler g_clientEventHandler;

BLEAdvertisedDevice* takeFoundDevice() {
  BLEAdvertisedDevice* device;
  portENTER_CRITICAL(&g_stateMux);
  device = g_foundDevice;
  g_foundDevice = nullptr;
  portEXIT_CRITICAL(&g_stateMux);
  return device;
}

bool subscribeToMeasurements(BLEClient* client) {
  BLERemoteService* service = client->getService(BLEUUID(kServiceUuid));
  if (service == nullptr) {
    setLinkState(LinkState::service_missing);
    return false;
  }

  BLERemoteCharacteristic* characteristic =
      service->getCharacteristic(BLEUUID(kVersion1CharacteristicUuid));
  if (characteristic == nullptr || !characteristic->canNotify()) {
    characteristic = service->getCharacteristic(BLEUUID(kLegacyCharacteristicUuid));
  }

  if (characteristic == nullptr) {
    setLinkState(LinkState::characteristic_missing);
    return false;
  }
  if (!characteristic->canNotify()) {
    setLinkState(LinkState::notify_unavailable);
    return false;
  }

  setActiveCharacteristic(characteristic);
  g_sequenceTracker.reset();
  characteristic->registerForNotify(handleNotification);
  setLinkState(LinkState::connected);
  return true;
}

void bleWorker(void*) {
  BLEDevice::init("OrthoSohle-Test");
  BLEScan* scanner = BLEDevice::getScan();
  scanner->setAdvertisedDeviceCallbacks(&g_advertisedDeviceHandler, false);
  scanner->setActiveScan(true);
  scanner->setInterval(100);
  scanner->setWindow(80);

  g_client = BLEDevice::createClient();
  g_client->setClientCallbacks(&g_clientEventHandler, false);

  for (;;) {
    if (!g_client->isConnected()) {
      setLinkState(LinkState::scanning);
      scanner->start(3, false);

      BLEAdvertisedDevice* match = takeFoundDevice();
      if (match != nullptr) {
        setLinkState(LinkState::connecting);
        const bool connected = g_client->connect(match);
        delete match;
        if (connected) {
          if (!subscribeToMeasurements(g_client)) g_client->disconnect();
        } else {
          setLinkState(LinkState::disconnected);
          vTaskDelay(pdMS_TO_TICKS(500));
        }
      }
    } else if (!hasActiveCharacteristic()) {
      g_client->disconnect();
    }

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  pinMode(kBacklightPin, OUTPUT);
  digitalWrite(kBacklightPin, HIGH);

  if (!g_display->begin()) {
    Serial.println("Displayinitialisierung fehlgeschlagen");
    setLinkState(LinkState::starting);
  }
  g_display->fillScreen(kBlack);
  drawScreen(readSnapshot());

  const BaseType_t taskCreated = xTaskCreatePinnedToCore(
      bleWorker, "ble-worker", 8192, nullptr, 1, nullptr, 0);
  if (taskCreated != pdPASS) {
    setLinkState(LinkState::disconnected);
    Serial.println("BLE-Task konnte nicht gestartet werden");
  }
}

void loop() {
  static uint32_t lastDrawMs = 0;
  const uint32_t now = millis();
  if (now - lastDrawMs >= kScreenRefreshMs) {
    drawScreen(readSnapshot());
    lastDrawMs = now;
  }
  delay(20);
}
