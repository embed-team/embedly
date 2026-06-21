import "./otel";
import { EmbedlyClient } from "./lib/client";

const client = new EmbedlyClient();
client.login(process.env.DISCORD_BOT_TOKEN);
