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
      const codec = query.codec as 'h264' | 'hevc' | 'av1' | undefined;
      const target_codec = codec && ['h264', 'hevc', 'av1'].includes(codec) ? codec : 'hevc';
      const target_height = query.height ? parseInt(query.height, 10) || null : null;
      const tone_map_hdr = query.tone_map === 'true';
      const audio_tracks = query.audio_tracks ? query.audio_tracks.split(',').map(Number).filter(Number.isFinite) : null;

      if (!service) return badRequest(set, 'Invalid service');
      if (!Number.isFinite(sourceId) || sourceId <= 0) return badRequest(set, 'Invalid source ID');

      try {
        return await getMediaConversionPreview({ service, sourceId, target_codec, target_height, tone_map_hdr, audio_tracks });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to inspect the media file';
        if (message.toLowerCase().includes('not found')) return notFound(set, message);
        if (
          message.includes('does not have a local file') ||
          message.includes('Unsupported') ||
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
        codec: t.Optional(t.String()),
        height: t.Optional(t.String()),
        tone_map: t.Optional(t.String()),
        audio_tracks: t.Optional(t.String()),
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
      const target_codec = body.target_codec;
      const target_height = body.target_height ?? null;
      const tone_map_hdr = body.tone_map_hdr ?? false;
      const audio_tracks = body.audio_tracks ?? null;

      if (!service) return badRequest(set, 'Invalid service');
      if (!Number.isFinite(sourceId) || sourceId <= 0) return badRequest(set, 'Invalid source ID');
      if (!['h264', 'hevc', 'av1'].includes(target_codec)) return badRequest(set, 'Invalid codec');

      try {
        return {
          job: await createMediaConversionJob({
            service,
            sourceId,
            target_codec: target_codec as 'h264' | 'hevc' | 'av1',
            target_height,
            tone_map_hdr,
            audio_tracks,
            requestedByUserId: user?.id,
          }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create conversion job';
        if (
          message.includes('already queued or running') ||
          message.includes('cannot be converted') ||
          message.includes('does not have a local file') ||
          message.includes('not implemented')
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
        target_codec: t.String(),
        target_height: t.Optional(t.Union([t.Number(), t.Null()])),
        tone_map_hdr: t.Optional(t.Boolean()),
        audio_tracks: t.Optional(t.Union([t.Array(t.Number()), t.Null()])),
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

