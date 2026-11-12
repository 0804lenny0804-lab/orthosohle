#pragma once

#include <cstddef>
#include <cstdint>

namespace orthosohle {

enum class MeasurementQuality : uint8_t {
  valid,
  range_limit,
  sensor_fault,
  invalid,
};

struct Measurement {
  float kilograms = 0.0F;
  uint32_t sequence = 0;
  bool has_sequence = false;
  MeasurementQuality quality = MeasurementQuality::invalid;
};

// Legacy payload is one little-endian IEEE-754 float32 in kilograms. Since the
// old sole sketch clamps at 25 kg, values at or above that limit are ambiguous.
Measurement decodeLegacyFloat32(const uint8_t* bytes, size_t length);

// Version 1 payload: 'O','S', version, sequence LE32, kilograms LE float32,
// quality flags. Bit 0 means range limit, bit 1 means sensor fault. Other bits
// are reserved and must be zero.
Measurement decodeVersion1(const uint8_t* bytes, size_t length);

// Accepts new sequences, including uint32 wraparound; rejects duplicates and
// old frames. A new BLE connection should create a fresh tracker.
class SequenceTracker {
 public:
  bool accept(uint32_t sequence);
  void reset();

 private:
  bool initialized_ = false;
  uint32_t latest_ = 0;
};

}  // namespace orthosohle
