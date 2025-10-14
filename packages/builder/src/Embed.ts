import {
  ContainerBuilder,
  escapeHeading,
  escapeMarkdown,
  HeadingLevel,
  heading,
  hyperlink,
  SectionBuilder,
  subtext,
  TimestampStyles,
  time
} from "@discordjs/builders";
import {
  type BaseEmbedData,
  type BaseEmbedDataWithoutPlatform,
  EmbedlyPlatformColors,
  type EmbedlyPlatformType,
  type Emojis,
  emojis,
  type StatsData
} from "@embedly/types";
import {
  type APIMediaGalleryItem,
  ButtonStyle,
  SeparatorSpacingSize
} from "discord-api-types/v10";

export interface EmbedData extends BaseEmbedData {
  quote?: BaseEmbedDataWithoutPlatform;
  reply?: BaseEmbedDataWithoutPlatform;
}

export enum EmbedFlags {
  MediaOnly = "MediaOnly",
  Spoiler = "Spoiler"
}

export class Embed implements EmbedData {
  public platform!: EmbedlyPlatformType;
  public name!: string;
  public username?: string;
  public profile_url?: string;
  public avatar_url!: string;
  public url!: string;
  public timestamp!: number;
  public stats!: StatsData;

  static NumberFormatter = new Intl.NumberFormat("en", {
    roundingMode: "ceil",
    roundingPriority: "lessPrecision",
    notation: "compact",
    maximumFractionDigits: 2
  });

  public description?: string;
  public media?: APIMediaGalleryItem[];
  public quote?: BaseEmbedDataWithoutPlatform;
  public reply?: BaseEmbedDataWithoutPlatform;
  constructor(data: BaseEmbedData) {
    Object.assign(this, data);
  }

  public setDescription(text: string) {
    this.description = text;
  }
  public setMedia(media: APIMediaGalleryItem[]) {
    this.media = media;
  }
  public setQuoteTweet(quote_tweet: BaseEmbedDataWithoutPlatform) {
    this.quote = quote_tweet;
  }
  public setReplyTweet(reply_tweet: BaseEmbedDataWithoutPlatform) {
    this.reply = reply_tweet;
  }

  static getDiscordEmbed(
    embed: Embed,
    flags?: Partial<Record<EmbedFlags, boolean>>
  ) {
    const media_only = flags?.[EmbedFlags.MediaOnly];
    const hidden = flags?.[EmbedFlags.Spoiler];

    const container = new ContainerBuilder();
    container.setAccentColor(EmbedlyPlatformColors[embed.platform]);
    if (hidden) {
      container.setSpoiler(true);
    }
    const text_section = new SectionBuilder()
      .addTextDisplayComponents((builder) => {
        if (embed.reply) {
          return builder.setContent(
            heading(
              escapeHeading(
                `${embed.reply.name} ${
                  embed.username
                    ? `(${hyperlink(`@${embed.reply.username}`, embed.reply.profile_url)})`
                    : ""
                }`
              ),
              HeadingLevel.Three
            )
          );
        } else {
          return builder.setContent(
            heading(
              escapeHeading(
                `${embed.quote ? emojis.quote : ""} ${embed.name} ${
                  embed.username
                    ? `(${hyperlink(`@${embed.username}`, embed.profile_url)})`
                    : ""
                }`
              ),
              HeadingLevel.Three
            )
          );
        }
      })
      .setThumbnailAccessory((builder) =>
        builder.setURL(embed.avatar_url)
      );

    if (embed.reply?.description) {
      text_section.addTextDisplayComponents((builder) =>
        builder.setContent(escapeMarkdown(embed.reply?.description!))
      );
    } else if (embed.description) {
      text_section.addTextDisplayComponents((builder) =>
        builder.setContent(escapeMarkdown(embed.description!))
      );
    }

    if (!media_only) {
      container.addSectionComponents(text_section);
    }

    if (embed.reply?.media) {
      container.addMediaGalleryComponents((builder) =>
        builder.addItems(embed.reply?.media!)
      );
    } else if (embed.media) {
      container.addMediaGalleryComponents((builder) =>
        builder.addItems(embed.media!)
      );
    }

    if (media_only) {
      return container.toJSON();
    }

    if (embed.reply || embed.quote) {
      container.addSeparatorComponents((builder) =>
        builder.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
      );
    }

    if (embed.reply) {
      const reply_text_section = new SectionBuilder()
        .addTextDisplayComponents((builder) =>
          builder.setContent(
            heading(
              escapeHeading(
                `${emojis.reply} ${embed.name} (${hyperlink(
                  embed.username!,
                  embed.profile_url
                )})`
              ),
              HeadingLevel.Three
            )
          )
        )
        .setThumbnailAccessory((builder) =>
          builder.setURL(embed.avatar_url)
        );
      if (embed.description) {
        reply_text_section.addTextDisplayComponents((builder) =>
          builder.setContent(escapeMarkdown(embed.description!))
        );
      }

      container.addSectionComponents(reply_text_section);

      if (embed.media) {
        container.addMediaGalleryComponents((builder) =>
          builder.addItems(embed.media!)
        );
      }
    } else if (embed.quote) {
      const quote_tweet = embed.quote;
      const quote_text_section = new SectionBuilder()
        .addTextDisplayComponents((builder) =>
          builder.setContent(
            heading(
              escapeHeading(
                `${quote_tweet.name} (${hyperlink(
                  quote_tweet.username!,
                  quote_tweet.profile_url
                )})`
              ),
              HeadingLevel.Three
            )
          )
        )
        .setThumbnailAccessory((builder) =>
          builder.setURL(quote_tweet.avatar_url)
        );
      if (quote_tweet.description) {
        quote_text_section.addTextDisplayComponents((builder) =>
          builder.setContent(escapeMarkdown(quote_tweet.description!))
        );
      }

      container.addSectionComponents(quote_text_section);

      if (quote_tweet.media) {
        container.addMediaGalleryComponents((builder) =>
          builder.addItems(quote_tweet.media!)
        );
      }
    }

    let stats: string[] = [];
    if (embed.stats || embed.reply?.stats) {
      stats = Object.entries(
        embed.reply ? embed.reply.stats! : embed.stats
      ).map(
        ([key, val]) =>
          `${emojis[key as keyof Emojis]} ${Embed.NumberFormatter.format(val)}`
      );
    }
    container.addSectionComponents((builder) => {
      if (stats.length > 0) {
        builder.addTextDisplayComponents((builder) =>
          builder.setContent(subtext(stats.join("      ")))
        );
      }
      return builder
        .addTextDisplayComponents((builder) =>
          builder.setContent(
            `${emojis[embed.platform]} • ${time(
              embed.timestamp,
              TimestampStyles.ShortDateTime
            )}`
          )
        )
        .setButtonAccessory((builder) =>
          builder
            .setStyle(ButtonStyle.Link)
            .setURL(embed.url)
            .setLabel(`View on ${embed.platform}`)
        );
    });

    return container.toJSON();
  }
}
