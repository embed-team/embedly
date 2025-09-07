import { Embed } from "@embedly/builder";
import {
  EMBEDLY_FAILED_INSTAGRAM,
  EMBEDLY_FETCH_INSTAGRAM
} from "@embedly/logging";
import { THREADS_REGEX } from "@embedly/parser";
import {
  type BaseEmbedData,
  EmbedlyPlatformType
} from "@embedly/types";
import { EmbedlyPlatform } from "./Platform.ts";

const alphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export class Threads extends EmbedlyPlatform {
  constructor() {
    super(EmbedlyPlatformType.Threads, "threads", {
      fetching: EMBEDLY_FETCH_INSTAGRAM,
      failed: EMBEDLY_FAILED_INSTAGRAM
    });
  }

  async parsePostId(url: string): Promise<string> {
    const match = THREADS_REGEX.exec(url)!;
    const { thread_shortcode } = match.groups!;
    const thread_id = thread_shortcode
      .split("")
      .reduce(
        (prev, curr) =>
          prev * BigInt(64) + BigInt(alphabet.indexOf(curr)),
        BigInt(0)
      );
    return `${thread_id}`;
  }

  async fetchPost(
    thread_id: string,
    env: {
      EMBED_USER_AGENT: string;
      THREADS_CSRF_TOKEN: string;
    }
  ): Promise<any> {
    const graphql = new URL(`https://www.threads.com/graphql/query`);
    graphql.searchParams.set(
      "variables",
      JSON.stringify({
        postID: thread_id,
        sort_order: "TOP",
        __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: true,
        __relay_internal__pv__BarcelonaHasSelfReplyContextrelayprovider: false,
        __relay_internal__pv__BarcelonaShouldShowFediverseM1Featuresrelayprovider: true,
        __relay_internal__pv__BarcelonaHasInlineReplyComposerrelayprovider: true,
        __relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
        __relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: true,
        __relay_internal__pv__IsTagIndicatorEnabledrelayprovider: false,
        __relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: true,
        __relay_internal__pv__BarcelonaHasSelfThreadCountrelayprovider: false,
        __relay_internal__pv__BarcelonaHasSpoilerStylingInforelayprovider: true,
        __relay_internal__pv__BarcelonaHasDeepDiverelayprovider: false,
        __relay_internal__pv__BarcelonaQuotedPostUFIEnabledrelayprovider: false,
        __relay_internal__pv__BarcelonaHasTopicTagsrelayprovider: true,
        __relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
        __relay_internal__pv__BarcelonaHasDisplayNamesrelayprovider: false,
        __relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: true,
        __relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: true,
        __relay_internal__pv__BarcelonaImplicitTrendsGKrelayprovider: false,
        __relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
        __relay_internal__pv__BarcelonaInlineComposerEnabledrelayprovider: false
      })
    );
    graphql.searchParams.set("doc_id", "23917460264622451");
    graphql.searchParams.set("lsd", "UpH8MtbTBKi8Wbdbt_uZX3");
    graphql.searchParams.set("server_timestamps", "true");

    const resp = await fetch(graphql.toString(), {
      method: "POST",
      headers: {
        "User-Agent": env.EMBED_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-IG-App-ID": "238260118697367",
        "X-CSRFTOKEN": env.THREADS_CSRF_TOKEN,
        "X-FB-LSD": "UpH8MtbTBKi8Wbdbt_uZX3",
        "X-ASBD-ID": "359341",
        "Sec-Fetch-Site": "same-origin"
      }
    });
    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }
    const { data } = (await resp.json()) as Record<string, any>;
    return data.data.edges[0].node.thread_items[0].post;
  }

  parsePostMedia(
    post_data: Record<string, any>
  ): Parameters<Embed["setMedia"]>[0] {
    if (post_data.carousel_media) {
      console.log(JSON.stringify(post_data.carousel_media, null, 2));
      return post_data.carousel_media.map((media: any) => ({
        media: {
          url: media.image_versions2.candidates[0].url
        },
        description: media.accessibility_caption
      }));
    }
    if (post_data.video_versions) {
      return [
        {
          media: {
            url: post_data.video_versions[0].url
          }
        }
      ];
    }
    if (post_data.image_versions2) {
      return [
        {
          media: {
            url: post_data.image_versions2.candidates[0].url
          },
          description: post_data.accessibility_caption
        }
      ];
    }
    return [];
  }

  transformRawData(raw_data: any): BaseEmbedData {
    return {
      platform: this.name,
      name: raw_data.user.full_name,
      username: raw_data.user.username,
      profile_url: `https://threads.com/@${raw_data.user.username}`,
      avatar_url: raw_data.user.profile_pic_url,
      timestamp: raw_data.taken_at,
      url: `https://threads.com/@${raw_data.user.username}/post/${raw_data.code}`,
      stats: {
        comments: raw_data.text_post_app_info.direct_reply_count,
        likes: raw_data.like_count,
        reposts: raw_data.text_post_app_info.reshare_count
      },
      description: raw_data.caption.text
    };
  }

  createEmbed(post_data: any): Embed {
    const embed = new Embed(this.transformRawData(post_data));
    const media = this.parsePostMedia(post_data);
    if (media.length > 10) {
      media.length = 10;
    }
    embed.setMedia(media);

    return embed;
  }
}
