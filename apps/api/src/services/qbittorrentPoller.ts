// TODO: Adaptive poll interval — poll every 1s when active transfers exist,
// increase to 5-10s when everything is seeding/paused/idle.

import {
  buildQbittorrentDisabledSnapshot,
  fetchMaindata,
  fetchQbittorrentSnapshot,
  fetchQbittorrentTorrents,
  fetchQbittorrentTorrent,
  getQbittorrentPluginConfig,
  resetMaindataState,
  type QbittorrentDashboardSnapshot,
  type QbittorrentTorrentListItem,
} from './qbittorrentService';

type DashboardData = QbittorrentDashboardSnapshot;
type TorrentsData = { enabled: boolean; connected: boolean; torrents: QbittorrentTorrentListItem[]; error?: string };
type TorrentData = {
  enabled: boolean;
  connected: boolean;
  torrent: QbittorrentTorrentListItem | null;
  error?: string;
};

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

    // Single maindata fetch powers all channels
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

    const intervalMs = Math.max(1000, config.poll_interval_seconds * 1000);
    schedulePoll(intervalMs);
  } catch (error) {
    console.error('qBittorrent poller error:', error);
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
