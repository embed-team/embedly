import { Events, Listener } from "@sapphire/framework";
import { MessageFlags, type Message } from "discord.js";

import { handleUrls, parseMessageURLs } from "../lib/handleUrls";

export class MessageCreateListener extends Listener<typeof Events.MessageCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageCreate,
    });
  }

  public async run(msg: Message) {
    if (msg.author.bot) return;
    if (msg.author.id === this.container.client.id) return;

    const { urls, suppressNativeEmbeds } = parseMessageURLs(msg.content);
    const sentEmbed = await handleUrls(urls, msg);
    if (!sentEmbed) return;
    if (!suppressNativeEmbeds) return;
    if (msg.embeds.length === 0) return;

    await msg.edit({ flags: MessageFlags.SuppressEmbeds });
  }
}
