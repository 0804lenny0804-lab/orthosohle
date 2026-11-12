#include "measurement_contract.hpp"

#include <cmath>
#include <cstring>

namespace orthosohle {
namespace {

uint32_t readLe32(const uint8_t* bytes) {
  return static_cast<uint32_t>(bytes[0]) |
         (static_cast<uint32_t>(bytes[1]) << 8U) |
         (static_cast<uint32_t>(bytes[2]) << 16U) |
         (static_cast<uint32_t>(bytes[3]) << 24U);
}

float readLeFloat32(const uint8_t* bytes) {
  const uint32_t bits = readLe32(bytes);
  float value = 0.0F;
  static_assert(sizeof(value) == sizeof(bits), "float32 required");
  std::memcpy(&value, &bits, sizeof(value));
  return value;
}

Measurement invalidMeasurement() { return {}; }

MeasurementQuality qualityFrom(uint8_t flags) {
  if ((flags & 0xFCU) != 0) return MeasurementQuality::invalid;
  if ((flags & 0x02U) != 0) return MeasurementQuality::sensor_fault;
  if ((flags & 0x01U) != 0) return MeasurementQuality::range_limit;
  return MeasurementQuality::valid;
}

}  // namespace

Measurement decodeLegacyFloat32(const uint8_t* bytes, size_t length) {
  if (bytes == nullptr || length != 4) return invalidMeasurement();

  const float kilograms = readLeFloat32(bytes);
  if (!std::isfinite(kilograms) || kilograms < 0.0F) return invalidMeasurement();

  return {kilograms, 0, false,
          kilograms >= 25.0F ? MeasurementQuality::range_limit
                             : MeasurementQuality::valid};
}

Measurement decodeVersion1(const uint8_t* bytes, size_t length) {
  constexpr size_t frameLength = 12;
  if (bytes == nullptr || length != frameLength) return invalidMeasurement();
  if (bytes[0] != 'O' || bytes[1] != 'S' || bytes[2] != 1) {
    return invalidMeasurement();
  }

  const uint32_t sequence = readLe32(bytes + 3);
  const float kilograms = readLeFloat32(bytes + 7);
  const MeasurementQuality quality = qualityFrom(bytes[11]);
  if (quality == MeasurementQuality::invalid || !std::isfinite(kilograms) ||
      kilograms < 0.0F) {
    return invalidMeasurement();
  }
  if ((quality == MeasurementQuality::valid && kilograms >= 25.0F) ||
      (quality == MeasurementQuality::range_limit && kilograms < 25.0F)) {
    return invalidMeasurement();
  }

  return {kilograms, sequence, true, quality};
}

bool SequenceTracker::accept(uint32_t sequence) {
  if (!initialized_) {
    latest_ = sequence;
    initialized_ = true;
    return true;
  }

  // A forward modular distance below half the uint32 range includes wraparound.
  const uint32_t distance = sequence - latest_;
  if (distance == 0 || distance >= 0x80000000U) return false;
  latest_ = sequence;
  return true;
}

void SequenceTracker::reset() {
  initialized_ = false;
  latest_ = 0;
}

}  // namespace orthosohle
