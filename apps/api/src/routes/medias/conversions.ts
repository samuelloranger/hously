import { Elysia, t } from 'elysia';
import { auth } from '../../auth';
import { requireUser } from '../../middleware/auth';
import { badRequest, notFound, serverError, unprocessable } from '../../utils/errors';
import {
  createMediaConversionJob,
  getMediaConversionPreview,
  getMediaConversionJob,
  listMediaConversionJobs,
  listActiveMediaConversionJobs,
  cancelMediaConversionJob,
} from '../../services/mediaConversions';

const parseService = (value: string) => (value === 'radarr' || value === 'sonarr' ? value : null);

export const mediasConversionRoutes = new Elysia({ prefix: '/api/medias' })
  .use(auth)
  .use(requireUser)
  .get(
    '/:service/:sourceId/conversion-preview',
    async ({ params, query, set }) => {
      const service = parseService(params.service);
      const sourceId = parseInt(params.sourceId, 10);
      const preset = typeof query.preset === 'string' && query.preset.trim() ? query.preset.trim() : 'hevc_1080p';

      if (!service) return badRequest(set, 'Invalid service');
      if (!Number.isFinite(sourceId) || sourceId <= 0) return badRequest(set, 'Invalid source ID');

      try {
        return await getMediaConversionPreview({ service, sourceId, preset });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to inspect the media file';
        if (message.toLowerCase().includes('not found')) return notFound(set, message);
        if (
          message.includes('does not have a local file') ||
          message.includes('Unsupported') ||
          message.includes('Unknown conversion preset') ||
          message.includes('not implemented')
        ) {
          return unprocessable(set, message);
        }
        console.error('[medias:conversion-preview]', error);
        return serverError(set, message);
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
      query: t.Object({
        preset: t.Optional(t.String()),
      }),
    },
  )
  .get(
    '/:service/:sourceId/conversions',
    async ({ params, set }) => {
      const service = parseService(params.service);
      const sourceId = parseInt(params.sourceId, 10);

      if (!service) return badRequest(set, 'Invalid service');
      if (!Number.isFinite(sourceId) || sourceId <= 0) return badRequest(set, 'Invalid source ID');

      try {
        return {
          jobs: await listMediaConversionJobs(service, sourceId),
        };
      } catch (error) {
        console.error('[medias:conversions:list]', error);
        return serverError(set, 'Failed to load conversion jobs');
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
    },
  )
  .post(
    '/:service/:sourceId/conversions',
    async ({ params, body, user, set }) => {
      const service = parseService(params.service);
      const sourceId = parseInt(params.sourceId, 10);
      const preset = body.preset.trim();

      if (!service) return badRequest(set, 'Invalid service');
      if (!Number.isFinite(sourceId) || sourceId <= 0) return badRequest(set, 'Invalid source ID');
      if (!preset) return badRequest(set, 'Preset is required');

      try {
        return {
          job: await createMediaConversionJob({
            service,
            sourceId,
            preset,
            requestedByUserId: user?.id,
          }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create conversion job';
        if (
          message.includes('already queued or running') ||
          message.includes('cannot be converted') ||
          message.includes('does not have a local file') ||
          message.includes('not implemented') ||
          message.includes('Unknown conversion preset')
        ) {
          return unprocessable(set, message);
        }
        if (message.toLowerCase().includes('not found')) return notFound(set, message);
        console.error('[medias:conversions:create]', error);
        return serverError(set, message);
      }
    },
    {
      params: t.Object({
        service: t.String(),
        sourceId: t.String(),
      }),
      body: t.Object({
        preset: t.String(),
      }),
    },
  )
  .get(
    '/conversions/active',
    async ({ set }) => {
      try {
        return {
          jobs: await listActiveMediaConversionJobs(),
        };
      } catch (error) {
        console.error('[medias:conversions:list-active]', error);
        return serverError(set, 'Failed to load active conversion jobs');
      }
    }
  )
  .get(
    '/conversions/:id',
    async ({ params, set }) => {
      const id = parseInt(params.id, 10);
      if (!Number.isFinite(id) || id <= 0) return badRequest(set, 'Invalid conversion ID');

      try {
        return await getMediaConversionJob(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load conversion job';
        if (message.toLowerCase().includes('not found')) return notFound(set, message);
        console.error('[medias:conversions:get]', error);
        return serverError(set, message);
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      }
      )
      .delete(
      '/conversions/:id',
      async ({ params, set }) => {
      const id = parseInt(params.id, 10);
      if (!Number.isFinite(id) || id <= 0) return badRequest(set, 'Invalid conversion ID');

      try {
        return await cancelMediaConversionJob(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to cancel conversion job';
        if (message.toLowerCase().includes('not found')) return notFound(set, message);
        console.error('[medias:conversions:cancel]', error);
        return serverError(set, message);
      }
      },
      {
      params: t.Object({
        id: t.String(),
      }),
      }
      );

