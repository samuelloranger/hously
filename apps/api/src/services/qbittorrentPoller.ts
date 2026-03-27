import { QBITTORRENT_TORRENTS_PAGE_SIZE } from '@hously/shared';
import { getQbittorrentPluginConfig } from './qbittorrent/config';
import { fetchMaindata, resetMaindataState, toNumberOr, toTorrent, toTorrentListItem } from './qbittorrent/client';
import { buildQbittorrentDisabledSnapshot } from './qbittorrent/torrents';

const TORRENTS_SSE_CHANNEL = /^torrents:(\d+)$/;

function getSubscribedTorrentsListChannels(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of subscribers) {
    if (TORRENTS_SSE_CHANNEL.test(s.channel) && !seen.has(s.channel)) {
      seen.add(s.channel);
      out.push(s.channel);
    }
  }
  return out;
}

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

const computeSummary = (torrents: Array<ReturnType<typeof toTorrent> extends infer T ? Exclude<T, null> : never>) => {
  let downloadingCount = 0;
  let stalledCount = 0;
  let seedingCount = 0;
  let pausedCount = 0;
  let completedCount = 0;

  for (const torrent of torrents) {
    const state = torrent.state;
    if (
      state === 'downloading' ||
      state === 'forcedDL' ||
      state === 'metaDL' ||
      state === 'queuedDL' ||
      state === 'checkingDL'
    ) {
      downloadingCount += 1;
    }
    if (state === 'stalledDL' || state === 'stalledUP') stalledCount += 1;
    if (state === 'uploading' || state === 'forcedUP' || state === 'queuedUP' || state === 'stalledUP') {
      seedingCount += 1;
    }
    if (state.startsWith('paused') || state.startsWith('stopped')) pausedCount += 1;
    if (torrent.progress >= 0.999) completedCount += 1;
  }

  return {
    downloading_count: downloadingCount,
    stalled_count: stalledCount,
    seeding_count: seedingCount,
    paused_count: pausedCount,
    completed_count: completedCount,
    total_count: torrents.length,
  };
};

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
      for (const channel of getSubscribedTorrentsListChannels()) {
        const match = channel.match(TORRENTS_SSE_CHANNEL);
        const offset = match ? parseInt(match[1], 10) : 0;
        notifySubscribers(channel, {
          enabled: false,
          connected: false,
          total_count: 0,
          offset,
          limit: QBITTORRENT_TORRENTS_PAGE_SIZE,
          torrents: [],
          download_speed: 0,
          upload_speed: 0,
        });
      }
      schedulePoll(5000);
      return;
    }

    // One maindata request should fan out all live qBittorrent channels.
    // The previous implementation fetched maindata again for the torrents list
    // and each torrent detail channel, which doubled or tripled qBittorrent API
    // pressure while the page was open.
    const { serverState, torrents: torrentMap } = await fetchMaindata(config);
    const rawTorrents = Array.from(torrentMap.values());
    const dashboardTorrents = rawTorrents.map(toTorrent).filter((row): row is NonNullable<typeof row> => Boolean(row));
    const summaryCounts = computeSummary(dashboardTorrents);
    const dashboardSnapshot = {
      enabled: true,
      connected: true,
      updated_at: new Date().toISOString(),
      poll_interval_seconds: config.poll_interval_seconds,
      summary: {
        ...summaryCounts,
        download_speed: Math.max(0, Math.trunc(toNumberOr(serverState.dl_info_speed, 0))),
        upload_speed: Math.max(0, Math.trunc(toNumberOr(serverState.up_info_speed, 0))),
        downloaded_bytes: Math.max(0, Math.trunc(toNumberOr(serverState.dl_info_data, 0))),
        uploaded_bytes: Math.max(0, Math.trunc(toNumberOr(serverState.up_info_data, 0))),
      },
      torrents: [...dashboardTorrents]
        .sort((a, b) => {
          const aScore = a.download_speed * 2 + a.upload_speed;
          const bScore = b.download_speed * 2 + b.upload_speed;
          return bScore - aScore;
        })
        .slice(0, config.max_items),
    };

    // Notify dashboard subscribers
    const hasDashboard = subscribers.some(s => s.channel === 'dashboard');
    if (hasDashboard) {
      notifySubscribers('dashboard', dashboardSnapshot);
    }

    // Notify torrents list subscribers (paginated SSE: one channel per offset)
    const torrentsListChannels = getSubscribedTorrentsListChannels();
    if (torrentsListChannels.length > 0) {
      const sortedList = rawTorrents
        .map(toTorrentListItem)
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => {
          const aAdded = a.added_on ? Date.parse(a.added_on) : 0;
          const bAdded = b.added_on ? Date.parse(b.added_on) : 0;
          return bAdded - aAdded;
        });
      const total_count = sortedList.length;
      const download_speed = Math.max(0, Math.trunc(toNumberOr(serverState.dl_info_speed, 0)));
      const upload_speed = Math.max(0, Math.trunc(toNumberOr(serverState.up_info_speed, 0)));

      for (const channel of torrentsListChannels) {
        const match = channel.match(TORRENTS_SSE_CHANNEL);
        const offset = match ? parseInt(match[1], 10) : 0;
        const torrents = sortedList.slice(offset, offset + QBITTORRENT_TORRENTS_PAGE_SIZE);
        notifySubscribers(channel, {
          enabled: true,
          connected: true,
          total_count,
          offset,
          limit: QBITTORRENT_TORRENTS_PAGE_SIZE,
          torrents,
          download_speed,
          upload_speed,
        });
      }
    }

    // Notify individual torrent subscribers
    const torrentChannels = new Set(subscribers.filter(s => s.channel.startsWith('torrent:')).map(s => s.channel));
    for (const channel of torrentChannels) {
      const hash = channel.slice('torrent:'.length);
      const rawTorrent = torrentMap.get(hash);
      const torrentResult = rawTorrent
        ? { enabled: true, connected: true, torrent: toTorrentListItem(rawTorrent) }
        : { enabled: true, connected: true, torrent: null, error: 'Torrent not found' };
      notifySubscribers(channel, torrentResult);
    }

    // Adaptive interval: poll fast when transfers are active, slow when idle.
    const configuredMs = Math.max(1000, config.poll_interval_seconds * 1000);
    const hasActiveTransfers =
      dashboardSnapshot.summary.download_speed > 0 ||
      dashboardSnapshot.summary.upload_speed > 0 ||
      dashboardSnapshot.summary.downloading_count > 0;
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
