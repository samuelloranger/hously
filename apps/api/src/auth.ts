import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { cookie } from "@elysiajs/cookie";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./utils/password";
import { authRateLimit } from "./middleware/rateLimit";
import { validateEmail, validatePassword } from "./utils/validation";
import {
  generateOpaqueToken,
  hashOpaqueToken,
  opaqueTokenCandidates,
} from "./utils/tokens";
import { sendPasswordResetEmail } from "./services/emailService";
import { mapUser } from "./utils/mappers";
import {
  updateUserAvatarFromUpload,
  updateUserProfileFields,
} from "./services/userProfileService";

const getJwtSecret = (): string => {
  const secret = process.env.SECRET_KEY;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "SECRET_KEY environment variable is required in production",
    );
  }
  return secret || "dev-key-change-in-production";
};

const ACCESS_TOKEN_TTL_SECONDS = 7 * 86400;

const signAccessToken = async (
  jwt: {
    sign: (value: { id: number; ver: number; exp: number }) => Promise<string>;
  },
  userId: number,
  authVersion: number,
): Promise<string> =>
  jwt.sign({
    id: userId,
    ver: authVersion,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
  });

// Create and store a refresh token for a user, returns the raw token string
const createRefreshToken = async (userId: number): Promise<string> => {
  const token = generateOpaqueToken();
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString(); // 30 days

  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashOpaqueToken(token),
      expiresAt,
      revoked: false,
    },
  });

  return token;
};

const revokeAllRefreshTokens = async (userId: number): Promise<void> => {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
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
    .derive(async ({ jwt, cookie: { auth }, request }) => {
      // 1. Check Authorization: Bearer <token> header (mobile clients)
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const profile = await jwt.verify(token);
        if (profile && profile.id) {
          const user = await prisma.user.findFirst({
            where: { id: Number(profile.id) },
          });
          if (
            user &&
            typeof profile.ver === "number" &&
            profile.ver === user.authVersion
          ) {
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

      const user = await prisma.user.findFirst({
        where: { id: Number(profile.id) },
      });

      if (
        !user ||
        typeof profile.ver !== "number" ||
        profile.ver !== user.authVersion
      ) {
        return { user: null };
      }

      return { user: mapUser(user) };
    })
    .group("/api/auth", (app) =>
      app
        .group("", (app) =>
          app.use(authRateLimit).post(
            "/login",
            async ({ body, jwt, set, cookie: { auth } }) => {
              const { email, password } = body;
              const user = await prisma.user.findFirst({
                where: { email },
              });

              if (!user) {
                set.status = 401;
                return { success: false, error: "Invalid credentials" };
              }

              try {
                const isValid = await verifyPassword(
                  password,
                  user.passwordHash,
                );
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
              const accessToken = await signAccessToken(
                jwt,
                user.id,
                user.authVersion,
              );

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
              await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date().toISOString() },
              });

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
          ),
        )
        .get(
          "/accept-invitation",
          async ({ query, set }) => {
            const { token } = query;

            if (!token) {
              set.status = 400;
              return { valid: false, error: "Token is required" };
            }

            try {
              const invitation = await prisma.invitation.findFirst({
                where: {
                  token: { in: opaqueTokenCandidates(token) },
                  status: "pending",
                  expiresAt: { gt: new Date() },
                },
              });

              if (!invitation) {
                return { valid: false, error: "Invalid or expired invitation" };
              }

              return { valid: true, email: invitation.email };
            } catch (error) {
              console.error("Error validating invitation:", error);
              set.status = 500;
              return { valid: false, error: "Failed to validate invitation" };
            }
          },
          {
            query: t.Object({
              token: t.String(),
            }),
          },
        )
        .post(
          "/accept-invitation",
          async ({ body, jwt, set, cookie: { auth } }) => {
            const { token, password, first_name, last_name } = body;

            // Validate password
            const [isValid, passwordError] = validatePassword(password);
            if (!isValid) {
              set.status = 400;
              return { error: passwordError };
            }

            try {
              // Find and validate invitation
              const invitation = await prisma.invitation.findFirst({
                where: {
                  token: { in: opaqueTokenCandidates(token) },
                  status: "pending",
                  expiresAt: { gt: new Date() },
                },
              });

              if (!invitation) {
                set.status = 400;
                return { error: "Invalid or expired invitation" };
              }

              // Check if user already exists (race condition guard)
              const existingUser = await prisma.user.findFirst({
                where: { email: invitation.email },
              });

              if (existingUser) {
                set.status = 400;
                return { error: "An account with this email already exists" };
              }

              // Create user and mark invitation as accepted in a transaction
              const passwordHash = await hashPassword(password);

              const newUser = await prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                  data: {
                    email: invitation.email,
                    passwordHash,
                    firstName: first_name || null,
                    lastName: last_name || null,
                    isAdmin: invitation.isAdmin,
                    locale: invitation.locale || "en",
                    createdAt: new Date().toISOString(),
                  },
                });

                await tx.invitation.update({
                  where: { id: invitation.id },
                  data: {
                    status: "accepted",
                    acceptedAt: new Date(),
                  },
                });

                return user;
              });

              // Generate JWT access token
              const accessToken = await signAccessToken(
                jwt,
                newUser.id,
                newUser.authVersion,
              );

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

              console.log(
                `User registered via invitation: ${invitation.email}`,
              );

              set.status = 201;
              return {
                user: mapUser(newUser),
                token: accessToken,
                refreshToken,
              };
            } catch (error) {
              console.error("Error accepting invitation:", error);
              set.status = 500;
              return { error: "Failed to create account" };
            }
          },
          {
            body: t.Object({
              token: t.String(),
              password: t.String(),
              first_name: t.Optional(t.String()),
              last_name: t.Optional(t.String()),
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
              const storedToken = await prisma.refreshToken.findFirst({
                where: {
                  token: { in: opaqueTokenCandidates(tokenValue) },
                  revoked: false,
                  expiresAt: { gt: new Date().toISOString() },
                },
              });

              if (!storedToken) {
                set.status = 401;
                return { error: "Invalid or expired refresh token" };
              }

              // Fetch user
              const user = await prisma.user.findFirst({
                where: { id: storedToken.userId },
              });

              if (!user) {
                set.status = 401;
                return { error: "User not found" };
              }

              // Revoke old refresh token (rotation)
              await prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revoked: true },
              });

              // Generate new access token
              const accessToken = await signAccessToken(
                jwt,
                user.id,
                user.authVersion,
              );

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
              const user = await prisma.user.findFirst({
                where: { email },
              });

              if (user) {
                // Generate secure token (32 bytes = 43 characters in base64url)
                const token = generateOpaqueToken();

                // Token expires in 1 hour
                const expiresAt = new Date(
                  Date.now() + 60 * 60 * 1000,
                ).toISOString();

                // Delete any existing unused tokens for this user
                await prisma.passwordResetToken.deleteMany({
                  where: {
                    userId: user.id,
                    used: false,
                  },
                });

                // Create new token
                await prisma.passwordResetToken.create({
                  data: {
                    userId: user.id,
                    token: hashOpaqueToken(token),
                    expiresAt,
                    used: false,
                  },
                });

                // Send password reset email
                const locale = body.locale || "en";
                await sendPasswordResetEmail(email, token, locale);
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
              const resetToken = await prisma.passwordResetToken.findFirst({
                where: {
                  token: { in: opaqueTokenCandidates(token) },
                  used: false,
                  expiresAt: { gt: new Date().toISOString() },
                },
              });

              if (!resetToken) {
                set.status = 400;
                return {
                  error: "This reset link is invalid or has expired.",
                };
              }

              // Update password
              const passwordHash = await hashPassword(password);
              await prisma.$transaction([
                prisma.user.update({
                  where: { id: resetToken.userId },
                  data: {
                    passwordHash,
                    authVersion: { increment: 1 },
                  },
                }),
                prisma.passwordResetToken.update({
                  where: { id: resetToken.id },
                  data: { used: true },
                }),
                prisma.refreshToken.updateMany({
                  where: { userId: resetToken.userId, revoked: false },
                  data: { revoked: true },
                }),
              ]);

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
          const dbUser = await prisma.user.findFirst({
            where: { id: user.id },
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
              const updatedUser = await updateUserProfileFields(user.id, {
                first_name,
                last_name,
                locale,
              });

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
          async ({ user, body, set, jwt, cookie: { auth } }) => {
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
              const dbUser = await prisma.user.findFirst({
                where: { id: user.id },
                select: { id: true, passwordHash: true, authVersion: true },
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
              const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                  passwordHash,
                  authVersion: { increment: 1 },
                },
                select: { id: true, authVersion: true },
              });
              await revokeAllRefreshTokens(user.id);

              const accessToken = await signAccessToken(
                jwt,
                updatedUser.id,
                updatedUser.authVersion,
              );
              auth.set({
                value: accessToken,
                httpOnly: true,
                maxAge: ACCESS_TOKEN_TTL_SECONDS,
                path: "/",
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
              });

              return {
                message: "Password updated successfully",
                token: accessToken,
              };
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

            const isWebFile = avatar instanceof File;
            const isReactNativeFile =
              avatar &&
              typeof avatar === "object" &&
              "uri" in avatar &&
              "name" in avatar &&
              "type" in avatar;

            if (!avatar || (!isWebFile && !isReactNativeFile)) {
              set.status = 400;
              return { error: "Avatar file is required" };
            }

            try {
              const result = await updateUserAvatarFromUpload(user.id, avatar);
              if (!result.ok) {
                set.status = 400;
                return { error: result.message };
              }
              return {
                message: "Avatar uploaded successfully",
                avatar_url: result.avatarUrl,
                url: result.avatarUrl,
              };
            } catch (error) {
              console.error("[avatar-upload][auth] failed:", error);
              set.status = 500;
              return { error: "Failed to upload avatar" };
            }
          },
          {
            body: t.Object({
              avatar: t.Any(), // Accept any type for React Native compatibility
            }),
            type: "multipart/form-data",
          },
        )
        .post("/logout", async ({ user, cookie: { auth } }) => {
          // Revoke all refresh tokens for user on logout
          if (user) {
            try {
              await prisma.$transaction([
                prisma.refreshToken.updateMany({
                  where: { userId: user.id, revoked: false },
                  data: { revoked: true },
                }),
                prisma.user.update({
                  where: { id: user.id },
                  data: { authVersion: { increment: 1 } },
                }),
              ]);
            } catch (error) {
              console.error("Error revoking refresh tokens:", error);
            }
          }
          auth.remove();
          return { message: "Logged out" };
        }),
    );
