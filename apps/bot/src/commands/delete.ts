import {
  createProblem,
  EmbedlyErrors,
  EmbedlyLogs,
  formatDiscordError,
  formatLog,
  getErrorContext,
} from "@embedly/logging";
import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
} from "discord.js";

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

    const requestId = `context_menu:${interaction.id}`;
    const logContext = {
      request_id: requestId,
      source: "context_menu",
      interaction_id: interaction.id,
      user_id: interaction.user.id,
    };
    const msg = interaction.targetMessage;
    if (msg.author.id !== this.container.client.user?.id) {
      const problem = createProblem(EmbedlyErrors.DeleteFailed, {
        request_id: requestId,
        context: {
          ...logContext,
          message_id: msg.id,
          reason: "not_bot_message",
        },
      });
      this.container.logger.warn(formatLog("warn", EmbedlyErrors.DeleteFailed, problem.context));
      await interaction.reply({
        content: formatDiscordError(problem),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({
      flags: MessageFlags.Ephemeral,
    });

    if (!msg.deletable) {
      const problem = createProblem(EmbedlyErrors.DeleteFailed, {
        request_id: requestId,
        context: {
          ...logContext,
          message_id: msg.id,
          reason: "not_deletable",
        },
      });
      this.container.logger.warn(formatLog("warn", EmbedlyErrors.DeleteFailed, problem.context));
      await interaction.editReply(formatDiscordError(problem));
      return;
    }

    let originalAuthorId = await this.container.messageCache.getOriginalAuthorId(msg.id);

    if (!originalAuthorId) {
      try {
        const reference = await msg.fetchReference();
        originalAuthorId = reference.author.id;
      } catch (error) {
        const problem = createProblem(EmbedlyErrors.DeleteFailed, {
          request_id: requestId,
          context: {
            ...logContext,
            message_id: msg.id,
            reason: "missing_original_author",
            ...getErrorContext(error),
          },
        });
        this.container.logger.warn(formatLog("warn", EmbedlyErrors.DeleteFailed, problem.context));
        await interaction.editReply(formatDiscordError(problem));
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
      const problem = createProblem(EmbedlyErrors.DeleteFailed, {
        request_id: requestId,
        context: {
          ...logContext,
          message_id: msg.id,
          original_author_id: originalAuthorId,
          has_manage_permission: hasManagePermission,
          reason: "insufficient_permissions",
        },
      });
      this.container.logger.warn(formatLog("warn", EmbedlyErrors.DeleteFailed, problem.context));
      await interaction.editReply(formatDiscordError(problem));
      return;
    }

    try {
      await msg.delete();
      await this.container.messageCache.removeBotMessage(msg.id);
    } catch (error) {
      const problem = createProblem(EmbedlyErrors.DeleteFailed, {
        request_id: requestId,
        context: {
          ...logContext,
          message_id: msg.id,
          original_author_id: originalAuthorId,
          ...getErrorContext(error),
        },
      });
      this.container.logger.error(formatLog("error", EmbedlyErrors.DeleteFailed, problem.context));
      await interaction.editReply(formatDiscordError(problem));
      return;
    }

    this.container.logger.info(
      formatLog("info", EmbedlyLogs.DeleteSucceeded, {
        ...logContext,
        message_id: msg.id,
        original_author_id: originalAuthorId,
      }),
    );
    await interaction.editReply(
      DELETE_SUCCESS_MESSAGES[~~(DELETE_SUCCESS_MESSAGES.length * Math.random())],
    );
  }
}
