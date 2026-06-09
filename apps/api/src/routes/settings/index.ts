import { Elysia, t } from "elysia";

import { requireAdmin } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, serverError } from "@hously/api/errors";
import {
  DEFAULT_TMDB_REGION,
  normalizeTmdbRegion,
} from "@hously/api/utils/medias/tmdbRegion";
import { WIDGETS } from "@hously/shared/constants";
import type {
  WidgetId,
  WidgetLayout,
  TileLayout,
} from "@hously/shared/constants";

import type { AppSettings } from "@prisma/client";

const DEFAULT_WIDGET_VISIBILITY = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w.defaultVisible]),
) as Record<WidgetId, boolean>;

function mapSettings(row: AppSettings) {
  return {
    country_code: normalizeTmdbRegion(row.countryCode),
    upcoming_window_months: row.upcomingWindowMonths,
    upcoming_languages: row.upcomingLanguages,
    dashboard_widget_visibility: {
      ...DEFAULT_WIDGET_VISIBILITY,
      ...((row.dashboardWidgetVisibility as Record<string, boolean>) ?? {}),
    },
    dashboard_widget_layout:
      (row.dashboardWidgetLayout as WidgetLayout | null) ?? null,
    dashboard_tile_layout:
      (row.dashboardTileLayout as TileLayout | null) ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
}

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  .use(requireAdmin)
  .get("/", async ({ set }) => {
    try {
      const row = await prisma.appSettings.upsert({
        where: { id: 1 },
        create: { id: 1, countryCode: DEFAULT_TMDB_REGION },
        update: {},
      });
      return { settings: mapSettings(row) };
    } catch {
      return serverError(set, "Failed to load settings");
    }
  })
  .patch(
    "/",
    async ({ body, set }) => {
      try {
        const trimmedCountry = body.country_code?.trim().toUpperCase();
        if (body.country_code && !/^[A-Z]{2}$/.test(trimmedCountry ?? "")) {
          return badRequest(set, "country_code must be a 2-letter ISO code");
        }
        const countryCode = trimmedCountry || null;

        const updateData: {
          countryCode?: string;
          upcomingWindowMonths?: number;
          upcomingLanguages?: string;
          dashboardWidgetVisibility?: Record<string, boolean>;
          dashboardWidgetLayout?: WidgetLayout;
          dashboardTileLayout?: TileLayout;
        } = {};

        if (body.country_code && countryCode)
          updateData.countryCode = countryCode;
        if (body.upcoming_window_months !== undefined) {
          const months = body.upcoming_window_months;
          if (![3, 6, 12, 24].includes(months)) {
            return badRequest(
              set,
              "upcoming_window_months must be one of: 3, 6, 12, 24",
            );
          }
          updateData.upcomingWindowMonths = months;
        }
        if (body.upcoming_languages !== undefined) {
          updateData.upcomingLanguages = body.upcoming_languages;
        }
        if (body.dashboard_widget_visibility !== undefined) {
          updateData.dashboardWidgetVisibility =
            body.dashboard_widget_visibility;
        }
        if (body.dashboard_widget_layout !== undefined) {
          updateData.dashboardWidgetLayout =
            body.dashboard_widget_layout as WidgetLayout;
        }
        if (body.dashboard_tile_layout !== undefined) {
          updateData.dashboardTileLayout =
            body.dashboard_tile_layout as TileLayout;
        }

        const row = await prisma.appSettings.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            countryCode: countryCode ?? DEFAULT_TMDB_REGION,
          },
          update: updateData,
        });
        return { settings: mapSettings(row) };
      } catch {
        return serverError(set, "Failed to update settings");
      }
    },
    {
      body: t.Object({
        country_code: t.Optional(t.String({ minLength: 2, maxLength: 2 })),
        upcoming_window_months: t.Optional(t.Integer()),
        upcoming_languages: t.Optional(t.String()),
        dashboard_widget_visibility: t.Optional(
          t.Object(Object.fromEntries(WIDGETS.map((w) => [w.id, t.Boolean()]))),
        ),
        dashboard_widget_layout: t.Optional(
          t.Tuple([
            t.Array(t.Union(WIDGETS.map((w) => t.Literal(w.id)))),
            t.Array(t.Union(WIDGETS.map((w) => t.Literal(w.id)))),
            t.Array(t.Union(WIDGETS.map((w) => t.Literal(w.id)))),
          ]),
        ),
        dashboard_tile_layout: t.Optional(t.Array(t.String())),
      }),
    },
  );
