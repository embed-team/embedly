import { SapphireClient } from "@sapphire/framework";
import { ActivityType, GatewayIntentBits, Partials, PresenceUpdateStatus } from "discord.js";

export class EmbedlyClient extends SapphireClient {
  public constructor() {
    super({
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
    return super.login(token);
  }

  public override async destroy() {
    return super.destroy();
  }
}
