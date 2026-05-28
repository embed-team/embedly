import { matchURL } from "@embedly/platforms";
import { Command, container } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  Message,
  MessageFlags,
} from "discord.js";

import { buildEmbed, EmbedFlags } from "../lib/builder";
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

  static async handleUrls(
    content: string,
    flags: Partial<EmbedFlags>,
    force: boolean = false,
    interactionOrMessage:
      | Command.ChatInputCommandInteraction
      | Command.ContextMenuCommandInteraction
      | Message,
  ) {
    const isMessage = interactionOrMessage instanceof Message;
    const urls = extractURLs(content);
    if (urls.length === 0) {
      if (isMessage) return;
      return await interactionOrMessage.reply({
        content: "No URLs Found.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    if (!isMessage) await interactionOrMessage.deferReply();

    const matches = (
      await Promise.all(
        urls.map(async (url) => {
          const match = await matchURL(url);
          return match ? { url, ...match } : null;
        }),
      )
    ).filter((m) => m !== null);

    if (!isMessage)
      await interactionOrMessage.editReply({
        content: "No matches found.",
      });

    for (const [i, { platform, id }] of matches.entries()) {
      const req = await container.api.platforms.scrape.$post(
        { json: { platform, id, force } },
        {
          headers: {
            Authorization: `Bearer ${process.env.EMBEDLY_AUTH_SECRET}`,
          },
        },
      );
      const post = await req.json();
      await (
        isMessage
          ? interactionOrMessage.reply
          : i === 0
            ? interactionOrMessage.editReply
            : interactionOrMessage.followUp
      )({
        components: [buildEmbed(post, flags)!],
        flags: [MessageFlags.IsComponentsV2],
        allowedMentions: {
          parse: [],
          repliedUser: false,
        },
      });
    }
    return;
  }

  public override async contextMenuRun(interaction: Command.ContextMenuCommandInteraction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const msg = interaction.targetMessage;
    await EmbedCommand.handleUrls(msg.content, {}, false, interaction);
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    const url = interaction.options.getString("url", true);
    await EmbedCommand.handleUrls(
      url,
      {
        MediaOnly: interaction.options.getBoolean("media_only") ?? false,
        SourceOnly: interaction.options.getBoolean("source_only") ?? false,
        Spoiler: interaction.options.getBoolean("spoiler") ?? false,
      },
      interaction.options.getBoolean("force") ?? false,
      interaction,
    );
  }
}
