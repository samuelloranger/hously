import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { db } from "./db";
import { users, passwordResetTokens, refreshTokens } from "./db/schema";
import { eq, and, gt } from "drizzle-orm";
import { hashPassword, verifyPassword } from "./utils/password";
import { authRateLimit } from "./middleware/rateLimit";
import { validateEmail, validatePassword } from "./utils/validation";
import { loadAccessControl, getBaseUrl } from "./utils/config";

// Map database user (camelCase) to frontend user (snake_case)
const mapUser = (user: typeof users.$inferSelect) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  is_admin: user.isAdmin || false,
  last_login: user.lastLogin,
  created_at: user.createdAt || new Date().toISOString(),
  last_activity: user.lastActivity,
  avatar_url: user.avatarUrl || null,
});

const getJwtSecret = (): string => {
  const secret = process.env.SECRET_KEY;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SECRET_KEY environment variable is required in production");
  }
  return secret || "dev-key-change-in-production";
};

// Generate a cryptographically secure refresh token
const generateRefreshToken = (): string => {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

// Create and store a refresh token for a user, returns the raw token string
const createRefreshToken = async (userId: number): Promise<string> => {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt,
    revoked: false,
  });

  return token;
};

export const auth = (app: Elysia) =>
  app
    .use(
      jwt({
        name: "jwt",
        secret: getJwtSecret(),
      }),
    )
    .use(cookie())
    .derive(async ({ jwt, cookie: { auth }, set, request }) => {
      // 1. Check Authorization: Bearer <token> header (mobile clients)
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const profile = await jwt.verify(token);
        if (profile && profile.id) {
          const user = await db.query.users.findFirst({
            where: eq(users.id, Number(profile.id)),
          });
          if (user) {
            return { user: mapUser(user) };
          }
        }
        // Invalid Bearer token — don't fall through to cookie, return null
        return { user: null };
      }

      // 2. Check auth cookie (web clients)
      if (!auth.value) {
        return { user: null };
      }
      const profile = await jwt.verify(auth.value as string);
      if (!profile || !profile.id) {
        return { user: null };
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, Number(profile.id)),
      });

      if (!user) {
        return { user: null };
      }

      return { user: mapUser(user) };
    })
    .group("/api/auth", (app) =>
      app
        .use(authRateLimit)
        .post(
          "/login",
          async ({ body, jwt, set, cookie: { auth } }) => {
            const { email, password } = body;
            const user = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (!user) {
              set.status = 401;
              return { success: false, error: "Invalid credentials" };
            }

            try {
              const isValid = await verifyPassword(password, user.passwordHash);
              if (!isValid) {
                set.status = 401;
                return { success: false, error: "Invalid credentials" };
              }
            } catch (e) {
              console.error("Password verification error:", e);
              set.status = 500;
              return { success: false, error: "Internal server error" };
            }

            // Generate JWT access token
            const accessToken = await jwt.sign({ id: user.id });

            // Set secure cookie for web clients
            // - httpOnly: Prevents XSS attacks from stealing the token
            // - sameSite: 'lax' provides CSRF protection (cookies not sent on cross-site POST)
            // - secure: HTTPS only in production
            auth.set({
              value: accessToken,
              httpOnly: true,
              maxAge: 7 * 86400, // 7 days
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });

            // Update last login
            await db
              .update(users)
              .set({ lastLogin: new Date().toISOString() })
              .where(eq(users.id, user.id));

            // Generate refresh token for mobile clients
            const refreshToken = await createRefreshToken(user.id);

            return {
              user: mapUser(user),
              token: accessToken,
              refreshToken,
            };
          },
          {
            body: t.Object({
              email: t.String(),
              password: t.String(),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .post(
          "/signup",
          async ({ body, jwt, set, cookie: { auth } }) => {
            const { email, password, first_name, last_name, locale } = body;

            // Validate email
            if (!validateEmail(email)) {
              set.status = 400;
              return { error: "Invalid email format" };
            }

            // Validate password
            const [isValid, passwordError] = validatePassword(password);
            if (!isValid) {
              set.status = 400;
              return { error: passwordError };
            }

            // Check if user already exists
            const existingUser = await db.query.users.findFirst({
              where: eq(users.email, email),
            });

            if (existingUser) {
              set.status = 400;
              return { error: "User with this email already exists" };
            }

            // Load access control and check if user should be admin
            const accessControl = loadAccessControl();
            const isAdmin = accessControl.adminEmails.includes(email);

            // Hash password and create user
            const passwordHash = await hashPassword(password);
            const [newUser] = await db
              .insert(users)
              .values({
                email,
                passwordHash,
                firstName: first_name || null,
                lastName: last_name || null,
                isAdmin,
                locale: locale || "en",
                createdAt: new Date().toISOString(),
              })
              .returning();

            // Generate JWT access token
            const accessToken = await jwt.sign({ id: newUser.id });

            // Set secure cookie for web clients
            auth.set({
              value: accessToken,
              httpOnly: true,
              maxAge: 7 * 86400, // 7 days
              path: "/",
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            });

            // Generate refresh token for mobile clients
            const refreshToken = await createRefreshToken(newUser.id);

            console.log(`New user registered: ${email}`);

            set.status = 201;
            return {
              user: mapUser(newUser),
              token: accessToken,
              refreshToken,
            };
          },
          {
            body: t.Object({
              email: t.String(),
              password: t.String(),
              first_name: t.Optional(t.String()),
              last_name: t.Optional(t.String()),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .post(
          "/refresh",
          async ({ body, jwt, set }) => {
            const { refreshToken: tokenValue } = body;

            if (!tokenValue) {
              set.status = 400;
              return { error: "Refresh token is required" };
            }

            try {
              // Find valid refresh token
              const storedToken = await db.query.refreshTokens.findFirst({
                where: and(
                  eq(refreshTokens.token, tokenValue),
                  eq(refreshTokens.revoked, false),
                  gt(refreshTokens.expiresAt, new Date().toISOString()),
                ),
              });

              if (!storedToken) {
                set.status = 401;
                return { error: "Invalid or expired refresh token" };
              }

              // Fetch user
              const user = await db.query.users.findFirst({
                where: eq(users.id, storedToken.userId),
              });

              if (!user) {
                set.status = 401;
                return { error: "User not found" };
              }

              // Revoke old refresh token (rotation)
              await db
                .update(refreshTokens)
                .set({ revoked: true })
                .where(eq(refreshTokens.id, storedToken.id));

              // Generate new access token
              const accessToken = await jwt.sign({ id: user.id });

              // Generate new refresh token
              const newRefreshToken = await createRefreshToken(user.id);

              return {
                accessToken,
                refreshToken: newRefreshToken,
              };
            } catch (error) {
              console.error("Error refreshing token:", error);
              set.status = 500;
              return { error: "Token refresh failed" };
            }
          },
          {
            body: t.Object({
              refreshToken: t.String(),
            }),
          },
        )
        .post(
          "/forgot-password",
          async ({ body, set }) => {
            const { email } = body;

            // Validate email
            if (!validateEmail(email)) {
              set.status = 400;
              return { error: "Invalid email format" };
            }

            // Always return success to prevent email enumeration
            // But only create token if user exists
            try {
              const user = await db.query.users.findFirst({
                where: eq(users.email, email),
              });

              if (user) {
                // Generate secure token (32 bytes = 43 characters in base64url)
                const tokenBytes = new Uint8Array(32);
                crypto.getRandomValues(tokenBytes);
                const token = btoa(String.fromCharCode(...tokenBytes))
                  .replace(/\+/g, "-")
                  .replace(/\//g, "_")
                  .replace(/=/g, "");

                // Token expires in 1 hour
                const expiresAt = new Date(
                  Date.now() + 60 * 60 * 1000,
                ).toISOString();

                // Delete any existing unused tokens for this user
                await db
                  .delete(passwordResetTokens)
                  .where(
                    and(
                      eq(passwordResetTokens.userId, user.id),
                      eq(passwordResetTokens.used, false),
                    ),
                  );

                // Create new token
                await db.insert(passwordResetTokens).values({
                  userId: user.id,
                  token,
                  expiresAt,
                  used: false,
                });

                // Build reset URL
                const baseUrl = getBaseUrl();
                const resetUrl = `${baseUrl}/reset-password?token=${token}`;

                console.log(
                  `Password reset requested for: ${email}. Reset URL: ${resetUrl}`,
                );
                // TODO: Send email with reset URL when email service is implemented
              }
            } catch (error) {
              console.error("Error processing forgot password request:", error);
              // Don't reveal errors to prevent enumeration
            }

            // Always return success message
            return {
              message:
                "If an account exists with this email, you will receive a reset link.",
            };
          },
          {
            body: t.Object({
              email: t.String(),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .post(
          "/reset-password",
          async ({ body, set }) => {
            const { token, password } = body;

            if (!token) {
              set.status = 400;
              return { error: "Invalid reset link" };
            }

            // Validate password
            const [isValid, passwordError] = validatePassword(password);
            if (!isValid) {
              set.status = 400;
              return { error: passwordError };
            }

            try {
              // Get and validate token
              const resetToken = await db.query.passwordResetTokens.findFirst({
                where: and(
                  eq(passwordResetTokens.token, token),
                  eq(passwordResetTokens.used, false),
                  gt(passwordResetTokens.expiresAt, new Date().toISOString()),
                ),
              });

              if (!resetToken) {
                set.status = 400;
                return {
                  error: "This reset link is invalid or has expired.",
                };
              }

              // Update password
              const passwordHash = await hashPassword(password);
              await db
                .update(users)
                .set({ passwordHash })
                .where(eq(users.id, resetToken.userId));

              // Mark token as used
              await db
                .update(passwordResetTokens)
                .set({ used: true })
                .where(eq(passwordResetTokens.id, resetToken.id));

              console.log(
                `Password reset successful for user_id: ${resetToken.userId}`,
              );

              return {
                message: "Your password has been reset successfully.",
              };
            } catch (error) {
              console.error("Error resetting password:", error);
              set.status = 500;
              return { error: "Password reset failed" };
            }
          },
          {
            body: t.Object({
              token: t.String(),
              password: t.String(),
              locale: t.Optional(t.String()),
            }),
          },
        )
        .get("/me", async ({ user, set }) => {
          if (!user) {
            set.status = 401;
            return { user: null };
          }

          // Fetch fresh user data (including avatar_url)
          const dbUser = await db.query.users.findFirst({
            where: eq(users.id, user.id),
          });

          if (!dbUser) {
            set.status = 401;
            return { user: null };
          }

          return { user: mapUser(dbUser) };
        })
        .put(
          "/me",
          async ({ user, body, set }) => {
            if (!user) {
              set.status = 401;
              return { error: "Unauthorized" };
            }

            const { first_name, last_name, locale } = body;

            if (
              first_name === undefined &&
              last_name === undefined &&
              locale === undefined
            ) {
              set.status = 400;
              return { error: "At least one field must be provided" };
            }

            if (locale && locale.length > 10) {
              set.status = 400;
              return { error: "Locale must be 10 characters or less" };
            }

            try {
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
        .post(
          "/change-password",
          async ({ user, body, set }) => {
            if (!user) {
              set.status = 401;
              return { error: "Unauthorized" };
            }

            const { current_password, new_password } = body;

            const [isValid, passwordError] = validatePassword(new_password);
            if (!isValid) {
              set.status = 400;
              return { error: passwordError };
            }

            try {
              const dbUser = await db.query.users.findFirst({
                where: eq(users.id, user.id),
              });

              if (!dbUser) {
                set.status = 401;
                return { error: "User not found" };
              }

              const isCurrentValid = await verifyPassword(
                current_password,
                dbUser.passwordHash,
              );
              if (!isCurrentValid) {
                set.status = 400;
                return { error: "Current password is incorrect" };
              }

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
        .post(
          "/avatar",
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
              const ext = avatar.name.split(".").pop() || "jpg";
              const filename = `avatar_${user.id}_${Date.now()}.${ext}`;

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
                url: avatarUrl,
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
        )
        .post("/logout", async ({ user, cookie: { auth } }) => {
          // Revoke all refresh tokens for user on logout
          if (user) {
            try {
              await db
                .update(refreshTokens)
                .set({ revoked: true })
                .where(eq(refreshTokens.userId, user.id));
            } catch (error) {
              console.error("Error revoking refresh tokens:", error);
            }
          }
          auth.remove();
          return { message: "Logged out" };
        }),
    );
