export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50 px-2.5 py-1.5 dark:border-neutral-700/60 dark:bg-neutral-900/40">
      <span className="text-[11px] font-medium text-neutral-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[12px] font-medium text-neutral-700 outline-none dark:text-neutral-200"
      >
        {children}
      </select>
    </div>
  );
}
