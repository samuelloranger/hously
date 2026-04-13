import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { prefetchRouteData } from "@/lib/routing/prefetch";
import { TorrentDetailPage } from "@/pages/torrents/_component/TorrentDetailPage";

export const Route = createFileRoute("/torrents/$hash")({
  beforeLoad: async () => {
    try {
      const user = await getCurrentUser();
      if (!user) throw redirect({ to: "/login" });
      return { user };
    } catch (e: unknown) {
      if ((e as { status?: number })?.status === 429) return { user: null };
      throw e;
    }
  },
  loader: async ({ context, params }) => {
    await prefetchRouteData(context.queryClient, "/torrents/$hash", params);
  },
  component: TorrentDetailPage,
});
