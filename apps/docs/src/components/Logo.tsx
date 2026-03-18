"use client";

import type { ComponentProps } from "react";
import TablerWorldShare from "~icons/tabler/world-share";

export function Logo(props: ComponentProps<"a">) {
  return (
    <a {...props}>
      <TablerWorldShare className="size-5 text-indigo-400" />
      Embedly
    </a>
  );
}
