export const formatGo = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--';
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} Go`;
};

export const formatRatio = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return '--';
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return value.toFixed(digits);
};
