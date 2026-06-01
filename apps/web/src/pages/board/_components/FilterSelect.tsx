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
    <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 border-neutral-700/60 bg-neutral-900/40">
      <span className="text-[11px] font-medium text-neutral-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[12px] font-medium outline-none text-neutral-200"
      >
        {children}
      </select>
    </div>
  );
}
