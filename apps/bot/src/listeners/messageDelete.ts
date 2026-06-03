import { Events, Listener } from "@sapphire/framework";
import type { Message, PartialMessage } from "discord.js";

export class MessageDeleteListener extends Listener<typeof Events.MessageDelete> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageDelete,
    });
  }

  public async run(message: Message | PartialMessage) {
    const botMessageIds = await this.container.messageCache.deleteSourceMessage(message.id);
    if (botMessageIds.length === 0) return;

    for (const botMessageId of botMessageIds) {
      try {
        const botMessage = await message.channel.messages.fetch(botMessageId);
        await botMessage.delete();
      } catch {}
    }
  }
}
