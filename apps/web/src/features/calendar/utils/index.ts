import { CalendarEvent } from "@/types";
import { TFunction } from "i18next";

/**
 * Split a multi-day event into separate events for each day.
 * For each day:
 * - First day: from start time to 23:59:59
 * - Middle days: from 00:00:00 to 23:59:59
 * - Last day: from 00:00:00 to end time
 */
export function splitMultiDayEvent(event: CalendarEvent): CalendarEvent[] {
  if (
    event.type !== "custom_event" ||
    !event.metadata?.start_datetime ||
    !event.metadata?.end_datetime
  ) {
    return [event];
  }

  const startDate = new Date(event.metadata.start_datetime);
  const endDate = new Date(event.metadata.end_datetime);

  // Check if it's a multi-day event
  const startDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );
  const endDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate()
  );

  if (startDay.getTime() === endDay.getTime()) {
    // Single day event, return as is
    return [event];
  }

  const splitEvents: CalendarEvent[] = [];
  const currentDate = new Date(startDay);
  const lastDate = new Date(endDay);

  while (currentDate <= lastDate) {
    const isFirstDay = currentDate.getTime() === startDay.getTime();
    const isLastDay = currentDate.getTime() === endDay.getTime();

    let dayStart: Date;
    let dayEnd: Date;

    if (isFirstDay && isLastDay) {
      // Single day event (shouldn't happen, but handle it)
      dayStart = startDate;
      dayEnd = endDate;
    } else if (isFirstDay) {
      // First day: from start time to end of day
      dayStart = startDate;
      dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
    } else if (isLastDay) {
      // Last day: from start of day to end time
      dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      dayEnd = endDate;
    } else {
      // Middle days: full day
      dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);
    }

    const dateStr = currentDate.toISOString().split("T")[0];

    splitEvents.push({
      ...event,
      id: `${event.id}-${dateStr}`,
      date: dateStr,
      // Keep original metadata intact for editing
      // The date field determines which day to display the event on
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return splitEvents;
}

export const getMonthName = (t: TFunction, month: number) => {
  return [
    t("calendar.january"),
    t("calendar.february"),
    t("calendar.march"),
    t("calendar.april"),
    t("calendar.may"),
    t("calendar.june"),
    t("calendar.july"),
    t("calendar.august"),
    t("calendar.september"),
    t("calendar.october"),
    t("calendar.november"),
    t("calendar.december"),
  ][month];
};

export const getDayName = (t: TFunction, day: number) => {
  return [
    t("calendar.sunday"),
    t("calendar.monday"),
    t("calendar.tuesday"),
    t("calendar.wednesday"),
    t("calendar.thursday"),
    t("calendar.friday"),
    t("calendar.saturday"),
  ][day];
};