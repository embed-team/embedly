export * from "./types";
export * as Platforms from "./platforms";
import * as Platforms from "./platforms";

export async function matchURL(url: string) {
  for (const platform of Object.values(Platforms)) {
    const id = await platform.match(url);
    if (id) return { platform: platform.type, id };
  }
  return null;
}
