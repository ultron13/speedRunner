{{/*
Expand the name of the chart.
*/}}
{{- define "speedrunner.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "speedrunner.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "speedrunner.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "speedrunner.labels" -}}
helm.sh/chart: {{ include "speedrunner.chart" . }}
{{ include "speedrunner.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "speedrunner.selectorLabels" -}}
app.kubernetes.io/name: {{ include "speedrunner.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "speedrunner.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "speedrunner.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Redis host - use service name if standalone is enabled
*/}}
{{- define "speedrunner.redisHost" -}}
{{- if .Values.redis.host }}
{{- .Values.redis.host }}
{{- else if .Values.redisStandalone.enabled }}
{{- include "speedrunner.fullname" . }}-redis
{{- else }}
localhost
{{- end }}
{{- end }}

{{/*
PostgreSQL host - use service name if standalone is enabled
*/}}
{{- define "speedrunner.postgresHost" -}}
{{- if .Values.postgres.host }}
{{- .Values.postgres.host }}
{{- else if .Values.postgresStandalone.enabled }}
{{- include "speedrunner.fullname" . }}-postgres
{{- else }}
localhost
{{- end }}
{{- end }}
