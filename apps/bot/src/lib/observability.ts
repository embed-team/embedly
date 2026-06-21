import { type EmbedlyEvent, formatLog, type LogContext, type LogLevel } from "@embedly/logging";
import {
  context,
  metrics,
  propagation,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";
import { container } from "@sapphire/framework";

export const tracer = trace.getTracer("embedly-bot");

const meter = metrics.getMeter("embedly-bot");
const logger = logs.getLogger("embedly-bot");
const serviceName = process.env.OTEL_SERVICE_NAME ?? "embedly-bot";

const severityNumbers = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} satisfies Record<LogLevel, SeverityNumber>;

export const botInvocations = meter.createCounter("embedly_bot_invocations_total");
export const botEmbedsCreated = meter.createCounter("embedly_bot_embeds_created_total");
export const botErrors = meter.createCounter("embedly_bot_errors_total");
export const botRequestDuration = meter.createHistogram("embedly_bot_request_duration_ms", {
  unit: "ms",
});

export async function span<T>(
  name: string,
  attributes: Attributes,
  fn: (activeSpan: Span) => Promise<T>,
) {
  return tracer.startActiveSpan(name, { attributes }, async (activeSpan) => {
    try {
      return await fn(activeSpan);
    } catch (error) {
      recordError(activeSpan, error);
      throw error;
    } finally {
      activeSpan.end();
    }
  });
}

export function recordError(activeSpan: Span, error: unknown) {
  if (error instanceof Error) {
    activeSpan.recordException(error);
    activeSpan.setAttribute("error.type", error.name);
    activeSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
    return;
  }

  activeSpan.setAttribute("error.type", typeof error);
  activeSpan.setStatus({
    code: SpanStatusCode.ERROR,
    message: String(error),
  });
}

export function markError(activeSpan: Span, message: string, attributes?: Attributes) {
  if (attributes) activeSpan.setAttributes(attributes);
  activeSpan.setStatus({
    code: SpanStatusCode.ERROR,
    message,
  });
}

export function injectTraceHeaders(headers: Record<string, string>) {
  propagation.inject(context.active(), headers);
  return headers;
}

export function getActiveTraceContext() {
  const activeSpan = trace.getActiveSpan();
  const spanContext = activeSpan?.spanContext();
  if (!spanContext) return {};

  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
  };
}

export function log(level: LogLevel, event: EmbedlyEvent, logContext?: LogContext) {
  const body = formatLog(level, event, logContext);
  container.logger[level](body);
  logger.emit({
    severityNumber: severityNumbers[level],
    severityText: level.toUpperCase(),
    body,
    attributes: {
      "service.name": serviceName,
      "event.name": event.type,
      "event.title": event.title,
      ...getLogAttributes(logContext),
    },
  });
}

function getLogAttributes(logContext?: LogContext) {
  const attributes: Attributes = {};
  if (!logContext) return attributes;

  for (const [key, value] of Object.entries(logContext)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      attributes[key] = value;
    }
  }

  return attributes;
}
