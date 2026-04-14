import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { prisma } from "@hously/api/db";
import { hashPassword, verifyPassword } from "@hously/api/utils/password";
import { validatePassword } from "@hously/api/utils/validation";
import {
  isAllowedFile,
  getImage,
  getContentType,
} from "@hously/api/services/imageService";
import {
  updateUserAvatarFromUpload,
  updateUserProfileFields,
} from "@hously/api/services/userProfileService";
import {
  badRequest,
  notFound,
  serverError,
  unauthorized,
} from "@hously/api/errors";
import { mapUser } from "@hously/api/utils/mappers";
export const usersRoutes = new Elysia({ prefix: "/api/users" })
  .use(auth)
  // GET /api/users - List all users (for assignee pickers, etc.)
  .get("/", async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }
    try {
      const users = await prisma.user.findMany({
        orderBy: [{ firstName: "asc" }, { email: "asc" }],
      });
      return { users: users.map(mapUser) };
    } catch (error) {
      console.error("Error listing users:", error);
      return serverError(set, "Failed to list users");
    }
  })
  // GET /api/users/me - Get current user profile
  .get("/me", async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, "Unauthorized");
    }

    // Fetch fresh user data from database (including locale)
    const dbUser = await prisma.user.findFirst({
      where: { id: user.id },
    });

    if (!dbUser) {
      return unauthorized(set, "User not found");
    }

    return { user: mapUser(dbUser) };
  })
  // PUT /api/users/me - Update user profile
  .put(
    "/me",
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      const { first_name, last_name, locale } = body;

      // Check if at least one field is provided
      if (
        first_name === undefined &&
        last_name === undefined &&
        locale === undefined
      ) {
        return badRequest(set, "At least one field must be provided");
      }

      // Validate locale if provided
      if (locale && locale.length > 10) {
        return badRequest(set, "Locale must be 10 characters or less");
      }

      try {
        const updatedUser = await updateUserProfileFields(user.id, {
          first_name,
          last_name,
          locale,
        });

        return { user: mapUser(updatedUser) };
      } catch (error) {
        console.error("Error updating user profile:", error);
        return serverError(set, "Failed to update profile");
      }
    },
    {
      body: t.Object({
        first_name: t.Optional(t.Union([t.String(), t.Null()])),
        last_name: t.Optional(t.Union([t.String(), t.Null()])),
        locale: t.Optional(t.Union([t.String(), t.Null()])),
      }),
    },
  )
  // POST /api/users/me/password - Change password
  .post(
    "/me/password",
    async ({ user, body, set, jwt, cookie: { auth } }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      const { current_password, new_password } = body;

      // Validate new password
      const [isValid, passwordError] = validatePassword(new_password);
      if (!isValid) {
        return badRequest(set, passwordError ?? "Invalid password");
      }

      try {
        // Fetch user with password hash
        const dbUser = await prisma.user.findFirst({
          where: { id: user.id },
          select: { id: true, passwordHash: true, authVersion: true },
        });

        if (!dbUser) {
          return unauthorized(set, "User not found");
        }

        // Verify current password
        const isCurrentValid = await verifyPassword(
          current_password,
          dbUser.passwordHash,
        );
        if (!isCurrentValid) {
          return badRequest(set, "Current password is incorrect");
        }

        // Hash new password and update
        const passwordHash = await hashPassword(new_password);
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            authVersion: { increment: 1 },
          },
          select: { id: true, authVersion: true },
        });
        await prisma.refreshToken.updateMany({
          where: { userId: user.id, revoked: false },
          data: { revoked: true },
        });

        const accessToken = await jwt.sign({
          id: updatedUser.id,
          ver: updatedUser.authVersion,
          exp: Math.floor(Date.now() / 1000) + 7 * 86400,
        });

        auth.set({
          value: accessToken,
          httpOnly: true,
          maxAge: 7 * 86400,
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });

        return { message: "Password updated successfully", token: accessToken };
      } catch (error) {
        console.error("Error changing password:", error);
        return serverError(set, "Failed to change password");
      }
    },
    {
      body: t.Object({
        current_password: t.String(),
        new_password: t.String(),
      }),
    },
  )
  // GET /api/users/avatar/:filename - Serve avatar image
  .get("/avatar/:filename", async ({ params, set }) => {
    const { filename } = params;

    if (!filename || !isAllowedFile(filename)) {
      return badRequest(set, "Invalid filename");
    }

    try {
      const imageBuffer = await getImage(filename);

      if (!imageBuffer) {
        return notFound(set, "Image not found");
      }

      // Set content type based on filename extension
      set.headers["Content-Type"] = getContentType(filename);
      set.headers["Cache-Control"] = "public, max-age=31536000"; // Cache for 1 year

      return imageBuffer;
    } catch (error) {
      console.error("Error serving avatar:", error);
      return serverError(set, "Failed to serve avatar");
    }
  })
  // POST /api/users/me/avatar - Upload avatar
  .post(
    "/me/avatar",
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, "Unauthorized");
      }

      const { avatar } = body;

      const isWebFile = avatar instanceof File;
      const isReactNativeFile =
        avatar &&
        typeof avatar === "object" &&
        "uri" in avatar &&
        "name" in avatar &&
        "type" in avatar;

      if (!avatar || (!isWebFile && !isReactNativeFile)) {
        return badRequest(set, "Avatar file is required");
      }

      try {
        const result = await updateUserAvatarFromUpload(user.id, avatar);
        if (!result.ok) {
          return badRequest(set, result.message);
        }
        return {
          message: "Avatar uploaded successfully",
          avatar_url: result.avatarUrl,
          url: result.avatarUrl,
        };
      } catch (error) {
        console.error("[avatar-upload][users] failed:", error);
        return serverError(set, "Failed to upload avatar");
      }
    },
    {
      body: t.Object({
        avatar: t.Any(), // Accept any type for React Native compatibility
      }),
      type: "multipart/form-data",
    },
  );
