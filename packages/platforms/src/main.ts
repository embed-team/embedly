export * from "./types";
export * as Platforms from "./platforms";
import * as Platforms from "./platforms";

export function matchURL(url: string) {
  for (const platform of Object.values(Platforms)) {
    const id = platform.match(url);
    if (id) return { platform: platform.type, id };
  }
  return null;
}
