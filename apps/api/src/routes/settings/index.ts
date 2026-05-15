import { Elysia, t } from "elysia";

import { requireAdmin } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import { badRequest, serverError } from "@hously/api/errors";
import {
  DEFAULT_TMDB_REGION,
  normalizeTmdbRegion,
} from "@hously/api/utils/medias/tmdbRegion";
import {
  normalizeCalendarSubdivision,
  normalizeUserCountryCode,
} from "@hously/api/services/holidayCalendar";

import type { AppSettings } from "@prisma/client";

function mapSettings(row: AppSettings) {
  return {
    country_code: normalizeTmdbRegion(row.countryCode),
    calendar_subdivision_code: row.calendarSubdivisionCode,
    upcoming_window_months: row.upcomingWindowMonths,
    upcoming_languages: row.upcomingLanguages,
    dashboard_widget_visibility: row.dashboardWidgetVisibility as Record<
      string,
      boolean
    >,
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
        const countryCode = normalizeUserCountryCode(body.country_code);
        if (!countryCode) {
          return badRequest(
            set,
            "country_code must be a supported 2-letter ISO code",
          );
        }

        const calendarSubdivisionCode =
          body.calendar_subdivision_code == null ||
          body.calendar_subdivision_code === ""
            ? null
            : normalizeCalendarSubdivision(
                countryCode,
                body.calendar_subdivision_code,
              );
        if (body.calendar_subdivision_code && !calendarSubdivisionCode) {
          return badRequest(
            set,
            "Invalid province or state for selected country",
          );
        }

        const updateData: {
          countryCode?: string;
          calendarSubdivisionCode?: string | null;
          upcomingWindowMonths?: number;
          upcomingLanguages?: string;
          dashboardWidgetVisibility?: Record<string, boolean>;
        } = {};

        if (body.country_code) updateData.countryCode = countryCode;
        if (body.calendar_subdivision_code !== undefined) {
          updateData.calendarSubdivisionCode = calendarSubdivisionCode;
        }
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

        const row = await prisma.appSettings.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            countryCode,
            calendarSubdivisionCode,
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
        calendar_subdivision_code: t.Optional(t.Union([t.String(), t.Null()])),
        upcoming_window_months: t.Optional(t.Integer()),
        upcoming_languages: t.Optional(t.String()),
        dashboard_widget_visibility: t.Optional(
          t.Object({
            weather: t.Boolean(),
            homeassistant: t.Boolean(),
            system: t.Boolean(),
            downloads: t.Boolean(),
            rss: t.Boolean(),
            minecraft: t.Optional(t.Boolean()),
          }),
        ),
      }),
    },
  );
