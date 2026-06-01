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

function SystemPanelSkeleton() {
  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-1">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-1 h-4 rounded-full bg-primary-500 shrink-0" />
        <div className="w-4 h-4 rounded bg-neutral-800 animate-pulse shrink-0" />
        <div className="h-3 w-12 rounded-full bg-neutral-800 animate-pulse" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-1 py-1">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-neutral-800 animate-pulse shrink-0" />
            <div
              className="h-2.5 w-8 rounded-full bg-neutral-800 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
            <div
              className="h-2.5 w-10 rounded-full bg-neutral-800 animate-pulse ml-auto"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          </div>
          <div className="h-[3px] w-full rounded-full bg-neutral-800" />
        </div>
      ))}
    </section>
  );
}

export function SystemPanel() {
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
    <section className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 space-y-5">
      <BeszelSection />
      <ScrutinySection />
      <AdguardSection />
      <UptimekumaSection />
    </section>
  );
}
