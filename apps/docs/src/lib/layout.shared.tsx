import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import DiscordIcon from "~icons/skill-icons/discordbots";

import { Logo } from "@/components/Logo";

export const gitConfig = {
  user: "embed-team",
  repo: "embedly",
  branch: "main",
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (props) => <Logo {...props} />,
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        text: "Invite to Discord",
        type: "icon",
        icon: <DiscordIcon />,
        url: "/invite",
        secondary: true,
      },
    ],
  };
}
