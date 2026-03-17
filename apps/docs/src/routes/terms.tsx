import { createFileRoute } from "@tanstack/react-router";
import { HomeLayout } from "@/components/layout/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/terms")({
  component: Terms
});

function Terms() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <div className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">
            Terms of Service
          </h1>
          <p className="text-fd-muted-foreground text-sm">
            Last updated March 2026
          </p>
        </div>

        <div className="prose prose-fd max-w-none space-y-8 text-fd-foreground">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Acceptance</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              By adding Embedly to your server or using it as a
              user-installed app, you agree to these terms. If you do
              not agree, please remove the bot from your server.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Use of the service
            </h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly is provided for the purpose of generating rich
              embeds from public social media posts. You agree to use it
              only for its intended purpose and in compliance with
              Discord's Terms of Service and Community Guidelines, as
              well as the terms of the platforms whose content you
              embed.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Prohibited use</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              You may not use Embedly to embed, distribute, or promote
              content that is illegal, harmful, or violates the rights
              of others. You may not attempt to abuse, scrape, or
              otherwise misuse the service in ways that could harm other
              users or the underlying infrastructure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Service availability
            </h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly is provided as-is with no guarantees of uptime or
              availability. We reserve the right to modify, suspend, or
              discontinue the service at any time without notice. We are
              not liable for any disruption or loss of functionality.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Termination</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We reserve the right to restrict or terminate access to
              Embedly for any user or server at our discretion,
              particularly in cases of abuse or violation of these
              terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Disclaimer</h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              Embedly fetches and displays publicly available content
              from third-party platforms. We are not responsible for the
              accuracy, legality, or appropriateness of embedded
              content. We do not endorse any content surfaced through
              the bot.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">
              Changes to these terms
            </h2>
            <p className="text-fd-muted-foreground leading-relaxed">
              We may update these terms as the service evolves.
              Continued use of the bot after changes constitutes
              acceptance of the updated terms.
            </p>
          </section>
        </div>
      </div>
    </HomeLayout>
  );
}
