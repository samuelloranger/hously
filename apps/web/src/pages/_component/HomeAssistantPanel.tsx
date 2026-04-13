import { useTranslation } from "react-i18next";
import { Lamp, Plug } from "lucide-react";
import {
  useHomeAssistantControl,
  useHomeAssistantWidget,
} from "@/pages/settings/useHomeAssistant";
import { usePrefetchIntent } from "@/lib/routing/usePrefetchIntent";
import { cn } from "@/lib/utils";
import { useState } from "react";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      {children}
    </h3>
  );
}

function isEntityOn(state: string): boolean {
  return state === "on" || state === "open";
}

export function HomeAssistantPanel() {
  const { t } = useTranslation("common");
  const query = useHomeAssistantWidget();
  const control = useHomeAssistantControl();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const prefetchIntent = usePrefetchIntent("/settings", { tab: "plugins" });

  if (!query.data || query.isError) return null;
  if (!query.data.plugin_enabled) return null;

  const entities = query.data.entities ?? [];

  const handleToggle = (entityId: string) => {
    setPendingId(entityId);
    control.mutate(
      { entity_id: entityId, action: "toggle" },
      { onSettled: () => setPendingId(null) },
    );
  };

  return (
    <section
      className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden"
      {...prefetchIntent}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
          <SectionTitle>{t("dashboard.homeAssistant.kicker")}</SectionTitle>
        </div>
        {query.isFetching ? (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            …
          </span>
        ) : null}
      </div>

      <div className="px-4 py-3 space-y-2">
        {entities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 px-3 py-4 text-center">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
              {t("dashboard.homeAssistant.emptyTitle")}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t("dashboard.homeAssistant.emptyDescription")}
            </p>
          </div>
        ) : (
          entities.map((e) => {
            const on = isEntityOn(e.state);
            const Icon = e.domain === "light" ? Lamp : Plug;
            const busy = pendingId === e.entity_id && control.isPending;
            return (
              <div
                key={e.entity_id}
                className="flex items-center gap-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/40 px-3 py-2.5"
              >
                <Icon
                  className={cn(
                    "size-5 shrink-0 transition-colors",
                    on ? "text-yellow-400" : "text-zinc-400 dark:text-zinc-500",
                  )}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {e.friendly_name}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                    {e.domain === "light"
                      ? t("dashboard.homeAssistant.domainLight")
                      : t("dashboard.homeAssistant.domainSwitch")}{" "}
                    · {e.entity_id}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleToggle(e.entity_id)}
                  aria-pressed={on}
                  aria-label={`${t("dashboard.homeAssistant.toggle")}: ${e.friendly_name}`}
                  className={cn(
                    "shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                    "border border-zinc-200 dark:border-zinc-600",
                    "bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                    "disabled:opacity-50",
                  )}
                >
                  {busy ? "…" : t("dashboard.homeAssistant.toggle")}
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
