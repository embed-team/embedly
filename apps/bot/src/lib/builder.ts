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

export interface EmbedFlags {
  MediaOnly: boolean;
  SourceOnly: boolean;
  Spoiler: boolean;
}

type PostData = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

function buildMediaEmbed(media: NormalizedPost["media"], spoiler?: EmbedFlags["Spoiler"]) {
  const gallery = new MediaGalleryBuilder();
  gallery.addItems(media.map((m) => ({ media: { url: m.url }, spoiler })));

  return gallery.toJSON();
}

function addPostComponents(embed: ContainerBuilder, post: PostData) {
  embed.addSectionComponents((section) => {
    section
      .setThumbnailAccessory((thumbnail) => thumbnail.setURL(post.author.avatar))
      .addTextDisplayComponents((author) =>
        author.setContent(
          heading(
            `${post.author.name} ${post.author.handle && post.author.url ? `(${hyperlink(`@${post.author.handle}`, post.author.url)})` : ""}`,
            HeadingLevel.Three,
          ),
        ),
      );
    if (post.text && post.text.length > 0) {
      section.addTextDisplayComponents((text) =>
        text.setContent(
          truncate(
            escapeMarkdown(
              post.platform === "Twitter" && post.translation
                ? `${getEmojiByName("translation", `${post.translation.provider}_${post.translation.source_lang}_${post.translation.target_lang}`)} ${post.translation.text}`
                : (post.text ?? ""),
            ),
            2000,
          ),
        ),
      );
    }
    return section;
  });
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
    embed.addMediaGalleryComponents(buildMediaEmbed(post.media));
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
          `${getEmojiByName(post.platform)} • ${time(post.timestamp, TimestampStyles.LongDateShortTime)} • ${hyperlink(`View on ${post.platform}`, post.url)}`,
        ),
    );
}

export function buildEmbed(post: PostData, flags?: Partial<EmbedFlags>) {
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

  addPostComponents(embed, post);

  if (post.quote) {
    embed.addSeparatorComponents((sep) =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
    addPostComponents(embed, post.quote);
  }

  return embed.toJSON();
}
