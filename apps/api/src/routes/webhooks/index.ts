import { Elysia } from "elysia";
import { prisma } from "@hously/api/db";
import { webhookHandlers } from "@hously/api/services/webhookHandlers";
import { enrichArrWebhookNotification } from "@hously/api/services/webhookEnrichment";
import { sendExternalNotification } from "@hously/api/services/externalNotificationService";
import {
  badRequest,
  forbidden,
  notFound,
  serverError,
} from "@hously/api/errors";
import { timingSafeEqual } from "node:crypto";
import { completeDownloadByHash } from "@hously/api/workers/checkDownloadCompletion";
import { enqueueLibraryPostProcess } from "@hously/api/services/postProcessor";
import { qbFetchJson } from "@hously/api/services/qbittorrent/client";
import { getQbittorrentPluginConfig } from "@hously/api/services/qbittorrent/config";
import { parseReleaseTitle } from "@hously/api/utils/medias/filenameParser";
import {
  QBIT_CATEGORY_HOUSLY_MOVIES,
  QBIT_CATEGORY_HOUSLY_SHOWS,
} from "@hously/api/constants/libraryGrab";

export const webhooksRoutes = new Elysia({ prefix: "/api/webhooks" })
  // ── qBittorrent torrent-completion webhook ──────────────────────────────────
  // The "Configure Webhooks" button in Settings auto-configures qBittorrent to
  // call this endpoint via:
  //
  //   /usr/bin/curl -s -X POST "<hously-url>/api/webhooks/qbittorrent/completed?hash=%I" \
  //     -H "Authorization: Bearer <secret>"
  //
  // qBittorrent substitutes %I with the torrent info-hash before spawning curl.
  // The hash is read from the query string; a JSON body ({ "hash": "..." }) is
  // also accepted as a fallback for manual/scripted calls.
  //
  // Use the internal Docker hostname (e.g. http://hously:3000) so qBittorrent
  // (inside a VPN network_mode container) reaches Hously directly without going
  // through the VPN tunnel or Cloudflare.
  .post("/qbittorrent/completed", async ({ body, query, request, set }) => {
    const qb = await getQbittorrentPluginConfig();
    const secret = qb.config?.webhook_secret;
    if (!secret) return forbidden(set, "Webhook not configured");

    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (
      tokenBuf.length !== secretBuf.length ||
      !timingSafeEqual(tokenBuf, secretBuf)
    ) {
      return forbidden(set, "Invalid token");
    }

    // hash may come from the query string (?hash=%I, set by autorun-setup)
    // or from a JSON body for manual/scripted calls
    let hash: string | undefined =
      typeof query?.hash === "string" ? query.hash : undefined;
    if (!hash) {
      try {
        const obj =
          body !== null && typeof body === "object"
            ? (body as Record<string, unknown>)
            : JSON.parse(typeof body === "string" ? body : "{}");
        hash = typeof obj?.hash === "string" ? obj.hash : undefined;
      } catch {
        return badRequest(set, "Invalid JSON");
      }
    }
    if (!hash?.trim()) return badRequest(set, "Missing hash");

    const downloadHistoryId = await completeDownloadByHash(hash);
    if (downloadHistoryId != null) {
      enqueueLibraryPostProcess(downloadHistoryId);
    }
    return {
      matched: downloadHistoryId != null,
      download_history_id: downloadHistoryId,
    };
  })
  // ── qBittorrent torrent-added webhook ────────────────────────────────────────
  // Auto-configured by "Configure Webhooks" in Settings — same curl/?hash=%I
  // pattern as /completed above.
  //
  // When a torrent lands in the hously-movies or hously-shows category, Hously
  // matches it against the library by title and creates a DownloadHistory entry
  // so the item's status switches to "downloading" immediately.
  .post("/qbittorrent/added", async ({ body, query, request, set }) => {
    const qb = await getQbittorrentPluginConfig();
    const secret = qb.config?.webhook_secret;
    if (!secret) return forbidden(set, "Webhook not configured");

    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (
      tokenBuf.length !== secretBuf.length ||
      !timingSafeEqual(tokenBuf, secretBuf)
    ) {
      return forbidden(set, "Invalid token");
    }

    let hash: string | undefined =
      typeof query?.hash === "string" ? query.hash : undefined;
    if (!hash) {
      try {
        const obj =
          body !== null && typeof body === "object"
            ? (body as Record<string, unknown>)
            : JSON.parse(typeof body === "string" ? body : "{}");
        hash = typeof obj?.hash === "string" ? obj.hash : undefined;
      } catch {
        return badRequest(set, "Invalid JSON");
      }
    }
    if (!hash?.trim()) return badRequest(set, "Missing hash");

    const normalizedHash = hash.trim().toLowerCase();

    try {
      if (!qb.enabled || !qb.config) {
        return { matched: false, reason: "qBittorrent not configured" };
      }

      // Fetch torrent info from qBittorrent by hash
      const info = await qbFetchJson<unknown[]>(
        qb.config,
        `/api/v2/torrents/info?hashes=${normalizedHash}`,
      );
      if (!Array.isArray(info) || info.length === 0) {
        return { matched: false, reason: "Torrent not found in qBittorrent" };
      }

      const raw = info[0] as Record<string, unknown>;
      const category = typeof raw.category === "string" ? raw.category : "";
      const tags =
        typeof raw.tags === "string"
          ? raw.tags.split(",").map((t: string) => t.trim().toLowerCase())
          : [];

      const isHouslyMedia =
        category === QBIT_CATEGORY_HOUSLY_MOVIES ||
        category === QBIT_CATEGORY_HOUSLY_SHOWS ||
        tags.includes("hously");

      if (!isHouslyMedia) {
        return { matched: false, reason: "Not a Hously media torrent" };
      }

      const expectedType =
        category === QBIT_CATEGORY_HOUSLY_SHOWS ? "show" : "movie";
      const torrentName = typeof raw.name === "string" ? raw.name : "";
      if (!torrentName) {
        return { matched: false, reason: "Torrent has no name" };
      }

      // Check if already tracked
      const existing = await prisma.downloadHistory.findFirst({
        where: { torrentHash: normalizedHash },
      });
      if (existing) {
        return {
          matched: true,
          reason: "Already tracked",
          download_history_id: existing.id,
        };
      }

      // Title-match against library
      const normalize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^a-z0-9]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      const normTorrent = normalize(torrentName);

      const candidates = await prisma.libraryMedia.findMany({
        where: {
          type: expectedType,
          status: { in: ["wanted", "downloading"] },
        },
        select: { id: true, title: true, qualityProfileId: true },
      });

      const torrentWords = normTorrent.split(" ").filter(Boolean);
      const match = candidates.find((m) => {
        const titleWords = normalize(m.title).split(" ").filter(Boolean);
        if (titleWords.length === 0) return false;
        // Require the title to appear as a contiguous, word-aligned sequence inside
        // the torrent name. Pure word-set containment ("the boys" ⊆ any torrent that
        // has both words) produces false positives for short titles like "It" or "Us"
        // and for partial matches like "The Boys" → "The Boys of Summer S01E01".
        for (let i = 0; i <= torrentWords.length - titleWords.length; i++) {
          if (
            torrentWords.slice(i, i + titleWords.length).join(" ") ===
            titleWords.join(" ")
          ) {
            return true;
          }
        }
        return false;
      });

      if (!match) {
        console.log(
          `[qbt/added] No library match for "${torrentName}" (${normalizedHash})`,
        );
        return { matched: false, reason: "No matching library item found" };
      }

      const parsed = parseReleaseTitle(torrentName);
      const dh = await prisma.downloadHistory.create({
        data: {
          mediaId: match.id,
          releaseTitle: torrentName,
          torrentHash: normalizedHash,
          qualityParsed: {
            resolution: parsed.resolution,
            source: parsed.source,
            codec: parsed.codec,
            hdr: parsed.hdr,
          },
        },
      });

      await prisma.libraryMedia.update({
        where: { id: match.id },
        data: { status: "downloading" },
      });

      // For shows, mark all wanted episodes as downloading too
      if (expectedType === "show") {
        await prisma.libraryEpisode.updateMany({
          where: { mediaId: match.id, status: "wanted" },
          data: { status: "downloading" },
        });
      }

      console.log(
        `[qbt/added] Linked "${torrentName}" (${normalizedHash}) → library item ${match.id} "${match.title}"`,
      );

      return { matched: true, download_history_id: dh.id };
    } catch (e) {
      console.error("[qbt/added] Error:", e);
      return serverError(set, "Failed to process torrent-added webhook");
    }
  })
  // Read all webhook bodies as raw text to avoid Elysia's parser failing on
  // non-standard payloads (e.g. Kopia sends application/json with plain text body)
  .onParse(({ request }) => request.text())
  // POST /api/webhooks/:serviceName - Receive webhook from external service
  .post("/:serviceName", async ({ params, query, body, set, request }) => {
    const { serviceName } = params;
    const token = query.token as string | undefined;

    // Validate token is provided
    if (!token) {
      console.warn(`${serviceName} webhook received without token`);
      return badRequest(set, "Token required");
    }

    // Check if handler exists for this service
    const handler = webhookHandlers[serviceName.toLowerCase()];
    if (!handler) {
      console.warn(`Unknown webhook service: ${serviceName}`);
      return notFound(set, "Unknown service");
    }

    try {
      // Validate token against database
      const service = await prisma.externalNotificationService.findFirst({
        where: {
          serviceName: serviceName.toLowerCase(),
          token: token,
          enabled: true,
        },
      });

      if (!service) {
        console.warn(
          `Invalid or disabled token for ${serviceName} webhook: ${token.slice(0, 10)}...`,
        );
        return forbidden(set, "Invalid or disabled token");
      }

      // Parse webhook payload — onParse gives us raw text for all content types
      let payload: Record<string, unknown>;
      const rawText = typeof body === "string" ? body : "";
      if (!rawText) {
        console.warn(`${serviceName} webhook received with empty payload`);
        return badRequest(set, "Invalid payload");
      }
      try {
        const parsed = JSON.parse(rawText);
        payload =
          typeof parsed === "object" && parsed !== null
            ? parsed
            : { body: rawText };
      } catch {
        payload = { body: rawText };
      }

      // Inject HTTP headers into payload (e.g. Kopia sends Subject as a header)
      const subjectHeader = request.headers.get("subject");
      if (subjectHeader && !payload.subject) payload.subject = subjectHeader;

      // Handle webhook first to get the real event_type
      try {
        const parsed = handler(payload);

        if (!parsed) {
          console.warn(
            `${serviceName} webhook payload rejected by handler (insufficient data)`,
          );
          return badRequest(set, "Webhook payload missing required fields");
        }

        const eventType = parsed.event_type;
        const enrichment = await enrichArrWebhookNotification(
          serviceName.toLowerCase(),
          parsed,
        );
        const templateVariables =
          enrichment.template_variables ?? parsed.template_variables;

        console.log(
          `Processing ${serviceName} webhook: event_type=${eventType}`,
        );

        // Create log entry with the real event_type from the handler
        const logEntry = await prisma.externalNotificationServiceLog.create({
          data: {
            serviceId: service.id,
            eventType,
            status: "pending",
            payload: JSON.stringify(payload),
            createdAt: new Date().toISOString(),
          },
        });

        console.log(
          `Created log entry for ${serviceName} webhook: ${logEntry.id}`,
        );

        // Prepare payload for notification service
        const notificationPayload = {
          template_variables: templateVariables,
          original_payload: parsed.original_payload,
          notification_url:
            enrichment.notification_url ?? parsed.notification_url,
          notification_metadata: {
            ...(parsed.notification_metadata ?? {}),
            ...(enrichment.notification_metadata ?? {}),
          },
        };

        // Send notifications
        try {
          const success = await sendExternalNotification(
            serviceName.toLowerCase(),
            eventType,
            notificationPayload,
            "en",
          );

          if (success) {
            await prisma.externalNotificationServiceLog.update({
              where: { id: logEntry.id },
              data: { status: "success" },
            });

            console.log(
              `Successfully processed ${serviceName} webhook: ${eventType}`,
            );
            return {
              success: true,
              message: "Webhook processed successfully",
            };
          } else {
            console.warn(
              `Webhook processed but notifications failed for ${serviceName}: ${eventType}`,
            );
            await prisma.externalNotificationServiceLog.update({
              where: { id: logEntry.id },
              data: { status: "failure" },
            });

            return {
              success: true,
              message: "Webhook processed but no notifications sent",
            };
          }
        } catch (notificationError) {
          console.error(
            `Error sending notifications for ${serviceName} webhook:`,
            notificationError,
          );
          await prisma.externalNotificationServiceLog.update({
            where: { id: logEntry.id },
            data: { status: "failure" },
          });

          return {
            success: true,
            message:
              "Webhook received but notification sending encountered errors",
          };
        }
      } catch (handlerError) {
        console.error(`Error processing ${serviceName} webhook:`, handlerError);
        return serverError(set, "Error processing webhook");
      }
    } catch (error) {
      console.error(`Error receiving ${serviceName} webhook:`, error);
      return serverError(set, "Internal server error");
    }
  });
