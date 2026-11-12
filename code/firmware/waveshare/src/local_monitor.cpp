#include "local_monitor.hpp"

#include <cmath>

namespace orthosohle {

MonitorState evaluateMonitorState(PlanState planState, float limitKg,
                                  LimitRule rule, SampleState sampleState,
                                  const Measurement& measurement) {
  switch (planState) {
    case PlanState::missing:
      return MonitorState::no_plan;
    case PlanState::expired:
      return MonitorState::expired_plan;
    case PlanState::pending_confirmation:
      return MonitorState::pending_plan;
    case PlanState::validity_unknown:
      return MonitorState::plan_validity_unknown;
    case PlanState::invalid:
      return MonitorState::invalid_plan;
    case PlanState::valid:
      break;
    default:
      return MonitorState::invalid_plan;
  }

  if (!std::isfinite(limitKg) || limitKg < 0.0F || limitKg >= 25.0F ||
      (rule != LimitRule::greater_than && rule != LimitRule::at_or_above)) {
    return MonitorState::invalid_plan;
  }
  switch (sampleState) {
    case SampleState::missing:
      return MonitorState::no_measurement;
    case SampleState::stale:
      return MonitorState::stale_measurement;
    case SampleState::current:
      break;
    default:
      return MonitorState::invalid_measurement;
  }

  switch (measurement.quality) {
    case MeasurementQuality::range_limit:
      return MonitorState::calibration_limit;
    case MeasurementQuality::sensor_fault:
      return MonitorState::sensor_fault;
    case MeasurementQuality::invalid:
      return MonitorState::invalid_measurement;
    case MeasurementQuality::valid:
      break;
    default:
      return MonitorState::invalid_measurement;
  }

  if (!std::isfinite(measurement.kilograms) || measurement.kilograms < 0.0F ||
      measurement.kilograms >= 25.0F) {
    return MonitorState::invalid_measurement;
  }

  const bool exceeded = rule == LimitRule::greater_than
                            ? measurement.kilograms > limitKg
                            : measurement.kilograms >= limitKg;
  return exceeded ? MonitorState::over_limit : MonitorState::monitoring;
}

}  // namespace orthosohle
