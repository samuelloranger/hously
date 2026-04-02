import { useTranslation } from 'react-i18next';
import { formatRecurrenceText } from '@/pages/chores/_component/utils/recurrence';

interface RecurrenceBadgeProps {
  recurrence_type?: 'daily_interval' | 'weekly' | null;
  recurrence_interval_days?: number | null;
  recurrence_weekday?: number | null;
  className?: string;
}

/**
 * Reusable badge component for displaying recurrence information
 * @param recurrence_type - Type of recurrence (daily_interval or weekly)
 * @param recurrence_interval_days - Number of days for daily_interval type
 * @param recurrence_weekday - Weekday (0-6) for weekly type
 * @param className - Optional additional CSS classes
 */
export function RecurrenceBadge({
  recurrence_type,
  recurrence_interval_days,
  recurrence_weekday,
  className = '',
}: RecurrenceBadgeProps) {
  const { t } = useTranslation('common');

  if (!recurrence_type) {
    return null;
  }

  return (
    <span
      className={`px-2 py-0.5 text-xs font-semibold rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ${className}`}
    >
      🔁 {formatRecurrenceText({ recurrence_type, recurrence_interval_days, recurrence_weekday }, t)}
    </span>
  );
}
