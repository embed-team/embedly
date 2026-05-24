import { matchURL } from "@embedly/platforms";
import { Events, Listener } from "@sapphire/framework";
import { MessageFlags, type Message } from "discord.js";

import { buildEmbed } from "../lib/builder";
import { extractURLs } from "../lib/utils";

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
    const urls = extractURLs(msg.content);
    if (urls.length === 0) return;

    const matches = (
      await Promise.all(
        urls.map(async (url) => {
          const match = await matchURL(url);
          return match ? { url, ...match } : null;
        }),
      )
    ).filter((m) => m !== null);

    if (matches.length === 0) return;

    for (const [_i, { platform, id }] of matches.entries()) {
      const req = await this.container.api.platforms.scrape.$post(
        { json: { platform, id } },
        {
          headers: {
            Authorization: `Bearer ${process.env.EMBEDLY_AUTH_SECRET}`,
          },
        },
      );
      const post = await req.json();

      await msg.reply({
        components: [buildEmbed(post)!],
        flags: [MessageFlags.IsComponentsV2],
        allowedMentions: {
          parse: [],
          repliedUser: false,
        },
      });
    }

    await msg.edit({ flags: MessageFlags.SuppressEmbeds });
  }
}
