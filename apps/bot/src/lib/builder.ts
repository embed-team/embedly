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

const MAX_GALLERY_ITEMS = 10;

export interface EmbedFlags {
  MediaOnly: boolean;
  SourceOnly: boolean;
  Spoiler: boolean;
}

type PostData = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

async function resolveMedia(media: NormalizedPost["media"]) {
  const resolved = [];
  for (const item of media) {
    if (item.type !== "video" || !item.url.includes("tiktok")) {
      resolved.push(item);
      continue;
    }

    const response = await fetch(item.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        Range: "bytes=0-0",
        "User-Agent": "Discordbot/2.0",
      },
    });
    await response.body?.cancel();
    if (!response.ok || !response.headers.get("Content-Type")?.startsWith("video/")) continue;
    resolved.push({ ...item, url: response.url });
  }
  return resolved;
}

function buildMediaEmbed(media: NormalizedPost["media"], spoiler?: EmbedFlags["Spoiler"]) {
  if (media.length === 0) return null;

  const gallery = new MediaGalleryBuilder();
  gallery.addItems(
    media.slice(0, MAX_GALLERY_ITEMS).map((m) => ({ media: { url: m.url }, spoiler })),
  );

  return gallery.toJSON();
}

async function addPostComponents(embed: ContainerBuilder, post: PostData, headingPrefix?: string) {
  const translation =
    post.platform === "Twitter" &&
    post.translation &&
    post.translation.text.trim().length > 0 &&
    post.translation.source_lang !== "en"
      ? post.translation
      : undefined;
  const authorHandle =
    post.author.handle && post.author.url
      ? `(${hyperlink(`@${post.author.handle}`, post.author.url)})`
      : "";
  const authorHeading = [headingPrefix, post.author.name, authorHandle].filter(Boolean).join(" ");

  embed.addSectionComponents((section) => {
    section
      .setThumbnailAccessory((thumbnail) => thumbnail.setURL(post.author.avatar))
      .addTextDisplayComponents((author) =>
        author.setContent(heading(authorHeading, HeadingLevel.Three)),
      );
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
  const media = await resolveMedia(post.media);
  if (media.length > 0) {
    embed.addMediaGalleryComponents(buildMediaEmbed(media)!);
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

export async function buildEmbed(post: PostData, flags?: Partial<EmbedFlags>) {
  if (flags?.MediaOnly) {
    return buildMediaEmbed(await resolveMedia(post.media), flags?.Spoiler);
  }

  const embed = new ContainerBuilder();

  if (flags?.Spoiler) {
    embed.setSpoiler(true);
  }

  if (flags?.SourceOnly) {
    await addPostComponents(embed, post);
    return embed.toJSON();
  }

  if (post.reply_to) {
    await addPostComponents(embed, post.reply_to);
    embed.addSeparatorComponents((sep) =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
  }

  await addPostComponents(
    embed,
    post,
    post.reply_to ? getEmojiByName("reply") : post.quote ? getEmojiByName("quote") : undefined,
  );

  if (post.quote) {
    embed.addSeparatorComponents((sep) =>
      sep.setDivider(true).setSpacing(SeparatorSpacingSize.Large),
    );
    await addPostComponents(embed, post.quote);
  }

  return embed.toJSON();
}
