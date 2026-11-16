{{/* Release-scoped name, truncated to the 63-char DNS label limit. */}}
{{- define "aip.fullname" -}}
{{- if contains .Chart.Name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "aip.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: aip
{{- end -}}

{{/* Usage: include "aip.selectorLabels" (dict "root" $ "component" "api") */}}
{{- define "aip.selectorLabels" -}}
app.kubernetes.io/name: {{ .root.Chart.Name }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* Usage: include "aip.componentName" (dict "root" $ "component" "api") */}}
{{- define "aip.componentName" -}}
{{- printf "%s-%s" (include "aip.fullname" .root) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Image reference; digest wins over tag. Usage: include "aip.image" (dict "root" $ "image" $c.image) */}}
{{- define "aip.image" -}}
{{- $repo := printf "%s/%s" (.root.Values.global.imageRegistry | trimSuffix "/") .image.repository -}}
{{- if .image.digest -}}
{{- printf "%s@%s" $repo .image.digest -}}
{{- else -}}
{{- printf "%s:%s" $repo (.image.tag | default .root.Chart.AppVersion) -}}
{{- end -}}
{{- end -}}

{{- define "aip.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- .Values.serviceAccount.name | default (include "aip.fullname" .) -}}
{{- else -}}
{{- .Values.serviceAccount.name | default "default" -}}
{{- end -}}
{{- end -}}

{{- define "aip.installSecretName" -}}
{{- printf "%s-install" (include "aip.fullname" .) -}}
{{- end -}}

{{/*
Installation ID: explicit value > existing Secret (kept across upgrades) > new UUID.
Only rendered once (in the install Secret); workloads read it via secretKeyRef, so
multiple renders can never disagree.
*/}}
{{- define "aip.installId" -}}
{{- if .Values.telemetry.installId -}}
{{- .Values.telemetry.installId -}}
{{- else -}}
{{- $existing := lookup "v1" "Secret" .Release.Namespace (include "aip.installSecretName" .) -}}
{{- if and $existing $existing.data (hasKey $existing.data "installId") -}}
{{- index $existing.data "installId" | b64dec -}}
{{- else -}}
{{- uuidv4 -}}
{{- end -}}
{{- end -}}
{{- end -}}
