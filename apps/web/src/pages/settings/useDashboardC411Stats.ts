import { useDashboardTrackerStats } from "./_trackerIntegration";

export const useDashboardC411Stats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("c411", options);
