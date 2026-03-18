import type { ComponentType } from "react";
import PhCursor from "~icons/ph/cursor";
import PhGlobeHemisphereWest from "~icons/ph/globe-hemisphere-west";
import PhLightning from "~icons/ph/lightning";
import PhRobot from "~icons/ph/robot";
import PhTerminalWindow from "~icons/ph/terminal-window";
import SiInstagram from "~icons/simple-icons/instagram";
import SiReddit from "~icons/simple-icons/reddit";
import SiThreads from "~icons/simple-icons/threads";
import SiTiktok from "~icons/simple-icons/tiktok";
import SiX from "~icons/simple-icons/x";

export const icon_map: Record<string, ComponentType> = {
  "ph:robot": PhRobot,
  "ph:globe-hemisphere-west": PhGlobeHemisphereWest,
  "ph:terminal-window": PhTerminalWindow,
  "ph:lightning": PhLightning,
  "ph:cursor": PhCursor,
  "simple-icons:x": SiX,
  "simple-icons:instagram": SiInstagram,
  "simple-icons:reddit": SiReddit,
  "simple-icons:threads": SiThreads,
  "simple-icons:tiktok": SiTiktok
};

export function Icon({ icon }: { icon: string }) {
  const Component = icon_map[icon];
  if (!Component) return null;
  return <Component />;
}
