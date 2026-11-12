#pragma once

#include "measurement_contract.hpp"

namespace orthosohle {

enum class PlanState : uint8_t {
  valid,
  missing,
  expired,
  pending_confirmation,
  validity_unknown,
  invalid,
};

enum class SampleState : uint8_t { current, stale, missing };
enum class LimitRule : uint8_t { greater_than, at_or_above };

enum class MonitorState : uint8_t {
  monitoring,
  over_limit,
  no_plan,
  expired_plan,
  pending_plan,
  plan_validity_unknown,
  invalid_plan,
  no_measurement,
  stale_measurement,
  calibration_limit,
  sensor_fault,
  invalid_measurement,
};

// This evaluates local display/alarm state only. It does not drive a motor or
// define medically validated hysteresis, delays, or freshness limits.
MonitorState evaluateMonitorState(PlanState planState, float limitKg,
                                  LimitRule rule, SampleState sampleState,
                                  const Measurement& measurement);

}  // namespace orthosohle
