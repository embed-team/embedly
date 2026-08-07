import { EmbedlyErrors, EmbedlyLogs, formatLog, getErrorContext } from "@embedly/logging";
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
    const requestId = `message:${message.id}`;
    const botMessageIds = await this.container.messageCache.getBotMessageIds(message.id);
    if (botMessageIds.length === 0) return;

    let deletedCount = 0;
    for (const botMessageId of botMessageIds) {
      try {
        const botMessage = await message.channel.messages.fetch(botMessageId);
        await botMessage.delete();
        deletedCount++;
      } catch (error) {
        this.container.logger.warn(
          formatLog("warn", EmbedlyErrors.DeleteFailed, {
            request_id: requestId,
            message_id: message.id,
            bot_message_id: botMessageId,
            ...getErrorContext(error),
          }),
        );
        continue;
      }

      try {
        await this.container.messageCache.removeBotMessage(botMessageId);
      } catch (error) {
        this.container.logger.warn(
          formatLog("warn", EmbedlyErrors.MessageCacheFailed, {
            request_id: requestId,
            message_id: message.id,
            bot_message_id: botMessageId,
            ...getErrorContext(error),
          }),
        );
      }
    }

    const failedCount = botMessageIds.length - deletedCount;
    const context = {
      request_id: requestId,
      message_id: message.id,
      bot_message_count: botMessageIds.length,
      deleted_count: deletedCount,
      failed_count: failedCount,
    };
    if (failedCount > 0) {
      this.container.logger.warn(formatLog("warn", EmbedlyErrors.DeleteFailed, context));
      return;
    }

    this.container.logger.info(formatLog("info", EmbedlyLogs.AutoDeleteSucceeded, context));
  }
}
