import type { User } from "@prisma/client";
import { prisma } from "@hously/api/db";
import {
  deleteImageFiles,
  getAvatarUrl,
  saveImageAndCreateThumbnail,
} from "@hously/api/services/imageService";
import {
  normalizeCalendarSubdivision,
  normalizeUserCountryCode,
} from "@hously/api/services/holidayCalendar";
import { validateImageMimeAndSize } from "@hously/shared/utils";

export type UserProfileUpdateInput = {
  first_name?: string | null;
  last_name?: string | null;
  locale?: string | null;
  country_code?: string | null;
  calendar_subdivision_code?: string | null;
};

export type UserProfileUpdateResult =
  | { ok: true; user: User }
  | { ok: false; status: 400 | 401; error: string };

export async function updateUserProfile(
  userId: number,
  input: UserProfileUpdateInput,
): Promise<UserProfileUpdateResult> {
  const {
    first_name,
    last_name,
    locale,
    country_code,
    calendar_subdivision_code,
  } = input;

  if (
    first_name === undefined &&
    last_name === undefined &&
    locale === undefined &&
    country_code === undefined &&
    calendar_subdivision_code === undefined
  ) {
    return {
      ok: false,
      status: 400,
      error: "At least one field must be provided",
    };
  }

  if (locale && locale.length > 10) {
    return {
      ok: false,
      status: 400,
      error: "Locale must be 10 characters or less",
    };
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return { ok: false, status: 401, error: "User not found" };
  }

  let normalizedCountry: string | null | undefined;
  if (country_code !== undefined) {
    if (country_code === null || country_code === "") {
      normalizedCountry = null;
    } else {
      normalizedCountry = normalizeUserCountryCode(country_code);
      if (!normalizedCountry) {
        return {
          ok: false,
          status: 400,
          error: "country_code must be a supported 2-letter ISO code or empty",
        };
      }
    }
  }

  const effectiveCountry =
    normalizedCountry !== undefined ? normalizedCountry : existing.countryCode;

  let normalizedSubdivision: string | null | undefined;
  if (calendar_subdivision_code !== undefined) {
    if (
      calendar_subdivision_code === null ||
      calendar_subdivision_code === ""
    ) {
      normalizedSubdivision = null;
    } else if (!effectiveCountry) {
      return {
        ok: false,
        status: 400,
        error: "Set a country before choosing a province or state",
      };
    } else {
      const sub = normalizeCalendarSubdivision(
        effectiveCountry,
        calendar_subdivision_code,
      );
      if (!sub) {
        return {
          ok: false,
          status: 400,
          error: "Invalid province or state for selected country",
        };
      }
      normalizedSubdivision = sub;
    }
  }

  const user = await updateUserProfileFields(
    userId,
    {
      first_name,
      last_name,
      locale,
      country_code: normalizedCountry,
      calendar_subdivision_code: normalizedSubdivision,
    },
    existing,
  );

  return { ok: true, user };
}

export async function updateUserProfileFields(
  userId: number,
  input: UserProfileUpdateInput,
  existingUser?: User,
): Promise<User> {
  const existing =
    existingUser ?? (await prisma.user.findUnique({ where: { id: userId } }));
  if (!existing) {
    throw new Error("User not found");
  }

  const updateData: Partial<{
    firstName: string | null;
    lastName: string | null;
    locale: string | null;
    countryCode: string | null;
    calendarSubdivisionCode: string | null;
  }> = {};

  if (input.first_name !== undefined) {
    updateData.firstName = input.first_name;
  }
  if (input.last_name !== undefined) {
    updateData.lastName = input.last_name;
  }
  if (input.locale !== undefined) {
    updateData.locale = input.locale;
  }

  let nextCountry = existing.countryCode;
  let nextSub = existing.calendarSubdivisionCode;

  if (input.country_code !== undefined) {
    nextCountry = input.country_code;
    if (
      input.country_code !== existing.countryCode &&
      input.calendar_subdivision_code === undefined
    ) {
      nextSub = null;
    }
  }

  if (input.calendar_subdivision_code !== undefined) {
    nextSub = input.calendar_subdivision_code;
  }

  if (!nextCountry) {
    nextSub = null;
  }

  if (input.country_code !== undefined) {
    updateData.countryCode = nextCountry;
  }
  if (
    input.country_code !== undefined ||
    input.calendar_subdivision_code !== undefined
  ) {
    updateData.calendarSubdivisionCode = nextSub;
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

export async function updateUserAvatarFromUpload(
  userId: number,
  avatar: unknown,
): Promise<{ ok: true; avatarUrl: string } | { ok: false; message: string }> {
  const validationError = validateImageMimeAndSize(
    avatar as { type: string; size?: number },
    { maxSizeBytes: 5 * 1024 * 1024 },
  );
  if (validationError) {
    return { ok: false, message: validationError.error };
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: userId },
  });
  if (dbUser?.avatarUrl) {
    const oldFilename = dbUser.avatarUrl.split("/").pop();
    if (oldFilename) {
      await deleteImageFiles(oldFilename);
    }
  }

  const filename = await saveImageAndCreateThumbnail(avatar as File);
  const avatarUrl = getAvatarUrl(filename);
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
  return { ok: true, avatarUrl };
}
