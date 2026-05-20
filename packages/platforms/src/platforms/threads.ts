import * as cheerio from "cheerio";

import { NormalizedPost, Platform } from "../types";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:[\w-]+\.)*threads\.com\/@.*\/post\/(?<thread_shortcode>[A-Za-z0-9-_]+)/;

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function parseMedia(raw: Record<string, any>): NormalizedPost["media"] {
  if (raw.carousel_media) {
    return raw.carousel_media.map((media: any) => ({
      url: media.image_versions2.candidates[0].url,
      type: "photo",
      description: media.accessibility_caption,
    }));
  }
  if (raw.video_versions) {
    return [
      {
        url: raw.video_versions[0].url,
        type: "video",
      },
    ];
  }
  if (raw.image_versions2?.candidates?.length > 0) {
    return [
      {
        url: raw.image_versions2.candidates[0].url,
        type: "photo",
        description: raw.accessibility_caption,
      },
    ];
  }
  return [];
}

export const Threads: Platform<
  "Threads",
  Record<string, any>[],
  {
    community_note?: string;
  }
> = {
  type: "Threads",
  async match(url) {
    const match = url.match(MATCH_RE);
    if (!match) return null;

    const { thread_shortcode } = match.groups!;
    console.log(thread_shortcode);
    const thread_id = thread_shortcode
      .trim()
      .split("")
      .reduce(
        (prev, curr) => prev * BigInt(alphabet.length) + BigInt(alphabet.indexOf(curr)),
        BigInt(0),
      );
    return thread_id.toString();
  },
  async fetch(id, env) {
    console.log(id);
    const sessionResp = await fetch("https://www.threads.com/", {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "",
        "X-IG-App-ID": "238260118697367",
      },
    });
    if (!sessionResp.ok) {
      throw { code: sessionResp.status, message: sessionResp.statusText };
    }

    const cookieValues: Record<string, string | undefined> = sessionResp.headers
      .getSetCookie()
      .map((line) =>
        line.split("; ").reduce((acc, curr) => {
          const [name, ...val] = curr.split("=");
          return Object.assign({}, acc, { [name]: decodeURIComponent(val.join("=")) });
        }, {}),
      )
      .reduce((acc, curr) => Object.assign({}, acc, curr), {});

    const csrfToken = cookieValues.csrftoken;

    const sessionHTML = await sessionResp.text();
    const $SESSION = cheerio.load(sessionHTML);
    let lsd: string;
    try {
      lsd = $SESSION(`script[type="application/json"][data-sjs]`)
        .map((_ind, el) => JSON.parse($SESSION(el).text()).require)
        .filter((_ind, el) => el.includes("ScheduledServerJS"))
        .toArray()[0]
        .at(-1)
        .map((item: any) => item.__bbox)
        .filter((item: any) => Object.hasOwn(item, "define"))[0]
        .define.filter((item: any[]) => item[0] === "LSD")[0]
        .filter((item: any) => Object.hasOwn(item, "token"))[0].token;
    } catch {
      throw {
        code: 500,
        message: "Threads page structure changed: missing data script",
      };
    }

    const body = new URLSearchParams({
      lsd,
      doc_id: "27268419409422049",
      server_timestamps: "true",
      variables: JSON.stringify({
        postID: id,
        sort_order: "TOP",
        __relay_internal__pv__BarcelonaIsLoggedInrelayprovider: false,
        __relay_internal__pv__BarcelonaHasPostAuthorNotifControlsrelayprovider: true,
        __relay_internal__pv__BarcelonaShouldShowFediverseM1Featuresrelayprovider: false,
        __relay_internal__pv__BarcelonaHasInlineReplyComposerrelayprovider: false,
        __relay_internal__pv__BarcelonaHasDearAlgoConsumptionrelayprovider: true,
        __relay_internal__pv__BarcelonaHasEventBadgerelayprovider: false,
        __relay_internal__pv__BarcelonaIsSearchDiscoveryEnabledrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunitiesrelayprovider: true,
        __relay_internal__pv__BarcelonaHasGameScoreSharerelayprovider: true,
        __relay_internal__pv__BarcelonaHasPublicViewCountCardrelayprovider: true,
        __relay_internal__pv__BarcelonaHasCommunityEntityCardrelayprovider: false,
        __relay_internal__pv__BarcelonaHasScorecardCommunityrelayprovider: false,
        __relay_internal__pv__BarcelonaHasMusicrelayprovider: true,
        __relay_internal__pv__BarcelonaHasNewspaperLinkStylerelayprovider: false,
        __relay_internal__pv__BarcelonaHasMessagingrelayprovider: false,
        __relay_internal__pv__BarcelonaHasGhostPostEmojiActivationrelayprovider: false,
        __relay_internal__pv__BarcelonaOptionalCookiesEnabledrelayprovider: true,
        __relay_internal__pv__BarcelonaHasDearAlgoWebProductionrelayprovider: false,
        __relay_internal__pv__BarcelonaIsCrawlerrelayprovider: false,
        __relay_internal__pv__BarcelonaHasCommunityTopContributorsrelayprovider: false,
        __relay_internal__pv__BarcelonaCanSeeSponsoredContentrelayprovider: false,
        __relay_internal__pv__BarcelonaShouldShowFediverseM075Featuresrelayprovider: false,
        __relay_internal__pv__BarcelonaIsInternalUserrelayprovider: false,
      }),
    });

    const resp = await fetch("https://www.threads.com/graphql/query", {
      method: "POST",
      redirect: "follow",
      headers: {
        "User-Agent": sessionResp.headers.get("User-Agent") ?? env?.EMBED_USER_AGENT ?? "",
        "X-ASBD-ID": "359341",
        "X-CSRFToken": csrfToken ?? "",
        "X-FB-LSD": lsd,
        "X-IG-App-ID": "238260118697367",
        "Sec-Fetch-Site": "same-origin",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      throw { code: resp.status, message: resp.statusText };
    }

    const { data, status } = (await resp.json()) as { data?: any; status?: string };

    if (status !== "ok") {
      throw { code: 500, message: "Threads API errored" };
    }

    const posts = data?.data?.edges?.[0].node?.thread_items?.map((item: any) => item?.post);

    if (!posts) {
      throw {
        code: 500,
        message: "Threads API returned unexpected structure",
      };
    }

    return posts;
  },
  async transform(raws) {
    const raw = raws.at(-1)!;
    return {
      platform: this.type,
      author: {
        name: raw.user.full_name,
        avatar: raw.user.profile_pic_url,
        handle: raw.user.username,
        url: `https://threads.net/@${raw.user.username}`,
      },
      media: parseMedia(raw),
      text: raw.caption.text,
      stats: {
        comments: raw.text_post_app_info.direct_reply_count,
        likes: raw.like_count,
        reposts: raw.text_post_app_info.reshare_count,
      },
      reply_to: raws.length > 1 ? await this.transform([raws.at(-2)!]) : undefined,
      url: `https://threads.net/@${raw.user.username}/post/${raw.code}`,
      timestamp: raw.taken_at,
      community_note: raw.media_overlay_info?.buttons?.[0].text,
    };
  },
} as const;
