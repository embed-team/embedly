import { SapphireClient } from "@sapphire/framework";
import {
  ActivityType,
  GatewayIntentBits,
  PresenceUpdateStatus
} from "discord.js";

const client = new SapphireClient({
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

client.login(process.env.DISCORD_BOT_TOKEN);
