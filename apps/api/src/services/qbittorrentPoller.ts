import { getQbittorrentPluginConfig } from './qbittorrent/config';
import { resetMaindataState } from './qbittorrent/client';
import {
  buildQbittorrentDisabledSnapshot,
  fetchQbittorrentSnapshot,
  fetchQbittorrentTorrents,
  fetchQbittorrentTorrent,
} from './qbittorrent/torrents';

type ChannelCallback<T = unknown> = (data: T) => void;

interface Subscriber {
  channel: string;
  callback: ChannelCallback<any>;
}

let subscribers: Subscriber[] = [];
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;

// Last payloads for change detection (keyed by channel)
const lastPayloads = new Map<string, string>();

const notifySubscribers = <T>(channel: string, data: T) => {
  const payload = JSON.stringify(data);
  if (lastPayloads.get(channel) === payload) return;
  lastPayloads.set(channel, payload);

  for (const sub of subscribers) {
    if (sub.channel === channel) {
      try {
        sub.callback(data);
      } catch {
        // Ignore individual subscriber errors
      }
    }
  }
};

const pollOnce = async () => {
  if (!running) return;

  try {
    const { enabled, config } = await getQbittorrentPluginConfig();

    if (!enabled || !config) {
      // Notify dashboard subscribers with disabled snapshot
      const dashboardChannels = new Set(subscribers.filter(s => s.channel === 'dashboard').map(s => s.channel));
      if (dashboardChannels.size > 0) {
        notifySubscribers('dashboard', {
          ...buildQbittorrentDisabledSnapshot(),
          updated_at: new Date().toISOString(),
        });
      }
      schedulePoll(5000);
      return;
    }

    // Single maindata fetch powers all channels.
    // fetchQbittorrentSnapshot and fetchQbittorrentTorrents both use fetchMaindata internally,
    // and since maindata state is module-level, the second call gets the cached delta result.
    const dashboardSnapshot = await fetchQbittorrentSnapshot(config, true);

    // Notify dashboard subscribers
    const hasDashboard = subscribers.some(s => s.channel === 'dashboard');
    if (hasDashboard) {
      notifySubscribers('dashboard', {
        ...dashboardSnapshot,
        updated_at: new Date().toISOString(),
      });
    }

    // Notify torrents subscribers
    const hasTorrents = subscribers.some(s => s.channel === 'torrents');
    if (hasTorrents) {
      const torrentsResult = await fetchQbittorrentTorrents(config, true, {
        sort: 'added_on',
        reverse: true,
        limit: 250,
      });
      notifySubscribers('torrents', torrentsResult);
    }

    // Notify individual torrent subscribers
    const torrentChannels = new Set(subscribers.filter(s => s.channel.startsWith('torrent:')).map(s => s.channel));
    for (const channel of torrentChannels) {
      const hash = channel.slice('torrent:'.length);
      const torrentResult = await fetchQbittorrentTorrent(config, true, hash);
      notifySubscribers(channel, torrentResult);
    }

    // Adaptive interval: poll fast when transfers are active, slow when idle.
    const configuredMs = Math.max(1000, config.poll_interval_seconds * 1000);
    const hasActiveTransfers =
      dashboardSnapshot.connected &&
      (dashboardSnapshot.summary.download_speed > 0 ||
        dashboardSnapshot.summary.upload_speed > 0 ||
        dashboardSnapshot.summary.downloading_count > 0);
    const intervalMs = hasActiveTransfers ? configuredMs : Math.min(30000, Math.max(10000, configuredMs * 10));
    schedulePoll(intervalMs);
  } catch (error) {
    console.error('qBittorrent poller error:', error);
    // Reset delta state so the next successful poll starts from a clean full sync.
    resetMaindataState();
    schedulePoll(3000);
  }
};

const schedulePoll = (ms: number) => {
  if (!running) return;
  pollTimer = setTimeout(() => {
    void pollOnce();
  }, ms);
};

const startPoller = () => {
  if (running) return;
  running = true;
  lastPayloads.clear();
  void pollOnce();
};

const stopPoller = () => {
  running = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  lastPayloads.clear();
  resetMaindataState();
};

export const subscribe = <T = unknown>(channel: string, callback: ChannelCallback<T>): (() => void) => {
  const sub: Subscriber = { channel, callback: callback as ChannelCallback<any> };
  subscribers.push(sub);

  if (subscribers.length === 1) {
    startPoller();
  }

  return () => {
    subscribers = subscribers.filter(s => s !== sub);
    if (subscribers.length === 0) {
      stopPoller();
    }
  };
};

export const createPollerSseResponse = (request: Request, channel: string): Response => {
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;

      const closeStream = () => {
        if (closed) return;
        closed = true;
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream may already be closed
        }
      };

      const writeChunk = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closeStream();
        }
      };

      const scheduleHeartbeat = () => {
        if (closed) return;
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout);
        heartbeatTimeout = setTimeout(() => {
          writeChunk(': ping\n\n');
          scheduleHeartbeat();
        }, 15000);
      };

      const unsubscribe = subscribe(channel, (data: unknown) => {
        if (closed) return;
        const payload = JSON.stringify(data);
        writeChunk(`data: ${payload}\n\n`);
        scheduleHeartbeat(); // Reset heartbeat on data push
      });

      // Push the last known payload immediately so the client gets data right
      // away without waiting for the next poll cycle.
      const cachedPayload = lastPayloads.get(channel);
      if (cachedPayload) {
        writeChunk(`data: ${cachedPayload}\n\n`);
      }

      signal.addEventListener('abort', closeStream);

      writeChunk('retry: 3000\n\n');
      scheduleHeartbeat();
    },
    cancel() {
      // No-op: cleanup handled by abort listener
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
};
