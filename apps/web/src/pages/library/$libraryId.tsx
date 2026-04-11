import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import {
  LibraryItemPage,
  type LibraryItemSearchParams,
} from "@/pages/medias/_component/LibraryItemPage";

export { type LibraryItemSearchParams };

export const Route = createFileRoute("/library/$libraryId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): LibraryItemSearchParams => ({
    tab: (["info", "similar", "search", "management"] as const).includes(
      search.tab as any,
    )
      ? (search.tab as LibraryItemSearchParams["tab"])
      : undefined,
  }),
  beforeLoad: async () => {
    try {
      const user = await getCurrentUser();
      if (!user) throw redirect({ to: "/login" });
      return { user };
    } catch (e: any) {
      if (e?.status === 429) return { user: null };
      throw e;
    }
  },
  component: LibraryItemPage,
});
