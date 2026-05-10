import { Platforms } from "@embedly/platforms";
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

const NumberFormatter = new Intl.NumberFormat("en", {
  roundingMode: "ceil",
  roundingPriority: "lessPrecision",
  notation: "compact",
  maximumFractionDigits: 2,
});

export interface EmbedFlags {
  MediaOnly: boolean;
  SourceOnly: boolean;
  Spoiler: boolean;
}

type PostData = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

function buildMediaEmbed(media: PostData["media"], spoiler?: EmbedFlags["Spoiler"]) {
  const gallery = new MediaGalleryBuilder();
  gallery.addItems(media.map((m) => ({ media: { url: m.url }, spoiler })));

  return gallery.toJSON();
}

export function buildEmbed(post: PostData, flags?: Partial<EmbedFlags>) {
  if (flags?.MediaOnly) {
    return buildMediaEmbed(post.media, flags?.Spoiler);
  }

  if (flags?.SourceOnly) {
    post = {
      ...post,
      quote: undefined,
      reply_to: undefined,
    };
  }

  const embed = new ContainerBuilder();
  embed.addSectionComponents((section) =>
    section
      .setThumbnailAccessory((thumbnail) => thumbnail.setURL(post.author.avatar))
      .addTextDisplayComponents(
        (author) =>
          author.setContent(
            heading(
              `${post.author.name} ${post.author.handle && post.author.url ? `(${hyperlink(`@${post.author.handle}`, post.author.url)})` : ""}`,
              HeadingLevel.Three,
            ),
          ),
        (text) =>
          text.setContent(
            escapeMarkdown(post.text ?? "").substring(0, 2000) +
              ((post.text?.length ?? 0) > 2000 ? "..." : ""),
          ),
      ),
  );
  if (post.platform === "Twitter") {
    if (post.community_note) {
      embed.addSeparatorComponents((sep) =>
        sep.setDivider(false).setSpacing(SeparatorSpacingSize.Large),
      );
      embed.addTextDisplayComponents((note) =>
        note.setContent(
          `${subtext(`${getEmojiByName("community_note")} ${underline("Readers added context they thought people might want to know")}`)}\n${blockQuote(`${post.community_note}`)}`,
        ),
      );
    }
  }
  if (post.media.length > 0) {
    embed.addMediaGalleryComponents(buildMediaEmbed(post.media));
  }
  embed
    .addSeparatorComponents((sep) => sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large))
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
          `${getEmojiByName(post.platform)} • ${time(post.timestamp, TimestampStyles.LongDateShortTime)} • ${hyperlink(`View on ${post.platform}`, post.url)}`,
        ),
    );
  return embed.toJSON();
}
