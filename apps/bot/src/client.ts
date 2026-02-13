import type { FormattedLog } from "@embedly/logging";
import { type Tracer, trace } from "@opentelemetry/api";
import {
  logs,
  type Logger as OtelLogger,
  SeverityNumber
} from "@opentelemetry/api-logs";
import {
  container,
  type ILogger,
  LogLevel,
  SapphireClient
} from "@sapphire/framework";
import {
  ActivityType,
  GatewayIntentBits,
  Partials,
  PresenceUpdateStatus
} from "discord.js";
import { PostHog } from "posthog-node";

class EmbedlyLogger implements ILogger {
  private otel: OtelLogger;

  constructor(name: string) {
    this.otel = logs.getLogger(name);
  }

  has(level: LogLevel): boolean {
    return level >= LogLevel.Info;
  }

  trace() {}

  debug() {}

  info(...values: readonly unknown[]) {
    this.emit(SeverityNumber.INFO, "INFO", values);
  }

  warn(...values: readonly unknown[]) {
    this.emit(SeverityNumber.WARN, "WARN", values);
  }

  error(...values: readonly unknown[]) {
    this.emit(SeverityNumber.ERROR, "ERROR", values);
  }

  fatal(...values: readonly unknown[]) {
    this.emit(SeverityNumber.FATAL, "FATAL", values);
  }

  write(level: LogLevel, ...values: readonly unknown[]) {
    const severityMap: Record<LogLevel, [SeverityNumber, string]> = {
      [LogLevel.Trace]: [SeverityNumber.TRACE, "TRACE"],
      [LogLevel.Debug]: [SeverityNumber.DEBUG, "DEBUG"],
      [LogLevel.Info]: [SeverityNumber.INFO, "INFO"],
      [LogLevel.Warn]: [SeverityNumber.WARN, "WARN"],
      [LogLevel.Error]: [SeverityNumber.ERROR, "ERROR"],
      [LogLevel.Fatal]: [SeverityNumber.FATAL, "FATAL"],
      [LogLevel.None]: [SeverityNumber.UNSPECIFIED, "UNSPECIFIED"]
    };
    const [num, text] = severityMap[level] ?? [
      SeverityNumber.INFO,
      "INFO"
    ];
    this.emit(num, text, values);
  }

  private static readonly consoleMethods: Record<
    string,
    (...args: unknown[]) => void
  > = {
    TRACE: console.trace,
    DEBUG: console.debug,
    INFO: console.info,
    WARN: console.warn,
    ERROR: console.error,
    FATAL: console.error
  };

  private emit(
    severityNumber: SeverityNumber,
    severityText: string,
    values: readonly unknown[]
  ) {
    const consoleMethod =
      EmbedlyLogger.consoleMethods[severityText] ?? console.log;
    const first = values[0];
    if (
      first &&
      typeof first === "object" &&
      "body" in first &&
      "attributes" in first
    ) {
      const log = first as FormattedLog;
      consoleMethod(log.body, log.attributes);
      this.otel.emit({
        severityNumber,
        severityText,
        body: log.body,
        attributes: log.attributes
      });
    } else {
      consoleMethod(...values);
      this.otel.emit({
        severityNumber,
        severityText,
        body: values.map(String).join(" ")
      });
    }
  }
}

declare module "@sapphire/framework" {
  interface Container {
    embed_authors: Map<string, string>;
    embed_messages: Map<string, string[]>;
    posthog: PostHog;
    tracer: Tracer;
  }
}

export class EmbedlyClient extends SapphireClient {
  public constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
      partials: [Partials.Message],
      presence: {
        activities: [
          {
            state: "Better embeds = Better Conversations",
            type: ActivityType.Custom,
            name: "Embedly"
          }
        ],
        afk: false,
        status: PresenceUpdateStatus.Online
      }
    });
  }

  public override async login(token?: string) {
    container.logger = new EmbedlyLogger("embedly-bot");
    container.embed_authors = new Map();
    container.embed_messages = new Map();
    container.posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.POSTHOG_HOST
    });
    container.tracer = trace.getTracer("embedly-bot");
    return super.login(token);
  }

  public override async destroy() {
    const provider = logs.getLoggerProvider() as {
      forceFlush?: () => Promise<void>;
    };
    await provider.forceFlush?.();
    await container.posthog.shutdown();
    return super.destroy();
  }
}
