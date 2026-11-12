#include "measurement_contract.hpp"

#include <cassert>
#include <cmath>
#include <cstdint>

using orthosohle::MeasurementQuality;

namespace {

void testLegacyFrames() {
  const uint8_t valid[] = {0x00, 0x00, 0x40, 0x40};  // 3.0 kg
  const auto decoded = orthosohle::decodeLegacyFloat32(valid, sizeof(valid));
  assert(decoded.quality == MeasurementQuality::valid);
  assert(!decoded.has_sequence);
  assert(std::fabs(decoded.kilograms - 3.0F) < 0.001F);

  const uint8_t limit[] = {0x00, 0x00, 0xC8, 0x41};  // 25.0 kg
  assert(orthosohle::decodeLegacyFloat32(limit, sizeof(limit)).quality ==
         MeasurementQuality::range_limit);
  assert(orthosohle::decodeLegacyFloat32(valid, 3).quality ==
         MeasurementQuality::invalid);
  assert(orthosohle::decodeLegacyFloat32(valid, 5).quality ==
         MeasurementQuality::invalid);

  const uint8_t negative[] = {0x00, 0x00, 0x80, 0xBF};
  assert(orthosohle::decodeLegacyFloat32(negative, sizeof(negative)).quality ==
         MeasurementQuality::invalid);
  const uint8_t nan[] = {0x00, 0x00, 0xC0, 0x7F};
  assert(orthosohle::decodeLegacyFloat32(nan, sizeof(nan)).quality ==
         MeasurementQuality::invalid);
  const uint8_t positiveInfinity[] = {0x00, 0x00, 0x80, 0x7F};
  assert(orthosohle::decodeLegacyFloat32(positiveInfinity, sizeof(positiveInfinity)).quality ==
         MeasurementQuality::invalid);
  const uint8_t negativeInfinity[] = {0x00, 0x00, 0x80, 0xFF};
  assert(orthosohle::decodeLegacyFloat32(negativeInfinity, sizeof(negativeInfinity)).quality ==
         MeasurementQuality::invalid);
}

void testVersionedFrames() {
  const uint8_t valid[] = {'O', 'S', 1, 0x02, 0x00, 0x00, 0x00,
                           0x00, 0x00, 0x40, 0x40, 0x00};
  const auto decoded = orthosohle::decodeVersion1(valid, sizeof(valid));
  assert(decoded.quality == MeasurementQuality::valid);
  assert(decoded.has_sequence && decoded.sequence == 2);
  assert(std::fabs(decoded.kilograms - 3.0F) < 0.001F);

  auto overRange = decoded;
  const uint8_t overRangeFrame[] = {'O', 'S', 1, 0, 0, 0, 0,
                                    0, 0, 0xC8, 0x41, 0x01};
  overRange = orthosohle::decodeVersion1(overRangeFrame, sizeof(overRangeFrame));
  assert(overRange.quality == MeasurementQuality::range_limit);

  const uint8_t sensorFault[] = {'O', 'S', 1, 0, 0, 0, 0,
                                 0, 0, 0x40, 0x40, 0x02};
  assert(orthosohle::decodeVersion1(sensorFault, sizeof(sensorFault)).quality ==
         MeasurementQuality::sensor_fault);

  uint8_t malformed[sizeof(valid)];
  for (size_t i = 0; i < sizeof(valid); ++i) malformed[i] = valid[i];
  malformed[2] = 2;
  assert(orthosohle::decodeVersion1(malformed, sizeof(malformed)).quality ==
         MeasurementQuality::invalid);
  malformed[0] = 'N';
  malformed[2] = 1;
  assert(orthosohle::decodeVersion1(malformed, sizeof(malformed)).quality ==
         MeasurementQuality::invalid);
  malformed[0] = 'O';
  malformed[2] = 1;
  malformed[11] = 0x80;
  assert(orthosohle::decodeVersion1(malformed, sizeof(malformed)).quality ==
         MeasurementQuality::invalid);
  malformed[11] = 0;
  malformed[9] = 0xC8;
  malformed[10] = 0x41;
  assert(orthosohle::decodeVersion1(malformed, sizeof(malformed)).quality ==
         MeasurementQuality::invalid);

  const uint8_t invalidValues[][12] = {
      {'O', 'S', 1, 0, 0, 0, 0, 0x00, 0x00, 0x80, 0xBF, 0x00},
      {'O', 'S', 1, 0, 0, 0, 0, 0x00, 0x00, 0xC0, 0x7F, 0x00},
      {'O', 'S', 1, 0, 0, 0, 0, 0x00, 0x00, 0x80, 0x7F, 0x00},  // +infinity
      {'O', 'S', 1, 0, 0, 0, 0, 0x00, 0x00, 0x80, 0xFF, 0x00},  // -infinity
  };
  for (const auto& frame : invalidValues) {
    assert(orthosohle::decodeVersion1(frame, sizeof(frame)).quality ==
           MeasurementQuality::invalid);
  }
  assert(orthosohle::decodeVersion1(valid, 11).quality ==
         MeasurementQuality::invalid);
}

void testSequenceTracking() {
  orthosohle::SequenceTracker tracker;
  assert(tracker.accept(0xFFFFFFFEU));
  assert(tracker.accept(0xFFFFFFFFU));
  assert(tracker.accept(0U));
  assert(!tracker.accept(0U));
  assert(!tracker.accept(0xFFFFFFFFU));
  assert(tracker.accept(1U));
  tracker.reset();
  assert(tracker.accept(1U));
}

}  // namespace

int main() {
  testLegacyFrames();
  testVersionedFrames();
  testSequenceTracking();
}
