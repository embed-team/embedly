import {
  createProblem,
  EmbedlyErrors,
  EmbedlyLogs,
  formatDiscordError,
  formatLog,
  getErrorContext,
  isEmbedlyProblem,
} from "@embedly/logging";
import { matchURL, Platforms } from "@embedly/platforms";
import { Command, container } from "@sapphire/framework";
import { Message, MessageFlags, PermissionFlagsBits } from "discord.js";

import { buildEmbed, EmbedFlags } from "./builder";
import {
  botEmbedsCreated,
  botErrors,
  botInvocations,
  botRequestDuration,
  getActiveTraceContext,
  injectTraceHeaders,
  log,
  markError,
  recordError,
  span,
} from "./observability";
import { extractURLs, isSpoiler } from "./utils";

type EmbedSource = "message" | "command" | "context_menu";
type EmbedInteraction = Command.ChatInputCommandInteraction | Command.ContextMenuCommandInteraction;
type ScrapeResponse = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

export interface EmbedURLRequest {
  url: string;
  flags?: Partial<EmbedFlags>;
  force?: boolean;
}

interface HandleUrlsOptions {
  source?: EmbedSource;
  updateTargets?: ReadonlyMap<number, string>;
}

export function parseMessageURLs(content: string) {
  const urls: EmbedURLRequest[] = [];
  let suppressNativeEmbeds = true;

  for (const match of extractURLs(content)) {
    const before = content.slice(0, match.index);
    const after = content.slice(match.endIndex);

    if (before.endsWith("<") && after.startsWith(">")) continue;

    if (before.endsWith("~")) {
      suppressNativeEmbeds = false;
      continue;
    }

    const flags: Partial<EmbedFlags> = {
      Spoiler: isSpoiler(match.url, content),
    };
    let force = false;

    if (before.endsWith("?@")) {
      flags.SourceOnly = true;
      force = true;
    } else if (before.endsWith("?!")) {
      flags.MediaOnly = true;
      force = true;
    } else if (before.endsWith("@")) {
      flags.SourceOnly = true;
    } else if (before.endsWith("!")) {
      flags.MediaOnly = true;
    } else if (before.endsWith("?")) {
      force = true;
    }

    urls.push({ url: match.url, flags, force });
  }

  return { urls, suppressNativeEmbeds };
}

function canReactToMessage(msg: Message) {
  if (!msg.channel) return false;
  if (!msg.inGuild()) return true;

  const me = msg.guild.members.me;
  if (!me) return false;

  return msg.channel.permissionsFor(me)?.has(PermissionFlagsBits.AddReactions, true) ?? false;
}

export async function handleUrls(
  urls: EmbedURLRequest[],
  interactionOrMessage: EmbedInteraction | Message,
  options: HandleUrlsOptions = {},
) {
  let msg: Message | null = null;
  let interaction: EmbedInteraction | null = null;

  if (interactionOrMessage instanceof Message) {
    msg = interactionOrMessage;
  } else {
    interaction = interactionOrMessage;
  }

  const embedSource = options.source ?? (msg ? "message" : "command");
  let sentEmbed = false;
  let sentFailureReaction = false;
  const reactToFailure = async () => {
    if (!msg) return;
    if (sentFailureReaction) return;
    if (!canReactToMessage(msg)) return;

    sentFailureReaction = true;
    try {
      await msg.react("❌");
    } catch (error) {
      container.logger.warn(
        formatLog("warn", EmbedlyErrors.DiscordSendFailed, {
          message_id: msg.id,
          channel_id: msg.channelId,
          guild_id: msg.guildId ?? "dm",
          reason: "failure_reaction_failed",
          ...getErrorContext(error),
        }),
      );
    }
  };

  if (urls.length === 0) {
    if (!interaction) return sentEmbed;
    const requestId = `${embedSource}:${interaction.id}`;
    const problem = createProblem(EmbedlyErrors.NoUrlsFound, {
      request_id: requestId,
      context: {
        request_id: requestId,
        source: embedSource,
        interaction_id: interaction.id,
        user_id: interaction.user.id,
      },
    });
    container.logger.warn(formatLog("warn", EmbedlyErrors.NoUrlsFound, problem.context));
    await interaction.reply({
      content: formatDiscordError(problem),
      flags: MessageFlags.Ephemeral,
    });
    return sentEmbed;
  }

  if (interaction) await interaction.deferReply();

  const matches = (
    await Promise.all(
      urls.map(async (request, requestIndex) => {
        const match = await matchURL(request.url);
        return match ? { ...request, ...match, requestIndex } : null;
      }),
    )
  ).filter(
    (match) =>
      match !== null && (!options.updateTargets || options.updateTargets.has(match.requestIndex)),
  );

  if (msg && options.updateTargets && matches.length !== options.updateTargets.size) {
    await reactToFailure();
  }

  if (interaction && matches.length === 0) {
    const requestId = `${embedSource}:${interaction.id}`;
    const problem = createProblem(EmbedlyErrors.NoMatchesFound, {
      request_id: requestId,
      context: {
        request_id: requestId,
        source: embedSource,
        interaction_id: interaction.id,
        user_id: interaction.user.id,
      },
    });
    container.logger.warn(formatLog("warn", EmbedlyErrors.NoMatchesFound, problem.context));
    await interaction.editReply({
      content: formatDiscordError(problem),
    });
    return sentEmbed;
  }

  for (const [i, { platform, id, flags, force, requestIndex }] of matches.entries()) {
    const startedAt = Date.now();
    const requestId = msg
      ? `message:${msg.id}:${requestIndex}`
      : `${embedSource}:${interaction!.id}:${requestIndex}`;
    const targetBotMessageId = options.updateTargets?.get(requestIndex);
    const logContext: Record<string, unknown> = {
      request_id: requestId,
      source: embedSource,
      platform,
      post_id: id,
      force: force ?? false,
      operation: targetBotMessageId ? "update" : "create",
      outcome: "success",
      status_code: 200,
      ...(msg
        ? {
            message_id: msg.id,
            channel_id: msg.channelId,
            guild_id: msg.guildId ?? "dm",
            user_id: msg.author.id,
          }
        : {
            interaction_id: interaction!.id,
            channel_id: interaction!.channelId,
            guild_id: interaction!.guildId ?? "dm",
            user_id: interaction!.user.id,
          }),
    };

    const spanAttributes = {
      "embedly.request_id": requestId,
      "embedly.source": embedSource,
      "embedly.platform": platform,
      "embedly.post_id": id,
    };
    const metricContext = { source: embedSource, platform };
    botInvocations.add(1, metricContext);

    await span(
      "embed.request",
      {
        ...spanAttributes,
        "discord.guild_id": String(logContext.guild_id),
        "discord.channel_id": String(logContext.channel_id),
        "discord.user_id": String(logContext.user_id),
      },
      async (requestSpan) => {
        try {
          let post: ScrapeResponse;
          try {
            const req = await span(
              "api.scrape",
              {
                ...spanAttributes,
              },
              async (apiSpan) => {
                const response = await container.api.platforms.scrape.$post(
                  { json: { platform, id, force: force ?? false } },
                  {
                    headers: injectTraceHeaders({
                      Authorization: `Bearer ${process.env.EMBEDLY_AUTH_SECRET}`,
                      "X-Embedly-Request-Id": requestId,
                      "X-Embedly-Source": embedSource,
                    }),
                  },
                );
                apiSpan.setAttribute("http.response.status_code", response.status);
                if (!response.ok) {
                  markError(apiSpan, `API returned ${response.status}`, {
                    "http.response.status_code": response.status,
                  });
                }
                return response;
              },
            );
            const body = await req.json();

            if (!req.ok) {
              const problem = isEmbedlyProblem(body)
                ? body
                : createProblem(EmbedlyErrors.ApiUnexpectedResponse, {
                    request_id: requestId,
                    context: { ...logContext, response_status: req.status },
                  });
              markError(requestSpan, problem.type, {
                "http.response.status_code": req.status,
                "embedly.error_type": problem.type,
              });
              Object.assign(logContext, {
                outcome: "error",
                status_code: req.status,
                error_type: problem.type,
              });
              botErrors.add(1, { ...metricContext, error_type: problem.type });
              if (msg) {
                await reactToFailure();
                return;
              }
              await interaction!.editReply({
                content: formatDiscordError(problem),
              });
              return;
            }

            post = body as ScrapeResponse;
          } catch (error) {
            recordError(requestSpan, error);
            const problem = createProblem(EmbedlyErrors.ApiUnexpectedResponse, {
              request_id: requestId,
              context: { ...logContext, ...getErrorContext(error) },
            });
            Object.assign(logContext, getErrorContext(error), {
              outcome: "error",
              status_code: problem.status,
              error_type: problem.type,
            });
            botErrors.add(1, { ...metricContext, error_type: problem.type });
            if (msg) {
              await reactToFailure();
              return;
            }
            await interaction!.editReply({
              content: formatDiscordError(problem),
            });
            return;
          }

          const component = await span(
            "embed.build",
            {
              ...spanAttributes,
            },
            async () => buildEmbed(post, flags),
          );
          if (!component) {
            const problem = createProblem(EmbedlyErrors.NoMediaFound, {
              request_id: requestId,
              context: logContext,
            });
            Object.assign(logContext, {
              outcome: "skipped",
              status_code: problem.status,
              error_type: problem.type,
            });
            if (msg) {
              await reactToFailure();
              return;
            }
            const response = { content: formatDiscordError(problem) };
            if (i === 0) {
              await interaction!.editReply(response);
            } else {
              await interaction!.followUp(response);
            }
            return;
          }

          const response = {
            components: [component],
            flags: [MessageFlags.IsComponentsV2],
            allowedMentions: {
              parse: [],
              repliedUser: false,
            },
          } as const;

          try {
            const botMessage = await span(
              targetBotMessageId ? "discord.edit" : "discord.send",
              {
                ...spanAttributes,
                "discord.guild_id": String(logContext.guild_id),
                "discord.channel_id": String(logContext.channel_id),
              },
              async (sendSpan) => {
                let message: Message;
                if (msg && targetBotMessageId) {
                  message = await msg.channel.messages.fetch(targetBotMessageId);
                  await message.edit(response);
                } else if (msg) {
                  message =
                    i > 0 && msg.channel.isSendable()
                      ? await msg.channel.send(response)
                      : await msg.reply(response);
                } else {
                  message =
                    i === 0
                      ? await interaction!.editReply(response)
                      : await interaction!.followUp(response);
                }
                sendSpan.setAttribute("discord.bot_message_id", message.id);
                return message;
              },
            );
            logContext.bot_message_id = botMessage.id;
            if (msg && !targetBotMessageId) {
              await span(
                "message_cache.save",
                {
                  ...spanAttributes,
                  "discord.source_message_id": msg.id,
                  "discord.bot_message_id": botMessage.id,
                },
                async () => {
                  await container.messageCache.save(
                    msg.id,
                    botMessage.id,
                    msg.author.id,
                    requestIndex,
                  );
                },
              );
            }
            if (!targetBotMessageId) botEmbedsCreated.add(1, metricContext);
            sentEmbed = true;
          } catch (error) {
            recordError(requestSpan, error);
            const problem = createProblem(EmbedlyErrors.DiscordSendFailed, {
              request_id: requestId,
              context: { ...logContext, ...getErrorContext(error) },
            });
            Object.assign(logContext, getErrorContext(error), {
              outcome: "error",
              status_code: problem.status,
              error_type: problem.type,
            });
            botErrors.add(1, { ...metricContext, error_type: problem.type });
            if (msg) {
              await reactToFailure();
              return;
            }
            await interaction!.editReply(formatDiscordError(problem));
          }
        } finally {
          Object.assign(logContext, getActiveTraceContext(), {
            duration_ms: Date.now() - startedAt,
          });
          botRequestDuration.record(Number(logContext.duration_ms), metricContext);
          const level =
            logContext.outcome === "success"
              ? "info"
              : logContext.outcome === "skipped"
                ? "warn"
                : "error";
          log(level, EmbedlyLogs.EmbedRequest, logContext);
        }
      },
    );
  }
  return sentEmbed;
}
