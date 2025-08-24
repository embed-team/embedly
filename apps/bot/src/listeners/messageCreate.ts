import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import { Embed } from "@embedly/builder";
import {
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink
} from "@embedly/parser";
import Platforms from "@embedly/platforms";
import { Events, Listener } from "@sapphire/framework";
import { type Message, MessageFlags } from "discord.js";

const app = treaty<App>(process.env.EMBEDLY_API_DOMAIN!);

export class MessageListener extends Listener<
  typeof Events.MessageCreate
> {
  public constructor(
    context: Listener.LoaderContext,
    options: Listener.Options
  ) {
    super(context, {
      ...options,
      event: Events.MessageCreate
    });
  }

  public async run(message: Message) {
    this.container.client.id ??= this.container.client.user?.id ?? null;

    if (message.author.bot) return;
    if (message.author.id === this.container.client.id) return;
    if (!hasLink(message.content)) return;
    const url = GENERIC_LINK_REGEX.exec(message.content)?.[0]!;
    const platform = getPlatformFromURL(url);
    if (!platform) return;

    const { data, error } = await app.api.scrape.post(
      {
        platform: platform.type,
        url
      },
      {
        headers: {
          authorization: `Bearer ${process.env.DISCORD_BOT_TOKEN}`
        }
      }
    );
    if (error) return;

    const embed = Platforms[platform.type].createEmbed(data);

    await Promise.all([
      message.reply({
        components: [Embed.getDiscordEmbed(embed)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          parse: [],
          repliedUser: false
        }
      }),
      message.edit({ flags: MessageFlags.SuppressEmbeds })
    ]);
  }
}
