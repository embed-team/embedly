import * as cheerio from "cheerio";

import type { Platform } from "../types";
import type {
  MarketplaceData,
  MarketplaceListing,
  MarketplaceMeta,
  MarketplacePhotos,
} from "./facebook-marketplace.d";

const MATCH_RE =
  /^(?:https?:\/\/)?(?:www\.|m\.)?facebook\.com\/marketplace\/item\/(\d+)\/?(?:[?#].*)?$/;
const LISTING_PREFIX = "adp_MarketplacePDPContainerQueryRelayPreloader_";
const PHOTOS_PREFIX = "adp_MarketplacePDPC2CMediaViewerWithImagesQueryRelayPreloader_";

export const FacebookMarketplace: Platform<
  "FacebookMarketplace",
  MarketplaceData,
  MarketplaceMeta
> = {
  type: "FacebookMarketplace",
  async match(url) {
    return url.match(MATCH_RE)?.[1] ?? null;
  },
  async fetch(id, env) {
    if (!/^\d+$/.test(id)) {
      throw { code: 400, message: "Invalid Marketplace listing ID" };
    }
    const response = await fetch(`https://www.facebook.com/marketplace/item/${id}/`, {
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "",
        Cookie: env?.FACEBOOK_MARKETPLACE_COOKIE ?? "",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
    });
    if (!response.ok) throw { code: response.status, message: response.statusText };

    const html = await response.text();
    const $ = cheerio.load(html);
    let listing: MarketplaceListing | undefined;
    let photos: MarketplacePhotos | undefined;
    let mapTemplate: string | undefined;

    for (const element of $('script[type="application/json"][data-sjs]').toArray()) {
      const text = $(element).text();
      if (
        !text.includes(LISTING_PREFIX) &&
        !text.includes(PHOTOS_PREFIX) &&
        !text.includes('"TilesMapConfig"')
      )
        continue;
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw { code: 500, message: "Failed to parse Marketplace data" };
      }
      for (const requireItem of data.require ?? []) {
        if (requireItem[0] !== "ScheduledServerJS") continue;
        for (const payload of requireItem[3] ?? []) {
          const box = payload.__bbox;
          for (const definition of box?.define ?? []) {
            if (definition[0] === "TilesMapConfig") {
              mapTemplate = definition[2]?.STATIC_MAP_URL_TEMPLATE;
            }
          }
          for (const item of box?.require ?? []) {
            if (item[0] !== "RelayPrefetchedStreamCache") continue;
            const [key, value] = item[3];
            const target =
              value?.__bbox?.result?.data?.viewer?.marketplace_product_details_page?.target;
            if (target?.id !== id) continue;
            if (key.startsWith(LISTING_PREFIX)) {
              // SAFETY: this preloader's target matches the requested listing ID and observed listing shape.
              listing = target as MarketplaceListing;
            }
            if (key.startsWith(PHOTOS_PREFIX)) {
              // SAFETY: this preloader's target matches the requested listing ID and observed photo shape.
              photos = target as MarketplacePhotos;
            }
          }
        }
      }
    }
    if (!listing || !photos) {
      throw {
        code: 500,
        message: "Marketplace listing data is unavailable",
        reason: "marketplace.data_unavailable",
        diagnostics: {
          upstream_http_status: response.status,
          upstream_url: response.url,
          upstream_content_type: response.headers.get("content-type"),
          upstream_html_length: html.length,
          upstream_page_title: $("title").text().slice(0, 250),
          upstream_listing_preloader: html.includes(LISTING_PREFIX),
          upstream_photos_preloader: html.includes(PHOTOS_PREFIX),
          upstream_listing_found: Boolean(listing),
          upstream_photos_found: Boolean(photos),
        },
      };
    }
    return { listing, photos, mapTemplate };
  },
  async transform({ listing, photos, mapTemplate }) {
    const media = photos.listing_photos.map((photo) => ({
      url: photo.image.uri,
      type: "photo",
      description: photo.accessibility_caption,
    }));
    let map: string | undefined;
    if (mapTemplate && listing.location) {
      const url = new URL(mapTemplate);
      url.searchParams.set("size", "600x180");
      url.searchParams.set("scale", "2");
      url.searchParams.set("zoom", "11");
      url.searchParams.set("language", "en_US");
      url.searchParams.set("center", `${listing.location.latitude},${listing.location.longitude}`);
      url.searchParams.set(
        "circle",
        `weight:2|color:0x4D6AA47f|fillcolor:0x4D6AA41c|${listing.location.latitude},${listing.location.longitude}|2k`,
      );
      map = url.href;
    }
    return {
      platform: this.type,
      author: { name: listing.marketplace_listing_title, avatar: media[0]?.url ?? "" },
      url: `https://www.facebook.com/marketplace/item/${listing.id}/`,
      text: listing.redacted_description?.text,
      timestamp: listing.creation_time,
      price:
        listing.formatted_price?.text ?? listing.listing_price?.formatted_amount_zeros_stripped,
      location: listing.location_text?.text,
      map,
      media,
    };
  },
};
