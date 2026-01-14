import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import {
  Embed,
  EmbedFlagNames,
  type EmbedFlags
} from "@embedly/builder";
import {
  EMBEDLY_EMBED_CREATED_MESSAGE,
  type EmbedlyInteractionContext,
  type EmbedlyPostContext,
  formatBetterStack
} from "@embedly/logging";
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
      if (error) {
        if ("detail" in error.value) {
          const error_context: EmbedlyInteractionContext &
            EmbedlyPostContext = {
            ...error.value.context,
            message_id: message.id,
            user_id: message.author.id
          };
          this.container.betterstack.error(
            ...formatBetterStack(error.value, error_context)
          );
        }
        return;
      }

      const embed = await Platforms[platform.type].createEmbed(data);
      const link_style = (await this.container.posthog.getFeatureFlag(
        "embed-link-styling-test",
        message.author.id
      )) as EmbedFlags[EmbedFlagNames.LinkStyle] | undefined;
      const msg = {
        components: [
          Embed.getDiscordEmbed(embed, {
            [EmbedFlagNames.Spoiler]: isSpoiler(url, message.content),
            [EmbedFlagNames.LinkStyle]: link_style ?? "control"
          })!
        ],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: {
          parse: [],
          repliedUser: false
        }
      } as const;
      const bot_message =
        ind > 0 && message.channel.isSendable()
          ? await message.channel.send(msg)
          : await message.reply(msg);
      this.container.embed_authors.set(
        bot_message.id,
        message.author.id
      );
      this.container.betterstack.info(
        ...formatBetterStack(EMBEDLY_EMBED_CREATED_MESSAGE, {
          user_message_id: message.id,
          bot_message_id: bot_message.id,
          user_id: message.author.id,
          platform: platform.type,
          url
        })
      );
    }
    await message.edit({ flags: MessageFlags.SuppressEmbeds });
  }
}
