import { Events, Listener } from "@sapphire/framework";
import { MessageFlags, type Message, type PartialMessage } from "discord.js";

export class MessageUpdateListener extends Listener<typeof Events.MessageUpdate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageUpdate,
    });
  }

  public async run(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    if (oldMessage.embeds.length > 0) return;
    if (newMessage.embeds.length === 0) return;
    if (newMessage.flags.has(MessageFlags.SuppressEmbeds)) return;

    const message = newMessage.partial ? await newMessage.fetch() : newMessage;
    if (message.author?.bot) return;
    if (message.author?.id === this.container.client.id) return;

    const botMessageIds = await this.container.messageCache.getBotMessageIds(message.id);
    if (botMessageIds.length === 0) return;

    await message.edit({ flags: MessageFlags.SuppressEmbeds });
  }
}
