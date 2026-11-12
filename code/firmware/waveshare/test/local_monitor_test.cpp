#include "local_monitor.hpp"

#include <cassert>
#include <limits>

using namespace orthosohle;

int main() {
  const Measurement under{5.0F, 1, true, MeasurementQuality::valid};
  const Measurement atLimit{10.0F, 2, true, MeasurementQuality::valid};
  const Measurement rangeLimit{25.0F, 3, true, MeasurementQuality::range_limit};
  const Measurement failed{0.0F, 4, true, MeasurementQuality::sensor_fault};

  assert(evaluateMonitorState(PlanState::valid, 10.0F, LimitRule::greater_than,
                             SampleState::current, under) == MonitorState::monitoring);
  assert(evaluateMonitorState(PlanState::valid, 10.0F, LimitRule::greater_than,
                             SampleState::current, atLimit) == MonitorState::monitoring);
  assert(evaluateMonitorState(PlanState::valid, 10.0F, LimitRule::at_or_above,
                             SampleState::current, atLimit) == MonitorState::over_limit);

  assert(evaluateMonitorState(PlanState::missing, 10.0F, LimitRule::greater_than,
                             SampleState::current, under) == MonitorState::no_plan);
  assert(evaluateMonitorState(PlanState::expired, 10.0F, LimitRule::greater_than,
                             SampleState::current, under) == MonitorState::expired_plan);
  assert(evaluateMonitorState(PlanState::pending_confirmation, 10.0F,
                             LimitRule::greater_than, SampleState::current, under) ==
         MonitorState::pending_plan);
  assert(evaluateMonitorState(PlanState::validity_unknown, 10.0F,
                             LimitRule::greater_than, SampleState::current, under) ==
         MonitorState::plan_validity_unknown);
  assert(evaluateMonitorState(PlanState::valid, 10.0F, LimitRule::greater_than,
                             SampleState::missing, under) == MonitorState::no_measurement);
  assert(evaluateMonitorState(PlanState::valid, 10.0F, LimitRule::greater_than,
                             SampleState::stale, under) == MonitorState::stale_measurement);
  assert(evaluateMonitorState(PlanState::valid, 10.0F, LimitRule::greater_than,
                             SampleState::current, rangeLimit) == MonitorState::calibration_limit);
  assert(evaluateMonitorState(PlanState::valid, 10.0F, LimitRule::greater_than,
                             SampleState::current, failed) == MonitorState::sensor_fault);
  assert(evaluateMonitorState(PlanState::valid, 25.0F, LimitRule::greater_than,
                             SampleState::current, under) == MonitorState::invalid_plan);
  assert(evaluateMonitorState(PlanState::valid, 0.0F, LimitRule::greater_than,
                             SampleState::current, under) == MonitorState::over_limit);
  assert(evaluateMonitorState(PlanState::valid, std::numeric_limits<float>::quiet_NaN(),
                             LimitRule::greater_than, SampleState::current, under) ==
         MonitorState::invalid_plan);
  assert(evaluateMonitorState(static_cast<PlanState>(99), 10.0F,
                             LimitRule::greater_than, SampleState::current, under) ==
         MonitorState::invalid_plan);
  assert(evaluateMonitorState(PlanState::valid, 10.0F, static_cast<LimitRule>(99),
                             SampleState::current, under) == MonitorState::invalid_plan);
}
