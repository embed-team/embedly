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
  replying_to?: BaseEmbedDataWithoutPlatform;
}

export enum EmbedFlags {
  MediaOnly = "MediaOnly",
  SourceOnly = "SourceOnly",
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
  public replying_to?: BaseEmbedDataWithoutPlatform;

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

  public setQuote(quote: BaseEmbedDataWithoutPlatform) {
    this.quote = quote;
  }

  public setReplyingTo(replying_to: BaseEmbedDataWithoutPlatform) {
    this.replying_to = replying_to;
  }

  static getDiscordEmbed(
    embed: Embed,
    flags?: Partial<Record<EmbedFlags, boolean>>
  ) {
    const media_only = flags?.[EmbedFlags.MediaOnly];
    const source_only = flags?.[EmbedFlags.SourceOnly];
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
    Embed.addPrimaryContentSection(container, embed, source_only);

    // Add primary media (reply media if exists, otherwise main media)
    Embed.addPrimaryMedia(container, embed, source_only);

    // Add secondary content (reply/quote) - skip if source_only
    if (!source_only) {
      Embed.addSecondaryContent(container, embed);
    }

    // Add footer with stats and metadata
    Embed.addFooterSection(container, embed);

    return container.toJSON();
  }

  private static buildMediaOnlyEmbed(embed: Embed, hidden?: boolean) {
    const media =
      embed.quote?.media || embed.media || embed.replying_to?.media;

    if (!media || media.length === 0) {
      return null;
    }

    const gallery = new MediaGalleryBuilder();
    gallery.addItems(media.map((m) => ({ ...m, spoiler: hidden })));

    return gallery.toJSON();
  }

  private static addPrimaryContentSection(
    container: ContainerBuilder,
    embed: Embed,
    source_only?: boolean
  ) {
    let author_name: string;
    let author_username: string | undefined;
    let author_profile_url: string | undefined;
    let author_avatar_url: string;
    let author_description: string | undefined;
    let prefix_emoji = "";

    if (source_only || !embed.replying_to) {
      author_name = embed.name;
      author_username = embed.username;
      author_profile_url = embed.profile_url;
      author_description = embed.description;
      author_avatar_url = embed.avatar_url;
      prefix_emoji = !source_only && embed.quote ? emojis.quote : "";
    } else {
      // Show reply content first (only when not source_only)
      author_name = embed.replying_to.name;
      author_username = embed.replying_to.username;
      author_profile_url = embed.replying_to.profile_url;
      author_avatar_url = embed.replying_to.avatar_url;
      author_description = embed.replying_to.description;
    }

    const text_section = Embed.createAuthorSection(
      author_name,
      author_username,
      author_profile_url,
      author_avatar_url,
      author_description,
      prefix_emoji
    );

    container.addSectionComponents(text_section);
  }

  private static addPrimaryMedia(
    container: ContainerBuilder,
    embed: Embed,
    source_only?: boolean
  ) {
    let media: APIMediaGalleryItem[] | undefined;
    if (source_only) {
      // For source_only, use main embed's media
      media = embed.media;
    } else if (embed.replying_to) {
      // For replies, show parent's media first (derek's media)
      media = embed.replying_to.media;
    } else {
      // Otherwise use main embed's media
      media = embed.media;
    }

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
    if (!embed.replying_to && !embed.quote) {
      return;
    }

    // Add separator
    container.addSeparatorComponents((builder) =>
      builder.setDivider(true).setSpacing(SeparatorSpacingSize.Large)
    );

    if (embed.replying_to) {
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
      ? ` (${hyperlink(`@${escapeMarkdown(username, { italic: true, underline: true })}`, profile_url)})`
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
    const stats_data = embed.replying_to
      ? embed.replying_to.stats
      : embed.stats;

    if (!stats_data) {
      return [];
    }

    return Object.entries(stats_data).map(
      ([key, val]) =>
        `${emojis[key as keyof Emojis]} ${Embed.NumberFormatter.format(val)}`
    );
  }
}
