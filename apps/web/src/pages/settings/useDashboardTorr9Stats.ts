import { useDashboardTrackerStats } from "./_trackerIntegration";

export const useDashboardTorr9Stats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("torr9", options);
