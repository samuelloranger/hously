import { BeszelSection } from "./BeszelSection";
import { ScrutinySection } from "./ScrutinySection";
import { AdguardSection } from "./AdguardSection";
import { UptimekumaSection } from "./UptimekumaSection";

export function SystemPanel() {
  return (
    <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-5">
      <BeszelSection />
      <ScrutinySection />
      <AdguardSection />
      <UptimekumaSection />
    </section>
  );
}
