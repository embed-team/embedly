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
    if (!/^\d+$/.test(id)) throw new Error("Invalid Marketplace listing ID");
    const response = await fetch(`https://www.facebook.com/marketplace/item/${id}/`, {
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
    });
    if (!response.ok) throw { code: response.status, message: response.statusText };

    const $ = cheerio.load(await response.text());
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
      const data = JSON.parse(text);
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
    if (!listing || !photos) throw new Error("Marketplace listing data is unavailable");
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
