export function pctFmt(v: number | null | undefined) {
  return v != null ? `${v.toFixed(0)}%` : "–";
}

export function mbps(kbps: number | null | undefined) {
  if (kbps == null) return "–";
  if (kbps >= 1_000_000) return `${(kbps / 1_000_000).toFixed(2)} Gbps`;
  if (kbps >= 1_000) return `${(kbps / 1_000).toFixed(1)} Mbps`;
  return `${kbps.toFixed(0)} Kbps`;
}

export function gb(mib: number | null | undefined) {
  if (mib == null) return null;
  return `${(mib / 1024).toFixed(1)} GB`;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-sm font-semibold text-neutral-100">
      {children}
    </h3>
  );
}

export function StatusDot({ status }: { status: "ok" | "warn" | "err" }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        status === "ok"
          ? "bg-emerald-400"
          : status === "warn"
            ? "bg-amber-400"
            : "bg-rose-400"
      }`}
    />
  );
}

export function MetricRow({
  label,
  value,
  sub,
  status = "ok",
}: {
  label: string;
  value: string;
  sub?: string | null;
  status?: "ok" | "warn" | "err";
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <StatusDot status={status} />
      <span className="w-16 shrink-0 text-xs font-medium text-neutral-400">
        {label}
      </span>
      <span className="font-display text-sm font-semibold tabular-nums text-neutral-50">
        {value}
      </span>
      {sub && (
        <span className="ml-auto font-mono text-[11px] text-neutral-400 tabular-nums">
          {sub}
        </span>
      )}
    </div>
  );
}

export function MiniBar({
  pct,
  accent = "bg-primary-500",
}: {
  pct: number;
  accent?: string;
}) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-[3px] w-full rounded-full bg-neutral-800 overflow-hidden mt-0.5 mb-1">
      <div
        className={`h-full rounded-full transition-all duration-700 ${accent}`}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}
