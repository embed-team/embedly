import { Events, Listener } from "@sapphire/framework";
import { MessageFlags, type Message } from "discord.js";

import type { EmbedFlags } from "../lib/builder";
import { handleUrls, type EmbedURLRequest } from "../lib/handleUrls";
import { extractURLs, isSpoiler } from "../lib/utils";

function parseMessageURLs(content: string) {
  const urls: EmbedURLRequest[] = [];
  let suppressNativeEmbeds = true;

  for (const match of extractURLs(content)) {
    const before = content.slice(0, match.index);
    const after = content.slice(match.endIndex);

    if (before.endsWith("<") && after.startsWith(">")) continue;

    if (before.endsWith("~")) {
      suppressNativeEmbeds = false;
      continue;
    }

    const flags: Partial<EmbedFlags> = {
      Spoiler: isSpoiler(match.url, content),
    };
    let force = false;

    if (before.endsWith("?@")) {
      flags.SourceOnly = true;
      force = true;
    } else if (before.endsWith("?!")) {
      flags.MediaOnly = true;
      force = true;
    } else if (before.endsWith("@")) {
      flags.SourceOnly = true;
    } else if (before.endsWith("!")) {
      flags.MediaOnly = true;
    } else if (before.endsWith("?")) {
      force = true;
    }

    urls.push({ url: match.url, flags, force });
  }

  return { urls, suppressNativeEmbeds };
}

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
