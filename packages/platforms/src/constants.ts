export const CF_CACHE_OPTIONS = {
  cf: {
    cacheTtl: 60 * 60 * 24,
    cacheEverything: true
  }
} as const;

export const GENERIC_LINK_REGEX =
  /\b((?:[a-z][\w-]+:(?:\/{1,3}|[a-z0-9%])|www\d{0,3}[.]|[a-z0-9.-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()[\]{};:'".,<>?«»""'']))/i;
