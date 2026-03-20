export interface WebhookResult {
  event_type: string;
  template_variables: Record<string, string>;
  original_payload: Record<string, unknown>;
  notification_url?: string;
  notification_metadata?: Record<string, unknown>;
}

export type WebhookHandler = (payload: Record<string, unknown>) => WebhookResult | null;
