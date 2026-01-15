import { EmbedlyPlatformType } from "@embedly/types";
import { CBC } from "./CBC.ts";
import { Instagram } from "./Instagram.ts";
import { Reddit } from "./Reddit.ts";
import { Threads } from "./Threads.ts";
import { TikTok } from "./TikTok.ts";
import { Twitter } from "./Twitter.ts";

export default {
  [EmbedlyPlatformType.Twitter]: new Twitter(),
  [EmbedlyPlatformType.Instagram]: new Instagram(),
  [EmbedlyPlatformType.TikTok]: new TikTok(),
  [EmbedlyPlatformType.CBC]: new CBC(),
  [EmbedlyPlatformType.Threads]: new Threads(),
  [EmbedlyPlatformType.Reddit]: new Reddit()
};
