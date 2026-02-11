import {
  DiagConsoleLogger,
  DiagLogLevel,
  diag
} from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://lgtm:4317";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "embedly-bot"
  }),
  traceExporter: new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`
    })
  }),
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingRequestHook: () => true,
      ignoreOutgoingRequestHook: (request) => {
        const host =
          typeof request === "string"
            ? request
            : (request.hostname ?? request.host ?? "");

        return (
          host.includes("discord.gg") || host.includes("discord.com")
        );
      }
    })
  ]
});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

sdk.start();
