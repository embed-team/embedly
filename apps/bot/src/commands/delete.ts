import {
  EMBEDLY_DELETE_FAILED,
  EMBEDLY_DELETE_SUCCESS,
  formatDiscord
} from "@embedly/logging";
import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  MessageFlags,
  PermissionFlagsBits
} from "discord.js";

export class DeleteCommand extends Command {
  public constructor(
    context: Command.LoaderContext,
    options: Command.Options
  ) {
    super(context, {
      ...options,
      description: "Delete Embedly's Response"
    });
  }

  public override registerApplicationCommands(
    registry: Command.Registry
  ) {
    registry.registerContextMenuCommand((command) =>
      command
        .setName("Delete Embed")
        .setType(ApplicationCommandType.Message)
    );
  }

  public override async contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction
  ) {
    if (!interaction.isMessageContextMenuCommand()) return;
    if (!interaction.inGuild()) return;
    const msg = interaction.targetMessage;
    if (msg.author.id !== this.container.client.id) {
      return await interaction.reply({
        content: formatDiscord(EMBEDLY_DELETE_FAILED, {
          message_id: msg.id
        }),
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral
    });

    const guild = await interaction.guild!.fetch();
    const runner = await guild.members.fetch(
      interaction.member.user.id
    );
    const reference = await msg.fetchReference();
    if (
      !runner.permissions.has(
        PermissionFlagsBits.ManageMessages,
        true
      ) ||
      runner.id !== reference.author.id
    ) {
      return await interaction.editReply({
        content: formatDiscord(EMBEDLY_DELETE_FAILED, {
          message_id: msg.id
        })
      });
    }
    if (!msg.deletable) {
      return await interaction.editReply({
        content: formatDiscord(EMBEDLY_DELETE_FAILED, {
          message_id: msg.id
        })
      });
    }
    await msg.delete();
    return await interaction.editReply({
      content: formatDiscord(EMBEDLY_DELETE_SUCCESS, {
        message_id: msg.id
      })
    });
  }
}
