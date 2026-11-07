import { Platforms, type NormalizedPost } from "@embedly/platforms";
import {
  ContainerBuilder,
  TextDisplayBuilder,
  heading,
  HeadingLevel,
  hyperlink,
  MediaGalleryBuilder,
  time,
  TimestampStyles,
  subtext,
  SeparatorSpacingSize,
  blockQuote,
  underline,
} from "discord.js";

import { getEmojiByName } from "./emojis";
import { signProxyURL } from "./proxy";
import { escapeMarkdown, truncate } from "./utils";

const NumberFormatter = new Intl.NumberFormat("en", {
  roundingMode: "ceil",
  roundingPriority: "lessPrecision",
  notation: "compact",
  maximumFractionDigits: 2,
});
const VoteNumberFormatter = new Intl.NumberFormat("en");

const MAX_GALLERY_ITEMS = 10;
const POLL_BAR_SIZE = 20;

export interface EmbedFlags {
  Compact: boolean;
  MediaOnly: boolean;
  SourceOnly: boolean;
  Spoiler: boolean;
}

type PostData = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;
type TwitterPoll = NonNullable<Extract<PostData, { platform: "Twitter" }>["poll"]>;

function renderPoll(poll: TwitterPoll) {
  const choices = poll.choices
    .map((choice) => {
      const percentage = Math.min(Math.max(choice.percentage, 0), 100);
      const filledSize = Math.round((percentage / 100) * POLL_BAR_SIZE);
      const bar = "█".repeat(filledSize) + "░".repeat(POLL_BAR_SIZE - filledSize);

      return `${escapeMarkdown(choice.label)}  **${Math.round(percentage)}%**\n${bar}`;
    })
    .join("\n");
  const voteLabel = poll.total_votes === 1 ? "vote" : "votes";
  const status =
    Date.parse(poll.ends_at) > Date.now() ? `${poll.time_left_en} left` : "Final results";

  return `${choices}\n${subtext(`${VoteNumberFormatter.format(poll.total_votes)} ${voteLabel} • ${status}`)}`;
}

function buildMediaEmbed(post: NormalizedPost, spoiler?: EmbedFlags["Spoiler"]) {
  if (post.media.length === 0) return null;

  const gallery = new MediaGalleryBuilder();
  gallery.addItems(
    post.media.slice(0, MAX_GALLERY_ITEMS).map((m) => ({
      media: {
        url:
          post.platform === "TikTok" && m.type === "video"
            ? signProxyURL(m.url, "/api/_media")
            : post.platform === "TruthSocial" && m.type === "image"
              ? signProxyURL(m.url)
              : m.url,
      },
      description: m.description?.slice(0, 1024) || undefined,
      spoiler,
    })),
  );

  return gallery.toJSON();
}

function addPostComponents(
  embed: ContainerBuilder,
  post: PostData,
  flags?: Partial<EmbedFlags>,
  headingPrefix?: string,
) {
  const platformName = post.platform === "TruthSocial" ? "Truth Social" : post.platform;
  const poll = post.platform === "Twitter" ? post.poll : undefined;
  const translation =
    post.platform === "Twitter" &&
    post.translation &&
    post.translation.text.trim().length > 0 &&
    post.translation.text !== post.text &&
    post.translation.source_lang !== "en"
      ? post.translation
      : undefined;
  const authorHandle =
    post.author.handle && post.author.url
      ? `(${hyperlink(`@${post.author.handle}`, post.author.url)})`
      : "";
  const authorName =
    post.platform === "FacebookMarketplace"
      ? truncate(escapeMarkdown(post.author.name), 250)
      : flags?.Compact
        ? escapeMarkdown(post.author.name)
        : post.author.name;
  const authorHeading = [headingPrefix, authorName, authorHandle].filter(Boolean).join(" ");

  const textComponents = [
    new TextDisplayBuilder().setContent(
      flags?.Compact
        ? `**${authorName}** ${authorHandle}`.trimEnd()
        : heading(authorHeading, HeadingLevel.Three),
    ),
  ];
  if (flags?.Compact && !flags.SourceOnly && post.reply_to) {
    const parent = post.reply_to;
    const name = escapeMarkdown(
      parent.author.handle ? `@${parent.author.handle}` : parent.author.name,
    );
    textComponents.push(
      new TextDisplayBuilder().setContent(subtext(`Replying to ${hyperlink(name, parent.url)}`)),
    );
  }
  if (post.platform === "FacebookMarketplace" && post.price) {
    textComponents.push(new TextDisplayBuilder().setContent(escapeMarkdown(post.price)));
  }
  if (post.text && post.text.length > 0) {
    textComponents.push(
      new TextDisplayBuilder().setContent(
        truncate(
          escapeMarkdown(
            translation
              ? `${getEmojiByName("translation", `${translation.provider}_${translation.source_lang}_${translation.target_lang}`)} ${translation.text}`
              : (post.text ?? ""),
          ),
          1500,
        ),
      ),
    );
  }
  if (flags?.Compact) {
    embed.addTextDisplayComponents(textComponents);
  } else {
    embed.addSectionComponents((section) =>
      section
        .setThumbnailAccessory((thumbnail) =>
          thumbnail.setURL(
            post.platform === "TruthSocial" ? signProxyURL(post.author.avatar) : post.author.avatar,
          ),
        )
        .addTextDisplayComponents(textComponents),
    );
  }
  if (poll?.choices.length) {
    embed.addTextDisplayComponents((display) => display.setContent(renderPoll(poll)));
  }
  if (post.platform === "Twitter" || post.platform === "Threads") {
    if (post.community_note) {
      embed.addSeparatorComponents((sep) =>
        sep.setDivider(false).setSpacing(SeparatorSpacingSize.Large),
      );
      embed.addTextDisplayComponents((note) =>
        note.setContent(
          `${subtext(`${getEmojiByName("community_note")} ${underline("Readers added context they thought people might want to know")}`)}\n${blockQuote(truncate(`${post.community_note}`, 500))}`,
        ),
      );
    }
  }
  if (flags?.Compact && !flags.SourceOnly && post.quote) {
    const quote = post.quote;
    const author = escapeMarkdown(
      [quote.author.name, quote.author.handle ? `(@${quote.author.handle})` : ""]
        .filter(Boolean)
        .join(" "),
    );
    embed.addTextDisplayComponents((display) =>
      display.setContent(
        blockQuote(
          `**Quoting ${hyperlink(author, quote.url)}**${quote.text ? `\n${truncate(escapeMarkdown(quote.text), 1500)}` : ""}`,
        ),
      ),
    );
  }
  if (post.media.length > 0) {
    embed.addMediaGalleryComponents(buildMediaEmbed(post)!);
  }
  if (post.platform === "FacebookMarketplace") {
    const { location, map } = post;
    if (location) {
      embed.addTextDisplayComponents((display) =>
        display.setContent(`${escapeMarkdown(location)} · Location is approximate`),
      );
    }
    if (map) {
      embed.addMediaGalleryComponents((gallery) =>
        gallery.addItems({
          media: { url: map },
          description: (location
            ? `Map showing approximate listing location in ${location}.`
            : "Map showing approximate listing location."
          ).slice(0, 1024),
        }),
      );
    }
    const footer = `${time(post.timestamp, TimestampStyles.RelativeTime)} • ${hyperlink("View on Facebook Marketplace", post.url)}`;
    embed.addTextDisplayComponents((display) =>
      display.setContent(flags?.Compact ? subtext(footer) : footer),
    );
    return;
  }
  if (!flags?.Compact) {
    const stats = Object.entries(post.stats ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${getEmojiByName(key)} ${NumberFormatter.format(value)}`)
      .join("     ");
    embed.addSeparatorComponents((sep) =>
      sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    );
    if (stats) embed.addTextDisplayComponents((display) => display.setContent(subtext(stats)));
  }
  const footer = `${getEmojiByName(post.platform)} • ${time(post.timestamp, TimestampStyles.LongDateShortTime)} • ${hyperlink(`View on ${platformName}`, post.url)}`;
  embed.addTextDisplayComponents((display) =>
    display.setContent(flags?.Compact ? subtext(footer) : footer),
  );
}

export function buildEmbed(post: PostData, flags?: Partial<EmbedFlags>) {
  if (post.platform === "FacebookMarketplace" && post.media.length === 0) return null;
  if (flags?.MediaOnly) {
    return buildMediaEmbed(post, flags?.Spoiler);
  }

  const embed = new ContainerBuilder();

  if (flags?.Spoiler) {
    embed.setSpoiler(true);
  }

  if (flags?.SourceOnly || flags?.Compact) {
    addPostComponents(embed, post, flags);
    return embed.toJSON();
  }

  if (post.reply_to) {
    addPostComponents(embed, post.reply_to);
    embed.addSeparatorComponents((sep) =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  addPostComponents(
    embed,
    post,
    undefined,
    post.reply_to ? getEmojiByName("reply") : post.quote ? getEmojiByName("quote") : undefined,
  );

  if (post.quote) {
    embed.addSeparatorComponents((sep) =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
    addPostComponents(embed, post.quote);
  }

  return embed.toJSON();
}
