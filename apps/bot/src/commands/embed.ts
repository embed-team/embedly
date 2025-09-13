import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import { Embed, EmbedFlags } from "@embedly/builder";
import {
  EMBEDLY_NO_LINK_IN_MESSAGE,
  EMBEDLY_NO_VALID_LINK,
  type EmbedlyInteractionContext,
  formatDiscord
} from "@embedly/logging";
import {
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink
} from "@embedly/parser";
import Platforms from "@embedly/platforms";
import { Command } from "@sapphire/framework";
import { ApplicationCommandType } from "discord.js";

const app = treaty<App>(process.env.EMBEDLY_API_DOMAIN!);

export class EmbedCommand extends Command {
  public constructor(
    context: Command.LoaderContext,
    options: Command.Options
  ) {
    super(context, {
      ...options,
      description: "Enrich the embeds of social media links"
    });
  }

  public override registerApplicationCommands(
    registry: Command.Registry
  ) {
    registry
      .registerChatInputCommand((command) =>
        command
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((opt) =>
            opt
              .setName("url")
              .setDescription("Link to content")
              .setRequired(true)
          )
          .addBooleanOption((opt) =>
            opt
              .setName("media_only")
              .setDescription("Display the media only")
          )
          .addBooleanOption((opt) =>
            opt
              .setName("spoiler")
              .setDescription("Hide embed content behind spoiler")
          )
      )
      .registerContextMenuCommand((command) =>
        command
          .setName("Embed Links")
          .setType(ApplicationCommandType.Message)
      );
  }

  async fetchEmbed(
    interaction:
      | Command.ChatInputCommandInteraction
      | Command.ContextMenuCommandInteraction,
    content: string,
    flags?: Partial<Record<EmbedFlags, boolean>>
  ) {
    const log_ctx = {
      interaction_id: interaction.id,
      user_id: interaction.user.id
    } satisfies EmbedlyInteractionContext;
    if (!hasLink(content)) {
      return await interaction.reply({
        content: formatDiscord(EMBEDLY_NO_LINK_IN_MESSAGE, log_ctx),
        flags: ["Ephemeral"]
      });
    }
    const url = GENERIC_LINK_REGEX.exec(content)?.[0]!;
    const platform = getPlatformFromURL(url);
    if (!platform) {
      return await interaction.reply({
        content: formatDiscord(EMBEDLY_NO_VALID_LINK, log_ctx),
        flags: ["Ephemeral"]
      });
    }

    await interaction.deferReply();

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

    if (error?.status === 400 || error?.status === 500) {
      return await interaction.editReply({
        content: formatDiscord(error.value, {
          ...log_ctx,
          ...error.value.context!
        })
      });
    }

    try {
      const embed = Platforms[platform.type].createEmbed(data);
      return await interaction.editReply({
        components: [Embed.getDiscordEmbed(embed, flags)],
        flags: ["IsComponentsV2"],
        allowedMentions: {
          parse: [],
          repliedUser: false
        }
      });
    } catch (error) {
      console.error(error);
      return await interaction.editReply({
        content: formatDiscord(
          Platforms[platform.type].log_messages.failed,
          {
            ...log_ctx,
            platform: platform.type,
            post_id: await Platforms[platform.type].parsePostId(url),
            post_url: url
          }
        )
      });
    }
  }

  public override async contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction
  ) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const msg = interaction.targetMessage;
    this.fetchEmbed(interaction, msg.content);
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const url = interaction.options.getString("url", true);
    this.fetchEmbed(interaction, url, {
      [EmbedFlags.MediaOnly]:
        interaction.options.getBoolean("media_only") ?? false,
      [EmbedFlags.Spoiler]:
        interaction.options.getBoolean("spoiler") ?? false
    });
  }
}
