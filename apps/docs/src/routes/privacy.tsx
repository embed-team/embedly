import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/layout/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/privacy")({
  component: Privacy
});

function Privacy() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-fd-muted-foreground text-sm">
            Last updated March 2026
          </p>
        </div>

        <div className="prose prose-fd max-w-none space-y-8 text-fd-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Overview</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly is a Discord bot that fetches and displays rich
              embeds for social media links. This policy describes what
              data we collect, why we collect it, and how it is used. We
              collect as little as possible to operate the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Data we collect</h2>
            <ul className="space-y-3 text-fd-muted-foreground">
              <li className="flex flex-col gap-1">
                <span className="font-medium text-fd-foreground">
                  Discord user and message IDs
                </span>
                <span className="leading-relaxed">
                  When you trigger an embed, your user ID and the
                  resulting bot message ID are held in memory for the
                  duration of the bot session. This is used to let you
                  delete embeds you created. This data is never written
                  to disk and is lost when the bot restarts.
                </span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-medium text-fd-foreground">
                  Interaction and error logs
                </span>
                <span className="leading-relaxed">
                  We log interaction metadata (user ID, platform,
                  source) for debugging and monitoring. Logs are
                  retained for a limited period and are not shared with
                  third parties.
                </span>
              </li>
              <li className="flex flex-col gap-1">
                <span className="font-medium text-fd-foreground">
                  Cached post data
                </span>
                <span className="leading-relaxed">
                  Fetched social media post data is cached for up to 24
                  hours in Cloudflare KV to reduce redundant requests.
                  This contains only the public post content returned by
                  the platform's API — no personal information beyond
                  what is publicly visible on the platform.
                </span>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Data we do not collect
            </h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We do not read, store, or process message content beyond
              extracting URLs to embed. We do not collect names, email
              addresses, or any other personal information. We do not
              sell or share data with third parties for advertising
              purposes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Third-party services
            </h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              To fetch post data, Embedly makes requests to third-party
              platform APIs including Twitter/X (via fxTwitter),
              Instagram, Reddit, Threads, and TikTok. These requests are
              made server-side and contain no personal information about
              the user who triggered the embed. Each platform's own
              privacy policy governs data processed on their end.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Data removal</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Since we do not persistently store personal data, there is
              nothing to delete. If you have concerns about specific log
              data, you can contact us via our Discord server.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Changes to this policy
            </h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We may update this policy as the service changes.
              Continued use of the bot after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>
        </div>
      </div>
    </HomeLayout>
  );
}
