import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";
import { prefetchRouteData } from "@/lib/routing/prefetch";
import { HabitsList } from "@/pages/habits/_component/HabitsList";
import type { HabitsSearchParams } from "@/pages/habits/_component/HabitsList";

export { type HabitsSearchParams };

function parseOptionalInt(val: unknown): number | undefined {
  return typeof val === "number"
    ? val
    : typeof val === "string" && val
      ? Number(val) || undefined
      : undefined;
}

export const Route = createFileRoute("/habits/")({
  validateSearch: (search: Record<string, unknown>): HabitsSearchParams => ({
    modal:
      search.modal === "create" || search.modal === "edit"
        ? search.modal
        : undefined,
    habitId: parseOptionalInt(search.habitId),
  }),
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
  loader: async ({ context }) => {
    await prefetchRouteData(context.queryClient, "/habits");
  },
  component: HabitsList,
});
