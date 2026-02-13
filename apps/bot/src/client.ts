import { EmbedlyLogger } from "@embedly/logging";
import { type Tracer, trace } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
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

class SapphireLogger extends EmbedlyLogger implements ILogger {
  has(level: LogLevel): boolean {
    return level >= LogLevel.Info;
  }

  trace() {}

  debug() {}

  write(level: LogLevel, ...values: readonly unknown[]) {
    if (level >= LogLevel.Info) {
      const methods = {
        [LogLevel.Info]: this.info,
        [LogLevel.Warn]: this.warn,
        [LogLevel.Error]: this.error,
        [LogLevel.Fatal]: this.fatal
      } as Record<LogLevel, (...v: readonly unknown[]) => void>;
      methods[level]?.call(this, ...values);
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
    container.logger = new SapphireLogger("embedly-bot");
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
