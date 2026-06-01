import { useMinecraftWidget } from "@/pages/_component/useMinecraftWidget";
import { cn } from "@/lib/utils";
import type { MinecraftServerEntry } from "@hously/shared/types";

const MINECRAFT_ICON =
  "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/minecraft.png";

function MinecraftCompactPanelSkeleton() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-neutral-800">
        <span className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
        <div className="h-4 w-4 rounded bg-neutral-800 animate-pulse shrink-0" />
        <div className="h-3 w-20 rounded-full bg-neutral-800 animate-pulse" />
      </div>
      <div className="px-4 py-3 space-y-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="size-2 rounded-full bg-neutral-800 animate-pulse shrink-0" />
            <div className="h-2.5 w-28 rounded-full bg-neutral-800 animate-pulse" />
            <div className="ml-auto h-2.5 w-16 rounded-full bg-neutral-800 animate-pulse" />
          </div>
        ))}
      </div>
    </section>
  );
}

function ServerRow({ server }: { server: MinecraftServerEntry }) {
  return (
    <div className="flex items-center gap-2 py-1 min-w-0">
      <span
        className={cn(
          "size-2 rounded-full shrink-0",
          server.is_online ? "bg-emerald-500" : "bg-neutral-600",
        )}
      />
      <span className="text-sm font-medium text-neutral-100 truncate min-w-0">
        {server.name}
      </span>
      <div className="ml-auto flex items-center gap-2 shrink-0">
        {server.is_online && server.online_players !== null && (
          <span className="text-xs tabular-nums text-neutral-400">
            {server.online_players}/{server.max_players ?? "?"}
          </span>
        )}
        {server.version && (
          <span className="text-xs text-neutral-500">
            {server.version}
          </span>
        )}
        {server.latency_ms !== null && server.is_online && (
          <span className="text-xs tabular-nums text-neutral-500">
            {server.latency_ms}ms
          </span>
        )}
      </div>
    </div>
  );
}

export function MinecraftCompactPanel() {
  const { isPending, servers } = useMinecraftWidget();

  if (isPending) return <MinecraftCompactPanelSkeleton />;

  if (servers.length === 0) return null;

  const onlineCount = servers.filter((s) => s.is_online).length;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-neutral-800">
        <span className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
        <img
          src={MINECRAFT_ICON}
          alt="Minecraft"
          className="w-4 h-4 shrink-0 rounded"
        />
        <h3 className="text-sm font-semibold text-neutral-100">
          Minecraft
        </h3>
        <span className="ml-auto text-xs text-neutral-400 tabular-nums">
          {onlineCount}/{servers.length} online
        </span>
      </div>
      <div className="px-4 py-3 divide-y divide-neutral-800">
        {servers.map((server) => (
          <ServerRow key={server.id} server={server} />
        ))}
      </div>
    </section>
  );
}
