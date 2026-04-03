import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/releases")({
  beforeLoad: async () => {
    await getCurrentUser();
    throw redirect({ to: "/calendar" });
  },
});
