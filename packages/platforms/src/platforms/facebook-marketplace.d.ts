export interface MarketplaceListing {
  id: string;
  marketplace_listing_title: string;
  redacted_description?: { text: string } | null;
  creation_time: number;
  formatted_price?: { text: string } | null;
  listing_price?: { formatted_amount_zeros_stripped?: string } | null;
  location_text?: { text: string } | null;
  location?: { latitude: number; longitude: number } | null;
}

export interface MarketplacePhotos {
  id: string;
  listing_photos: Array<{
    image: { uri: string };
    accessibility_caption?: string;
  }>;
}

export interface MarketplaceData {
  listing: MarketplaceListing;
  photos: MarketplacePhotos;
  mapTemplate?: string;
}

export interface MarketplaceMeta {
  price?: string;
  location?: string;
  map?: string;
}
