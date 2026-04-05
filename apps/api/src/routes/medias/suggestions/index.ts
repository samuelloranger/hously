import { Elysia, t } from "elysia";
import { auth } from "@hously/api/auth";
import { requireUser } from "@hously/api/middleware/auth";
import { prisma } from "@hously/api/db";
import {
  normalizeOllamaConfig,
  normalizeRadarrConfig,
  normalizeSonarrConfig,
} from "@hously/api/utils/plugins/normalizers";
import { badGateway, badRequest, serviceUnavailable } from "@hously/api/errors";
import {
  type TmdbSearchItem,
  mapTmdbSearchItem,
  fetchRadarrTmdbIds,
  fetchSonarrTmdbIds,
  buildArrItemUrl,
  toRecord,
} from "@hously/api/utils/medias/mappers";
import { loadTmdbConfig } from "@hously/api/utils/medias/tmdbFetchers";

type Candidate = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  year: number | null;
  overview: string;
};

function toCandidates(items: TmdbSearchItem[]): Candidate[] {
  return items.map((i) => ({
    tmdb_id: i.tmdb_id,
    media_type: i.media_type,
    title: i.title,
    year: i.release_year,
    overview: (i.overview ?? "").slice(0, 220),
  }));
}

async function fetchPopularPool(
  apiKey: string,
  language: string,
  kind: "movie" | "tv",
  pages: number,
): Promise<TmdbSearchItem[]> {
  const out: TmdbSearchItem[] = [];
  for (let p = 1; p <= pages; p++) {
    const path = kind === "movie" ? "movie" : "tv";
    const url = new URL(`https://api.themoviedb.org/3/${path}/popular`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", language);
    url.searchParams.set("page", String(p));
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`TMDB ${path}/popular failed: ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    const results = Array.isArray(data.results) ? data.results : [];
    for (const raw of results) {
      const rec = toRecord(raw);
      if (!rec) continue;
      const mapped = mapTmdbSearchItem({ ...rec, media_type: kind });
      if (mapped) out.push(mapped);
    }
  }
  return out;
}

async function enrichWithArr(
  items: TmdbSearchItem[],
  radarrConfig: ReturnType<typeof normalizeRadarrConfig> | null,
  sonarrConfig: ReturnType<typeof normalizeSonarrConfig> | null,
): Promise<TmdbSearchItem[]> {
  const [radarrIds, sonarrIds] = await Promise.all([
    radarrConfig
      ? fetchRadarrTmdbIds(
          radarrConfig.website_url,
          radarrConfig.api_key,
        ).catch(() => new Map())
      : Promise.resolve(new Map()),
    sonarrConfig
      ? fetchSonarrTmdbIds(
          sonarrConfig.website_url,
          sonarrConfig.api_key,
        ).catch(() => new Map())
      : Promise.resolve(new Map()),
  ]);

  return items.map((item) => {
    const isMovie = item.media_type === "movie";
    const entry = isMovie
      ? radarrIds.get(item.tmdb_id)
      : sonarrIds.get(item.tmdb_id);
    const sourceId = entry?.sourceId ?? null;
    const sourceBaseUrl = isMovie
      ? radarrConfig?.website_url
      : sonarrConfig?.website_url;

    let arr_url: string | null = null;
    if (sourceBaseUrl && entry) {
      if (isMovie) {
        arr_url = buildArrItemUrl(
          sourceBaseUrl,
          "radarr",
          String(item.tmdb_id),
        );
      } else if (entry.titleSlug) {
        arr_url = buildArrItemUrl(sourceBaseUrl, "sonarr", entry.titleSlug);
      }
    }

    return {
      ...item,
      already_exists: isMovie
        ? radarrIds.has(item.tmdb_id)
        : sonarrIds.has(item.tmdb_id),
      can_add: isMovie ? Boolean(radarrConfig) : Boolean(sonarrConfig),
      source_id: sourceId,
      arr_url,
    };
  });
}

function parseAiJson(
  raw: string,
): Array<{ tmdb_id: unknown; media_type: unknown; reason: unknown }> {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fence ? fence[1]!.trim() : trimmed;
  const parsed = JSON.parse(jsonStr) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (x): x is { tmdb_id: unknown; media_type: unknown; reason: unknown } =>
      typeof x === "object" && x !== null && "tmdb_id" in x,
  );
}

export const mediasAiSuggestionsRoutes = new Elysia()
  .use(auth)
  .use(requireUser)
  .get("/ai/suggestions/config", async () => {
    const plugin = await prisma.plugin.findFirst({ where: { type: "ollama" } });
    const config = plugin?.enabled
      ? normalizeOllamaConfig(plugin.config)
      : null;
    return {
      enabled: Boolean(plugin?.enabled),
      ready: Boolean(config),
    };
  })
  .post(
    "/ai/suggestions",
    async ({ body, set }) => {
      const ollamaPlugin = await prisma.plugin.findFirst({
        where: { type: "ollama" },
      });
      const ollamaConfig = ollamaPlugin?.enabled
        ? normalizeOllamaConfig(ollamaPlugin.config)
        : null;
      if (!ollamaConfig) {
        return serviceUnavailable(
          set,
          "Ollama plugin is disabled or not configured. Enable it under Settings → Plugins.",
        );
      }
      const ollamaBase = ollamaConfig.base_url;
      const model = ollamaConfig.model;

      const tmdbConfig = await loadTmdbConfig();
      if (!tmdbConfig) return badRequest(set, "TMDB is not configured");

      const [radarrPlugin, sonarrPlugin] = await Promise.all([
        prisma.plugin.findFirst({
          where: { type: "radarr" },
          select: { enabled: true, config: true },
        }),
        prisma.plugin.findFirst({
          where: { type: "sonarr" },
          select: { enabled: true, config: true },
        }),
      ]);
      const radarrConfig = radarrPlugin?.enabled
        ? normalizeRadarrConfig(radarrPlugin.config)
        : null;
      const sonarrConfig = sonarrPlugin?.enabled
        ? normalizeSonarrConfig(sonarrPlugin.config)
        : null;

      const language = body.language || "en-US";
      const mediaType = body.media_type;

      let pool: TmdbSearchItem[] = [];
      try {
        if (mediaType === "movie") {
          pool = await fetchPopularPool(
            tmdbConfig.api_key,
            language,
            "movie",
            2,
          );
        } else if (mediaType === "tv") {
          pool = await fetchPopularPool(tmdbConfig.api_key, language, "tv", 2);
        } else {
          const [movies, shows] = await Promise.all([
            fetchPopularPool(tmdbConfig.api_key, language, "movie", 1),
            fetchPopularPool(tmdbConfig.api_key, language, "tv", 1),
          ]);
          pool = [...movies, ...shows].slice(0, 48);
        }
      } catch (e) {
        console.error("AI suggestions TMDB pool:", e);
        return badGateway(set, "Failed to load titles from TMDB");
      }

      pool = pool.filter(
        (x, i, a) =>
          a.findIndex(
            (y) => y.tmdb_id === x.tmdb_id && y.media_type === x.media_type,
          ) === i,
      );
      if (pool.length < 8) {
        return badRequest(set, "Not enough TMDB candidates for suggestions");
      }

      const enrichedPool = await enrichWithArr(
        pool,
        radarrConfig,
        sonarrConfig,
      );
      const candidates = toCandidates(enrichedPool);
      const prompt =
        (body.prompt ?? "").trim() ||
        "Pick a diverse, interesting mix worth watching.";

      const system = `You recommend movies and TV shows. You MUST only pick titles from the candidate list (JSON). Each candidate has tmdb_id, media_type, title, year, overview.
Return ONLY a JSON array (no markdown, no prose) of 6 to 10 objects with keys: "tmdb_id" (number), "media_type" ("movie" or "tv"), "reason" (one short sentence, English).
Use only pairs that exist in the list. Order from best match first.`;

      const userMsg = `User request: ${prompt}

Candidates:
${JSON.stringify(candidates)}`;

      let replyText = "";
      try {
        const ctrl = new AbortController();
        const abortTimer = setTimeout(() => ctrl.abort(), 90_000);
        try {
          const ollamaRes = await fetch(`${ollamaBase}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: system },
                { role: "user", content: userMsg },
              ],
              stream: false,
              options: { temperature: 0.35, num_predict: 1200 },
            }),
          });
          if (!ollamaRes.ok) {
            const errText = await ollamaRes.text().catch(() => "");
            console.error("Ollama error:", ollamaRes.status, errText);
            let detail = errText;
            try {
              const parsed = JSON.parse(errText) as { error?: string };
              if (typeof parsed.error === "string") {
                detail = parsed.error;
              }
            } catch {
              /* plain text */
            }
            const hint =
              ollamaRes.status === 404 && /not found/i.test(detail)
                ? " Set the model name in Settings → Plugins → Ollama to one you have (`ollama list` on the Ollama host)."
                : " Check the base URL and plugin settings.";
            return badGateway(
              set,
              `Ollama (${ollamaRes.status}): ${detail}.${hint}`,
            );
          }
          const ollamaJson = (await ollamaRes.json()) as {
            message?: { content?: string };
            error?: string;
          };
          if (ollamaJson.error && !ollamaJson.message?.content) {
            return badGateway(
              set,
              `Ollama: ${ollamaJson.error}. Set the model in Settings → Plugins → Ollama.`,
            );
          }
          replyText = ollamaJson.message?.content ?? "";
        } finally {
          clearTimeout(abortTimer);
        }
      } catch (e) {
        console.error("Ollama fetch:", e);
        return badGateway(
          set,
          "Could not reach Ollama. Check the plugin base URL and that the model is pulled on the Ollama host.",
        );
      }

      let picks: Array<{
        tmdb_id: number;
        media_type: "movie" | "tv";
        reason: string;
      }> = [];
      try {
        const arr = parseAiJson(replyText);
        const byKey = new Map<string, TmdbSearchItem>(
          enrichedPool.map((it) => [`${it.media_type}:${it.tmdb_id}`, it]),
        );
        for (const row of arr) {
          const id =
            typeof row.tmdb_id === "number"
              ? row.tmdb_id
              : parseInt(String(row.tmdb_id), 10);
          const mt =
            row.media_type === "tv"
              ? "tv"
              : row.media_type === "movie"
                ? "movie"
                : null;
          const reason =
            typeof row.reason === "string" ? row.reason.slice(0, 280) : "";
          if (!Number.isFinite(id) || !mt || !reason) continue;
          const key = `${mt}:${id}`;
          if (!byKey.has(key)) continue;
          picks.push({ tmdb_id: id, media_type: mt, reason });
        }
      } catch (e) {
        console.error("AI suggestions JSON parse:", e);
        return badGateway(
          set,
          "Could not parse AI response. Try again or use a different model.",
        );
      }

      picks = picks.slice(0, 12);
      if (picks.length === 0) {
        return badGateway(
          set,
          "The model returned no valid picks from the list. Try again.",
        );
      }

      const reasonByKey = new Map<string, string>(
        picks.map((p) => [`${p.media_type}:${p.tmdb_id}`, p.reason]),
      );
      const ordered: TmdbSearchItem[] = [];
      for (const p of picks) {
        const it = enrichedPool.find(
          (x) => x.tmdb_id === p.tmdb_id && x.media_type === p.media_type,
        );
        if (it) ordered.push(it);
      }

      const items = ordered.map((it) => ({
        ...it,
        ai_reason: reasonByKey.get(`${it.media_type}:${it.tmdb_id}`) ?? null,
      }));

      return { items, model };
    },
    {
      body: t.Object({
        prompt: t.Optional(t.String()),
        media_type: t.Union([
          t.Literal("movie"),
          t.Literal("tv"),
          t.Literal("both"),
        ]),
        language: t.Optional(t.String()),
      }),
    },
  );
