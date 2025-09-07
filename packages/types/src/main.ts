import type { APIMediaGalleryItem } from "discord-api-types/v10";

export enum EmbedlyPlatformType {
  Twitter = "Twitter",
  Instagram = "Instagram",
  TikTok = "TikTok",
  CBC = "cbc.ca",
  Threads = "Threads"
}

export const EmbedlyPlatformColors: Record<
  EmbedlyPlatformType,
  [red: number, blue: number, green: number]
> = {
  [EmbedlyPlatformType.Twitter]: [29, 161, 242],
  [EmbedlyPlatformType.Instagram]: [225, 48, 108],
  [EmbedlyPlatformType.TikTok]: [57, 118, 132],
  [EmbedlyPlatformType.CBC]: [215, 36, 42],
  [EmbedlyPlatformType.Threads]: [0, 0, 0]
};

export interface StatsData {
  comments: number;
  reposts?: number;
  likes: number;
  bookmarks?: number;
  views?: number;
}

export interface BaseEmbedData {
  platform: EmbedlyPlatformType;
  name: string;
  username?: string;
  profile_url?: string;
  avatar_url: string;
  url: string;
  timestamp: number;
  stats?: StatsData;
  description?: string;
  media?: APIMediaGalleryItem[];
}
export type BaseEmbedDataWithoutPlatform = Omit<
  BaseEmbedData,
  "platform"
>;

export type Emojis = {
  [K in keyof Required<StatsData>]: string;
} & { [K in EmbedlyPlatformType]: string } & {
  reply: string;
  quote: string;
};

export const emojis: Emojis = {
  comments: "<:comment:1386639521373753374>",
  reposts: "<:repost:1386639564143198349>",
  likes: "<:like:1386639662772391987>",
  bookmarks: "<:bookmark:1386639640433529014>",
  views: "<:view:1386639685237084292>",
  reply: "<:reply:1386639619768058007>",
  quote: "<:quote:1389657738480713838>",
  [EmbedlyPlatformType.Twitter]: "<:twitter:1386639732179599481>",
  [EmbedlyPlatformType.Instagram]: "<:instagram:1386639712013254748>",
  [EmbedlyPlatformType.TikTok]: "<:tiktok:1386641825963708446>",
  [EmbedlyPlatformType.CBC]: "<:cbc:1409997044495683674>",
  [EmbedlyPlatformType.Threads]: "<:threads:1413343483929956446>"
};
