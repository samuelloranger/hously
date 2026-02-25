export interface CustomEvent {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  color: string;
  recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
  recurrence_interval_days?: number | null;
  recurrence_original_created_at?: string | null;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number | null;
  created_at: string;
}

export interface CalendarEventBase {
  id: string;
  date: string;
  title: string;
  description: string | null;
}

export interface CalendarEventChoreMetadata {
  type: 'chore';
  metadata: {
    chore_id?: number;
    reminder_datetime?: string;
    reminder_enabled?: boolean;
    reminder_minutes_before?: number | null;
    recurrence_type?: 'daily_interval' | 'weekly' | null;
    recurrence_interval_days?: number | null;
    recurrence_weekday?: number | null;
    assigned_to?: number | null;
  };
}

export interface CalendarEventCustomEventMetadata {
  type: 'custom_event';
  metadata: {
    custom_event_id?: number;
    type?: 'custom_event';
    start_datetime?: string;
    end_datetime?: string;
    all_day?: boolean;
    color?: string;
    recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
    recurrence_interval_days?: number | null;
    reminder_enabled?: boolean;
    reminder_minutes_before?: number | null;
  };
}

export interface CalendarEventMealPlanMetadata {
  type: 'meal_plan';
  metadata: Record<string, unknown>;
}

export type CalendarEvent = CalendarEventBase &
  (CalendarEventChoreMetadata | CalendarEventCustomEventMetadata | CalendarEventMealPlanMetadata);

export function isCustomEvent(event: CalendarEvent): event is CalendarEventBase & CalendarEventCustomEventMetadata {
  return event.type === 'custom_event';
}

export function isChoreEvent(event: CalendarEvent): event is CalendarEventBase & CalendarEventChoreMetadata {
  return event.type === 'chore';
}

export function isMealPlanEvent(event: CalendarEvent): event is CalendarEventBase & CalendarEventMealPlanMetadata {
  return event.type === 'meal_plan';
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
}

export interface CustomEventsResponse {
  events: CustomEvent[];
}

export interface CreateCustomEventRequest {
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime: string;
  all_day?: boolean;
  color?: string;
  recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
  recurrence_interval_days?: number | null;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number | null;
}

export interface UpdateCustomEventRequest {
  title?: string;
  description?: string | null;
  start_datetime?: string;
  end_datetime?: string;
  all_day?: boolean;
  color?: string;
  recurrence_type?: 'yearly' | 'monthly' | 'weekly' | 'biweekly' | 'daily_interval' | null;
  recurrence_interval_days?: number | null;
  reminder_enabled?: boolean;
  reminder_minutes_before?: number | null;
}

export interface ICalTokenResponse {
  hasToken: boolean;
  url: string | null;
  webcalUrl: string | null;
}

export interface ICalTokenGenerateResponse {
  url: string;
  webcalUrl: string;
}
