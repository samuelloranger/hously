import { useTranslation } from "react-i18next";
import { Server } from "lucide-react";
import { BeszelSection } from "./BeszelSection";
import { ScrutinySection } from "./ScrutinySection";
import { AdguardSection } from "./AdguardSection";
import { UptimekumaSection } from "./UptimekumaSection";
import {
  useDashboardSystemSummary,
  useDashboardScrutinySummary,
  useDashboardAdguardSummary,
} from "@/pages/_component/useDashboardSystem";
import { useUptimekumaMonitors } from "@/pages/_component/useUptimekumaMonitors";
import { WidgetHeader, WidgetShell } from "@/pages/_component/widgetPrimitives";

function VitalCellSkeleton() {
  return (
    <div className="rounded-lg bg-surface-inset/60 ring-1 ring-border/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="h-2 w-8 rounded-full bg-neutral-800 animate-pulse" />
        <div className="size-2 rounded-full bg-neutral-800 animate-pulse" />
      </div>
      <div className="h-7 w-14 rounded bg-neutral-800 animate-pulse" />
      <div className="h-[3px] w-full rounded-full bg-neutral-800" />
    </div>
  );
}

function SystemPanelSkeleton() {
  return (
    <WidgetShell>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-800">
        <span className="w-1 h-4 rounded-full bg-primary-500 shrink-0" />
        <Server className="w-4 h-4 shrink-0 text-neutral-600" strokeWidth={2} />
        <div className="h-3 w-16 rounded-full bg-neutral-800 animate-pulse" />
      </div>
      <div className="px-4 py-4 grid grid-cols-2 gap-2">
        <VitalCellSkeleton />
        <VitalCellSkeleton />
      </div>
    </WidgetShell>
  );
}

export function SystemPanel() {
  const { t } = useTranslation("common");
  const beszel = useDashboardSystemSummary();
  const scrutiny = useDashboardScrutinySummary();
  const adguard = useDashboardAdguardSummary();
  const uptime = useUptimekumaMonitors();

  if (
    beszel.isPending ||
    scrutiny.isPending ||
    adguard.isPending ||
    uptime.isPending
  ) {
    return <SystemPanelSkeleton />;
  }

  return (
    <WidgetShell>
      <WidgetHeader icon={Server} title={t("dashboard.home.systemHeading")} />
      <BeszelSection />
      <ScrutinySection />
      <AdguardSection />
      <UptimekumaSection />
    </WidgetShell>
  );
}
