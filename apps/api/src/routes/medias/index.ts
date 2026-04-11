import { Elysia } from "elysia";
import { mediasTmdbRoutes } from "./tmdb";
import { mediasProwlarrRoutes } from "./prowlarr";
import { mediasWatchlistRoutes } from "./watchlist";
import { mediasCollectionsRoutes } from "./collections";
import { mediasBlocklistRoutes } from "./blocklist";

export const mediasRoutes = new Elysia({ prefix: "/api/medias" })
  .use(mediasTmdbRoutes)
  .use(mediasProwlarrRoutes)
  .use(mediasWatchlistRoutes)
  .use(mediasCollectionsRoutes)
  .use(mediasBlocklistRoutes);
