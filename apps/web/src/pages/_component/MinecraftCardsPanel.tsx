import { useAppSettings } from "@/pages/settings/useAppSettings";
import { useMinecraftWidget } from "@/pages/_component/useMinecraftWidget";
import { cn } from "@/lib/utils";
import type { MinecraftServerEntry } from "@hously/shared/types";

const MINECRAFT_ICON =
  "https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/minecraft.png";

const MAX_PLAYER_SAMPLE = 6;

function MinecraftCardsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <section
          key={i}
          className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
        >
          <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <span className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
            <div className="size-8 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse shrink-0" />
            <div className="h-3 w-32 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          </div>
          <div className="px-4 py-3 space-y-2">
            <div
              className="h-2.5 w-48 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
            <div
              className="h-2.5 w-24 rounded-full bg-zinc-100 dark:bg-zinc-800 animate-pulse"
              style={{ animationDelay: `${i * 60 + 40}ms` }}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function ServerCard({ server }: { server: MinecraftServerEntry }) {
  const sample = server.player_sample ?? [];
  const visible = sample.slice(0, MAX_PLAYER_SAMPLE);
  const overflow = sample.length - visible.length;

  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <span className="w-1 h-4 rounded-full bg-emerald-500 shrink-0" />
        <img
          src={server.favicon ?? MINECRAFT_ICON}
          alt={server.name}
          className="w-8 h-8 rounded shrink-0 object-contain"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = MINECRAFT_ICON;
          }}
        />
        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate min-w-0">
          {server.name}
        </h3>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            server.is_online
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
          )}
        >
          {server.is_online ? "Online" : "Offline"}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {server.motd && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {server.motd}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          {server.is_online && server.online_players !== null && (
            <span className="tabular-nums">
              {server.online_players}/{server.max_players ?? "?"} players
            </span>
          )}
          {server.version && <span>{server.version}</span>}
          {server.latency_ms !== null && server.is_online && (
            <span className="tabular-nums">{server.latency_ms}ms</span>
          )}
        </div>
        {visible.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {visible.map((p) => (
              <span
                key={p.id}
                className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-700 dark:text-zinc-300"
              >
                {p.name}
              </span>
            ))}
            {overflow > 0 && (
              <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                +{overflow}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function MinecraftCardsPanel() {
  const settings = useAppSettings();
  const { isPending, cardServers } = useMinecraftWidget();

  if (settings.isPending || isPending) return <MinecraftCardsSkeleton />;

  if (!settings.data?.settings.dashboard_widget_visibility.minecraft)
    return null;

  if (cardServers.length === 0) return null;

  return (
    <div className="space-y-3">
      {cardServers.map((server) => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
