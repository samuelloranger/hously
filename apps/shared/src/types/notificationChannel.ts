// Provider key. Add new members when implementing a new provider.
export type NotificationChannelType = "ntfy";

export interface NtfyChannelConfig {
  url: string;
  topic: string;
  token?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
}

// Discriminated union of all supported provider configs. When adding a new
// provider, add its *ChannelConfig interface to this union.
export type NotificationChannelConfig = NtfyChannelConfig;

export interface NotificationChannel {
  id: number;
  type: NotificationChannelType;
  label: string;
  config: NotificationChannelConfig;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationChannelsResponse {
  channels: NotificationChannel[];
}
