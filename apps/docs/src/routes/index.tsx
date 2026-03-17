import {
  GrainGradient,
  HalftoneDots
} from "@paper-design/shaders-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import iconURL from "@/assets/share-globe.png?url";
import { HomeLayout } from "@/components/layout/home";
import { baseOptions } from "@/lib/layout.shared";

export const Route = createFileRoute("/")({
  component: Home
});

function Home() {
  return (
    <HomeLayout {...baseOptions()}>
      <div className="flex flex-col flex-1 gap-8 container mx-auto px-6 py-8">
        <div className="border rounded-2xl w-full overflow-clip grid grid-cols-1 grid-rows-1">
          <div className="row-start-1 col-start-1 z-10 flex flex-col px-12 pt-32 pb-48 gap-8 text-fd-accent dark:text-fd-foreground">
            <p className="text-xs leading-4 font-medium border border-indigo-400/75 px-3 py-2 w-fit rounded-full">
              The missing link between social media and Discord.
            </p>
            <p className="text-5xl font-medium text-balance max-w-2xl mb-4">
              Share links that actually work, the way they should be.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/invite"
                className="rounded-full px-6 py-2 bg-indigo-500 border-2 border-indigo-400/25 text-center"
              >
                Invite to Discord
              </a>
              <Link
                to="/docs/$"
                params={{
                  _splat: ""
                }}
                className="rounded-full px-6 py-2 bg-fd-background text-fd-foreground border-2 text-center"
              >
                View Docs
              </Link>
            </div>
          </div>
          <div className="row-start-1 col-start-1 z-5 grid grid-cols-[1fr_auto] grid-rows-[1fr_auto] w-full h-full p-8">
            <p className="row-start-2 col-start-2">
              <HalftoneDots
                image={iconURL}
                colorBack="#0000000"
                colorFront="#ffffff"
                originalColors={false}
                type="soft"
                grid="square"
                inverted={false}
                size={0.67}
                radius={0.67}
                contrast={0.25}
                grainMixer={0}
                grainOverlay={0}
                grainSize={0}
                scale={1.0}
                fit="contain"
                className="size-32 md:size-48 lg:size-64"
              />
            </p>
          </div>
          <GrainGradient
            width="125%"
            height="150%"
            colors={["#1e293b", "#4c1d95", "#c084fc", "#7C86FF"]}
            colorBack="#1A1A1E"
            softness={1}
            intensity={1}
            noise={0.5}
            shape="corners"
            speed={1}
            className="w-full h-full row-start-1 col-start-1"
          />
        </div>
        <hr className="w-full" />
        <div className="flex flex-col gap-6 text-fd-accent-foreground/75">
          <p className="text-3xl leading-none font-semibold tracking-tight">
            See Embedly in action
          </p>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-col gap-3 bg-fd-accent/50 border border-fd-muted p-4 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <p className="text-sm leading-none font-medium italic">
                Right-click to create an embed
              </p>
              <div className="rounded-t-lg rounded-b-xl overflow-clip">
                <video
                  muted
                  src="https://roselyn.thornbush.dev/assets/projects/embedly/context-menu.mp4"
                  loop
                  autoPlay
                  playsInline
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 bg-fd-accent/50 border border-fd-muted p-4 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
              <p className="text-sm leading-none font-medium italic">
                Create embeds with /embed
              </p>
              <div className="rounded-t-lg rounded-b-xl overflow-clip">
                <video
                  muted
                  src="https://roselyn.thornbush.dev/assets/projects/embedly/slash-command.mp4"
                  loop
                  autoPlay
                  playsInline
                />
              </div>
            </div>
          </div>
        </div>
        <hr className="w-full" />
      </div>
    </HomeLayout>
  );
}
