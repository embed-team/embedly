import { Logtail } from "@logtail/node";
import { container, SapphireClient } from "@sapphire/framework";
import {
  ActivityType,
  GatewayIntentBits,
  PresenceUpdateStatus
} from "discord.js";
import { PostHog } from "posthog-node";

declare module "@sapphire/framework" {
  interface Container {
    betterstack: Logtail;
    embed_authors: Map<string, string>;
    posthog: PostHog;
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
    container.posthog = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.POSTHOG_HOST
    });
    return super.login(token);
  }

  public override async destroy() {
    await container.betterstack?.flush();
    await container.posthog.shutdown();
    return super.destroy();
  }
}
