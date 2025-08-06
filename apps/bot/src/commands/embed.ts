import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import { Command } from "@sapphire/framework";
import {
  type APIInteractionResponseChannelMessageWithSource,
  ApplicationCommandType,
  InteractionResponseType
} from "discord.js";

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
          .addStringOption((string) =>
            string
              .setName("url")
              .setDescription("Link to content")
              .setRequired(true)
          )
      )
      .registerContextMenuCommand((command) =>
        command
          .setName("Embed Links")
          .setType(ApplicationCommandType.Message)
      );
  }

  isInteractionResponse(
    data: Record<string, any>
  ): data is APIInteractionResponseChannelMessageWithSource {
    return (
      data.type &&
      data.type === InteractionResponseType.ChannelMessageWithSource
    );
  }

  async fetchEmbed(
    interaction:
      | Command.ChatInputCommandInteraction
      | Command.ContextMenuCommandInteraction,
    content: string
  ) {
    await interaction.deferReply({ flags: ["Ephemeral"] });

    const { data, error } = await app.api.embed.post(
      {
        author: interaction.user,
        id: interaction.id,
        content
      },
      {
        headers: {
          authorization: `Bearer ${process.env.DISCORD_BOT_TOKEN}`,
          accept: "application/vnd.embedly.container"
        }
      }
    );

    if (error && error.status === 400) {
      if (this.isInteractionResponse(error.value)) {
        return await interaction.editReply({
          content: error.value.data.content
        });
      }
    }

    if (Array.isArray(data)) {
      const blurbs = [
        "*happy robot noises* embed fixed! ✨",
        "*excited beeping* your link is now pretty! :D",
        "*mechanical purring* embed enhanced ~ enjoy! ✨",
        "*whirrs with pride* fixed that social link for ya! ✨",
        "*robot dance* embed upgraded successfully! 🎉",
        "*contented humming* your message is now shareable! ✨",
        "*cheerful chirping* embed repaired with love! 💕",
        "*satisfied beep boop* social link beautified! ✨",
        "*happy buzzing* embed transformation complete! :3",
        "*delighted whirring* your link got the premium treatment! ✨",
        "*joyful mechanical sounds* embed fixed ~ you're welcome! :)",
        "*pleased robot giggles* social media link enhanced! ✨",
        "*excited servo noises* embed upgraded for maximum sharing! 🚀",
        "*warm robot hum* your link is now conversation-ready! ✨",
        "*triumphant beeping* another embed saved from the void! 🎯"
      ];
      await interaction.editReply(
        blurbs[Math.floor(Math.random() * blurbs.length)]
      );
      return await interaction.followUp({
        components: data,
        flags: ["IsComponentsV2"],
        allowedMentions: {
          parse: [],
          repliedUser: false
        }
      });
    }
    return;
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
    this.fetchEmbed(interaction, url);
  }
}
