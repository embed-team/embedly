import { Instagram } from "./Instagram.ts";
import { TikTok } from "./TikTok.ts";
import { Twitter } from "./Twitter.ts";

export default {
  Twitter: new Twitter(),
  Instagram: new Instagram(),
  TikTok: new TikTok()
};
