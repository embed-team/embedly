import {
  ContainerBuilder,
  escapeHeading,
  escapeMarkdown,
  HeadingLevel,
  heading,
  hyperlink,
  MediaGalleryBuilder,
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
  public description?: string;
  public media?: APIMediaGalleryItem[];
  public quote?: BaseEmbedDataWithoutPlatform;
  public reply?: BaseEmbedDataWithoutPlatform;

  static NumberFormatter = new Intl.NumberFormat("en", {
    roundingMode: "ceil",
    roundingPriority: "lessPrecision",
    notation: "compact",
    maximumFractionDigits: 2
  });

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

    if (media_only) {
      return Embed.buildMediaOnlyEmbed(embed, hidden);
    }

    const container = new ContainerBuilder();
    container.setAccentColor(EmbedlyPlatformColors[embed.platform]);

    if (hidden) {
      container.setSpoiler(true);
    }

    // Add primary content section (reply content if exists, otherwise main content)
    Embed.addPrimaryContentSection(container, embed);

    // Add primary media (reply media if exists, otherwise main media)
    Embed.addPrimaryMedia(container, embed);

    // Add secondary content (main content after reply, or quote)
    Embed.addSecondaryContent(container, embed);

    // Add footer with stats and metadata
    Embed.addFooterSection(container, embed);

    return container.toJSON();
  }

  private static buildMediaOnlyEmbed(embed: Embed, hidden?: boolean) {
    const media = embed.reply?.media || embed.media;

    if (!media || media.length === 0) {
      return null;
    }

    const gallery = new MediaGalleryBuilder();
    gallery.addItems(media.map((m) => ({ ...m, spoiler: hidden })));

    return gallery.toJSON();
  }

  private static addPrimaryContentSection(
    container: ContainerBuilder,
    embed: Embed
  ) {
    let author_name: string;
    let author_username: string | undefined;
    let author_profile_url: string | undefined;
    let author_description: string | undefined;
    let prefix_emoji = "";

    if (embed.reply) {
      // Show reply content first
      author_name = embed.reply.name;
      author_username = embed.reply.username;
      author_profile_url = embed.reply.profile_url;
      author_description = embed.reply.description;
    } else {
      // Show main content with quote emoji if it's a quote
      author_name = embed.name;
      author_username = embed.username;
      author_profile_url = embed.profile_url;
      author_description = embed.description;
      prefix_emoji = embed.quote ? emojis.quote : "";
    }

    const text_section = Embed.createAuthorSection(
      author_name,
      author_username,
      author_profile_url,
      embed.avatar_url,
      author_description,
      prefix_emoji
    );

    container.addSectionComponents(text_section);
  }

  private static addPrimaryMedia(
    container: ContainerBuilder,
    embed: Embed
  ) {
    const media = embed.reply?.media || embed.media;

    if (media) {
      container.addMediaGalleryComponents((builder) =>
        builder.addItems(media)
      );
    }
  }

  private static addSecondaryContent(
    container: ContainerBuilder,
    embed: Embed
  ) {
    if (!embed.reply && !embed.quote) {
      return;
    }

    // Add separator
    container.addSeparatorComponents((builder) =>
      builder.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    if (embed.reply) {
      // Show original content after reply
      Embed.addOriginalContentAfterReply(container, embed);
    } else if (embed.quote) {
      // Show quote content
      Embed.addQuoteContent(container, embed.quote);
    }
  }

  private static addOriginalContentAfterReply(
    container: ContainerBuilder,
    embed: Embed
  ) {
    const reply_section = Embed.createAuthorSection(
      embed.name,
      embed.username,
      embed.profile_url,
      embed.avatar_url,
      embed.description,
      emojis.reply
    );

    container.addSectionComponents(reply_section);

    if (embed.media) {
      container.addMediaGalleryComponents((builder) =>
        builder.addItems(embed.media ?? [])
      );
    }
  }

  private static addQuoteContent(
    container: ContainerBuilder,
    quote: BaseEmbedDataWithoutPlatform
  ) {
    const quote_section = Embed.createAuthorSection(
      quote.name,
      quote.username,
      quote.profile_url,
      quote.avatar_url,
      quote.description
    );

    container.addSectionComponents(quote_section);

    if (quote.media) {
      container.addMediaGalleryComponents((builder) =>
        builder.addItems(quote.media ?? [])
      );
    }
  }

  private static createAuthorSection(
    name: string,
    username: string | undefined,
    profile_url: string | undefined,
    avatar_url: string,
    description: string | undefined,
    prefix_emoji: string = ""
  ): SectionBuilder {
    const author_text = Embed.formatAuthorHeading(
      name,
      username,
      profile_url,
      prefix_emoji
    );

    const section = new SectionBuilder()
      .addTextDisplayComponents((builder) =>
        builder.setContent(author_text)
      )
      .setThumbnailAccessory((builder) => builder.setURL(avatar_url));

    if (description) {
      section.addTextDisplayComponents((builder) =>
        builder.setContent(escapeMarkdown(description))
      );
    }

    return section;
  }

  private static formatAuthorHeading(
    name: string,
    username: string | undefined,
    profile_url: string | undefined,
    prefix_emoji: string
  ): string {
    const username_part = username
      ? ` (${hyperlink(`@${username}`, profile_url)})`
      : "";

    const full_text = `${prefix_emoji} ${name}${username_part}`.trim();

    return heading(escapeHeading(full_text), HeadingLevel.Three);
  }

  private static addFooterSection(
    container: ContainerBuilder,
    embed: Embed
  ) {
    const stats = Embed.formatStats(embed);

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
  }

  private static formatStats(embed: Embed): string[] {
    const stats_data = embed.reply ? embed.reply.stats : embed.stats;

    if (!stats_data) {
      return [];
    }

    return Object.entries(stats_data).map(
      ([key, val]) =>
        `${emojis[key as keyof Emojis]} ${Embed.NumberFormatter.format(val)}`
    );
  }
}
