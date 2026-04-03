export type RecurrenceType = 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_TYPE_VALUES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

const RECURRENCE_TYPE_VALUES: Exclude<RecurrenceType, null>[] = [
  'yearly',
  'monthly',
  'weekly',
  'biweekly',
  'daily_interval',
];
