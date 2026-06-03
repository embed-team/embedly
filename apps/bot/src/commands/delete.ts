import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

const DELETE_FAILED =
  "Failed to delete the message.\n-# (This only works if you are the original poster or have `Manage Messages` permission.)";
const DELETE_SUCCESS_MESSAGES = [
  "embed successfully yeeted into the void! ✨",
  "👋 bye bye embed! deletion complete!",
  "your embed has left the building! ✨",
  "poof~ your embed has vanished! ✨",
  "🧹 all tidy! embed removed as requested~",
];

export class DeleteCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      description: "Delete Embedly's response",
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerContextMenuCommand((command) =>
      command
        .setName("Delete Embed")
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
    if (msg.author.id !== this.container.client.user?.id) {
      await interaction.reply({
        content: DELETE_FAILED,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    if (!msg.deletable) {
      await interaction.editReply(DELETE_FAILED);
      return;
    }

    let originalAuthorId = await this.container.messageCache.getOriginalAuthorId(msg.id);

    if (!originalAuthorId) {
      try {
        const reference = await msg.fetchReference();
        originalAuthorId = reference.author.id;
      } catch {
        await interaction.editReply(DELETE_FAILED);
        return;
      }
    }

    const isOriginalPoster = interaction.user.id === originalAuthorId;
    let hasManagePermission = false;

    if (interaction.inGuild()) {
      const guild = await interaction.guild!.fetch();
      const runner = await guild.members.fetch(interaction.member.user.id);
      hasManagePermission = runner.permissions.has(PermissionFlagsBits.ManageMessages, true);
    }

    if (!hasManagePermission && !isOriginalPoster) {
      await interaction.editReply(DELETE_FAILED);
      return;
    }

    await msg.delete();
    await this.container.messageCache.removeBotMessage(msg.id);
    await interaction.editReply(
      DELETE_SUCCESS_MESSAGES[~~(DELETE_SUCCESS_MESSAGES.length * Math.random())],
    );
  }
}
