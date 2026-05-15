import { describe, it, expect, spyOn } from "bun:test";
import * as mcUtil from "minecraft-server-util";
import { pingMinecraftServer } from "./ping";

describe("pingMinecraftServer", () => {
  it("returns online result when server responds", async () => {
    const spy = spyOn(mcUtil, "status").mockResolvedValueOnce({
      version: { name: "1.21.4", protocol: 769 },
      players: {
        online: 3,
        max: 20,
        sample: [
          { name: "Steve", id: "00000000-0000-0000-0000-000000000001" },
        ],
      },
      motd: { raw: "§aA Server", clean: "A Server", html: "<span>A Server</span>" },
      roundTripLatency: 42,
      favicon: "data:image/png;base64,abc123",
      srvRecord: null,
    } as any);

    const result = await pingMinecraftServer("mc.example.com", 25565);

    expect(result.is_online).toBe(true);
    expect(result.online_players).toBe(3);
    expect(result.max_players).toBe(20);
    expect(result.version).toBe("1.21.4");
    expect(result.motd).toBe("A Server");
    expect(result.latency_ms).toBe(42);
    expect(result.favicon).toBe("data:image/png;base64,abc123");
    expect(result.player_sample).toEqual([
      { name: "Steve", id: "00000000-0000-0000-0000-000000000001" },
    ]);

    spy.mockRestore();
  });

  it("returns offline result when connection fails", async () => {
    const spy = spyOn(mcUtil, "status").mockRejectedValueOnce(
      new Error("ECONNREFUSED"),
    );

    const result = await pingMinecraftServer("mc.example.com", 25565);

    expect(result.is_online).toBe(false);
    expect(result.online_players).toBeNull();
    expect(result.latency_ms).toBeNull();
    expect(result.player_sample).toBeNull();

    spy.mockRestore();
  });

  it("returns offline result when connection times out", async () => {
    const spy = spyOn(mcUtil, "status").mockRejectedValueOnce(
      new Error("Timed out"),
    );

    const result = await pingMinecraftServer("mc.example.com", 25565);

    expect(result.is_online).toBe(false);

    spy.mockRestore();
  });
});
