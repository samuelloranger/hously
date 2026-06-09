import {
  Boxes,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  ChevronRight,
  Container,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDistanceToNow } from "date-fns";
import { enUS, fr } from "date-fns/locale";
import { Dialog } from "@/components/dialog";
import { cn } from "@/lib/utils";
import { useDashboardDockerSummary } from "@/pages/_component/useDashboardDocker";
import { WidgetHeader, WidgetShell } from "@/pages/_component/widgetPrimitives";
import type {
  DashboardDockerContainer,
  DockerContainerState,
} from "@hously/shared/types";

const STATE_ORDER: DockerContainerState[] = [
  "exited",
  "dead",
  "paused",
  "restarting",
  "created",
  "removing",
  "unknown",
  "running",
];

const STATE_TINT: Record<DockerContainerState, string> = {
  running: "bg-emerald-950/40 text-emerald-300",
  exited: "bg-rose-950/40 text-rose-300",
  paused: "bg-amber-950/40 text-amber-300",
  restarting: "bg-amber-950/40 text-amber-300",
  dead: "bg-rose-950/40 text-rose-300",
  created: "bg-neutral-900/70 text-neutral-300",
  removing: "bg-rose-950/40 text-rose-300",
  unknown: "bg-neutral-900/70 text-neutral-300",
};

function DockerPanelSkeleton() {
  return (
    <WidgetShell>
      <WidgetHeader icon={Boxes} title="Docker" />
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              className="h-16 rounded-lg bg-surface-inset/60 ring-1 ring-border/60 animate-pulse"
            />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-10 rounded-lg bg-neutral-800/70 animate-pulse"
            />
          ))}
        </div>
      </div>
    </WidgetShell>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "bad" | "neutral";
}) {
  return (
    <div className="rounded-lg bg-surface-inset/60 ring-1 ring-border/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "good" && "text-emerald-300",
          tone === "bad" && "text-red-300",
          tone === "neutral" && "text-neutral-100",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function stateClasses(container: DashboardDockerContainer): string {
  if (container.status.toLowerCase().includes("unhealthy")) {
    return "border-red-500/40 bg-red-500/10 text-red-200";
  }
  if (container.state === "running") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (container.state === "paused" || container.state === "restarting") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-200";
  }
  return "border-red-500/35 bg-red-500/10 text-red-200";
}

function StateIcon({ container }: { container: DashboardDockerContainer }) {
  if (container.status.toLowerCase().includes("unhealthy")) {
    return <CircleAlert className="size-3.5" aria-hidden />;
  }
  if (container.state === "running") {
    return <CircleCheck className="size-3.5" aria-hidden />;
  }
  return <CircleDashed className="size-3.5" aria-hidden />;
}

function iconSlug(container: DashboardDockerContainer): string {
  return container.icon_name
    .toLowerCase()
    .replace(/^hously[-_]/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ContainerIcon({ container }: { container: DashboardDockerContainer }) {
  const [failed, setFailed] = useState(false);
  const slug = iconSlug(container);

  if (failed || !slug) {
    return <Container className="size-4 text-neutral-400" aria-hidden />;
  }

  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${slug}.png`}
      alt=""
      className="size-4 rounded object-contain"
      onError={() => setFailed(true)}
    />
  );
}

function containerPriority(container: DashboardDockerContainer): number {
  if (container.status.toLowerCase().includes("unhealthy")) return 0;
  if (container.state === "dead" || container.state === "exited") return 1;
  if (
    container.state === "restarting" ||
    container.state === "paused" ||
    container.state === "removing"
  ) {
    return 2;
  }
  if (container.state === "created" || container.state === "unknown") return 3;
  return 4;
}

function DockerContainerRow({
  container,
  icon = "container",
  compact = false,
}: {
  container: DashboardDockerContainer;
  icon?: "container" | "state";
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        compact
          ? "rounded-lg border border-neutral-800 bg-neutral-950/35 px-3 py-2"
          : "px-1 py-2.5",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border",
          compact ? "size-7" : "size-8",
          stateClasses(container),
        )}
      >
        {icon === "state" ? (
          <StateIcon container={container} />
        ) : (
          <ContainerIcon container={container} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-neutral-100">
          {container.compose_service || container.name}
        </div>
        <div className="truncate text-xs text-neutral-500">
          {container.status || container.image}
        </div>
      </div>
      <span className="shrink-0 rounded-md bg-neutral-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
        {container.state}
      </span>
    </div>
  );
}

function DockerStateSection({
  state,
  containers,
}: {
  state: DockerContainerState;
  containers: DashboardDockerContainer[];
}) {
  const { t } = useTranslation("common");
  if (containers.length === 0) return null;

  return (
    <section className="space-y-0">
      <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.14em]",
            STATE_TINT[state],
          )}
        >
          {t(`dashboard.home.docker.sections.${state}`)}
        </span>
        <span className="text-[11px] font-mono tabular-nums text-neutral-500">
          {containers.length}
        </span>
      </div>
      <div className="divide-y divide-neutral-800/60">
        {containers.map((container) => (
          <DockerContainerRow key={container.id} container={container} />
        ))}
      </div>
    </section>
  );
}

function DockerContainersModal({
  open,
  onOpenChange,
  containers,
  updatedAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  containers: DashboardDockerContainer[];
  updatedAt: string | null;
}) {
  const { t, i18n } = useTranslation("common");

  const grouped = useMemo(() => {
    const map: Record<DockerContainerState, DashboardDockerContainer[]> = {
      running: [],
      exited: [],
      paused: [],
      restarting: [],
      dead: [],
      created: [],
      removing: [],
      unknown: [],
    };
    for (const container of containers) {
      map[container.state].push(container);
    }
    return map;
  }, [containers]);

  const locale = i18n.language?.startsWith("fr") ? fr : enUS;
  const updatedAgo = updatedAt
    ? formatDistanceToNow(new Date(updatedAt), {
        addSuffix: true,
        locale,
      })
    : null;

  return (
    <Dialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={t("dashboard.home.docker.viewAll")}
      panelClassName="max-w-lg p-0"
      bodyScroll
    >
      <div className="flex flex-col min-h-0">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-700">
          {updatedAgo && (
            <p className="mt-0.5 text-[11px] text-neutral-400 font-mono">
              {t("dashboard.home.docker.updatedAgo", {
                relative: updatedAgo,
              })}
            </p>
          )}
        </div>
        <div className="overflow-y-auto px-4 pb-4">
          {containers.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              {t("dashboard.home.docker.emptyAll")}
            </div>
          ) : (
            STATE_ORDER.map((state) => (
              <DockerStateSection
                key={state}
                state={state}
                containers={grouped[state]}
              />
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}

export function DockerPanel() {
  const { t } = useTranslation("common");
  const { data, isPending, error } = useDashboardDockerSummary();
  const [modalOpen, setModalOpen] = useState(false);

  if (isPending) return <DockerPanelSkeleton />;

  const summary = data?.summary;
  const visibleContainers = [...(data?.containers ?? [])]
    .sort((a, b) => {
      const priority = containerPriority(a) - containerPriority(b);
      if (priority !== 0) return priority;
      return (a.compose_service || a.name).localeCompare(
        b.compose_service || b.name,
      );
    })
    .slice(0, 5);
  const issueCount =
    (summary?.stopped ?? 0) +
    (summary?.paused ?? 0) +
    (summary?.restarting ?? 0) +
    (summary?.unhealthy ?? 0) +
    (summary?.other ?? 0);

  return (
    <>
      <DockerContainersModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        containers={data?.containers ?? []}
        updatedAt={data?.updated_at ?? null}
      />
      <WidgetShell>
        <WidgetHeader
          icon={Boxes}
          title={t("dashboard.home.docker.title")}
          right={
            data?.enabled ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
                  issueCount > 0
                    ? "bg-red-500/15 text-red-200"
                    : "bg-emerald-500/15 text-emerald-200",
                )}
              >
                {issueCount > 0
                  ? t("dashboard.home.docker.needsAttention")
                  : t("dashboard.home.docker.healthy")}
              </span>
            ) : null
          }
        />

        {!data?.enabled ? (
          <div className="p-4 text-sm text-neutral-400">
            {t("dashboard.home.docker.disabled")}
          </div>
        ) : error || data.error || !data.connected ? (
          <div className="p-4 text-sm text-red-300">
            {data?.error ?? t("dashboard.home.docker.loadError")}
          </div>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <StatCell
                label={t("dashboard.home.docker.running")}
                value={summary?.running ?? 0}
                tone="good"
              />
              <StatCell
                label={t("dashboard.home.docker.down")}
                value={issueCount}
                tone={issueCount > 0 ? "bad" : "neutral"}
              />
              <StatCell
                label={t("dashboard.home.docker.total")}
                value={summary?.total ?? 0}
                tone="neutral"
              />
            </div>

            {data.compose_project && (
              <div className="rounded-lg bg-neutral-950/40 px-3 py-2 text-xs text-neutral-400 ring-1 ring-neutral-800">
                {t("dashboard.home.docker.composeProject", {
                  project: data.compose_project,
                })}
              </div>
            )}

            {visibleContainers.length === 0 ? (
              <p className="text-sm text-neutral-400">
                {t("dashboard.home.docker.empty")}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                  {t("dashboard.home.docker.containers")}
                </div>
                {visibleContainers.map((container) => (
                  <DockerContainerRow
                    key={container.id}
                    container={container}
                    icon={
                      containerPriority(container) === 4 ? "container" : "state"
                    }
                    compact
                  />
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-100 transition-colors font-medium"
            >
              <ChevronRight size={12} />
              {t("dashboard.home.docker.viewAll")}
            </button>
          </div>
        )}
      </WidgetShell>
    </>
  );
}
