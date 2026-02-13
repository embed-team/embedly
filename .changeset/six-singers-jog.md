---
"@embedly/platforms": minor
"@embedly/logging": minor
"@embedly/api": minor
"@embedly/bot": minor
---

Replace BetterStack (Logtail) with OTEL-native logging for LGTM stack. Logs now flow through OpenTelemetry to Loki alongside traces and metrics. Added EmbedlyLogger class, platform and source labels for Grafana indexing, and trace correlation for the API.
