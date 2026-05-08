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

function mapSettings(row: {
  countryCode: string;
  calendarSubdivisionCode: string | null;
  updatedAt: Date;
}) {
  return {
    country_code: normalizeTmdbRegion(row.countryCode),
    calendar_subdivision_code: row.calendarSubdivisionCode,
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

        const row = await prisma.appSettings.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            countryCode,
            calendarSubdivisionCode,
          },
          update: {
            countryCode,
            calendarSubdivisionCode,
          },
        });
        return { settings: mapSettings(row) };
      } catch {
        return serverError(set, "Failed to update settings");
      }
    },
    {
      body: t.Object({
        country_code: t.String({ minLength: 2, maxLength: 2 }),
        calendar_subdivision_code: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  );
