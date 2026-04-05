import type { Chore } from "@prisma/client";
import { prisma } from "@hously/api/db";
import { nowUtc } from "@hously/api/utils";
import {
  computeNextRecurrenceDate,
  type ChoreRecurrenceType,
} from "@hously/shared";

export async function createNextChoreOccurrence(
  chore: Chore,
  completedAt: Date,
): Promise<Chore | null> {
  const nextDate = computeNextRecurrenceDate(
    {
      ...chore,
      recurrenceType: chore.recurrenceType as ChoreRecurrenceType | null,
    },
    completedAt,
  );
  if (!nextDate) return null;

  const maxPositionResult = await prisma.chore.aggregate({
    _max: { position: true },
    where: { OR: [{ completed: false }, { completed: null }] },
  });

  const newPosition = (maxPositionResult._max.position ?? -1) + 1;

  return prisma.chore.create({
    data: {
      choreName: chore.choreName,
      description: chore.description,
      assignedTo: chore.assignedTo,
      addedBy: chore.addedBy,
      reminderEnabled: chore.reminderEnabled,
      imagePath: chore.imagePath,
      position: newPosition,
      recurrenceType: chore.recurrenceType,
      recurrenceIntervalDays: chore.recurrenceIntervalDays,
      recurrenceWeekday: chore.recurrenceWeekday,
      recurrenceOriginalCreatedAt: chore.recurrenceOriginalCreatedAt,
      recurrenceParentId: chore.id,
      completed: false,
      createdAt: nowUtc(),
    },
  });
}

export async function removeChoreRecurrence(choreId: number): Promise<void> {
  await prisma.chore.update({
    where: { id: choreId },
    data: {
      recurrenceType: null,
      recurrenceIntervalDays: null,
      recurrenceWeekday: null,
    },
  });
}
