import { Elysia, t } from "elysia";
import { auth } from "../auth";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../utils/password";
import { validatePassword } from "../utils/validation";

// Map database user (camelCase) to frontend user (snake_case)
const mapUser = (user: typeof users.$inferSelect) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  is_admin: user.isAdmin || false,
  locale: user.locale,
  last_login: user.lastLogin,
  created_at: user.createdAt || new Date().toISOString(),
  last_activity: user.lastActivity,
  avatar_url: user.avatarUrl || null,
});

export const usersRoutes = new Elysia({ prefix: "/api/users" })
  .use(auth)
  // GET /api/users/me - Get current user profile
  .get("/me", async ({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    // Fetch fresh user data from database (including locale)
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser) {
      set.status = 401;
      return { error: "User not found" };
    }

    return { user: mapUser(dbUser) };
  })
  // PUT /api/users/me - Update user profile
  .put(
    "/me",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { first_name, last_name, locale } = body;

      // Check if at least one field is provided
      if (
        first_name === undefined &&
        last_name === undefined &&
        locale === undefined
      ) {
        set.status = 400;
        return { error: "At least one field must be provided" };
      }

      // Validate locale if provided
      if (locale && locale.length > 10) {
        set.status = 400;
        return { error: "Locale must be 10 characters or less" };
      }

      try {
        // Build update object with only provided fields
        const updateData: Partial<{
          firstName: string | null;
          lastName: string | null;
          locale: string | null;
        }> = {};

        if (first_name !== undefined) {
          updateData.firstName = first_name;
        }
        if (last_name !== undefined) {
          updateData.lastName = last_name;
        }
        if (locale !== undefined) {
          updateData.locale = locale;
        }

        // Update user
        const [updatedUser] = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, user.id))
          .returning();

        return { user: mapUser(updatedUser) };
      } catch (error) {
        console.error("Error updating user profile:", error);
        set.status = 500;
        return { error: "Failed to update profile" };
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
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { current_password, new_password } = body;

      // Validate new password
      const [isValid, passwordError] = validatePassword(new_password);
      if (!isValid) {
        set.status = 400;
        return { error: passwordError };
      }

      try {
        // Fetch user with password hash
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, user.id),
        });

        if (!dbUser) {
          set.status = 401;
          return { error: "User not found" };
        }

        // Verify current password
        const isCurrentValid = await verifyPassword(
          current_password,
          dbUser.passwordHash,
        );
        if (!isCurrentValid) {
          set.status = 400;
          return { error: "Current password is incorrect" };
        }

        // Hash new password and update
        const passwordHash = await hashPassword(new_password);
        await db
          .update(users)
          .set({ passwordHash })
          .where(eq(users.id, user.id));

        return { message: "Password updated successfully" };
      } catch (error) {
        console.error("Error changing password:", error);
        set.status = 500;
        return { error: "Failed to change password" };
      }
    },
    {
      body: t.Object({
        current_password: t.String(),
        new_password: t.String(),
      }),
    },
  )
  // POST /api/users/me/avatar - Upload avatar
  .post(
    "/me/avatar",
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return { error: "Unauthorized" };
      }

      const { avatar } = body;

      if (!avatar || !(avatar instanceof File)) {
        set.status = 400;
        return { error: "Avatar file is required" };
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
      ];
      if (!allowedTypes.includes(avatar.type)) {
        set.status = 400;
        return { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" };
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (avatar.size > maxSize) {
        set.status = 400;
        return { error: "File too large. Maximum size is 5MB" };
      }

      try {
        // Generate unique filename
        const ext = avatar.name.split(".").pop() || "jpg";
        const filename = `avatar_${user.id}_${Date.now()}.${ext}`;

        // Save to uploads directory
        const uploadsDir = `${process.cwd()}/uploads/avatars`;
        await Bun.write(`${uploadsDir}/${filename}`, avatar);

        const avatarUrl = `/uploads/avatars/${filename}`;

        // Persist avatar URL in user record
        await db
          .update(users)
          .set({ avatarUrl })
          .where(eq(users.id, user.id));

        return {
          message: "Avatar uploaded successfully",
          avatar_url: avatarUrl,
        };
      } catch (error) {
        console.error("Error uploading avatar:", error);
        set.status = 500;
        return { error: "Failed to upload avatar" };
      }
    },
    {
      body: t.Object({
        avatar: t.File(),
      }),
    },
  );
