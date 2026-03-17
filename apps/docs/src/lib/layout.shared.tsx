import { Icon } from "@iconify/react";
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/Logo";

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
        icon: <Icon icon="skill-icons:discordbots" />,
        url: "/invite",
        secondary: true
      }
    ]
  };
}
