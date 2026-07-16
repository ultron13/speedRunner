#!/usr/bin/env bash
set -euo pipefail

RUN_ID="${1:-run-$(date +%s)}"
TARGET_URL="${2:-http://httpbin.org}"
VIRTUAL_USERS="${3:-5}"
DURATION="${4:-30}"
RAMP_UP="${5:-10}"
NAMESPACE="marathonrunner-execution"

echo "============================================"
echo " MarathonRunner - JMeter Test Execution"
echo "============================================"
echo ""
echo "Run ID:        $RUN_ID"
echo "Target:        $TARGET_URL"
echo "Virtual Users: $VIRTUAL_USERS"
echo "Duration:      ${DURATION}s"
echo "Ramp-up:       ${RAMP_UP}s"
echo "Namespace:     $NAMESPACE"
echo ""

# Create JMeter ConfigMap with test plan
cat << EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: jmeter-test-plan-${RUN_ID}
  namespace: ${NAMESPACE}
  labels:
    app: jmeter
    run-id: ${RUN_ID}
    app.kubernetes.io/part-of: speedrunner
data:
  test-plan.jmx: |
    <?xml version="1.0" encoding="UTF-8"?>
    <jmeterTestPlan version="1.2" properties="5.0" jmeter="5.6.3">
      <hashTree>
        <TestPlan guiclass="TestPlanGui" testclass="TestPlan" testname="MarathonRunner Test" enabled="true">
          <boolProp name="TestPlan.functional_mode">false</boolProp>
          <boolProp name="TestPlan.serialize_threadgroups">false</boolProp>
          <elementProp name="TestPlan.user_defined_variables" elementType="Arguments">
            <collectionProp name="Arguments.arguments"/>
          </elementProp>
        </TestPlan>
        <hashTree>
          <ThreadGroup guiclass="ThreadGroupGui" testclass="ThreadGroup" testname="Load Test" enabled="true">
            <intProp name="ThreadGroup.num_threads">${VIRTUAL_USERS}</intProp>
            <intProp name="ThreadGroup.ramp_time">${RAMP_UP}</intProp>
            <boolProp name="ThreadGroup.scheduler">true</boolProp>
            <stringProp name="ThreadGroup.duration">${DURATION}</stringProp>
            <stringProp name="ThreadGroup.delay">0</stringProp>
            <stringProp name="ThreadGroup.on_sample_error">continue</stringProp>
          </ThreadGroup>
          <hashTree>
            <HTTPSamplerProxy guiclass="HttpTestSampleGui" testclass="HTTPSamplerProxy" testname="HTTP Request" enabled="true">
              <stringProp name="HTTPSampler.domain">${TARGET_URL}</stringProp>
              <stringProp name="HTTPSampler.path">/</stringProp>
              <stringProp name="HTTPSampler.method">GET</stringProp>
              <boolProp name="HTTPSampler.follow_redirects">true</boolProp>
            </HTTPSamplerProxy>
            <hashTree/>
          </hashTree>
        </hashTree>
      </hashTree>
    </jmeterTestPlan>
EOF

echo "Test plan ConfigMap created."

# Create JMeter Job
cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: jmeter-${RUN_ID}
  namespace: ${NAMESPACE}
  labels:
    app: jmeter
    run-id: ${RUN_ID}
    app.kubernetes.io/part-of: speedrunner
    app.kubernetes.io/component: execution
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 300
  template:
    metadata:
      labels:
        app: jmeter
        run-id: ${RUN_ID}
        app.kubernetes.io/part-of: speedrunner
    spec:
      restartPolicy: Never
      containers:
        - name: jmeter
          image: speedrunner/jmeter:latest
          imagePullPolicy: IfNotPresent
          env:
            - name: RUN_ID
              value: "${RUN_ID}"
            - name: TARGET_URL
              value: "${TARGET_URL}"
            - name: VIRTUAL_USERS
              value: "${VIRTUAL_USERS}"
            - name: DURATION
              value: "${DURATION}"
            - name: RAMP_UP
              value: "${RAMP_UP}"
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          volumeMounts:
            - name: test-plan
              mountPath: /test-plan
              readOnly: true
            - name: results
              mountPath: /results
      volumes:
        - name: test-plan
          configMap:
            name: jmeter-test-plan-${RUN_ID}
        - name: results
          emptyDir: {}
EOF

echo ""
echo "JMeter Job created: jmeter-${RUN_ID}"
echo ""
echo "Monitor with:"
echo "  kubectl get pods -n ${NAMESPACE} -l run-id=${RUN_ID} -w"
echo "  kubectl logs -f job/jmeter-${RUN_ID} -n ${NAMESPACE}"
echo ""
echo "Job will auto-cleanup after 5 minutes."
