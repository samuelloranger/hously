import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";

export const dashboardFaviconRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get(
    "/favicon",
    async ({ query, set }) => {
      try {
        const url = new URL(
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(query.domain)}&sz=64`,
        );
        const response = await fetch(url.toString());
        if (!response.ok) {
          set.status = 502;
          return { error: "Failed to fetch favicon" };
        }
        const contentType = response.headers.get("content-type") ?? "image/png";
        const buffer = await response.arrayBuffer();
        return new Response(buffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=604800",
          },
        });
      } catch {
        set.status = 502;
        return { error: "Failed to fetch favicon" };
      }
    },
    {
      query: t.Object({
        domain: t.String({ minLength: 1, maxLength: 253 }),
      }),
    },
  );
