import type { Chore, Reminder } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { formatIso } from "@hously/api/utils";

export type ChoreUser = { firstName: string | null; email: string } | null;

export const mapChore = (
  chore: Chore,
  activeReminder?: Pick<Reminder, "reminderDatetime" | "active"> | null,
  addedByUser?: ChoreUser,
  assignedToUser?: ChoreUser,
  completedByUser?: ChoreUser,
) => ({
  id: chore.id,
  position: chore.position,
  chore_name: chore.choreName,
  description: chore.description,
  assigned_to: chore.assignedTo,
  completed: chore.completed,
  added_by: chore.addedBy,
  completed_by: chore.completedBy,
  reminder_enabled: chore.reminderEnabled,
  image_path: chore.imagePath,
  created_at: formatIso(chore.createdAt),
  completed_at: formatIso(chore.completedAt),
  added_by_username: addedByUser?.firstName || addedByUser?.email || null,
  assigned_to_username:
    assignedToUser?.firstName || assignedToUser?.email || null,
  completed_by_username:
    completedByUser?.firstName || completedByUser?.email || null,
  reminder_datetime: activeReminder
    ? formatIso(activeReminder.reminderDatetime)
    : null,
  reminder_active: activeReminder?.active || false,
  recurrence_type: chore.recurrenceType,
  recurrence_interval_days: chore.recurrenceIntervalDays,
  recurrence_weekday: chore.recurrenceWeekday,
  recurrence_original_created_at: formatIso(chore.recurrenceOriginalCreatedAt),
  recurrence_parent_id: chore.recurrenceParentId,
});

export const deactivateRemindersForChore = async (choreId: number) => {
  await prisma.reminder.updateMany({
    where: { choreId },
    data: { active: false },
  });
};

export type RecurrenceInput = {
  recurrence_type?: string | null;
  recurrence_interval_days?: number | null;
  recurrence_weekday?: number | null;
};

export type ValidatedRecurrence = {
  recurrenceType: string | null;
  recurrenceIntervalDays: number | null;
  recurrenceWeekday: number | null;
};

export const validateRecurrenceFields = (
  input: RecurrenceInput,
  set: { status?: number | string },
  badRequest: (
    set: { status?: number | string },
    message: string,
  ) => { error: string },
):
  | { ok: true; value: ValidatedRecurrence }
  | { ok: false; response: { error: string } } => {
  if (!input.recurrence_type) {
    return {
      ok: true,
      value: {
        recurrenceType: null,
        recurrenceIntervalDays: null,
        recurrenceWeekday: null,
      },
    };
  }

  if (!["daily_interval", "weekly"].includes(input.recurrence_type)) {
    return {
      ok: false,
      response: badRequest(
        set,
        'Invalid recurrence_type. Must be "daily_interval" or "weekly"',
      ),
    };
  }

  if (input.recurrence_type === "daily_interval") {
    if (
      !input.recurrence_interval_days ||
      input.recurrence_interval_days <= 0
    ) {
      return {
        ok: false,
        response: badRequest(
          set,
          "recurrence_interval_days must be positive for daily_interval type",
        ),
      };
    }
    return {
      ok: true,
      value: {
        recurrenceType: input.recurrence_type,
        recurrenceIntervalDays: input.recurrence_interval_days,
        recurrenceWeekday: null,
      },
    };
  }

  if (
    input.recurrence_weekday === null ||
    input.recurrence_weekday === undefined ||
    input.recurrence_weekday < 0 ||
    input.recurrence_weekday > 6
  ) {
    return {
      ok: false,
      response: badRequest(
        set,
        "recurrence_weekday must be between 0 (Monday) and 6 (Sunday)",
      ),
    };
  }

  return {
    ok: true,
    value: {
      recurrenceType: input.recurrence_type,
      recurrenceIntervalDays: null,
      recurrenceWeekday: input.recurrence_weekday,
    },
  };
};

export const resolveAssignedTo = async (
  assigned_to: string | number | null | undefined,
  set: { status?: number | string },
  badRequest: (
    set: { status?: number | string },
    message: string,
  ) => { error: string },
): Promise<
  | { ok: true; value: string | null }
  | { ok: false; response: { error: string } }
> => {
  if (assigned_to === undefined || assigned_to === null || assigned_to === "") {
    return { ok: true, value: null };
  }

  const parsedAssignedTo = String(assigned_to);
  const assignedUser = await prisma.user.findFirst({
    where: { id: parsedAssignedTo },
  });
  if (!assignedUser) {
    return {
      ok: false,
      response: badRequest(set, "Assigned user does not exist"),
    };
  }
  return { ok: true, value: parsedAssignedTo };
};
