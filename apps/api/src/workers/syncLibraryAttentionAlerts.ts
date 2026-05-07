import { syncLibraryAttentionAlerts } from "@hously/api/services/libraryAttention";

export async function runSyncLibraryAttentionAlerts(): Promise<void> {
  const r = await syncLibraryAttentionAlerts();
  console.log(
    `[syncLibraryAttentionAlerts] created=${r.created} updated=${r.updated} resolved=${r.resolved}`,
  );
}
