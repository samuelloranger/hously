import { useTranslation } from "react-i18next";
import { Lamp, Plug, Home } from "lucide-react";
import {
  useHomeAssistantControl,
  useHomeAssistantWidget,
} from "@/hooks/home-assistant/useHomeAssistant";
import { usePrefetchIntent } from "@/lib/routing/usePrefetchIntent";
import { cn } from "@/lib/utils";
import { useState } from "react";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-neutral-100">
      {children}
    </h3>
  );
}

function isEntityOn(state: string): boolean {
  return state === "on" || state === "open";
}

function HomeAssistantPanelSkeleton() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3 border-b border-neutral-800">
        <span className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
        <Home
          className="w-4 h-4 shrink-0 text-neutral-600"
          strokeWidth={2}
        />
        <div className="h-3 w-24 rounded-full bg-neutral-800 animate-pulse" />
      </div>
      <div className="px-4 py-3 space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5"
          >
            <div
              className="size-5 shrink-0 rounded bg-neutral-800 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
            <div className="flex-1 space-y-1.5">
              <div
                className="h-2.5 w-24 rounded-full bg-neutral-800 animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
              <div
                className="h-2 w-32 rounded-full bg-neutral-800 animate-pulse"
                style={{ animationDelay: `${i * 80 + 40}ms` }}
              />
            </div>
            <div
              className="h-7 w-14 shrink-0 rounded-lg bg-neutral-800 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function HomeAssistantPanel() {
  const { t } = useTranslation("common");
  const query = useHomeAssistantWidget();
  const control = useHomeAssistantControl();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const prefetchIntent = usePrefetchIntent("/settings", {
    tab: "integrations",
  });

  if (query.isPending) return <HomeAssistantPanelSkeleton />;
  if (!query.data || query.isError) return null;
  if (!query.data.integration_enabled) return null;

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
      className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden"
      {...prefetchIntent}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-4 rounded-full bg-amber-500 shrink-0" />
          <Home
            className="w-4 h-4 shrink-0 text-neutral-400"
            strokeWidth={2}
          />
          <SectionTitle>{t("dashboard.homeAssistant.kicker")}</SectionTitle>
        </div>
        {query.isFetching ? (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
            …
          </span>
        ) : null}
      </div>

      <div className="px-4 py-3 space-y-2">
        {entities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-700 px-3 py-4 text-center">
            <p className="text-sm font-medium text-neutral-200 mb-1">
              {t("dashboard.homeAssistant.emptyTitle")}
            </p>
            <p className="text-xs text-neutral-400 leading-relaxed">
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
                className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2.5"
              >
                <Icon
                  className={cn(
                    "size-5 shrink-0 transition-colors",
                    on ? "text-yellow-400" : "text-neutral-500",
                  )}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-100 truncate">
                    {e.friendly_name}
                  </p>
                  <p className="text-[10px] text-neutral-400 truncate">
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
                    "border border-neutral-600",
                    "bg-neutral-900 hover:bg-neutral-800",
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
