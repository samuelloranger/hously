import { Elysia } from 'elysia';
import { auth } from '../auth';

/**
 * Middleware that requires an authenticated user.
 * Returns 401 Unauthorized if no user is present in the request context.
 *
 * Usage: new Elysia().use(requireUser).get('/path', handler)
 *   or inside a .group(): app.use(requireUser).get(...)
 *
 * Note: includes the auth plugin to ensure the `user` derive is available.
 */
export const requireUser = new Elysia({ name: 'middleware/requireUser' })
  .use(auth)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
  });

/**
 * Middleware that requires an authenticated admin user.
 * Returns 401 if not authenticated, 403 if authenticated but not admin.
 *
 * Usage: new Elysia().use(requireAdmin).get('/path', handler)
 *   or inside a .group(): app.use(requireAdmin).get(...)
 *
 * Note: includes the auth plugin to ensure the `user` derive is available.
 */
export const requireAdmin = new Elysia({ name: 'middleware/requireAdmin' })
  .use(auth)
  .onBeforeHandle(({ user, set }) => {
    if (!user) {
      set.status = 401;
      return { error: 'Unauthorized' };
    }
    if (!user.is_admin) {
      set.status = 403;
      return { error: 'Forbidden' };
    }
  });
