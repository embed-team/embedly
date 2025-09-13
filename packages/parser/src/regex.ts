export const GENERIC_LINK_REGEX =
  /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»“”‘’]))/i;
export const SPOILER_LINK_REGEX = (url: string) =>
  RegExp(`\\|\\|\\s?${url}\\s?\\|\\|`);
export const TWITTER_REGEX =
  /(?:twitter|x).com\/.*\/status(?:es)?\/(?<tweet_id>[^/?]+)/;
export const IG_REGEX =
  /instagram.com\/(?:[A-Za-z0-9_.]+\/)?(p|share|reels|reel|stories)\/(?<ig_shortcode>[A-Za-z0-9-_]+)/;
export const TIKTOK_REGEX_MAIN =
  /(https?:\/\/)?(?:[\w-]+\.)*tiktok\.com/;
export const TIKTOK_REGEX =
  /https:\/\/(?:m|www|vm)?\.?tiktok\.com\/(?<tiktok_user>@[\w.-]+)\/video\/(?<tiktok_id>\d+)/;
export const THREADS_REGEX =
  /threads\.com\/@.*\/post\/(?<thread_shortcode>[A-Za-z0-9-_]+)/;
export const CBC_REGEX = /cbc.ca\/.*(?<cbc_id>1\.\d+)/;
