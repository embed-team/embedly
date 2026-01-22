export const EmbedlyPlatformType = {
  Twitter: "Twitter",
  Instagram: "Instagram",
  TikTok: "TikTok",
  CBC: "cbc.ca",
  Threads: "Threads",
  Reddit: "Reddit"
} as const;

export type EmbedlyPlatformType =
  (typeof EmbedlyPlatformType)[keyof typeof EmbedlyPlatformType];

export interface StatEmojis {
  comments: string;
  reposts: string;
  likes: string;
  bookmarks: string;
  views: string;
  reply: string;
  quote: string;
}

export const statEmojis: StatEmojis = {
  comments: "<:comment:1386639521373753374>",
  reposts: "<:repost:1386639564143198349>",
  likes: "<:like:1386639662772391987>",
  bookmarks: "<:bookmark:1386639640433529014>",
  views: "<:view:1386639685237084292>",
  reply: "<:reply:1386639619768058007>",
  quote: "<:quote:1389657738480713838>"
};

export type Emojis = StatEmojis & Record<EmbedlyPlatformType, string>;

export const emojis: Emojis = {
  ...statEmojis,
  [EmbedlyPlatformType.Twitter]: "<:twitter:1386639732179599481>",
  [EmbedlyPlatformType.Instagram]: "<:instagram:1386639712013254748>",
  [EmbedlyPlatformType.TikTok]: "<:tiktok:1386641825963708446>",
  [EmbedlyPlatformType.CBC]: "<:cbc:1409997044495683674>",
  [EmbedlyPlatformType.Threads]: "<:threads:1413343483929956446>",
  [EmbedlyPlatformType.Reddit]: "<:reddit:1461320093240655922>"
};
