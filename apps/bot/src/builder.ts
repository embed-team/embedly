import { Platforms } from "@embedly/platforms";

type PostData = Awaited<ReturnType<(typeof Platforms)[keyof typeof Platforms]["transform"]>>;
export function buildEmbed(post: PostData) {}
