import { Elysia, t } from "elysia";
import { Prisma } from "@prisma/client";
import { auth } from "../../auth";
import { prisma } from "../../db";
import { nowUtc } from "../../utils";
import {
  normalizeQbittorrentConfig,
  invalidateQbittorrentPluginConfigCache,
} from "../../services/qbittorrent/config";
import { clampInteger, isValidHttpUrl } from "../../utils/plugins/utils";
import {
  normalizeHackernewsConfig,
  normalizeHomeAssistantConfig,
  normalizeRedditConfig,
  normalizeTmdbConfig,
  normalizeOllamaConfig,
  normalizeWeatherConfig,
} from "../../utils/plugins/normalizers";
import { encrypt } from "../../services/crypto";
import {
  assertValidHaBaseUrl,
  haListDiscoverableEntities,
} from "../../services/homeAssistant";
import { haDomainFromEntityId } from "../../utils/plugins/homeAssistantUtils";
import { searchSubreddits } from "../../utils/dashboard/reddit";
import { logActivity } from "../../utils/activityLogs";
import { deleteCache } from "../../services/cache";
import { requireAdmin } from "../../middleware/auth";
import { badGateway, badRequest, serverError } from "../../utils/errors";

export const dashboardPluginsRoutes = new Elysia({ prefix: "/api/plugins" })
  .use(auth)
  .use(requireAdmin)
  .get("/weather", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "weather" },
      });
      const config = normalizeWeatherConfig(plugin?.config);

      return {
        plugin: {
          type: "weather",
          enabled: plugin?.enabled || false,
          address: config?.address || "",
          temperature_unit: config?.temperature_unit || "fahrenheit",
        },
      };
    } catch (error) {
      console.error("Error fetching Weather plugin config:", error);
      return serverError(set, "Failed to fetch Weather plugin config");
    }
  })
  .put(
    "/weather",
    async ({ user, body, set }) => {
      const address = body.address.trim();
      const temperatureUnit =
        body.temperature_unit === "celsius" ? "celsius" : "fahrenheit";
      const enabled = body.enabled ?? true;

      if (!address) {
        return badRequest(set, "address is required");
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "weather" },
          update: {
            enabled,
            config: {
              address,
              temperature_unit: temperatureUnit,
            },
            updatedAt: now,
          },
          create: {
            type: "weather",
            enabled,
            config: {
              address,
              temperature_unit: temperatureUnit,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "weather" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            address,
            temperature_unit: temperatureUnit,
          },
        };
      } catch (error) {
        console.error("Error saving Weather plugin config:", error);
        return serverError(set, "Failed to save Weather plugin config");
      }
    },
    {
      body: t.Object({
        address: t.String(),
        temperature_unit: t.Union([
          t.Literal("fahrenheit"),
          t.Literal("celsius"),
        ]),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/tmdb", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "tmdb" },
      });
      const config = normalizeTmdbConfig(plugin?.config);

      return {
        plugin: {
          type: "tmdb",
          enabled: plugin?.enabled || false,
          api_key: "",
          popularity_threshold: config?.popularity_threshold ?? 15,
        },
      };
    } catch (error) {
      console.error("Error fetching TMDB plugin config:", error);
      return serverError(set, "Failed to fetch TMDB plugin config");
    }
  })
  .put(
    "/tmdb",
    async ({ user, body, set }) => {
      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "tmdb" },
      });
      const existingConfig = normalizeTmdbConfig(existingPlugin?.config);
      const providedApiKey = body.api_key.trim();
      const apiKey = providedApiKey || existingConfig?.api_key || "";
      const enabled = body.enabled ?? true;
      const popularityThreshold = Math.max(
        0,
        Math.min(100, Math.round(body.popularity_threshold ?? 15)),
      );

      if (!apiKey) {
        return badRequest(set, "api_key is required");
      }

      try {
        const now = nowUtc();
        const configPayload = {
          api_key: encrypt(apiKey),
          popularity_threshold: popularityThreshold,
        };
        const plugin = await prisma.plugin.upsert({
          where: { type: "tmdb" },
          update: {
            enabled,
            config: configPayload,
            updatedAt: now,
          },
          create: {
            type: "tmdb",
            enabled,
            config: configPayload,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "tmdb" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            api_key: "",
            popularity_threshold: popularityThreshold,
          },
        };
      } catch (error) {
        console.error("Error saving TMDB plugin config:", error);
        return serverError(set, "Failed to save TMDB plugin config");
      }
    },
    {
      body: t.Object({
        api_key: t.String(),
        enabled: t.Optional(t.Boolean()),
        popularity_threshold: t.Optional(t.Number()),
      }),
    },
  )
  .get("/ollama", async ({ set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "ollama" },
      });
      const config = normalizeOllamaConfig(plugin?.config);

      return {
        plugin: {
          type: "ollama" as const,
          enabled: plugin?.enabled || false,
          base_url: config?.base_url || "",
          model: config?.model || "llama3.2",
        },
      };
    } catch (error) {
      console.error("Error fetching Ollama plugin config:", error);
      return serverError(set, "Failed to fetch Ollama plugin config");
    }
  })
  .put(
    "/ollama",
    async ({ user, body, set }) => {
      const baseUrl = body.base_url.trim().replace(/\/+$/, "");
      const model = (body.model ?? "").trim() || "llama3.2";
      const enabled = body.enabled ?? true;

      if (!baseUrl || !isValidHttpUrl(baseUrl)) {
        return badRequest(
          set,
          "Invalid base_url. Must be a valid http(s) URL (e.g. http://127.0.0.1:11434).",
        );
      }

      try {
        const now = nowUtc();
        const configPayload = {
          base_url: baseUrl,
          model,
        };
        const plugin = await prisma.plugin.upsert({
          where: { type: "ollama" },
          update: {
            enabled,
            config: configPayload,
            updatedAt: now,
          },
          create: {
            type: "ollama",
            enabled,
            config: configPayload,
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "ollama" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            base_url: baseUrl,
            model,
          },
        };
      } catch (error) {
        console.error("Error saving Ollama plugin config:", error);
        return serverError(set, "Failed to save Ollama plugin config");
      }
    },
    {
      body: t.Object({
        base_url: t.String(),
        model: t.Optional(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/qbittorrent", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "qbittorrent" },
      });

      const config = normalizeQbittorrentConfig(plugin?.config);
      return {
        plugin: {
          type: "qbittorrent",
          enabled: plugin?.enabled || false,
          website_url: config?.website_url || "",
          username: config?.username || "",
          password_set: Boolean(config?.password),
          poll_interval_seconds: config?.poll_interval_seconds || 1,
          max_items: config?.max_items || 8,
        },
      };
    } catch (error) {
      console.error("Error fetching qBittorrent plugin config:", error);
      return serverError(set, "Failed to fetch qBittorrent plugin config");
    }
  })
  .put(
    "/qbittorrent",
    async ({ user, body, set }) => {
      const websiteUrl = body.website_url.trim().replace(/\/+$/, "");
      const username = body.username.trim();
      const pollIntervalSeconds = clampInteger(
        body.poll_interval_seconds,
        1,
        30,
        1,
      );
      const maxItems = clampInteger(body.max_items, 3, 30, 8);

      if (!websiteUrl || !isValidHttpUrl(websiteUrl)) {
        return badRequest(
          set,
          "Invalid website_url. Must be a valid http(s) URL.",
        );
      }

      if (!username) {
        return badRequest(set, "username is required");
      }

      try {
        const existingPlugin = await prisma.plugin.findFirst({
          where: { type: "qbittorrent" },
        });
        const existingConfig = normalizeQbittorrentConfig(
          existingPlugin?.config,
        );
        const providedPassword = body.password?.trim() || "";
        const password = providedPassword || existingConfig?.password || "";

        if (!password) {
          return badRequest(set, "password is required");
        }

        const now = nowUtc();
        const enabled = body.enabled ?? existingPlugin?.enabled ?? true;
        const config: Prisma.InputJsonValue = {
          website_url: websiteUrl,
          username,
          password: encrypt(password),
          poll_interval_seconds: pollIntervalSeconds,
          max_items: maxItems,
        };

        const plugin = await prisma.plugin.upsert({
          where: { type: "qbittorrent" },
          update: {
            enabled,
            config,
            updatedAt: now,
          },
          create: {
            type: "qbittorrent",
            enabled,
            config,
            createdAt: now,
            updatedAt: now,
          },
        });

        await invalidateQbittorrentPluginConfigCache();

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "qbittorrent" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            website_url: websiteUrl,
            username,
            password_set: true,
            poll_interval_seconds: pollIntervalSeconds,
            max_items: maxItems,
          },
        };
      } catch (error) {
        console.error("Error saving qBittorrent plugin config:", error);
        return serverError(set, "Failed to save qBittorrent plugin config");
      }
    },
    {
      body: t.Object({
        website_url: t.String(),
        username: t.String(),
        password: t.Optional(t.String()),
        poll_interval_seconds: t.Optional(t.Numeric()),
        max_items: t.Optional(t.Numeric()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/hackernews", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "hackernews" },
      });
      const config = normalizeHackernewsConfig(plugin?.config);

      return {
        plugin: {
          type: "hackernews",
          enabled: plugin?.enabled || false,
          feed_type: config?.feed_type || "top",
          story_count: config?.story_count || 10,
        },
      };
    } catch (error) {
      console.error("Error fetching Hacker News plugin config:", error);
      return serverError(set, "Failed to fetch Hacker News plugin config");
    }
  })
  .put(
    "/hackernews",
    async ({ user, body, set }) => {
      const validFeedTypes = [
        "top",
        "best",
        "new",
        "ask",
        "show",
        "job",
      ] as const;
      const feedType = validFeedTypes.includes(
        body.feed_type as (typeof validFeedTypes)[number],
      )
        ? body.feed_type
        : "top";
      const storyCount = Math.max(
        1,
        Math.min(Math.trunc(Number(body.story_count) || 10), 50),
      );
      const enabled = body.enabled ?? true;

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "hackernews" },
          update: {
            enabled,
            config: {
              feed_type: feedType,
              story_count: storyCount,
            },
            updatedAt: now,
          },
          create: {
            type: "hackernews",
            enabled,
            config: {
              feed_type: feedType,
              story_count: storyCount,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await deleteCache("dashboard:hackernews");

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "hackernews" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            feed_type: feedType,
            story_count: storyCount,
          },
        };
      } catch (error) {
        console.error("Error saving Hacker News plugin config:", error);
        return serverError(set, "Failed to save Hacker News plugin config");
      }
    },
    {
      body: t.Object({
        feed_type: t.String(),
        story_count: t.Numeric(),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/reddit", async ({ user, set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "reddit" },
      });
      const config = normalizeRedditConfig(plugin?.config);

      return {
        plugin: {
          type: "reddit",
          enabled: plugin?.enabled || false,
          subreddits: config.subreddits,
        },
      };
    } catch (error) {
      console.error("Error fetching Reddit plugin config:", error);
      return serverError(set, "Failed to fetch Reddit plugin config");
    }
  })
  .put(
    "/reddit",
    async ({ user, body, set }) => {
      const rawSubreddits = body.subreddits ?? [];
      const subreddits = rawSubreddits
        .map((s: string) => s.replace(/^r\//, "").trim())
        .filter((s: string) => /^[a-zA-Z0-9_]+$/.test(s));

      if (subreddits.length === 0) {
        return badRequest(set, "At least one valid subreddit is required");
      }

      const enabled = body.enabled ?? true;

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "reddit" },
          update: {
            enabled,
            config: { subreddits },
            updatedAt: now,
          },
          create: {
            type: "reddit",
            enabled,
            config: { subreddits },
            createdAt: now,
            updatedAt: now,
          },
        });

        await deleteCache("dashboard:reddit");

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "reddit" },
        });

        return {
          success: true,
          plugin: {
            type: plugin.type,
            enabled: plugin.enabled,
            subreddits,
          },
        };
      } catch (error) {
        console.error("Error saving Reddit plugin config:", error);
        return serverError(set, "Failed to save Reddit plugin config");
      }
    },
    {
      body: t.Object({
        subreddits: t.Array(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  )
  .get("/reddit/search", async ({ user, set, query }) => {
    const q = (query as Record<string, string | undefined>).q?.trim() || "";
    if (q.length < 2) {
      return { results: [] };
    }

    try {
      const results = await searchSubreddits(q);
      return { results };
    } catch (error) {
      console.error("Error searching subreddits:", error);
      return badGateway(set, "Failed to search subreddits");
    }
  })
  .get("/home-assistant/entities", async ({ set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "home-assistant" },
        select: { enabled: true, config: true },
      });
      if (!plugin?.enabled) {
        return badRequest(set, "Enable the Home Assistant plugin first");
      }
      const cfg = normalizeHomeAssistantConfig(plugin.config);
      if (!cfg) {
        return badRequest(set, "Home Assistant is not configured");
      }

      const list = await haListDiscoverableEntities(
        cfg.base_url,
        cfg.access_token,
      );
      if (!list.ok) {
        set.status =
          list.status >= 400 && list.status < 600 ? list.status : 502;
        return { error: list.message };
      }

      const entities = list.entities.map((s) => {
        const domain = haDomainFromEntityId(s.entity_id)!;
        const attrs =
          s.attributes && typeof s.attributes === "object"
            ? (s.attributes as Record<string, unknown>)
            : {};
        const friendly =
          typeof attrs.friendly_name === "string" && attrs.friendly_name.trim()
            ? attrs.friendly_name.trim()
            : s.entity_id;
        return { entity_id: s.entity_id, friendly_name: friendly, domain };
      });

      return { entities };
    } catch (error) {
      console.error("Error listing Home Assistant entities:", error);
      return serverError(set, "Failed to list Home Assistant devices");
    }
  })
  .get("/home-assistant", async ({ set }) => {
    try {
      const plugin = await prisma.plugin.findFirst({
        where: { type: "home-assistant" },
      });
      const cfg = normalizeHomeAssistantConfig(plugin?.config);

      return {
        plugin: {
          type: "home-assistant" as const,
          enabled: plugin?.enabled || false,
          base_url: cfg?.base_url || "",
          access_token: "",
          enabled_entity_ids: cfg?.enabled_entity_ids ?? [],
        },
      };
    } catch (error) {
      console.error("Error fetching Home Assistant plugin config:", error);
      return serverError(set, "Failed to fetch Home Assistant plugin config");
    }
  })
  .put(
    "/home-assistant",
    async ({ user, body, set }) => {
      const baseUrl = body.base_url.trim().replace(/\/+$/, "");
      const enabled = body.enabled ?? true;
      const rawIds = body.enabled_entity_ids ?? [];
      const enabledEntityIds = [
        ...new Set(rawIds.map((id) => id.trim()).filter(Boolean)),
      ].filter((id) => haDomainFromEntityId(id) !== null);

      if (!baseUrl || !assertValidHaBaseUrl(baseUrl)) {
        return badRequest(
          set,
          "Invalid base_url. Use http(s) URL of your Home Assistant instance (e.g. https://homeassistant.local:8123).",
        );
      }

      const existingPlugin = await prisma.plugin.findFirst({
        where: { type: "home-assistant" },
      });
      const existingCfg = normalizeHomeAssistantConfig(existingPlugin?.config);
      const providedToken = body.access_token.trim();

      let accessTokenEncrypted: string;
      if (providedToken) {
        accessTokenEncrypted = encrypt(providedToken);
      } else if (existingCfg) {
        const raw = existingPlugin?.config as Record<string, unknown> | null;
        const prev =
          typeof raw?.access_token === "string" ? raw.access_token : "";
        if (!prev) {
          return badRequest(set, "access_token is required");
        }
        accessTokenEncrypted = prev;
      } else {
        return badRequest(set, "access_token is required");
      }

      try {
        const now = nowUtc();
        const plugin = await prisma.plugin.upsert({
          where: { type: "home-assistant" },
          update: {
            enabled,
            config: {
              base_url: baseUrl,
              access_token: accessTokenEncrypted,
              enabled_entity_ids: enabledEntityIds,
            },
            updatedAt: now,
          },
          create: {
            type: "home-assistant",
            enabled,
            config: {
              base_url: baseUrl,
              access_token: accessTokenEncrypted,
              enabled_entity_ids: enabledEntityIds,
            },
            createdAt: now,
            updatedAt: now,
          },
        });

        await logActivity({
          type: "plugin_updated",
          userId: user!.id,
          payload: { plugin_type: "home-assistant" },
        });

        const saved = normalizeHomeAssistantConfig(plugin.config);

        return {
          success: true,
          plugin: {
            type: "home-assistant" as const,
            enabled: plugin.enabled,
            base_url: saved?.base_url || baseUrl,
            access_token: "",
            enabled_entity_ids: saved?.enabled_entity_ids ?? enabledEntityIds,
          },
        };
      } catch (error) {
        console.error("Error saving Home Assistant plugin config:", error);
        return serverError(set, "Failed to save Home Assistant plugin config");
      }
    },
    {
      body: t.Object({
        base_url: t.String(),
        access_token: t.String(),
        enabled_entity_ids: t.Array(t.String()),
        enabled: t.Optional(t.Boolean()),
      }),
    },
  );
