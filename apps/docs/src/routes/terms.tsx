import { createFileRoute } from "@tanstack/react-router";

import { HomeLayout } from "@/components/layout/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">Terms of Service</h1>
          <p className="text-fd-muted-foreground text-sm">Last updated June 2026</p>
        </div>

        <div className="prose prose-fd max-w-none space-y-8 text-fd-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Acceptance</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              By adding Embedly to a server or using it as a user-installed app, you agree to these
              terms. If you do not agree, do not use Embedly and remove it from any server you
              control.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Use of the service</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly generates rich embeds from supported public social media links through
              automatic message detection, the /embed command, and message context menus. You agree
              to follow Discord's Terms of Service and Community Guidelines, plus the rules for any
              platform whose content you embed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Prohibited use</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Do not use Embedly to embed, distribute, or promote illegal content, harmful content,
              or content that violates someone else's rights. Do not abuse the service, scrape
              through it, bypass platform limits, overload infrastructure, or interfere with other
              users.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Your responsibility</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              You are responsible for the links you ask Embedly to fetch and the content surfaced
              from those links. Embedly may skip, remove, or fail to render a link when the platform
              is unavailable, the content is unsupported, or the request appears abusive.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Service availability</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly has no uptime or availability guarantee. We may change or stop the service at
              any time. We are not liable for downtime, missing embeds, or lost functionality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Termination</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We may restrict or terminate access for any user or server that abuses Embedly or
              violates these terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Disclaimer</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly fetches and displays publicly available content from third-party platforms. We
              are not responsible for that content. We do not endorse content surfaced through the
              bot.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Changes to these terms</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We may update these terms as Embedly changes. Continued use of Embedly means you
              accept the updated terms.
            </p>
          </section>
        </div>
      </div>
    </HomeLayout>
  );
}
