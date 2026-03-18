import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/Logo";
import DiscordIcon from "~icons/skill-icons/discordbots";

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: "embed-team",
  repo: "embedly",
  branch: "main"
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (props) => <Logo {...props} />
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      {
        text: "Invite to Discord",
        type: "icon",
        icon: <DiscordIcon />,
        url: "/invite",
        secondary: true
      }
    ]
  };
}
