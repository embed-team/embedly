import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import { Embed, EmbedFlags } from "@embedly/builder";
import {
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink,
  isEscaped,
  isSpoiler
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

    const urls = message.content.match(
      new RegExp(GENERIC_LINK_REGEX, "g")
    );
    if (!urls) return;
    for (const [ind, url] of urls.entries()) {
      if (isEscaped(url, message.content)) return;
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

      const embed = await Platforms[platform.type].createEmbed(data);
      const msg = {
        components: [
          Embed.getDiscordEmbed(embed, {
            [EmbedFlags.Spoiler]: isSpoiler(url, message.content)
          })!
        ],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          parse: [],
          repliedUser: false
        }
      } as const;
      if (ind > 0 && message.channel.isSendable()) {
        await message.channel.send(msg);
      } else {
        await message.reply(msg);
      }
    }
    await message.edit({ flags: MessageFlags.SuppressEmbeds });
  }
}
