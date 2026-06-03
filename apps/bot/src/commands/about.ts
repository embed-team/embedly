import { Command } from "@sapphire/framework";
import {
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  bold,
  ContainerBuilder,
  HeadingLevel,
  heading,
  InteractionContextType,
  MessageFlags,
} from "discord.js";

export class AboutCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Learn about Embedly and how to use it.",
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((command) =>
      command
        .setName(this.name)
        .setDescription(this.description)
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
    const embedCommand = this.container.stores.get("commands").get("embed");
    interaction.reply({
      components: [
        new ContainerBuilder()
          .addSectionComponents((section) =>
            section
              .addTextDisplayComponents((text) =>
                text.setContent(
                  `${heading("Embedly", HeadingLevel.Two)}
Better embeds = Better conversations ✨

${heading("What is Embedly?", HeadingLevel.Three)}
Embedly fixes broken social media embeds on Discord. Get full videos, images, and context from Twitter/X, TikTok, Instagram, Threads, and more.

${heading("How to Use", HeadingLevel.Three)}
- Use </embed:${embedCommand?.applicationCommandRegistry.globalChatInputCommandIds.values().next().value}> to manually enhance a link
- Right-click any message → ${bold("Embed Links")}
- Or just share links - Embedly works automatically!

${heading("Features", HeadingLevel.Three)}
- ${bold("Media Only")} - Show just images/videos
- ${bold("Source Only")} - Hide replies and quotes
- ${bold("Spoiler Mode")} - Blur sensitive content

${heading("Open Source", HeadingLevel.Three)}
Embedly is source available under the Elastic License v2. View the code, learn how it works, and see what platforms are supported.

Made with 💕 by embed.team`,
                ),
              )
              .setThumbnailAccessory((thumbnail) =>
                thumbnail.setURL(
                  this.container.client.user!.avatarURL({
                    extension: "png",
                  })!,
                ),
              ),
          )
          .addActionRowComponents((row) =>
            row.addComponents(
              new ButtonBuilder()
                .setLabel("GitHub")
                .setStyle(ButtonStyle.Link)
                .setURL("https://github.com/embed-team/embedly")
                .setEmoji({ name: "⭐" }),
              new ButtonBuilder()
                .setLabel("Website")
                .setStyle(ButtonStyle.Link)
                .setURL("https://bot.embed.team")
                .setEmoji({ name: "🌐" }),
              new ButtonBuilder()
                .setLabel("Invite")
                .setStyle(ButtonStyle.Link)
                .setURL("https://embedly.roselynn.gay")
                .setEmoji({ name: "➕" }),
            ),
          )
          .toJSON(),
      ],
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
    });
  }
}
