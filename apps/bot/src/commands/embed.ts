import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
} from "discord.js";

import { handleUrls } from "../lib/handleUrls";
import { extractURLs } from "../lib/utils";

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
          .addBooleanOption((opt) =>
            opt.setName("force").setDescription("Force the bot to re-fetch the post."),
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

  public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const msg = interaction.targetMessage;
    await handleUrls(
      extractURLs(msg.content).map(({ url }) => ({ url })),
      interaction,
      { source: "context_menu" },
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const url = interaction.options.getString("url", true);
    await handleUrls(
      extractURLs(url).map(({ url }) => ({
        url,
        flags: {
          MediaOnly: interaction.options.getBoolean("media_only") ?? false,
          SourceOnly: interaction.options.getBoolean("source_only") ?? false,
          Spoiler: interaction.options.getBoolean("spoiler") ?? false,
        },
        force: interaction.options.getBoolean("force") ?? false,
      })),
      interaction,
      { source: "command" },
    );
  }
}
