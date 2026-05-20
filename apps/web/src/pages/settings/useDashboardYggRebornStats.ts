import { useDashboardTrackerStats } from "./_trackerIntegration";

export const useDashboardYggRebornStats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("ygg-reborn", options);
