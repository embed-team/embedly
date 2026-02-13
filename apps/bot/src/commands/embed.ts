import { treaty } from "@elysiajs/eden";
import type { App } from "@embedly/api";
import {
  Embed,
  EmbedFlagNames,
  type EmbedFlags
} from "@embedly/builder";
import {
  EMBEDLY_EMBED_CREATED_COMMAND,
  EMBEDLY_NO_LINK_IN_MESSAGE,
  EMBEDLY_NO_LINK_WARN,
  EMBEDLY_NO_VALID_LINK,
  EMBEDLY_NO_VALID_LINK_WARN,
  type EmbedlyInteractionContext,
  formatDiscord,
  formatLog
} from "@embedly/logging";
import Platforms, {
  GENERIC_LINK_REGEX,
  getPlatformFromURL,
  hasLink
} from "@embedly/platforms";
import {
  context,
  propagation,
  SpanStatusCode
} from "@opentelemetry/api";
import { Command } from "@sapphire/framework";
import {
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType
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
              .setName("source_only")
              .setDescription(
                "Show only the original post (no reply chains or quotes)"
              )
          )
          .addBooleanOption((opt) =>
            opt
              .setName("spoiler")
              .setDescription("Hide embed content behind spoiler")
          )
          .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel
          )
          .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
          )
      )
      .registerContextMenuCommand((command) =>
        command
          .setName("Embed Links")
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

  async fetchEmbed(
    interaction:
      | Command.ChatInputCommandInteraction
      | Command.ContextMenuCommandInteraction,
    content: string,
    flags?: Partial<EmbedFlags>
  ) {
    const log_ctx = {
      interaction_id: interaction.id,
      user_id: interaction.user.id
    } satisfies EmbedlyInteractionContext;
    if (!hasLink(content)) {
      this.container.logger.warn(
        formatLog(EMBEDLY_NO_LINK_WARN, log_ctx)
      );
      return await interaction.reply({
        content: formatDiscord(EMBEDLY_NO_LINK_IN_MESSAGE, log_ctx),
        flags: ["Ephemeral"]
      });
    }
    const url = GENERIC_LINK_REGEX.exec(content)![0];
    const platform = await this.container.tracer.startActiveSpan(
      "detect_platform",
      async (s) => {
        const platform = getPlatformFromURL(url);
        s.setAttribute("embedly.platform", platform?.type ?? "unknown");
        s.setAttribute("embedly.url", url);
        s.end();
        return platform;
      }
    );
    if (!platform) {
      this.container.logger.warn(
        formatLog(EMBEDLY_NO_VALID_LINK_WARN, log_ctx)
      );
      return await interaction.reply({
        content: formatDiscord(EMBEDLY_NO_VALID_LINK, log_ctx),
        flags: ["Ephemeral"]
      });
    }

    await interaction.deferReply();

    const { data, error } = await this.container.tracer.startActiveSpan(
      "fetch_from_api",
      async (s) => {
        s.setAttribute("embedly.platform", platform.type);
        s.setAttribute("embedly.url", url);

        const otelHeaders: Record<string, string> = {};
        propagation.inject(context.active(), otelHeaders);

        const res = await app.api.scrape.post(
          {
            platform: platform.type,
            url
          },
          {
            headers: {
              authorization: `Bearer ${process.env.DISCORD_BOT_TOKEN}`,
              ...otelHeaders
            }
          }
        );
        if (res.error) {
          s.setStatus({
            code: SpanStatusCode.ERROR,
            message:
              "detail" in res.error.value
                ? res.error.value.detail
                : res.error.value.type
          });
          s.recordException(
            "detail" in res.error.value
              ? res.error.value.detail
              : res.error.value.type
          );
        }
        s.end();
        return res;
      }
    );

    if (error?.status === 400 || error?.status === 500) {
      const error_context = {
        ...log_ctx,
        ...("context" in error.value ? error.value.context : {})
      };
      this.container.logger.error(
        formatLog(error.value, error_context)
      );
      return await interaction.editReply({
        content: formatDiscord(error.value, error_context)
      });
    }

    const embed = await this.container.tracer.startActiveSpan(
      "create_embed",
      async (s) => {
        s.setAttribute("embedly.platform", platform.type);
        const embed = await Platforms[platform.type].createEmbed(data);
        s.end();
        return embed;
      }
    );

    const bot_message = await this.container.tracer.startActiveSpan(
      "send_message",
      async (s) => {
        const res = await interaction.editReply({
          components: [Embed.getDiscordEmbed(embed, flags)!],
          flags: ["IsComponentsV2"],
          allowedMentions: {
            parse: [],
            repliedUser: false
          }
        });
        s.setAttribute("discord.bot_message_id", res.id);
        s.end();
        return res;
      }
    );

    this.container.embed_authors.set(
      bot_message.id,
      interaction.user.id
    );
    this.container.logger.info(
      formatLog(EMBEDLY_EMBED_CREATED_COMMAND, {
        interaction_id: interaction.id,
        user_id: interaction.user.id,
        bot_message_id: bot_message.id,
        platform: platform.type,
        url
      })
    );
    return bot_message;
  }

  public override async contextMenuRun(
    interaction: Command.ContextMenuCommandInteraction
  ) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const msg = interaction.targetMessage;
    this.container.tracer.startActiveSpan(
      "context_menu",
      async (root_span) => {
        root_span.setAttributes({
          "discord.interaction_id": interaction.id,
          "discord.command": interaction.commandName,
          "discord.guild_id": interaction.guildId ?? "dm",
          "discord.user_id": interaction.user.id,
          "discord.message_id": msg.id
        });
        try {
          await this.fetchEmbed(interaction, msg.content);
          root_span.setStatus({ code: SpanStatusCode.OK });
        } catch (error: any) {
          root_span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          root_span.recordException(error);
        } finally {
          root_span.end();
        }
      }
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction
  ) {
    const url = interaction.options.getString("url", true);

    this.container.tracer.startActiveSpan(
      "/embed",
      async (root_span) => {
        root_span.setAttributes({
          "discord.interaction_id": interaction.id,
          "discord.command": interaction.commandName,
          "discord.guild_id": interaction.guildId ?? "dm",
          "discord.user_id": interaction.user.id
        });

        let link_style:
          | EmbedFlags[EmbedFlagNames.LinkStyle]
          | undefined;
        try {
          link_style = (await this.container.posthog.getFeatureFlag(
            "embed-link-styling-test",
            interaction.user.id
          )) as EmbedFlags[EmbedFlagNames.LinkStyle] | undefined;
        } catch {
          link_style = undefined;
        }

        try {
          await this.fetchEmbed(interaction, url, {
            [EmbedFlagNames.MediaOnly]:
              interaction.options.getBoolean("media_only") ?? false,
            [EmbedFlagNames.SourceOnly]:
              interaction.options.getBoolean("source_only") ?? false,
            [EmbedFlagNames.Spoiler]:
              interaction.options.getBoolean("spoiler") ?? false,
            [EmbedFlagNames.LinkStyle]: link_style ?? "control"
          });
          root_span.setStatus({ code: SpanStatusCode.OK });
        } catch (error: any) {
          root_span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          root_span.recordException(error);
        } finally {
          root_span.end();
        }
      }
    );
  }
}
