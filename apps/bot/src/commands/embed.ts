import { matchURL } from "@embedly/platforms";
import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
} from "discord.js";

import { buildEmbed } from "../builder";
import { extractURLs } from "../utils";
export class EmbedCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Enrich the embeds of social media links",
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry
      .registerChatInputCommand((command) =>
        command
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((opt) =>
            opt.setName("url").setDescription("Link to content").setRequired(true),
          )
          .addBooleanOption((opt) =>
            opt.setName("media_only").setDescription("Display the media only"),
          )
          .addBooleanOption((opt) =>
            opt
              .setName("source_only")
              .setDescription("Show only the original post (no reply chains or quotes)"),
          )
          .addBooleanOption((opt) =>
            opt.setName("spoiler").setDescription("Hide embed content behind spoiler"),
          )
          .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
          )
          .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
          ),
      )
      .registerContextMenuCommand((command) =>
        command
          .setName("Embed Links")
          .setType(ApplicationCommandType.Message)
          .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
          )
          .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall,
          ),
      );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const url = interaction.options.getString("url", true);
    const urls = extractURLs(url);
    if (urls.length === 0) {
      return await interaction.reply({
        content: "No URLs Found.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const matches = (
      await Promise.all(
        urls.map(async (url) => {
          const match = await matchURL(url);
          return match ? { url, ...match } : null;
        }),
      )
    ).filter((m) => m !== null);

    if (matches.length === 0) {
      return await interaction.reply({
        content: "Failed to find any matching platforms.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferReply();

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
      await interaction.editReply({
        components: [
          buildEmbed(post, {
            MediaOnly: interaction.options.getBoolean("media_only") ?? false,
            SourceOnly: interaction.options.getBoolean("source_only") ?? false,
            Spoiler: interaction.options.getBoolean("spoiler") ?? false,
          })!,
        ],
        flags: [MessageFlags.IsComponentsV2],
        allowedMentions: {
          parse: [],
          repliedUser: false,
        },
      });
    }

    return;
  }
}
