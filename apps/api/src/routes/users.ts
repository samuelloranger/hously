import { Elysia, t } from 'elysia';
import { auth } from '../auth';
import { prisma } from '../db';
import { hashPassword, verifyPassword } from '../utils/password';
import { validatePassword } from '../utils/validation';
import {
  saveImageAndCreateThumbnail,
  deleteImageFiles,
  getAvatarUrl,
  isAllowedFile,
  getImage,
  getContentType,
} from '../services/imageService';
import { badRequest, notFound, serverError, unauthorized } from '../utils/errors';
import { mapUser } from '../utils/mappers';
import { validateImageMimeAndSize } from '@hously/shared';

export const usersRoutes = new Elysia({ prefix: '/api/users' })
  .use(auth)
  // GET /api/users - List all users (for assignee pickers, etc.)
  .get('/', async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, 'Unauthorized');
    }
    try {
      const users = await prisma.user.findMany({
        orderBy: [{ firstName: 'asc' }, { email: 'asc' }],
      });
      return { users: users.map(mapUser) };
    } catch (error) {
      console.error('Error listing users:', error);
      return serverError(set, 'Failed to list users');
    }
  })
  // GET /api/users/me - Get current user profile
  .get('/me', async ({ user, set }) => {
    if (!user) {
      return unauthorized(set, 'Unauthorized');
    }

    // Fetch fresh user data from database (including locale)
    const dbUser = await prisma.user.findFirst({
      where: { id: user.id },
    });

    if (!dbUser) {
      return unauthorized(set, 'User not found');
    }

    return { user: mapUser(dbUser) };
  })
  // PUT /api/users/me - Update user profile
  .put(
    '/me',
    async ({ user, body, set }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
      }

      const { first_name, last_name, locale } = body;

      // Check if at least one field is provided
      if (first_name === undefined && last_name === undefined && locale === undefined) {
        return badRequest(set, 'At least one field must be provided');
      }

      // Validate locale if provided
      if (locale && locale.length > 10) {
        return badRequest(set, 'Locale must be 10 characters or less');
      }

      try {
        // Build update object with only provided fields
        const updateData: Partial<{
          firstName: string | null;
          lastName: string | null;
          locale: string | null;
          dashboardConfig: any | null;
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
        const updatedUser = await prisma.user.update({
          where: { id: user.id },
          data: updateData,
        });

        return { user: mapUser(updatedUser) };
      } catch (error) {
        console.error('Error updating user profile:', error);
        return serverError(set, 'Failed to update profile');
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
  // POST /api/users/me/password - Change password
  .post(
    '/me/password',
    async ({ user, body, set, jwt, cookie: { auth } }) => {
      if (!user) {
        return unauthorized(set, 'Unauthorized');
      }

      const { current_password, new_password } = body;

      // Validate new password
      const [isValid, passwordError] = validatePassword(new_password);
      if (!isValid) {
        return badRequest(set, passwordError ?? 'Invalid password');
      }

      try {
        // Fetch user with password hash
        const dbUser = await prisma.user.findFirst({
          where: { id: user.id },
          select: { id: true, passwordHash: true, authVersion: true },
        });

        if (!dbUser) {
          return unauthorized(set, 'User not found');
        }

        // Verify current password
        const isCurrentValid = await verifyPassword(current_password, dbUser.passwordHash);
        if (!isCurrentValid) {
          return badRequest(set, 'Current password is incorrect');
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
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
        });

        return { message: 'Password updated successfully', token: accessToken };
      } catch (error) {
        console.error('Error changing password:', error);
        return serverError(set, 'Failed to change password');
      }
    },
    {
      body: t.Object({
        current_password: t.String(),
        new_password: t.String(),
      }),
    }
  )
  // GET /api/users/avatar/:filename - Serve avatar image
  .get('/avatar/:filename', async ({ params, set }) => {
    const { filename } = params;

    if (!filename || !isAllowedFile(filename)) {
      return badRequest(set, 'Invalid filename');
    }

    try {
      const imageBuffer = await getImage(filename);

      if (!imageBuffer) {
        return notFound(set, 'Image not found');
      }

      // Set content type based on filename extension
      set.headers['Content-Type'] = getContentType(filename);
      set.headers['Cache-Control'] = 'public, max-age=31536000'; // Cache for 1 year

      return imageBuffer;
    } catch (error) {
      console.error('Error serving avatar:', error);
      return serverError(set, 'Failed to serve avatar');
    }
  })
  // POST /api/users/me/avatar - Upload avatar
  .post(
    '/me/avatar',
    async ({ user, body, set }) => {
      const logPrefix = `[avatar-upload][users][${new Date().toISOString()}]`;
      console.log(`${logPrefix} request received`);

      if (!user) {
        console.warn(`${logPrefix} unauthorized request (no user in auth context)`);
        return unauthorized(set, 'Unauthorized');
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
        return badRequest(set, 'Avatar file is required');
      }

      console.log(
        `${logPrefix} avatar file received name="${avatar.name}" type="${avatar.type}" size=${avatar.size || 'unknown'} isWebFile=${isWebFile} isReactNativeFile=${isReactNativeFile}`
      );

      const avatarValidationError = validateImageMimeAndSize(avatar, { maxSizeBytes: 5 * 1024 * 1024 });
      if (avatarValidationError) {
        console.warn(`${logPrefix} avatar validation failed: ${avatarValidationError.error}`);
        return badRequest(set, avatarValidationError.error);
      }

      try {
        console.log(`${logPrefix} fetching current user record before upload`);
        // Delete old avatar if exists
        const dbUser = await prisma.user.findFirst({
          where: { id: user.id },
        });
        console.log(`${logPrefix} current db avatarUrl="${dbUser?.avatarUrl || 'none'}"`);

        if (dbUser?.avatarUrl) {
          // Extract filename from URL (assuming S3 format)
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
        return serverError(set, 'Failed to upload avatar');
      }
    },
    {
      body: t.Object({
        avatar: t.Any(), // Accept any type for React Native compatibility
      }),
      type: 'multipart/form-data',
    }
  );
