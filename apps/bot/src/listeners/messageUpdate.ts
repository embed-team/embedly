import { Events, Listener } from "@sapphire/framework";
import { MessageFlags, type Message, type PartialMessage } from "discord.js";

import { handleUrls, parseMessageURLs, type EmbedURLRequest } from "../lib/handleUrls";

function hasSameOptions(left: EmbedURLRequest, right: EmbedURLRequest) {
  return (
    left.force === right.force &&
    left.flags?.MediaOnly === right.flags?.MediaOnly &&
    left.flags?.SourceOnly === right.flags?.SourceOnly &&
    left.flags?.Spoiler === right.flags?.Spoiler
  );
}

export class MessageUpdateListener extends Listener<typeof Events.MessageUpdate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: Events.MessageUpdate,
    });
  }

  public async run(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
    const message = newMessage.partial ? await newMessage.fetch() : newMessage;
    if (message.author?.bot) return;
    if (message.author?.id === this.container.client.id) return;

    const botMessages = await this.container.messageCache.getBotMessages(message.id);
    if (botMessages.length === 0) return;

    if (typeof oldMessage.content === "string" && oldMessage.content !== message.content) {
      const oldUrls = parseMessageURLs(oldMessage.content).urls;
      const newUrls = parseMessageURLs(message.content).urls;
      const sameUrls =
        oldUrls.length === newUrls.length &&
        oldUrls.every((request, index) => request.url === newUrls[index]?.url);

      if (sameUrls) {
        const updateTargets = new Map<number, string>();

        for (const { id, requestIndex } of botMessages) {
          if (requestIndex === undefined) continue;
          const oldRequest = oldUrls[requestIndex];
          const newRequest = newUrls[requestIndex];
          if (!oldRequest || !newRequest) continue;
          if (hasSameOptions(oldRequest, newRequest)) continue;
          updateTargets.set(requestIndex, id);
        }

        if (updateTargets.size > 0) {
          await handleUrls(newUrls, message, { updateTargets });
        }
      }
    }

    if (oldMessage.embeds.length > 0) return;
    if (message.embeds.length === 0) return;
    if (message.flags.has(MessageFlags.SuppressEmbeds)) return;
    await message.edit({ flags: MessageFlags.SuppressEmbeds });
  }
}
