import { Platforms } from "@embedly/platforms";
import { ContainerBuilder, MediaGalleryBuilder } from "discord.js";

export interface EmbedFlags {
  MediaOnly: boolean;
  SourceOnly: boolean;
  Spoiler: boolean;
}

type PostData = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;

function buildMediaOnlyEmbed(media: PostData["media"], spoiler?: EmbedFlags["Spoiler"]) {
  if (!media || media.length === 0) {
    return null;
  }
  const gallery = new MediaGalleryBuilder();
  gallery.addItems(media.map((m) => ({ media: { url: m.url }, spoiler })));

  return gallery.toJSON();
}

export function buildEmbed(post: PostData, flags?: Partial<EmbedFlags>) {
  if (flags?.MediaOnly) {
    return buildMediaOnlyEmbed(post.media, flags?.Spoiler);
  }

  if (flags?.SourceOnly) {
    post = {
      ...post,
      quote: undefined,
      reply_to: undefined,
    };
  }

  const container = new ContainerBuilder();
  return container.toJSON();
}
