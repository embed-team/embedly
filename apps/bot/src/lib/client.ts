import { resolve } from "node:path";

import type { AppType } from "@embedly/api";
import { container, SapphireClient } from "@sapphire/framework";
import { ActivityType, GatewayIntentBits, Partials, PresenceUpdateStatus } from "discord.js";
import { hc } from "hono/client";

import { MessageCache } from "./messageCache";
export class EmbedlyClient extends SapphireClient {
  public constructor() {
    super({
      baseUserDirectory: resolve(import.meta.dirname, ".."),
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message],
      presence: {
        activities: [
          {
            state: "Better embeds = Better Conversations",
            type: ActivityType.Custom,
            name: "Embedly",
          },
        ],
        afk: false,
        status: PresenceUpdateStatus.Online,
      },
    });
  }

  public override async login(token?: string) {
    container.api = hc<AppType>(process.env.EMBEDLY_API_DOMAIN ?? "http://localhost:8787");
    container.messageCache = await MessageCache.connect();
    return super.login(token);
  }

  public override async destroy() {
    await container.messageCache?.close();
    return super.destroy();
  }
}

declare module "@sapphire/framework" {
  interface Container {
    api: ReturnType<typeof hc<AppType>>;
    messageCache: MessageCache;
  }
}
