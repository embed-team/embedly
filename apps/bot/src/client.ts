import { Logtail } from "@logtail/node";
import { type Tracer, trace } from "@opentelemetry/api";
import { container, SapphireClient } from "@sapphire/framework";
import {
  ActivityType,
  GatewayIntentBits,
  Partials,
  PresenceUpdateStatus
} from "discord.js";
import { PostHog } from "posthog-node";

declare module "@sapphire/framework" {
  interface Container {
    betterstack: Logtail;
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
    container.betterstack = new Logtail(
      process.env.BETTERSTACK_SOURCE_TOKEN!,
      {
        endpoint: process.env.BETTERSTACK_INGESTING_HOST
      }
    );
    container.embed_authors = new Map();
    container.embed_messages = new Map();
    container.posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.POSTHOG_HOST
    });
    container.tracer = trace.getTracer("embedly-bot");
    return super.login(token);
  }

  public override async destroy() {
    await container.betterstack?.flush();
    await container.posthog.shutdown();
    return super.destroy();
  }
}
