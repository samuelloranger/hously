import { Elysia, t } from 'elysia';
import { auth } from '../../auth';
import { prisma } from '../../db';
import { toPositiveInt } from '../../utils/coerce';
import { mapJellyfinApiItem } from '../../utils/dashboard/jellyfin';
import { normalizeJellyfinConfig } from '../../utils/plugins/normalizers';

export const dashboardJellyfinRoutes = new Elysia()
  .use(auth)
  .get(
    '/jellyfin/image',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const jellyfinPlugin = await prisma.plugin.findFirst({
          where: { type: 'jellyfin' },
          select: { enabled: true, config: true },
        });

        if (!jellyfinPlugin?.enabled) {
          set.status = 404;
          return { error: 'Jellyfin plugin not enabled' };
        }

        const config = normalizeJellyfinConfig(jellyfinPlugin.config);
        if (!config) {
          set.status = 404;
          return { error: 'Jellyfin plugin not configured' };
        }

        const candidates =
          query.preferred === 'primary'
            ? ([
                { itemId: query.itemId, imageType: 'Primary', tag: query.primaryTag },
                { itemId: query.itemId, imageType: 'Backdrop', tag: query.backdropTag },
                { itemId: query.parentBackdropItemId, imageType: 'Backdrop', tag: query.parentBackdropTag },
              ] as const)
            : ([
                { itemId: query.itemId, imageType: 'Backdrop', tag: query.backdropTag },
                { itemId: query.parentBackdropItemId, imageType: 'Backdrop', tag: query.parentBackdropTag },
                { itemId: query.itemId, imageType: 'Primary', tag: query.primaryTag },
              ] as const);

        for (const candidate of candidates) {
          if (!candidate.itemId) continue;

          const imageUrl = new URL(
            `/Items/${encodeURIComponent(candidate.itemId)}/Images/${candidate.imageType}`,
            config.website_url
          );
          if (candidate.tag) {
            imageUrl.searchParams.set('tag', candidate.tag);
          }

          const response = await fetch(imageUrl.toString(), {
            headers: {
              'X-Emby-Token': config.api_key,
              Accept: 'image/*',
            },
          });

          const contentType = response.headers.get('content-type');
          if (!response.ok || !contentType || !contentType.startsWith('image/')) {
            continue;
          }

          const imageBuffer = await response.arrayBuffer();
          return new Response(imageBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'private, max-age=21600',
            },
          });
        }

        set.status = 404;
        return { error: 'Image not found' };
      } catch (error) {
        console.error('Error proxying Jellyfin image:', error);
        set.status = 500;
        return { error: 'Failed to proxy Jellyfin image' };
      }
    },
    {
      query: t.Object({
        itemId: t.String(),
        preferred: t.Optional(t.String()),
        parentBackdropItemId: t.Optional(t.String()),
        backdropTag: t.Optional(t.String()),
        parentBackdropTag: t.Optional(t.String()),
        primaryTag: t.Optional(t.String()),
      }),
    }
  )
  .get(
    '/jellyfin/latest',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Unauthorized' };
      }

      try {
        const requestedPage = toPositiveInt(query.page, 1);
        const page = Math.max(1, Math.min(100, requestedPage));
        const requestedLimit = toPositiveInt(query.limit, 12);
        const limit = Math.max(1, Math.min(30, requestedLimit));
        const startIndex = (page - 1) * limit;

        const jellyfinPlugin = await prisma.plugin.findFirst({
          where: { type: 'jellyfin' },
          select: { enabled: true, config: true },
        });

        if (!jellyfinPlugin?.enabled) {
          return { enabled: false, items: [], page, limit, has_more: false };
        }

        const config = normalizeJellyfinConfig(jellyfinPlugin.config);
        if (!config) {
          return { enabled: false, items: [], page, limit, has_more: false };
        }

        const jellyfinUrl = new URL('/Items', config.website_url);
        jellyfinUrl.searchParams.set('Recursive', 'true');
        jellyfinUrl.searchParams.set('SortBy', 'DateCreated');
        jellyfinUrl.searchParams.set('SortOrder', 'Descending');
        jellyfinUrl.searchParams.set('IncludeItemTypes', 'Movie,Series,MusicAlbum,Audio,Video');
        jellyfinUrl.searchParams.set(
          'Fields',
          'DateCreated,Overview,ProductionYear,BackdropImageTags,ParentBackdropImageTags,ParentBackdropItemId,ImageTags'
        );
        jellyfinUrl.searchParams.set('Limit', String(limit));
        jellyfinUrl.searchParams.set('StartIndex', String(startIndex));

        const response = await fetch(jellyfinUrl.toString(), {
          headers: {
            'X-Emby-Token': config.api_key,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          set.status = 502;
          return { error: 'Jellyfin request failed' };
        }

        const data = (await response.json()) as Record<string, unknown>;
        const rawItems = Array.isArray(data.Items) ? data.Items : [];
        const totalRecordCountRaw =
          typeof data.TotalRecordCount === 'number' ? Math.trunc(data.TotalRecordCount) : Number.NaN;
        const totalRecordCount = Number.isFinite(totalRecordCountRaw) ? totalRecordCountRaw : null;
        const items = rawItems.map(item => mapJellyfinApiItem(item, config.website_url)).filter(item => !!item);
        const hasMore =
          totalRecordCount !== null ? startIndex + rawItems.length < totalRecordCount : rawItems.length === limit;

        return { enabled: true, items, page, limit, has_more: hasMore };
      } catch (error) {
        console.error('Error getting latest Jellyfin items:', error);
        set.status = 500;
        return { error: 'Failed to get latest Jellyfin items' };
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        page: t.Optional(t.String()),
      }),
    }
  );
