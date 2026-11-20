import he from "he";

import type { Platform, PlatformHTMLRewriter } from "../types";
import type { ApartmentData, ApartmentMeta, ApartmentRental } from "./apartments.d";

declare const HTMLRewriter: { new (): PlatformHTMLRewriter };

const MATCH_RE =
  /^(?:https?:\/\/)?(?:www\.)?apartments\.com\/([a-z0-9-]+\/[a-z0-9]{7})\/?(?:\?[^#]*)?(#[a-z0-9]{7}-[12]-(?:unit|floorplan))?$/i;

export const Apartments: Platform<"Apartments", ApartmentData, ApartmentMeta> = {
  type: "Apartments",
  async match(url) {
    const match = url.match(MATCH_RE);
    return match ? `${match[1]}/${match[2] ?? ""}` : null;
  },
  async fetch(id, env) {
    if (!/^[a-z0-9-]+\/[a-z0-9]{7}\/(?:#[a-z0-9]{7}-[12]-(?:unit|floorplan))?$/i.test(id)) {
      throw { code: 400, message: "Invalid Apartments.com listing ID" };
    }
    const url = new URL(`https://www.apartments.com/${id}`);
    const response = await fetch(url, {
      headers: {
        "User-Agent": env?.EMBED_USER_AGENT ?? "",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.apartments.com/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok) throw { code: response.status, message: response.statusText };

    let startup = "";
    let awcToken = "";
    let csrfToken = "";
    let scriptChunks: string[] = [];
    const content = {
      name: "",
      location: "",
      description: "",
      pets: "",
      parking: "",
    };
    const amenities: string[] = [];
    const propertyFeatures: string[] = [];
    let amenityGroup = 0;
    let amenityChunks: string[] = [];
    const rewriter = new HTMLRewriter()
      .on("script", {
        element(element) {
          scriptChunks = [];
          element.onEndTag(() => {
            const script = scriptChunks.join("");
            if (/require\(\s*\[['"]ProfileStartup['"]\]/.test(script)) startup = script;
            awcToken ||= script.match(/\bantiWebCrawlerToken:\s*'([^']+)'/)?.[1] ?? "";
            csrfToken ||= script.match(/\baft:\s*'([^']+)'/)?.[1] ?? "";
          });
        },
        text(chunk) {
          scriptChunks.push(chunk.text);
        },
      })
      .on("#amenitiesSection h2", {
        element() {
          amenityGroup++;
        },
      })
      .on("#amenitiesSection .specInfo span, #uniqueFeatures .specInfo span", {
        element(element) {
          amenityChunks = [];
          const target = amenityGroup === 2 ? propertyFeatures : amenities;
          element.onEndTag(() => {
            target.push(he.decode(amenityChunks.join("")).trim());
          });
        },
        text(chunk) {
          amenityChunks.push(chunk.text);
        },
      });
    for (const [selector, field] of [
      ["h1", "name"],
      [".propertyAddressContainer h2", "location"],
      ["#descriptionSection > p:not(.propertyBlurbContent)", "description"],
      ["#fees-policies-pet-fees-tab", "pets"],
      ["#fees-policies-parking-tab", "parking"],
    ] as const) {
      rewriter.on(selector, {
        text(chunk) {
          content[field] += chunk.text;
        },
      });
    }
    await rewriter.transform(response).body?.pipeTo(new WritableStream());
    // The surrounding options are JavaScript; rentals is serialized JSON.
    const rentalsJSON = startup?.match(
      /\brentals:\s*(\[[\s\S]*?\]),\s*disableMediaCascadingModelToUnit:/,
    )?.[1];
    if (!rentalsJSON || !content.name.length) {
      throw { code: 502, message: "Apartments.com listing data is unavailable" };
    }
    // SAFETY: ProfileStartup's rentals field contains the observed rental records.
    const rentals = JSON.parse(rentalsJSON) as ApartmentRental[];
    const rentalKey = url.hash.slice(1).split("-")[0];
    const rental = rentalKey ? rentals.find((item) => item.RentalKey === rentalKey) : undefined;
    if (rentalKey && !rental) {
      throw { code: 404, message: "This apartment unit or floor plan is no longer listed" };
    }
    const model = rental && rentals.find((item) => item.RentalKey === rental.ModelKey);
    const photoRental = rental?.HasUnitPhoto ? rental : model?.HasUnitPhoto ? model : undefined;
    if (!awcToken || !csrfToken) {
      throw { code: 502, message: "Apartments.com gallery tokens are unavailable" };
    }
    const galleryResponse = await fetch(
      "https://www.apartments.com/services/property/mediagallery/render",
      {
        method: "POST",
        headers: {
          "User-Agent": env?.EMBED_USER_AGENT ?? "",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "application/json",
          Referer: `${url.origin}${url.pathname}`,
          Origin: url.origin,
          "X-AWC-TOKEN": awcToken,
          "X-CSRF-TOKEN": csrfToken,
          "X-Requested-With": "XMLHttpRequest",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          ListingKey: url.pathname.split("/")[2],
          RentalKey: photoRental?.RentalKey,
          RentalType: photoRental?.RentalType ?? 0,
          HasViewFromUnit: false,
          UnitNumber: photoRental?.UnitNumber ?? "",
        }),
      },
    );
    if (!galleryResponse.ok) {
      throw { code: galleryResponse.status, message: "Apartments.com gallery request failed" };
    }
    const gallery = await galleryResponse.json();
    // SAFETY: the gallery endpoint serializes media groups in its Json field.
    const groups = JSON.parse(gallery.Json) as {
      Key: number;
      Value: { Uri: string; AltText?: string; Caption?: string }[];
    }[];
    const media = groups
      .filter((group) => group.Key === 1)
      .flatMap((group) => group.Value)
      .map((photo) => ({
        url: photo.Uri,
        type: "photo",
        description: photo.AltText || photo.Caption,
      }));
    const rentalImage = rental?.ImageUri || model?.ImageUri;
    if (rentalImage) {
      media.unshift({ url: rentalImage, type: "photo", description: rental?.Name });
    }
    const features = rental
      ? (rental.InteriorAmenities?.SubCategories.flatMap((category) =>
          category.Amenities.map((amenity) => amenity.Name),
        ) ?? [])
      : propertyFeatures;

    return {
      url: url.href,
      name: he.decode(content.name).trim(),
      location: he.decode(content.location).replace(/\s+/g, " ").trim(),
      description: rental?.Description || he.decode(content.description).trim(),
      minRent: Number(startup?.match(/\blistingMinRent:\s*(\d+(?:\.\d+)?)/)?.[1]),
      maxRent: Number(startup?.match(/\blistingMaxRent:\s*(\d+(?:\.\d+)?)/)?.[1]),
      rentals,
      rental,
      media,
      amenities: [...new Set(amenities)],
      features: [...new Set(features)],
      pets: he
        .decode(content.pets)
        .replace(/\bRead (?:More|Less)\b/g, "")
        .replace(/\s+/g, " ")
        .trim(),
      parking: he.decode(content.parking).replace(/\s+/g, " ").trim(),
    };
  },
  async transform(raw) {
    const { rental } = raw;
    const rentals = rental ? [rental] : raw.rentals.filter((item) => item.RentalType === 1);
    const price = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    const minRent = rental ? rental.Rent : raw.minRent;
    const maxRent = rental ? rental.MaxRent : raw.maxRent;
    const details = [
      minRent > 0
        ? `${price.format(minRent)}${maxRent > minRent ? `–${price.format(maxRent)}` : ""}/mo + fees`
        : "Contact for rent",
    ];
    for (const [key, maxKey, suffix] of [
      ["Beds", "Beds", "beds"],
      ["Baths", "Baths", "baths"],
      ["SquareFeet", "MaxSquareFeet", "sq ft"],
    ] as const) {
      if (!rentals.length) continue;
      const min = Math.min(...rentals.map((item) => item[key]));
      const max = Math.max(...rentals.map((item) => item[maxKey]));
      details.push(
        key === "Beds" && max === 0
          ? "Studio"
          : `${min}${max > min ? `–${max}` : ""} ${max === 1 ? suffix.replace(/s$/, "") : suffix}`,
      );
    }
    if (rental?.AvailableDateText) details.push(rental.AvailableDateText);
    return {
      platform: this.type,
      author: {
        name: `${raw.name}${rental ? ` · ${rental.UnitNumber ? `Unit ${rental.UnitNumber}` : rental.Name}` : ""}`,
        avatar: "",
      },
      url: raw.url,
      text: raw.description,
      timestamp: 0,
      media: raw.media,
      location: raw.location,
      details,
      amenities: raw.amenities,
      features: raw.features,
      pets: raw.pets,
      parking: raw.parking,
      propertyPhotos: Boolean(rental && !rental.HasUnitPhoto),
    };
  },
};
