import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { cookie } from '@elysiajs/cookie';
import { prisma } from './db';
import { hashPassword, verifyPassword } from './utils/password';
import { authRateLimit } from './middleware/rateLimit';
import { validateEmail, validatePassword } from './utils/validation';
import { loadAccessControl, getBaseUrl } from './utils/config';
import { saveImageAndCreateThumbnail, deleteImageFiles, getAvatarUrl } from './services/imageService';
import { sendPasswordResetEmail, isEmailConfigured } from './services/emailService';

// Map database user (camelCase) to frontend user (snake_case)
const mapUser = (user: {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean | null;
  locale: string | null;
  lastLogin: Date | null;
  createdAt: Date | null;
  lastActivity: Date | null;
  avatarUrl: string | null;
}) => ({
  id: user.id,
  email: user.email,
  first_name: user.firstName,
  last_name: user.lastName,
  is_admin: user.isAdmin || false,
  locale: user.locale ?? null,
  last_login: user.lastLogin?.toISOString() ?? null,
  created_at: user.createdAt?.toISOString() ?? new Date().toISOString(),
  last_activity: user.lastActivity?.toISOString() ?? null,
  avatar_url: user.avatarUrl || null,
});

const getJwtSecret = (): string => {
  const secret = process.env.SECRET_KEY;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('SECRET_KEY environment variable is required in production');
  }
  return secret || 'dev-key-change-in-production';
};

// Generate a cryptographically secure refresh token
const generateRefreshToken = (): string => {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Create and store a refresh token for a user, returns the raw token string
const createRefreshToken = async (userId: number): Promise<string> => {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await prisma.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
      revoked: false,
    },
  });

  return token;
};

export const auth = (app: Elysia) =>
  app
    .use(
      jwt({
        name: 'jwt',
        secret: getJwtSecret(),
      })
    )
    .use(cookie())
    .derive(async ({ jwt, cookie: { auth }, request }) => {
      // 1. Check Authorization: Bearer <token> header (mobile clients)
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const profile = await jwt.verify(token);
        if (profile && profile.id) {
          const user = await prisma.user.findFirst({
            where: { id: Number(profile.id) },
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

      const user = await prisma.user.findFirst({
        where: { id: Number(profile.id) },
      });

      if (!user) {
        return { user: null };
      }

      return { user: mapUser(user) };
    })
    .group('/api/auth', app =>
      app
        .group('', app =>
          app
            .use(authRateLimit)
            .post(
              '/login',
              async ({ body, jwt, set, cookie: { auth } }) => {
                const { email, password } = body;
                const user = await prisma.user.findFirst({
                  where: { email },
                });

                if (!user) {
                  set.status = 401;
                  return { success: false, error: 'Invalid credentials' };
                }

                try {
                  const isValid = await verifyPassword(password, user.passwordHash);
                  if (!isValid) {
                    set.status = 401;
                    return { success: false, error: 'Invalid credentials' };
                  }
                } catch (e) {
                  console.error('Password verification error:', e);
                  set.status = 500;
                  return { success: false, error: 'Internal server error' };
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
                  path: '/',
                  sameSite: 'lax',
                  secure: process.env.NODE_ENV === 'production',
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
              }
            )
        )
        .get(
          '/accept-invitation',
          async ({ query, set }) => {
            const { token } = query;

            if (!token) {
              set.status = 400;
              return { valid: false, error: 'Token is required' };
            }

            try {
              const invitation = await prisma.invitation.findFirst({
                where: {
                  token,
                  status: 'pending',
                  expiresAt: { gt: new Date() },
                },
              });

              if (!invitation) {
                return { valid: false, error: 'Invalid or expired invitation' };
              }

              return { valid: true, email: invitation.email };
            } catch (error) {
              console.error('Error validating invitation:', error);
              set.status = 500;
              return { valid: false, error: 'Failed to validate invitation' };
            }
          },
          {
            query: t.Object({
              token: t.String(),
            }),
          }
        )
        .post(
          '/accept-invitation',
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
                  token,
                  status: 'pending',
                  expiresAt: { gt: new Date() },
                },
              });

              if (!invitation) {
                set.status = 400;
                return { error: 'Invalid or expired invitation' };
              }

              // Check if user already exists (race condition guard)
              const existingUser = await prisma.user.findFirst({
                where: { email: invitation.email },
              });

              if (existingUser) {
                set.status = 400;
                return { error: 'An account with this email already exists' };
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
                    locale: invitation.locale || 'en',
                    createdAt: new Date().toISOString(),
                  },
                });

                await tx.invitation.update({
                  where: { id: invitation.id },
                  data: {
                    status: 'accepted',
                    acceptedAt: new Date(),
                  },
                });

                return user;
              });

              // Generate JWT access token
              const accessToken = await jwt.sign({ id: newUser.id });

              // Set secure cookie for web clients
              auth.set({
                value: accessToken,
                httpOnly: true,
                maxAge: 7 * 86400, // 7 days
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              });

              // Generate refresh token for mobile clients
              const refreshToken = await createRefreshToken(newUser.id);

              console.log(`User registered via invitation: ${invitation.email}`);

              set.status = 201;
              return {
                user: mapUser(newUser),
                token: accessToken,
                refreshToken,
              };
            } catch (error) {
              console.error('Error accepting invitation:', error);
              set.status = 500;
              return { error: 'Failed to create account' };
            }
          },
          {
            body: t.Object({
              token: t.String(),
              password: t.String(),
              first_name: t.Optional(t.String()),
              last_name: t.Optional(t.String()),
            }),
          }
        )
        .post(
          '/refresh',
          async ({ body, jwt, set }) => {
            const { refreshToken: tokenValue } = body;

            if (!tokenValue) {
              set.status = 400;
              return { error: 'Refresh token is required' };
            }

            try {
              // Find valid refresh token
              const storedToken = await prisma.refreshToken.findFirst({
                where: {
                  token: tokenValue,
                  revoked: false,
                  expiresAt: { gt: new Date().toISOString() },
                },
              });

              if (!storedToken) {
                set.status = 401;
                return { error: 'Invalid or expired refresh token' };
              }

              // Fetch user
              const user = await prisma.user.findFirst({
                where: { id: storedToken.userId },
              });

              if (!user) {
                set.status = 401;
                return { error: 'User not found' };
              }

              // Revoke old refresh token (rotation)
              await prisma.refreshToken.update({
                where: { id: storedToken.id },
                data: { revoked: true },
              });

              // Generate new access token
              const accessToken = await jwt.sign({ id: user.id });

              // Generate new refresh token
              const newRefreshToken = await createRefreshToken(user.id);

              return {
                accessToken,
                refreshToken: newRefreshToken,
              };
            } catch (error) {
              console.error('Error refreshing token:', error);
              set.status = 500;
              return { error: 'Token refresh failed' };
            }
          },
          {
            body: t.Object({
              refreshToken: t.String(),
            }),
          }
        )
        .post(
          '/forgot-password',
          async ({ body, set }) => {
            const { email } = body;

            // Validate email
            if (!validateEmail(email)) {
              set.status = 400;
              return { error: 'Invalid email format' };
            }

            // Always return success to prevent email enumeration
            // But only create token if user exists
            try {
              const user = await prisma.user.findFirst({
                where: { email },
              });

              if (user) {
                // Generate secure token (32 bytes = 43 characters in base64url)
                const tokenBytes = new Uint8Array(32);
                crypto.getRandomValues(tokenBytes);
                const token = btoa(String.fromCharCode(...tokenBytes))
                  .replace(/\+/g, '-')
                  .replace(/\//g, '_')
                  .replace(/=/g, '');

                // Token expires in 1 hour
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

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
                    token,
                    expiresAt,
                    used: false,
                  },
                });

                // Send password reset email
                const locale = body.locale || 'en';
                await sendPasswordResetEmail(email, token, locale);
              }
            } catch (error) {
              console.error('Error processing forgot password request:', error);
              // Don't reveal errors to prevent enumeration
            }

            // Always return success message
            return {
              message: 'If an account exists with this email, you will receive a reset link.',
            };
          },
          {
            body: t.Object({
              email: t.String(),
              locale: t.Optional(t.String()),
            }),
          }
        )
        .post(
          '/reset-password',
          async ({ body, set }) => {
            const { token, password } = body;

            if (!token) {
              set.status = 400;
              return { error: 'Invalid reset link' };
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
                  token,
                  used: false,
                  expiresAt: { gt: new Date().toISOString() },
                },
              });

              if (!resetToken) {
                set.status = 400;
                return {
                  error: 'This reset link is invalid or has expired.',
                };
              }

              // Update password
              const passwordHash = await hashPassword(password);
              await prisma.user.update({
                where: { id: resetToken.userId },
                data: { passwordHash },
              });

              // Mark token as used
              await prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { used: true },
              });

              console.log(`Password reset successful for user_id: ${resetToken.userId}`);

              return {
                message: 'Your password has been reset successfully.',
              };
            } catch (error) {
              console.error('Error resetting password:', error);
              set.status = 500;
              return { error: 'Password reset failed' };
            }
          },
          {
            body: t.Object({
              token: t.String(),
              password: t.String(),
              locale: t.Optional(t.String()),
            }),
          }
        )
        .get('/me', async ({ user, set }) => {
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
          '/me',
          async ({ user, body, set }) => {
            if (!user) {
              set.status = 401;
              return { error: 'Unauthorized' };
            }

            const { first_name, last_name, locale } = body;

            if (first_name === undefined && last_name === undefined && locale === undefined) {
              set.status = 400;
              return { error: 'At least one field must be provided' };
            }

            if (locale && locale.length > 10) {
              set.status = 400;
              return { error: 'Locale must be 10 characters or less' };
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

              const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: updateData,
              });

              return { user: mapUser(updatedUser) };
            } catch (error) {
              console.error('Error updating user profile:', error);
              set.status = 500;
              return { error: 'Failed to update profile' };
            }
          },
          {
            body: t.Object({
              first_name: t.Optional(t.Union([t.String(), t.Null()])),
              last_name: t.Optional(t.Union([t.String(), t.Null()])),
              locale: t.Optional(t.Union([t.String(), t.Null()])),
            }),
          }
        )
        .post(
          '/change-password',
          async ({ user, body, set }) => {
            if (!user) {
              set.status = 401;
              return { error: 'Unauthorized' };
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
              });

              if (!dbUser) {
                set.status = 401;
                return { error: 'User not found' };
              }

              const isCurrentValid = await verifyPassword(current_password, dbUser.passwordHash);
              if (!isCurrentValid) {
                set.status = 400;
                return { error: 'Current password is incorrect' };
              }

              const passwordHash = await hashPassword(new_password);
              await prisma.user.update({
                where: { id: user.id },
                data: { passwordHash },
              });

              return { message: 'Password updated successfully' };
            } catch (error) {
              console.error('Error changing password:', error);
              set.status = 500;
              return { error: 'Failed to change password' };
            }
          },
          {
            body: t.Object({
              current_password: t.String(),
              new_password: t.String(),
            }),
          }
        )
        .post(
          '/avatar',
          async ({ user, body, set }) => {
            const logPrefix = `[avatar-upload][auth][${new Date().toISOString()}]`;
            console.log(`${logPrefix} request received`);

            if (!user) {
              console.warn(`${logPrefix} unauthorized request (no user in auth context)`);
              set.status = 401;
              return { error: 'Unauthorized' };
            }

            const { avatar } = body;
            console.log(`${logPrefix} authenticated user id=${user.id}`);
            console.log(`${logPrefix} body keys=${Object.keys(body || {}).join(',') || 'none'}`);

            // Support both Web File (instanceof File) and React Native file objects ({uri, name, type})
            const isWebFile = avatar instanceof File;
            const isReactNativeFile =
              avatar && typeof avatar === 'object' && 'uri' in avatar && 'name' in avatar && 'type' in avatar;

            if (!avatar || (!isWebFile && !isReactNativeFile)) {
              console.warn(
                `${logPrefix} invalid payload: avatar missing or not File (type=${typeof avatar}, isWebFile=${isWebFile}, isReactNativeFile=${isReactNativeFile})`
              );
              set.status = 400;
              return { error: 'Avatar file is required' };
            }

            console.log(
              `${logPrefix} avatar file received name="${avatar.name}" type="${avatar.type}" size=${avatar.size || 'unknown'} isWebFile=${isWebFile} isReactNativeFile=${isReactNativeFile}`
            );

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!allowedTypes.includes(avatar.type)) {
              console.warn(`${logPrefix} invalid avatar mime type="${avatar.type}" allowed=${allowedTypes.join(',')}`);
              set.status = 400;
              return {
                error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
              };
            }

            // Validate file size (max 5MB) - only for Web File objects that have size property
            const maxSize = 5 * 1024 * 1024;
            if (avatar.size && avatar.size > maxSize) {
              console.warn(`${logPrefix} avatar too large size=${avatar.size} max=${maxSize} bytes`);
              set.status = 400;
              return { error: 'File too large. Maximum size is 5MB' };
            }

            try {
              console.log(`${logPrefix} fetching current user record before upload`);
              // Delete old avatar if exists
              const dbUser = await prisma.user.findFirst({
                where: { id: user.id },
              });
              console.log(`${logPrefix} current db avatarUrl="${dbUser?.avatarUrl || 'none'}"`);

              if (dbUser?.avatarUrl) {
                const oldFilename = dbUser.avatarUrl.split('/').pop();
                console.log(`${logPrefix} parsed old filename="${oldFilename || 'none'}" from avatarUrl`);
                if (oldFilename) {
                  console.log(`${logPrefix} deleting old avatar assets for key="${oldFilename}"`);
                  await deleteImageFiles(oldFilename);
                  console.log(`${logPrefix} old avatar assets deleted`);
                }
              }

              // Save to S3 and create thumbnail
              console.log(`${logPrefix} uploading new avatar to image service`);
              const filename = await saveImageAndCreateThumbnail(avatar);
              console.log(`${logPrefix} image service completed filename="${filename}"`);

              // Build avatar URL using S3 direct URL
              const avatarUrl = getAvatarUrl(filename);
              console.log(`${logPrefix} generated avatar URL="${avatarUrl}"`);

              // Persist avatar URL in user record
              console.log(`${logPrefix} updating user.avatarUrl in database`);
              await prisma.user.update({
                where: { id: user.id },
                data: { avatarUrl },
              });
              console.log(`${logPrefix} database update success for user id=${user.id}`);
              console.log(`${logPrefix} request complete`);

              return {
                message: 'Avatar uploaded successfully',
                avatar_url: avatarUrl,
                url: avatarUrl,
              };
            } catch (error) {
              console.error(`${logPrefix} failed with error:`, error);
              set.status = 500;
              return { error: 'Failed to upload avatar' };
            }
          },
          {
            body: t.Object({
              avatar: t.Any(), // Accept any type for React Native compatibility
            }),
            type: 'multipart/form-data',
          }
        )
        .post('/logout', async ({ user, cookie: { auth } }) => {
          // Revoke all refresh tokens for user on logout
          if (user) {
            try {
              await prisma.refreshToken.updateMany({
                where: { userId: user.id },
                data: { revoked: true },
              });
            } catch (error) {
              console.error('Error revoking refresh tokens:', error);
            }
          }
          auth.remove();
          return { message: 'Logged out' };
        })
    );
