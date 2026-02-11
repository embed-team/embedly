import {
  EMBEDLY_DELETE_FAILED,
  EMBEDLY_DELETE_FAILED_WARN,
  EMBEDLY_DELETE_SUCCESS,
  EMBEDLY_DELETE_SUCCESS_INFO,
  formatBetterStack,
  formatDiscord
} from "@embedly/logging";
import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  type Guild,
  type GuildMember,
  InteractionContextType,
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
        .setContexts(
          InteractionContextType.BotDM,
          InteractionContextType.Guild,
          InteractionContextType.PrivateChannel
        )
        .setIntegrationTypes(
          ApplicationIntegrationType.GuildInstall,
          ApplicationIntegrationType.UserInstall
        )
    );
  }

  public override async contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction
  ) {
    if (!interaction.isMessageContextMenuCommand()) return;
    if (!interaction.inGuild()) return;
    const msg = interaction.targetMessage;
    if (msg.author.id !== this.container.client.id) {
      this.container.betterstack.warn(
        ...formatBetterStack(EMBEDLY_DELETE_FAILED_WARN, {
          message_id: msg.id,
          user_id: interaction.user.id,
          reason: "not_bot_message"
        })
      );
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

    if (!msg.deletable) {
      this.container.betterstack.warn(
        ...formatBetterStack(EMBEDLY_DELETE_FAILED_WARN, {
          message_id: msg.id,
          user_id: interaction.user.id,
          reason: "not_deletable"
        })
      );
      return await interaction.editReply({
        content: formatDiscord(EMBEDLY_DELETE_FAILED, {
          message_id: msg.id
        })
      });
    }

    let original_author_id = this.container.embed_authors.get(msg.id);

    if (!original_author_id) {
      try {
        const reference = await msg.fetchReference();
        original_author_id = reference.author.id;
      } catch {
        this.container.betterstack.warn(
          ...formatBetterStack(EMBEDLY_DELETE_FAILED_WARN, {
            message_id: msg.id,
            user_id: interaction.user.id,
            reason: "no_author_mapping_and_no_reference"
          })
        );
        return await interaction.editReply({
          content: formatDiscord(EMBEDLY_DELETE_FAILED, {
            message_id: msg.id
          })
        });
      }
    }

    let guild: Guild;
    let runner: GuildMember;
    try {
      guild = await interaction.guild!.fetch();
      runner = await guild.members.fetch(interaction.member.user.id);
    } catch {
      this.container.betterstack.warn(
        ...formatBetterStack(EMBEDLY_DELETE_FAILED_WARN, {
          message_id: msg.id,
          user_id: interaction.user.id,
          reason: "failed_to_fetch_guild_or_member"
        })
      );
      return await interaction.editReply({
        content: formatDiscord(EMBEDLY_DELETE_FAILED, {
          message_id: msg.id
        })
      });
    }

    const has_manage_permission = runner.permissions.has(
      PermissionFlagsBits.ManageMessages,
      true
    );
    const is_original_poster = runner.id === original_author_id;

    if (!has_manage_permission && !is_original_poster) {
      this.container.betterstack.warn(
        ...formatBetterStack(EMBEDLY_DELETE_FAILED_WARN, {
          message_id: msg.id,
          user_id: interaction.user.id,
          original_author_id,
          has_manage_permission,
          reason: "insufficient_permissions"
        })
      );
      return await interaction.editReply({
        content: formatDiscord(EMBEDLY_DELETE_FAILED, {
          message_id: msg.id
        })
      });
    }

    await msg.delete();
    this.container.embed_authors.delete(msg.id);
    for (const [user_msg_id, bot_ids] of this.container
      .embed_messages) {
      const filtered = bot_ids.filter((id) => id !== msg.id);
      if (filtered.length === bot_ids.length) continue;
      if (filtered.length === 0) {
        this.container.embed_messages.delete(user_msg_id);
      } else {
        this.container.embed_messages.set(user_msg_id, filtered);
      }
      break;
    }
    this.container.betterstack.info(
      ...formatBetterStack(EMBEDLY_DELETE_SUCCESS_INFO, {
        message_id: msg.id,
        user_id: interaction.user.id,
        original_author_id
      })
    );
    return await interaction.editReply({
      content: formatDiscord(EMBEDLY_DELETE_SUCCESS, {
        message_id: msg.id
      })
    });
  }
}
