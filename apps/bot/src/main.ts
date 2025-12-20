import { EmbedlyClient } from "./client.ts";

const client = new EmbedlyClient();

client.login(process.env.DISCORD_BOT_TOKEN);
