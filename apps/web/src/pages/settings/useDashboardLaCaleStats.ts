import { useDashboardTrackerStats } from "./_trackerIntegration";

export const useDashboardLaCaleStats = (options?: { enabled?: boolean }) =>
  useDashboardTrackerStats("la-cale", options);
