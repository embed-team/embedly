import {
  Agent,
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedDefs,
  AppBskyFeedPost,
  RichText,
  XRPCError,
} from "@atproto/api";

import { version } from "../../package.json";
import type { NormalizedPost, Platform } from "../types";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:www\.)?bsky\.app\/profile\/(?<actor>[^/?#]+)\/post\/(?<post_id>[^/?#]+)/;

type BlueskyRecordPost = AppBskyEmbedRecord.ViewRecord;
type BlueskyPost = AppBskyFeedDefs.PostView | BlueskyRecordPost;
type BlueskyData = AppBskyFeedDefs.ThreadViewPost | BlueskyRecordPost;
type BlueskyEmbed =
  | NonNullable<AppBskyFeedDefs.PostView["embed"]>
  | NonNullable<AppBskyEmbedRecord.ViewRecord["embeds"]>[number];

interface BlueskyMeta {
  external?: AppBskyEmbedExternal.ViewExternal;
}

function enrichText(record: AppBskyFeedPost.Record) {
  const richText = new RichText({ text: record.text, facets: record.facets });
  return Array.from(richText.segments())
    .map((segment) => {
      const link = segment.link;
      if (link) return `[${segment.text}](${link.uri})`;

      const mention = segment.mention;
      if (mention) return `[${segment.text}](https://bsky.app/profile/${mention.did})`;

      const tag = segment.tag;
      if (tag) return `[${segment.text}](https://bsky.app/hashtag/${encodeURIComponent(tag.tag)})`;

      return segment.text;
    })
    .join("");
}

async function parseMedia(post: BlueskyPost, record: AppBskyFeedPost.Record) {
  const media: NormalizedPost["media"] = [];
  const embeds: BlueskyEmbed[] =
    "value" in post ? [...(post.embeds ?? [])] : post.embed ? [post.embed] : [];

  for (let ind = 0; ind < embeds.length; ind++) {
    const embed = embeds[ind];

    if (AppBskyEmbedRecord.isView(embed) && AppBskyEmbedRecord.isViewRecord(embed.record)) {
      embeds.push(...(embed.record.embeds ?? []));
    }

    if (AppBskyEmbedImages.isView(embed)) {
      media.push(
        ...embed.images.map((image) => ({
          url: image.fullsize,
          type: "photo",
          description: image.alt || undefined,
        })),
      );
    }

    if (AppBskyEmbedExternal.isView(embed) && embed.external.thumb) {
      media.push({
        url: embed.external.thumb,
        type: "photo",
        description: embed.external.description || embed.external.title,
      });
    }

    if (AppBskyEmbedRecordWithMedia.isView(embed)) {
      if (AppBskyEmbedImages.isView(embed.media)) {
        media.push(
          ...embed.media.images.map((image) => ({
            url: image.fullsize,
            type: "photo",
            description: image.alt || undefined,
          })),
        );
      }

      if (AppBskyEmbedExternal.isView(embed.media) && embed.media.external.thumb) {
        media.push({
          url: embed.media.external.thumb,
          type: "photo",
          description: embed.media.external.description || embed.media.external.title,
        });
      }
    }
  }

  const video = AppBskyEmbedVideo.validateMain(record.embed);
  const recordWithMedia = AppBskyEmbedRecordWithMedia.validateMain(record.embed);
  const embeddedVideo = video.success
    ? video
    : recordWithMedia.success
      ? AppBskyEmbedVideo.validateMain(recordWithMedia.value.media)
      : undefined;

  if (embeddedVideo?.success) {
    let didURL: URL;
    if (post.author.did.startsWith("did:plc:")) {
      didURL = new URL(`/${post.author.did}`, "https://plc.directory");
    } else if (post.author.did.startsWith("did:web:")) {
      const parts = post.author.did.slice("did:web:".length).split(":").map(decodeURIComponent);
      didURL = new URL(`https://${parts[0]}`);
      didURL.pathname =
        parts.length === 1 ? "/.well-known/did.json" : `/${parts.slice(1).join("/")}/did.json`;
    } else {
      throw {
        code: 500,
        message: "Unsupported Bluesky DID method",
      };
    }

    const didResp = await fetch(didURL);
    if (!didResp.ok) {
      throw { code: didResp.status, message: didResp.statusText };
    }

    const resolved: unknown = await didResp.json();
    let pds: string | undefined;
    if (
      typeof resolved === "object" &&
      resolved !== null &&
      "service" in resolved &&
      Array.isArray(resolved.service)
    ) {
      for (const service of resolved.service) {
        if (
          typeof service === "object" &&
          service !== null &&
          "id" in service &&
          service.id === "#atproto_pds" &&
          "serviceEndpoint" in service &&
          typeof service.serviceEndpoint === "string"
        ) {
          pds = service.serviceEndpoint;
        }
      }
    }

    if (!pds) {
      throw {
        code: 500,
        message: "Bluesky DID document missing PDS endpoint",
      };
    }

    const blobURL = new URL("/xrpc/com.atproto.sync.getBlob", pds);
    blobURL.searchParams.set("did", post.author.did);
    blobURL.searchParams.set("cid", embeddedVideo.value.video.ref.toString());
    media.push({
      url: blobURL.toString(),
      type: embeddedVideo.value.presentation === "gif" ? "gif" : "video",
      description: embeddedVideo.value.alt,
    });
  }

  return media;
}

export const Bluesky: Platform<"Bluesky", BlueskyData, BlueskyMeta> = {
  type: "Bluesky",
  async match(url) {
    const groups = url.match(MATCH_RE)?.groups;
    if (!groups) return null;

    return `at://${groups.actor}/app.bsky.feed.post/${groups.post_id}`;
  },
  async fetch(id, env) {
    const agent = new Agent({
      service: "https://public.api.bsky.app",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? `Embedly/${version}`,
      },
    });

    try {
      const resp = await agent.getPostThread({
        uri: id,
        depth: 0,
        parentHeight: 1,
      });
      const thread = resp.data.thread;
      if (AppBskyFeedDefs.isThreadViewPost(thread)) {
        const record = AppBskyFeedPost.validateRecord(thread.post.record);
        if (!record.success) {
          throw {
            code: 500,
            message: "Bluesky API returned unexpected post record",
          };
        }
        return thread;
      }

      if (AppBskyFeedDefs.isNotFoundPost(thread)) {
        throw { code: 404, message: "Bluesky post not found" };
      }

      if (AppBskyFeedDefs.isBlockedPost(thread)) {
        throw { code: 403, message: "Bluesky post is blocked" };
      }

      throw {
        code: 500,
        message: "Bluesky API returned unexpected thread structure",
      };
    } catch (error) {
      if (error instanceof XRPCError) {
        throw { code: error.status, message: error.message };
      }
      throw error;
    }
  },
  async transform(raw, options) {
    const depth = options?.depth ?? 0;
    const includeContext = depth < 1;
    const post: BlueskyPost = "post" in raw ? raw.post : raw;
    const record = AppBskyFeedPost.validateRecord("value" in post ? post.value : post.record);
    if (!record.success) {
      throw {
        code: 500,
        message: "Bluesky API returned unexpected post record",
      };
    }
    const embeds = "value" in post ? (post.embeds ?? []) : post.embed ? [post.embed] : [];
    let quote: BlueskyRecordPost | undefined;
    let external: AppBskyEmbedExternal.ViewExternal | undefined;
    for (const embed of embeds) {
      if (AppBskyEmbedExternal.isView(embed)) {
        external = embed.external;
      }
      if (AppBskyEmbedRecord.isView(embed) && AppBskyEmbedRecord.isViewRecord(embed.record)) {
        quote = embed.record;
      }
      if (AppBskyEmbedRecordWithMedia.isView(embed)) {
        if (AppBskyEmbedExternal.isView(embed.media)) {
          external = embed.media.external;
        }
        if (AppBskyEmbedRecord.isViewRecord(embed.record.record)) {
          quote = embed.record.record;
        }
      }
    }
    const postID = post.uri.split("/").at(-1);
    const timestamp = Date.parse(record.value.createdAt);

    return {
      platform: this.type,
      author: {
        name: post.author.displayName || post.author.handle,
        handle: post.author.handle,
        url: `https://bsky.app/profile/${post.author.handle}`,
        avatar: post.author.avatar ?? "",
      },
      url: postID
        ? `https://bsky.app/profile/${post.author.handle}/post/${postID}`
        : `https://bsky.app/profile/${post.author.handle}`,
      text: enrichText(record.value),
      timestamp: Number.isNaN(timestamp) ? 0 : Math.floor(timestamp / 1000),
      stats: {
        comments: post.replyCount,
        reposts: post.repostCount,
        likes: post.likeCount,
      },
      media: await parseMedia(post, record.value),
      quote:
        includeContext && quote ? await this.transform(quote, { depth: depth + 1 }) : undefined,
      reply_to:
        includeContext && "post" in raw && AppBskyFeedDefs.isThreadViewPost(raw.parent)
          ? await this.transform(raw.parent, { depth: depth + 1 })
          : undefined,
      external,
    };
  },
};
