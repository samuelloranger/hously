import { Elysia } from "elysia";
import { mediasLibraryRoutes } from "./library";
import { mediasTmdbRoutes } from "./tmdb";
import { mediasProwlarrRoutes } from "./prowlarr";
import { mediasArrRoutes } from "./arr";
import { mediasWatchlistRoutes } from "./watchlist";
import { mediasCollectionsRoutes } from "./collections";
import { mediasAiSuggestionsRoutes } from "./suggestions";

export const mediasRoutes = new Elysia({ prefix: "/api/medias" })
  .use(mediasLibraryRoutes)
  .use(mediasTmdbRoutes)
  .use(mediasProwlarrRoutes)
  .use(mediasArrRoutes)
  .use(mediasWatchlistRoutes)
  .use(mediasCollectionsRoutes)
  .use(mediasAiSuggestionsRoutes);
