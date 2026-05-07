import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { badRequest, notFound, serverError } from "@hously/api/errors";
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeJellyfinConfig } from "@hously/api/utils/integrations/normalizers";

const HOUSLY_DEVICE_ID = "hously-web-demo";
const HOUSLY_PLAY_SESSION_PREFIX = "hously-demo-";

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function buildJellyfinMasterStreamUrl(
  websiteUrl: string,
  itemId: string,
  apiKey: string,
  userId?: string,
  audioStreamIndex?: number,
): string {
  const base = websiteUrl.replace(/\/+$/, "");
  const url = new URL(
    `Videos/${encodeURIComponent(itemId)}/master.m3u8`,
    `${base}/`,
  );
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("MediaSourceId", itemId);
  url.searchParams.set(
    "PlaySessionId",
    `${HOUSLY_PLAY_SESSION_PREFIX}${itemId}`,
  );
  url.searchParams.set("DeviceId", HOUSLY_DEVICE_ID);
  if (userId) url.searchParams.set("UserId", userId);
  url.searchParams.set("VideoCodec", "h264");
  url.searchParams.set("AudioCodec", "aac");
  url.searchParams.set("MaxStreamingBitrate", "20000000");
  url.searchParams.set("TranscodingMaxAudioChannels", "2");
  if (typeof audioStreamIndex === "number") {
    url.searchParams.set("AudioStreamIndex", String(audioStreamIndex));
  }
  return url.toString();
}

function extractJellyfinUserId(rawConfig: unknown): string | undefined {
  if (!rawConfig || typeof rawConfig !== "object") return undefined;
  const cfg = rawConfig as Record<string, unknown>;
  const mappings = cfg.user_mappings;
  if (!Array.isArray(mappings) || mappings.length === 0) return undefined;
  const first = mappings[0];
  if (!first || typeof first !== "object") return undefined;
  const id = (first as Record<string, unknown>).jellyfin_user_id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

export function formatJellyfinPlaybackTitle(
  raw: Record<string, unknown>,
): string {
  const type = String(raw.Type ?? "").toLowerCase();
  const name = String(raw.Name ?? "");
  const series = String(raw.SeriesName ?? "");
  if (type === "episode") {
    const sn = raw.ParentIndexNumber;
    const en = raw.IndexNumber;
    const season = typeof sn === "number" ? sn : Number(sn);
    const ep = typeof en === "number" ? en : Number(en);
    const epLabel =
      Number.isFinite(season) && Number.isFinite(ep)
        ? `S${String(season).padStart(2, "0")}E${String(ep).padStart(2, "0")}`
        : "";
    const show = series || name;
    return epLabel ? `${show} — ${epLabel}` : show;
  }
  return name || series || "Unknown";
}

function buildPosterUrl(
  websiteUrl: string,
  itemId: string,
  raw: Record<string, unknown>,
): string | null {
  const base = websiteUrl.replace(/\/+$/, "");
  const tags = toRecord(raw.ImageTags);
  const primaryTag =
    typeof tags?.Primary === "string" ? (tags.Primary as string) : null;
  const seriesPrimaryTag =
    typeof raw.SeriesPrimaryImageTag === "string"
      ? (raw.SeriesPrimaryImageTag as string)
      : null;
  const seriesId =
    typeof raw.SeriesId === "string" ? (raw.SeriesId as string) : null;

  if (primaryTag) {
    return `${base}/Items/${encodeURIComponent(itemId)}/Images/Primary?tag=${primaryTag}&maxWidth=600&quality=85`;
  }
  if (seriesId && seriesPrimaryTag) {
    return `${base}/Items/${encodeURIComponent(seriesId)}/Images/Primary?tag=${seriesPrimaryTag}&maxWidth=600&quality=85`;
  }
  return null;
}

function buildBackdropUrl(
  websiteUrl: string,
  itemId: string,
  raw: Record<string, unknown>,
): string | null {
  const base = websiteUrl.replace(/\/+$/, "");
  const tags = Array.isArray(raw.BackdropImageTags)
    ? (raw.BackdropImageTags as unknown[])
    : [];
  const firstTag = tags.find((t) => typeof t === "string");
  if (typeof firstTag === "string") {
    return `${base}/Items/${encodeURIComponent(itemId)}/Images/Backdrop?tag=${firstTag}&maxWidth=1920&quality=85`;
  }
  const parentTags = Array.isArray(raw.ParentBackdropImageTags)
    ? (raw.ParentBackdropImageTags as unknown[])
    : [];
  const parentId =
    typeof raw.ParentBackdropItemId === "string"
      ? (raw.ParentBackdropItemId as string)
      : null;
  const parentFirst = parentTags.find((t) => typeof t === "string");
  if (parentId && typeof parentFirst === "string") {
    return `${base}/Items/${encodeURIComponent(parentId)}/Images/Backdrop?tag=${parentFirst}&maxWidth=1920&quality=85`;
  }
  return null;
}

export interface JellyfinAudioStreamOut {
  index: number;
  language: string | null;
  display_title: string;
  codec: string | null;
  is_default: boolean;
}

function extractAudioStreams(
  raw: Record<string, unknown>,
): JellyfinAudioStreamOut[] {
  const streams = Array.isArray(raw.MediaStreams)
    ? (raw.MediaStreams as unknown[])
    : [];
  const out: JellyfinAudioStreamOut[] = [];
  for (const s of streams) {
    if (!s || typeof s !== "object") continue;
    const obj = s as Record<string, unknown>;
    if (String(obj.Type ?? "") !== "Audio") continue;
    const idx = obj.Index;
    if (typeof idx !== "number") continue;
    out.push({
      index: idx,
      language:
        typeof obj.Language === "string" ? (obj.Language as string) : null,
      display_title:
        typeof obj.DisplayTitle === "string" && obj.DisplayTitle
          ? (obj.DisplayTitle as string)
          : typeof obj.Title === "string"
            ? (obj.Title as string)
            : `Audio ${idx}`,
      codec: typeof obj.Codec === "string" ? (obj.Codec as string) : null,
      is_default: Boolean(obj.IsDefault),
    });
  }
  return out;
}

export async function getJellyfinPlaybackInfo(
  itemId: string,
  options?: {
    getIntegration?: typeof getIntegrationConfigRecord;
    fetchImpl?: typeof fetch;
  },
): Promise<
  | {
      ok: true;
      body: {
        item_id: string;
        title: string;
        item_type: string;
        series_name: string | null;
        overview: string | null;
        production_year: number | null;
        stream_url: string;
        poster_url: string | null;
        backdrop_url: string | null;
        container: string;
        mime_type: string;
        duration_ticks: number | null;
        resume_ticks: number;
        played_percentage: number;
        audio_streams: JellyfinAudioStreamOut[];
        default_audio_stream_index: number | null;
      };
    }
  | { ok: false; status: 404 | 500; message: string }
> {
  const getInt = options?.getIntegration ?? getIntegrationConfigRecord;
  const fetcher = options?.fetchImpl ?? fetch;

  const row = await getInt("jellyfin");
  if (!row?.enabled) {
    return {
      ok: false,
      status: 404,
      message: "Jellyfin integration not configured",
    };
  }

  const config = normalizeJellyfinConfig(row.config);
  if (!config) {
    return {
      ok: false,
      status: 404,
      message: "Jellyfin integration not configured",
    };
  }

  const userId = extractJellyfinUserId(row.config);
  const base = config.website_url.replace(/\/+$/, "");
  const itemUrl = userId
    ? `${base}/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(itemId)}`
    : `${base}/Items?ids=${encodeURIComponent(itemId)}`;

  const itemRes = await fetcher(itemUrl, {
    headers: {
      "X-Emby-Token": config.api_key,
      Accept: "application/json",
    },
  });

  if (itemRes.status === 404) {
    return { ok: false, status: 404, message: "Item not found in Jellyfin" };
  }
  if (!itemRes.ok) {
    const body = await itemRes.text().catch(() => "");
    console.error(
      `[jellyfin/playback] Jellyfin returned ${itemRes.status} for ${itemUrl}: ${body.slice(0, 200)}`,
    );
    return {
      ok: false,
      status: 500,
      message: `Failed to fetch item from Jellyfin (status ${itemRes.status})`,
    };
  }

  let rawJson: unknown;
  try {
    rawJson = await itemRes.json();
  } catch {
    return {
      ok: false,
      status: 500,
      message: "Invalid item response from Jellyfin",
    };
  }

  let raw = toRecord(rawJson);
  if (raw && Array.isArray(raw.Items)) {
    const first = raw.Items[0];
    raw =
      first && typeof first === "object"
        ? (first as Record<string, unknown>)
        : null;
    if (!raw)
      return {
        ok: false,
        status: 404,
        message: "Item not found in Jellyfin",
      };
  }
  if (!raw) {
    return {
      ok: false,
      status: 500,
      message: "Invalid item response from Jellyfin",
    };
  }

  const id = String(raw.Id ?? itemId);
  const title = formatJellyfinPlaybackTitle(raw);
  const rt = raw.RunTimeTicks;
  const durationTicks =
    typeof rt === "number" ? rt : typeof rt === "string" ? Number(rt) : NaN;

  const userData = toRecord(raw.UserData);
  const resumeTicksRaw = userData?.PlaybackPositionTicks;
  const resumeTicks =
    typeof resumeTicksRaw === "number"
      ? resumeTicksRaw
      : typeof resumeTicksRaw === "string"
        ? Number(resumeTicksRaw) || 0
        : 0;
  const playedPercentageRaw = userData?.PlayedPercentage;
  const playedPercentage =
    typeof playedPercentageRaw === "number"
      ? playedPercentageRaw
      : typeof playedPercentageRaw === "string"
        ? Number(playedPercentageRaw) || 0
        : 0;

  const itemType = String(raw.Type ?? "").toLowerCase();
  const seriesName =
    typeof raw.SeriesName === "string" ? (raw.SeriesName as string) : null;
  const overview =
    typeof raw.Overview === "string" ? (raw.Overview as string) : null;
  const py = raw.ProductionYear;
  const productionYear =
    typeof py === "number"
      ? py
      : typeof py === "string"
        ? Number(py) || null
        : null;

  const audioStreams = extractAudioStreams(raw);
  const defaultAudio =
    audioStreams.find((s) => s.is_default) ?? audioStreams[0];
  const defaultAudioIndex = defaultAudio?.index ?? null;

  return {
    ok: true,
    body: {
      item_id: id,
      title,
      item_type: itemType,
      series_name: seriesName,
      overview,
      production_year: productionYear,
      stream_url: buildJellyfinMasterStreamUrl(
        config.website_url,
        id,
        config.api_key,
        userId,
        defaultAudioIndex ?? undefined,
      ),
      poster_url: buildPosterUrl(config.website_url, id, raw),
      backdrop_url: buildBackdropUrl(config.website_url, id, raw),
      container: "hls",
      mime_type: "application/vnd.apple.mpegurl",
      duration_ticks: Number.isFinite(durationTicks) ? durationTicks : null,
      resume_ticks: Number.isFinite(resumeTicks) ? resumeTicks : 0,
      played_percentage: Number.isFinite(playedPercentage)
        ? playedPercentage
        : 0,
      audio_streams: audioStreams,
      default_audio_stream_index: defaultAudioIndex,
    },
  };
}

type SessionEvent = "start" | "progress" | "stop";

async function reportSessionEvent(
  event: SessionEvent,
  body: {
    itemId: string;
    positionTicks: number;
    isPaused?: boolean;
  },
): Promise<{ ok: boolean; status: number; message?: string }> {
  const row = await getIntegrationConfigRecord("jellyfin");
  if (!row?.enabled)
    return { ok: false, status: 404, message: "Jellyfin not configured" };
  const config = normalizeJellyfinConfig(row.config);
  if (!config)
    return { ok: false, status: 404, message: "Jellyfin not configured" };

  const userId = extractJellyfinUserId(row.config);
  if (!userId) {
    // Without a user mapping we can't update UserData (which Continue Watching reads).
    return {
      ok: false,
      status: 400,
      message: "No Jellyfin user mapping configured",
    };
  }

  const base = config.website_url.replace(/\/+$/, "");
  const positionTicks = Math.max(0, Math.floor(body.positionTicks));

  // Two side-effects per event:
  //  1) /Sessions/Playing/* — keeps Now-Playing alive so Jellyfin shows the active session
  //     and triggers webhooks (PlaybackStart, PlaybackStopped). Doesn't update UserData
  //     when called with an admin api_key.
  //  2) /Users/{userId}/Items/{itemId}/UserData — directly updates PlaybackPositionTicks /
  //     PlayedPercentage so "Continue Watching" / resume work.
  // We fire both; Continue Watching is what matters for the user, the Sessions call is
  // best-effort.

  const sessionPath =
    event === "start"
      ? "/Sessions/Playing"
      : event === "progress"
        ? "/Sessions/Playing/Progress"
        : "/Sessions/Playing/Stopped";

  const sessionPayload = {
    ItemId: body.itemId,
    MediaSourceId: body.itemId,
    PositionTicks: positionTicks,
    PlaySessionId: `${HOUSLY_PLAY_SESSION_PREFIX}${body.itemId}`,
    PlayMethod: "Transcode" as const,
    CanSeek: true,
    IsPaused: Boolean(body.isPaused),
  };

  const sessionPromise = fetch(`${base}${sessionPath}`, {
    method: "POST",
    headers: {
      "X-Emby-Token": config.api_key,
      "X-Emby-Authorization": `MediaBrowser Client="Hously", Device="Web", DeviceId="${HOUSLY_DEVICE_ID}", Version="1.0.0"`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sessionPayload),
  }).catch((err) => {
    console.warn("[jellyfin/playback] Sessions endpoint failed:", err);
    return null;
  });

  const userDataUrl = `${base}/Users/${encodeURIComponent(userId)}/Items/${encodeURIComponent(body.itemId)}/UserData`;
  const userDataPromise = fetch(userDataUrl, {
    method: "POST",
    headers: {
      "X-Emby-Token": config.api_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ PlaybackPositionTicks: positionTicks }),
  });

  const [, userDataRes] = await Promise.all([sessionPromise, userDataPromise]);

  if (!userDataRes.ok) {
    const text = await userDataRes.text().catch(() => "");
    return {
      ok: false,
      status: userDataRes.status,
      message: `Jellyfin UserData ${event} returned ${userDataRes.status}: ${text.slice(0, 120)}`,
    };
  }
  return { ok: true, status: 200 };
}

const sessionBodySchema = t.Object({
  item_id: t.String({ minLength: 1 }),
  position_ticks: t.Number({ minimum: 0 }),
  is_paused: t.Optional(t.Boolean()),
});

export const jellyfinPlaybackUrlRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get(
    "/jellyfin/playback-url/:itemId",
    async ({ params, set }) => {
      try {
        const result = await getJellyfinPlaybackInfo(params.itemId);
        if (!result.ok) {
          if (result.status === 404) return notFound(set, result.message);
          return serverError(set, result.message);
        }
        return result.body;
      } catch (error) {
        console.error("Jellyfin playback-url error:", error);
        return serverError(set, "Failed to resolve Jellyfin playback URL");
      }
    },
    { params: t.Object({ itemId: t.String() }) },
  )
  .post(
    "/jellyfin/playback/started",
    async ({ body, set }) => {
      try {
        const r = await reportSessionEvent("start", {
          itemId: body.item_id,
          positionTicks: body.position_ticks,
          isPaused: body.is_paused,
        });
        if (!r.ok) {
          if (r.status === 404) return notFound(set, r.message ?? "");
          return serverError(set, r.message ?? "Failed to start session");
        }
        return { ok: true };
      } catch (error) {
        console.error("Jellyfin start session error:", error);
        return serverError(set, "Failed to report start");
      }
    },
    { body: sessionBodySchema },
  )
  .post(
    "/jellyfin/playback/progress",
    async ({ body, set }) => {
      try {
        const r = await reportSessionEvent("progress", {
          itemId: body.item_id,
          positionTicks: body.position_ticks,
          isPaused: body.is_paused,
        });
        if (!r.ok) {
          if (r.status === 404) return notFound(set, r.message ?? "");
          // Don't 500 on every tick — return 200 with ok:false so the client doesn't retry-storm.
          return badRequest(set, r.message ?? "progress failed");
        }
        return { ok: true };
      } catch (error) {
        console.error("Jellyfin progress error:", error);
        return serverError(set, "Failed to report progress");
      }
    },
    { body: sessionBodySchema },
  )
  .post(
    "/jellyfin/playback/stopped",
    async ({ body, set }) => {
      try {
        const r = await reportSessionEvent("stop", {
          itemId: body.item_id,
          positionTicks: body.position_ticks,
        });
        if (!r.ok) {
          if (r.status === 404) return notFound(set, r.message ?? "");
          return serverError(set, r.message ?? "Failed to stop session");
        }
        return { ok: true };
      } catch (error) {
        console.error("Jellyfin stop session error:", error);
        return serverError(set, "Failed to report stop");
      }
    },
    { body: sessionBodySchema },
  );
