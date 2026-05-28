import { Events, Listener } from "@sapphire/framework";
import { MessageFlags, type Message } from "discord.js";

import { EmbedCommand } from "../commands/embed";

export class ReadyListener extends Listener<typeof Events.MessageCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageCreate,
    });
  }

  public async run(msg: Message) {
    if (msg.author.bot) return;
    if (msg.author.id === this.container.client.id) return;

    await EmbedCommand.handleUrls(msg.content, {}, false, msg);

    await msg.edit({ flags: MessageFlags.SuppressEmbeds });
  }
}
