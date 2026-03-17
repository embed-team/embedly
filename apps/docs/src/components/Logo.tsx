"use client";

import { Icon } from "@iconify/react";
import type { ComponentProps } from "react";

export function Logo(props: ComponentProps<"a">) {
  return (
    <a {...props}>
      <Icon
        icon="tabler:world-share"
        className="size-5 text-indigo-400"
      />
      Embedly
    </a>
  );
}
