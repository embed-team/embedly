import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/invite")({
  beforeLoad: () => {
    throw redirect({
      href: "https://discord.com/oauth2/authorize?client_id=1386571219670794371"
    });
  }
});
