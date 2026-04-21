import type {
  NotificationChannel,
  NotificationChannelType,
  NtfyChannelConfig,
} from "@hously/shared";

export interface DispatchPayload {
  title: string;
  body: string;
  url?: string;
}

export async function dispatchNtfy(
  config: NtfyChannelConfig,
  { title, body, url }: DispatchPayload,
): Promise<void> {
  const headers: Record<string, string> = {
    Title: title,
    Priority: String(config.priority ?? 3),
    "Content-Type": "text/plain",
  };
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  if (url) headers["Click"] = url;

  const res = await fetch(`${config.url}/${config.topic}`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}: ${await res.text()}`);
}

// Orchestrator: routes a channel to its provider-specific dispatcher.
// To add a new provider: add a `case` here that calls the new dispatcher.
// The `never` assignment in the default branch makes TypeScript complain
// when a new NotificationChannelType member is added without a case.
export async function dispatchToChannel(
  channel: NotificationChannel,
  payload: DispatchPayload,
): Promise<void> {
  const type: NotificationChannelType = channel.type;
  switch (type) {
    case "ntfy":
      return dispatchNtfy(channel.config as NtfyChannelConfig, payload);
    default: {
      const _exhaustive: never = type;
      throw new Error(
        `Unknown notification channel type: ${(_exhaustive as string) ?? channel.type}`,
      );
    }
  }
}
