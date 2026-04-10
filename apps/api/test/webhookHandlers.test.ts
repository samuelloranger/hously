import { describe, expect, it } from "bun:test";
import { webhookHandlers } from "../src/services/webhookHandlers";

describe("webhookHandlers.jellyfin", () => {
  it("normalizes the official flat webhook payload shape", () => {
    const result = webhookHandlers.jellyfin({
      NotificationType: "PlaybackStart",
      Title: "Severance",
      NotificationUsername: "sam",
      NotificationUserId: "42",
      ItemId: "item-1",
      ItemType: "Episode",
      ServerName: "Media",
      ServerId: "server-1",
      PlaybackPosition: "00:10:00",
      Provider_tmdb: "123",
      Provider_imdb: "tt11280740",
    });

    expect(result.event_type).toBe("PlaybackStart");
    expect(result.template_variables.NotificationType).toBe("PlaybackStart");
    expect(result.template_variables.Title).toBe("Severance");
    expect(result.template_variables.NotificationUsername).toBe("sam");
    expect(result.template_variables.ItemType).toBe("Episode");
    expect(result.template_variables.ServerName).toBe("Media");
    expect(result.template_variables.Provider_tmdb).toBe("123");
    expect(result.template_variables.item_name).toBe("Severance");
    expect(result.template_variables.user_name).toBe("sam");
  });

  it("extracts official variables from the nested Jellyfin payload shape", () => {
    const result = webhookHandlers.jellyfin({
      NotificationType: "ItemAdded",
      Item: {
        Id: "item-2",
        Name: "The Matrix",
        Type: "Movie",
        Overview: "Neo learns the truth.",
        ProductionYear: 1999,
        ProviderIds: {
          Tmdb: "603",
          Imdb: "tt0133093",
        },
        Genres: ["Action", "Sci-Fi"],
        RunTimeTicks: 81600000000,
      },
      User: {
        Id: "7",
        Name: "admin",
      },
      Server: {
        Id: "server-2",
        Name: "Jellyfin",
      },
    });

    expect(result.event_type).toBe("ItemAdded");
    expect(result.template_variables.Title).toBe("The Matrix");
    expect(result.template_variables.ItemId).toBe("item-2");
    expect(result.template_variables.ItemType).toBe("Movie");
    expect(result.template_variables.NotificationUsername).toBe("admin");
    expect(result.template_variables.ServerName).toBe("Jellyfin");
    expect(result.template_variables.Provider_tmdb).toBe("603");
    expect(result.template_variables.Provider_imdb).toBe("tt0133093");
    expect(result.template_variables.Genres).toBe("Action, Sci-Fi");
    expect(result.template_variables.Runtime).toBe("2:16:00");
    expect(result.template_variables.year).toBe("1999");
  });

  it("maps legacy event aliases to the official Jellyfin notification types", () => {
    const result = webhookHandlers.jellyfin({
      NotificationType: "UserAdded",
      NotificationUsername: "new-user",
      ServerName: "Jellyfin",
    });

    expect(result.event_type).toBe("UserCreated");
    expect(result.template_variables.NotificationType).toBe("UserCreated");
  });
});

describe("webhookHandlers.cross-seed", () => {
  it("maps cross-seed RESULTS payloads into notification variables", () => {
    const result = webhookHandlers["cross-seed"]({
      title: "cross-seed found matches",
      body: "Stuart Little (1999) matched on La Cale (API)",
      extra: {
        event: "RESULTS",
        name: "Stuart Little (1999)",
        infoHashes: ["3ea08dcec3baedb5800e8f42f7acdb6555966084"],
        trackers: ["La Cale (API)"],
        source: "torrentClient",
        result: "injected",
        decisions: ["MATCH"],
        searchee: {
          category: "radarr",
          client: "qbittorrent",
          path: "/data/Downloads/movies",
          infoHash: "f236801a00000000000000000000000000000000",
        },
      },
    });

    expect(result.event_type).toBe("RESULTS");
    expect(result.template_variables.title).toBe("cross-seed found matches");
    expect(result.template_variables.body).toBe(
      "Stuart Little (1999) matched on La Cale (API)",
    );
    expect(result.template_variables.name).toBe("Stuart Little (1999)");
    expect(result.template_variables.trackers).toBe("La Cale (API)");
    expect(result.template_variables.tracker).toBe("La Cale (API)");
    expect(result.template_variables.source).toBe("torrentClient");
    expect(result.template_variables.client).toBe("qbittorrent");
    expect(result.template_variables.category).toBe("radarr");
    expect(result.template_variables.result).toBe("injected");
  });
});

describe("webhookHandlers.generic", () => {
  it("maps generic title/body payloads into a generic notification event", () => {
    const result = webhookHandlers.generic({
      title: "Weekly Docker cleanup completed",
      body: "Total cleared: 12.34 GB",
      total_gb_cleared: 12.34,
    });

    expect(result!.event_type).toBe("GENERIC");
    expect(result!.template_variables.title).toBe(
      "Weekly Docker cleanup completed",
    );
    expect(result!.template_variables.body).toBe("Total cleared: 12.34 GB");
    expect(result!.template_variables.total_gb_cleared).toBe("12.34");
  });

  it("returns null when payload has no title or body fields", () => {
    const result = webhookHandlers.generic({ foo: "bar", count: 42 });
    expect(result).toBeNull();
  });

  it("allows notification with only a title", () => {
    const result = webhookHandlers.generic({ title: "Backup finished" });
    expect(result!.event_type).toBe("GENERIC");
    expect(result!.template_variables.title).toBe("Backup finished");
    expect(result!.template_variables.body).toBe("No details provided.");
  });

  it("allows notification with only a body", () => {
    const result = webhookHandlers.generic({
      message: "All systems operational",
    });
    expect(result!.event_type).toBe("GENERIC");
    expect(result!.template_variables.title).toBe("Generic notification");
    expect(result!.template_variables.body).toBe("All systems operational");
  });
});
