import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/layout/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
});

function Privacy() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-fd-muted-foreground text-sm">Last updated June 2026</p>
        </div>

        <div className="prose prose-fd max-w-none space-y-8 text-fd-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Overview</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly is a Discord bot that fetches and displays rich embeds for social media links.
              This policy explains what data Embedly uses and where it goes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Data we collect</h2>
            <ul className="space-y-3 text-fd-muted-foreground">
              <li className="flex flex-col gap-1">
                <span className="font-medium text-fd-foreground">
                  Discord IDs and message cache data
                </span>
                <span className="leading-relaxed">
                  When you trigger an embed or delete one, we process Discord user, guild, channel,
                  message, interaction, and bot message IDs. Message-cache mappings are stored in
                  self-hosted DragonflyDB so embeds created from your messages can be deleted later.
                  These mappings expire after about 24 hours by default.
                </span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-medium text-fd-foreground">Request and error metadata</span>
                <span className="leading-relaxed">
                  We log metadata such as request ID, source, platform, post ID, cache status,
                  status code, outcome, duration, trace IDs, and error details. These logs are used
                  for debugging and abuse checks. They also show service health.
                </span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-medium text-fd-foreground">Cached post data</span>
                <span className="leading-relaxed">
                  Fetched social media post data is cached for up to 24 hours in Cloudflare KV to
                  avoid repeated fetches. This cache contains the public post content returned by
                  the platform API.
                </span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-medium text-fd-foreground">Observability data</span>
                <span className="leading-relaxed">
                  Bot logs, metrics, and traces are sent to a self-hosted Grafana LGTM stack. API
                  logs and traces are processed through Cloudflare Workers observability.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Data we do not collect</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We do not store full Discord message content. Message content is processed only to
              find supported URLs and Embedly flags. We do not collect names or email addresses. We
              do not sell data or share it for advertising.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Third-party services</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly uses Discord for commands and messages, Cloudflare Workers for the API,
              Cloudflare KV for public post cache, self-hosted DragonflyDB for message-cache
              mappings, self-hosted Grafana LGTM for bot observability, Cloudflare Workers
              observability for API logs and traces, and platform APIs for public posts. Supported
              platforms are Twitter/X, Bluesky, Instagram, TikTok and Threads.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Data removal</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Cached public post data expires within 24 hours. Message-cache mappings expire after
              about 24 hours by default. If you have concerns about specific log data, contact us in
              Discord.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Changes to this policy</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We may update this policy as Embedly changes. Continued use of Embedly means you
              accept the updated policy.
            </p>
          </section>
        </div>
      </div>
    </HomeLayout>
  );
}
