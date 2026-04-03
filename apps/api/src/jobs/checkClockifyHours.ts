import { prisma } from "../db";
import { normalizeClockifyConfig } from "../utils/plugins/normalizers";
import { logActivity } from "../utils/activityLogs";
import { createAndQueueNotification } from "./notificationService";
import {
  CLOCKIFY_API_BASE,
  CLOCKIFY_PAGE_SIZE,
  parseDuration,
  getCurrentWeekRange,
  submitApprovalRequest,
} from "../services/clockify";

const JOB_ID = "checkClockifyHours";
const JOB_NAME = "Check Clockify weekly hours";
const TARGET_HOURS = 37.5;

export const checkClockifyHours = async (options?: {
  trigger?: "cron" | "manual" | "queue";
}): Promise<void> => {
  const trigger = options?.trigger ?? "cron";
  const startedAt = Date.now();

  const endLog = async (success: boolean, message?: string) => {
    await logActivity({
      type: "cron_job_ended",
      payload: {
        job_id: JOB_ID,
        job_name: JOB_NAME,
        success,
        duration_ms: Date.now() - startedAt,
        trigger,
        message,
      },
    });
  };

  try {
    const plugin = await prisma.plugin.findFirst({
      where: { type: "clockify" },
    });

    if (!plugin || !plugin.enabled) {
      await logActivity({
        type: "cron_job_skipped",
        payload: {
          job_id: JOB_ID,
          job_name: JOB_NAME,
          reason: !plugin ? "plugin_missing" : "plugin_disabled",
          trigger,
        },
      });
      console.log("[cron:clockify] plugin not found or disabled, skipping");
      return;
    }

    const config = normalizeClockifyConfig(plugin.config);
    if (!config.api_key || !config.workspace_id || !config.user_id) {
      await logActivity({
        type: "cron_job_skipped",
        payload: {
          job_id: JOB_ID,
          job_name: JOB_NAME,
          reason: "invalid_config",
          trigger,
        },
      });
      console.log("[cron:clockify] invalid config, skipping");
      return;
    }

    const { start, end } = getCurrentWeekRange();
    console.log(
      `[cron:clockify] checking hours for week ${start.toISOString()} – ${end.toISOString()}`,
    );

    let page = 1;
    let totalSeconds = 0;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        start: start.toISOString(),
        end: end.toISOString(),
        page: String(page),
        pageSize: String(CLOCKIFY_PAGE_SIZE),
      });

      const res = await fetch(
        `${CLOCKIFY_API_BASE}/v1/workspaces/${config.workspace_id}/user/${config.user_id}/time-entries?${params}`,
        { headers: { "X-Api-Key": config.api_key } },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const msg = `Clockify API error: ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`;
        console.error(`[cron:clockify] ${msg}`);
        throw new Error(msg);
      }

      const rawText = await res.text();
      let entries: Array<{ timeInterval?: { duration?: string | null } }>;
      try {
        entries = JSON.parse(rawText);
      } catch {
        console.error(
          `[cron:clockify] unexpected response (${res.status}): ${rawText.slice(0, 500)}`,
        );
        throw new Error(
          `Clockify returned non-JSON response (${res.status}): ${rawText.slice(0, 200)}`,
        );
      }

      for (const entry of entries) {
        const duration = entry.timeInterval?.duration;
        if (duration) {
          totalSeconds += parseDuration(duration);
        }
      }

      // Clockify signals the last page via a `Last-Page` response header
      const isLastPage =
        res.headers.get("Last-Page") === "true" ||
        entries.length < CLOCKIFY_PAGE_SIZE;
      hasMore = !isLastPage;
      page++;
    }

    const totalHours = totalSeconds / 3600;
    const weekLabel = `${start.toISOString().slice(0, 10)} – ${end.toISOString().slice(0, 10)}`;
    console.log(
      `[cron:clockify] ${totalHours.toFixed(2)}h logged for week ${weekLabel} (target: ${TARGET_HOURS}h)`,
    );

    const users = await prisma.user.findMany({ select: { id: true } });

    if (totalHours < TARGET_HOURS) {
      const shortBy = (TARGET_HOURS - totalHours).toFixed(1);
      for (const user of users) {
        await createAndQueueNotification(
          user.id,
          "[Clockify] Hours below target",
          `You logged ${totalHours.toFixed(1)}h this week (${weekLabel}). You're ${shortBy}h short of the ${TARGET_HOURS}h target.`,
          "clockify_hours_warning",
        );
      }
    } else {
      let submitted = false;
      try {
        await submitApprovalRequest(config.api_key, config.workspace_id, start);
        submitted = true;
        console.log(
          `[cron:clockify] approval request submitted for week ${weekLabel}`,
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `[cron:clockify] failed to submit approval request: ${message}`,
        );
      }

      for (const user of users) {
        await createAndQueueNotification(
          user.id,
          submitted
            ? "[Clockify] Timesheet submitted"
            : "[Clockify] Target reached",
          submitted
            ? `You logged ${totalHours.toFixed(1)}h this week (${weekLabel}). Your timesheet has been submitted for approval.`
            : `You logged ${totalHours.toFixed(1)}h this week (${weekLabel}). Target reached but timesheet submission failed.`,
          "clockify_hours_approved",
        );
      }
    }

    await endLog(true, `${totalHours.toFixed(2)}h logged for ${weekLabel}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await endLog(false, message);
    throw error;
  }
};
