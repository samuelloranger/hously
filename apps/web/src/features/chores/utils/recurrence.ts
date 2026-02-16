interface RecurrenceData {
  recurrence_type?: 'daily_interval' | 'weekly' | null;
  recurrence_interval_days?: number | null;
  recurrence_weekday?: number | null;
}

/**
 * Formats recurrence information into a human-readable string
 * @param recurrence - Object containing recurrence type and interval/weekday information
 * @param t - Translation function from react-i18next (useTranslation hook)
 * @returns Formatted recurrence string (e.g., "Every day", "Every 2 days", "Every Monday")
 */
export function formatRecurrenceText(
  recurrence: RecurrenceData,
  t: (key: string, options?: { count?: number; weekday?: string }) => string
): string {
  if (!recurrence.recurrence_type) {
    return '';
  }

  if (recurrence.recurrence_type === 'daily_interval') {
    if (recurrence.recurrence_interval_days === 1) {
      return t('chores.everyDay');
    }
    return t('chores.everyXDays', {
      count: recurrence.recurrence_interval_days as number,
    });
  }

  // Weekly recurrence
  const weekdayNames = [
    t('chores.monday'),
    t('chores.tuesday'),
    t('chores.wednesday'),
    t('chores.thursday'),
    t('chores.friday'),
    t('chores.saturday'),
    t('chores.sunday'),
  ];
  const weekdayName = weekdayNames[recurrence.recurrence_weekday || 0];
  return t('chores.everyWeekday', {
    weekday: weekdayName,
  });
}
