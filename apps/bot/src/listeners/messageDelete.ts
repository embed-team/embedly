import { EMBEDLY_AUTO_DELETE_INFO, formatLog } from "@embedly/logging";
import { Events, Listener } from "@sapphire/framework";
import type { Message, PartialMessage } from "discord.js";

export class MessageDeleteListener extends Listener<
  typeof Events.MessageDelete
> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options
  ) {
    super(context, {
      ...options,
      event: Events.MessageDelete
    });
  }

  public async run(message: Message | PartialMessage) {
    const bot_message_ids = this.container.embed_messages.get(
      message.id
    );
    if (!bot_message_ids) return;

    for (const bot_msg_id of bot_message_ids) {
      try {
        const bot_msg =
          await message.channel.messages.fetch(bot_msg_id);
        await bot_msg.delete();
      } catch {}
      this.container.embed_authors.delete(bot_msg_id);
    }

    this.container.embed_messages.delete(message.id);

    this.container.logger.info(
      formatLog(EMBEDLY_AUTO_DELETE_INFO, {
        message_id: message.id,
        user_id: message.author?.id,
        original_author_id: message.author?.id
      })
    );
  }
}
