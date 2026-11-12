cmake_minimum_required(VERSION 3.16)
project(orthosohle_firmware_domain LANGUAGES CXX)

add_library(measurement_contract
  src/local_monitor.cpp
  src/measurement_contract.cpp
)
target_include_directories(measurement_contract PUBLIC include)
target_compile_features(measurement_contract PUBLIC cxx_std_17)
target_compile_options(measurement_contract PRIVATE -Wall -Wextra -Wpedantic -Werror)

add_executable(measurement_contract_test test/measurement_contract_test.cpp)
target_link_libraries(measurement_contract_test PRIVATE measurement_contract)
target_compile_options(measurement_contract_test PRIVATE -Wall -Wextra -Wpedantic -Werror)

add_executable(local_monitor_test test/local_monitor_test.cpp)
target_link_libraries(local_monitor_test PRIVATE measurement_contract)
target_compile_options(local_monitor_test PRIVATE -Wall -Wextra -Wpedantic -Werror)

enable_testing()
add_test(NAME measurement_contract_test COMMAND measurement_contract_test)
add_test(NAME local_monitor_test COMMAND local_monitor_test)
