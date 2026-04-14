import type { User } from "@prisma/client";
import { prisma } from "@hously/api/db";
import {
  deleteImageFiles,
  getAvatarUrl,
  saveImageAndCreateThumbnail,
} from "@hously/api/services/imageService";
import { validateImageMimeAndSize } from "@hously/shared/utils";

export async function updateUserProfileFields(
  userId: number,
  input: {
    first_name?: string | null;
    last_name?: string | null;
    locale?: string | null;
  },
): Promise<User> {
  const updateData: Partial<{
    firstName: string | null;
    lastName: string | null;
    locale: string | null;
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
