import { AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  if (value == null || value === "") return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="w-[34%] shrink-0 text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 break-all text-neutral-800 dark:text-neutral-200",
          mono && "font-mono text-[11px] leading-snug",
        )}
      >
        {String(value)}
      </span>
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium tracking-tight",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500 mb-2">
      {children}
    </p>
  );
}

export function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mt-3 mb-1.5">
      <Icon size={10} />
      {label}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusDot({ status }: { status: string }) {
  if (status === "downloaded") {
    return <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />;
  }
  if (status === "downloading") {
    return (
      <Circle size={11} className="text-sky-400 shrink-0 fill-sky-400/20" />
    );
  }
  if (status === "skipped") {
    return <AlertCircle size={11} className="text-neutral-400 shrink-0" />;
  }
  // wanted
  return (
    <Circle
      size={11}
      className="text-neutral-300 dark:text-neutral-600 shrink-0"
    />
  );
}
