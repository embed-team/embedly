import { Logtail } from "@logtail/node";
import { container, SapphireClient } from "@sapphire/framework";
import {
  ActivityType,
  GatewayIntentBits,
  PresenceUpdateStatus
} from "discord.js";

declare module "@sapphire/framework" {
  interface Container {
    betterstack: Logtail;
    embed_authors: Map<string, string>;
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
    return super.login(token);
  }

  public override destroy() {
    container.betterstack?.flush();
    return super.destroy();
  }
}
