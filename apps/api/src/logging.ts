import { formatLog, type EmbedlyEvent, type LogContext, type LogLevel } from "@embedly/logging";
import { context as otelContext } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { LoggerProvider, SimpleLogRecordProcessor } from "@opentelemetry/sdk-logs";

import { version } from "../package.json";

const severityNumbers = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};
const resource = resourceFromAttributes({
  "service.name": "embedly-api",
  "service.version": version,
});

export async function log(
  endpoint: string,
  level: LogLevel,
  event: EmbedlyEvent,
  context: LogContext,
) {
  const provider = new LoggerProvider({
    resource,
    processors: [
      new SimpleLogRecordProcessor(
        new OTLPLogExporter({
          url: endpoint.replace(/\/v1\/traces\/?$/, "").replace(/\/$/, "") + "/v1/logs",
          timeoutMillis: 5000,
        }),
      ),
    ],
  });
  const body = formatLog(level, event, context);
  console[level](body);
  provider.getLogger("embedly-api").emit({
    context: otelContext.active(),
    severityNumber: severityNumbers[level],
    severityText: level.toUpperCase(),
    body,
    attributes: {
      "event.name": event.type,
      ...Object.fromEntries(Object.entries(context).filter(([, value]) => value != null)),
    },
  });
  await provider.shutdown();
}
