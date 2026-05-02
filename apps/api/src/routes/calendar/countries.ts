import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import {
  listHolidayCountriesForApi,
  listHolidaySubdivisionsForApi,
  normalizeUserCountryCode,
} from "@hously/api/services/holidayCalendar";
import { badRequest, serverError } from "@hously/api/errors";

export const calendarCountriesRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/available-countries", async ({ set }) => {
    try {
      const countries = listHolidayCountriesForApi();
      return { countries };
    } catch (error) {
      console.error("Error loading holiday countries list:", error);
      return serverError(set, "Failed to load countries list");
    }
  })
  .get(
    "/holiday-subdivisions/:countryCode",
    async ({ params, set }) => {
      const cc = normalizeUserCountryCode(params.countryCode);
      if (!cc) {
        return badRequest(set, "Invalid country");
      }
      try {
        const subdivisions = listHolidaySubdivisionsForApi(cc);
        return { subdivisions };
      } catch (error) {
        console.error("Error loading holiday subdivisions:", error);
        return serverError(set, "Failed to load subdivisions");
      }
    },
    {
      params: t.Object({
        countryCode: t.String(),
      }),
    },
  );
