import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import appCss from "@/styles/app.css?url";

const DESCRIPTION =
  "Rich social media embeds for Discord. Share links that actually work, the way they should be.";

const getOrigin = createServerFn().handler(() => {
  const request = getRequest();
  return new URL(request.url).origin;
});

export const Route = createRootRoute({
  loader: () => getOrigin(),
  head: ({ loaderData: origin }) => {
    const og_image = `${origin ?? "https://bot.embeds.media"}/og.jpg`;
    return {
      meta: [
        { charSet: "utf-8" },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1"
        },
        { title: "Embedly" },
        { name: "description", content: DESCRIPTION },
        // OpenGraph
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Embedly" },
        { property: "og:title", content: "Embedly" },
        { property: "og:description", content: DESCRIPTION },
        { property: "og:image", content: og_image },
        // Twitter
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Embedly" },
        { name: "twitter:description", content: DESCRIPTION },
        { name: "twitter:image", content: og_image }
      ],
      links: [{ rel: "stylesheet", href: appCss }]
    };
  },
  component: RootComponent
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
