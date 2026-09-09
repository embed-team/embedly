import { Platforms, type NormalizedPost } from "@embedly/platforms";
import {
  ContainerBuilder,
  escapeMarkdown,
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
import { truncate } from "./utils";

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

function buildMediaEmbed(media: NormalizedPost["media"], spoiler?: EmbedFlags["Spoiler"]) {
  if (media.length === 0) return null;

  const gallery = new MediaGalleryBuilder();
  gallery.addItems(
    media.slice(0, MAX_GALLERY_ITEMS).map((m) => ({
      media: { url: m.url },
      description: m.description?.slice(0, 1024) || undefined,
      spoiler,
    })),
  );

  return gallery.toJSON();
}

function addPostComponents(embed: ContainerBuilder, post: PostData, headingPrefix?: string) {
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
      : post.author.name;
  const authorHeading = [headingPrefix, authorName, authorHandle].filter(Boolean).join(" ");

  embed.addSectionComponents((section) => {
    section
      .setThumbnailAccessory((thumbnail) => thumbnail.setURL(post.author.avatar))
      .addTextDisplayComponents((author) =>
        author.setContent(heading(authorHeading, HeadingLevel.Three)),
      );
    if (post.platform === "FacebookMarketplace" && post.price) {
      const price = post.price;
      section.addTextDisplayComponents((display) => display.setContent(escapeMarkdown(price)));
    }
    if (post.text && post.text.length > 0) {
      section.addTextDisplayComponents((text) =>
        text.setContent(
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
    return section;
  });
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
  if (post.media.length > 0) {
    embed.addMediaGalleryComponents(buildMediaEmbed(post.media)!);
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
    embed.addTextDisplayComponents((footer) =>
      footer.setContent(
        `${time(post.timestamp, TimestampStyles.RelativeTime)} • ${hyperlink("View on Facebook Marketplace", post.url)}`,
      ),
    );
    return;
  }
  embed
    .addSeparatorComponents((sep) => sep.setDivider(false).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      (stats) =>
        stats.setContent(
          subtext(
            Object.entries(post.stats ?? {})
              .map(([key, val]) => `${getEmojiByName(key)} ${NumberFormatter.format(val)}`)
              .join("     "),
          ),
        ),
      (footer) =>
        footer.setContent(
          `${getEmojiByName(post.platform)} • ${time(post.timestamp, TimestampStyles.LongDateShortTime)} • ${hyperlink(`View on ${platformName}`, post.url)}`,
        ),
    );
}

export function buildEmbed(post: PostData, flags?: Partial<EmbedFlags>) {
  if (post.platform === "FacebookMarketplace" && post.media.length === 0) return null;
  if (flags?.MediaOnly) {
    return buildMediaEmbed(post.media, flags?.Spoiler);
  }

  const embed = new ContainerBuilder();

  if (flags?.Spoiler) {
    embed.setSpoiler(true);
  }

  if (flags?.SourceOnly) {
    addPostComponents(embed, post);
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
