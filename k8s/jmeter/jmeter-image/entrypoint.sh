#!/bin/bash
set -e

echo "=========================================="
echo "MarathonRunner JMeter Executor"
echo "=========================================="
echo "Run ID:        ${RUN_ID:-unknown}"
echo "Target:        ${TARGET_URL:-unknown}"
echo "VUsers:        ${VIRTUAL_USERS:-10}"
echo "Duration:      ${DURATION:-60}s"
echo "Ramp-up:       ${RAMP_UP:-30}s"
echo "Engine:        JMeter 5.6.3"
echo "=========================================="

JMETER_HOME="/opt/apache-jmeter-5.6.3"
JMETER_BIN="${JMETER_HOME}/bin/jmeter"
TEST_PLAN="${TEST_PLAN_PATH:-/test-plan/test-plan.jmx}"
RESULTS_DIR="/results/${RUN_ID:-default}"
mkdir -p "${RESULTS_DIR}"

if [ ! -f "${TEST_PLAN}" ]; then
    echo "ERROR: Test plan not found at ${TEST_PLAN}"
    exit 1
fi

if [ ! -f "${JMETER_BIN}" ]; then
    echo "ERROR: JMeter binary not found at ${JMETER_BIN}"
    exit 1
fi

echo "Starting JMeter execution..."
exec "${JMETER_BIN}" \
    -n \
    -t "${TEST_PLAN}" \
    -l "${RESULTS_DIR}/results.jtl" \
    -j "${RESULTS_DIR}/jmeter.log" \
    -Jjmeterengine.force.system.exit=true \
    -Jjmeter.save.saveservice.output_format=xml \
    -Jjmeter.save.saveservice.print_field_names=true \
    -Jjmeter.save.saveservice.response_data=true \
    -Jjmeter.save.saveservice.samplerData=true \
    -Jjmeter.save.saveservice.requestHeaders=true \
    -Jjmeter.save.saveservice.url=true \
    -Jjmeter.save.saveservice.responseHeaders=true \
    -Jjmeter.save.saveservice.timestamp_format=ms \
    -Jjmeter.save.saveservice.bytes=true \
    -Jjmeter.save.saveservice.connect_time=true

EXIT_CODE=$?

echo "=========================================="
echo "JMeter execution completed"
echo "Exit code: ${EXIT_CODE}"
echo "Results:   ${RESULTS_DIR}/results.jtl"
echo "Log:       ${RESULTS_DIR}/jmeter.log"
echo "=========================================="

exit ${EXIT_CODE}
