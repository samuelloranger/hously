import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { TrackerPluginConfig } from '../utils/plugins/types';

const mockFetch = mock(async (_url: string, _opts?: RequestInit) => {
  return new Response('', { status: 200 });
});

const baseConfig: TrackerPluginConfig = {
  tracker_url: 'https://tracker.example.com',
  username: 'testuser',
  password: 'testpass',
};

describe('scrapeTorr9', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mock.restore();
  });

  it('throws when solution is missing', async () => {
    const { scrapeTorr9 } = await import('../services/trackers/httpTorr9');
    await expect(scrapeTorr9(baseConfig, undefined)).rejects.toThrow(
      'Torr9 scraper requires FlareSolverr solution'
    );
  });

  it('throws when login fails', async () => {
    mockFetch.mockImplementationOnce(async () => new Response('Unauthorized', { status: 401 }));

    const { scrapeTorr9 } = await import('../services/trackers/httpTorr9');
    await expect(
      scrapeTorr9(baseConfig, { userAgent: 'Mozilla/5.0', cookies: [] })
    ).rejects.toThrow('Torr9 API login failed: 401');
  });

  it('throws when login response is missing token or user', async () => {
    mockFetch.mockImplementationOnce(async () =>
      new Response(JSON.stringify({ token: null, user: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { scrapeTorr9 } = await import('../services/trackers/httpTorr9');
    await expect(
      scrapeTorr9(baseConfig, { userAgent: 'Mozilla/5.0', cookies: [] })
    ).rejects.toThrow('Torr9 API login response missing token or user data');
  });

  it('returns parsed stats from login response', async () => {
    const uploaded = 500_000_000_000;
    const downloaded = 250_000_000_000;

    mockFetch.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify({
          token: 'jwt-token',
          user: { total_uploaded_bytes: uploaded, total_downloaded_bytes: downloaded },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { scrapeTorr9 } = await import('../services/trackers/httpTorr9');
    const stats = await scrapeTorr9(baseConfig, { userAgent: 'Mozilla/5.0', cookies: [] });

    expect(stats.uploadedGo).toBeCloseTo(500, 1);
    expect(stats.downloadedGo).toBeCloseTo(250, 1);
    expect(stats.ratio).toBe(2);
  });

  it('returns null ratio when downloaded is zero', async () => {
    mockFetch.mockImplementationOnce(async () =>
      new Response(
        JSON.stringify({
          token: 'jwt-token',
          user: { total_uploaded_bytes: 1_000_000_000, total_downloaded_bytes: 0 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const { scrapeTorr9 } = await import('../services/trackers/httpTorr9');
    const stats = await scrapeTorr9(baseConfig, { userAgent: 'Mozilla/5.0', cookies: [] });

    expect(stats.ratio).toBeNull();
  });
});

describe('scrapeLaCale', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    mock.restore();
  });

  it('throws when login fails', async () => {
    mockFetch.mockImplementationOnce(async () => new Response('Forbidden', { status: 403 }));

    const { scrapeLaCale } = await import('../services/trackers/httpLaCale');
    await expect(scrapeLaCale(baseConfig)).rejects.toThrow('LaCale API login failed: 403');
  });

  it('throws when /me request fails', async () => {
    mockFetch
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=abc; Path=/' },
        })
      )
      .mockImplementationOnce(async () => new Response('Server Error', { status: 500 }));

    const { scrapeLaCale } = await import('../services/trackers/httpLaCale');
    await expect(scrapeLaCale(baseConfig)).rejects.toThrow('LaCale API me failed: 500');
  });

  it('returns parsed stats from /me response', async () => {
    const meData = {
      uploaded: 100_000_000_000,
      downloaded: 50_000_000_000,
      ratio: 2.0,
      email: 'user@example.com',
      username: 'testuser',
      id: '123',
      avatar: null,
      bio: null,
      bonusPoints: 0,
      countExpressed: '0',
      forceChangeUsername: false,
      newYearGiftClaimed: false,
      passkey: 'abc',
      permissions: [],
      role: 'user',
      seedingCount: 5,
      showSensitiveContent: false,
      uploadStats: { approved: 0, pending: 0 },
    };

    mockFetch
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=abc; Path=/' },
        })
      )
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify(meData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const { scrapeLaCale } = await import('../services/trackers/httpLaCale');
    const stats = await scrapeLaCale(baseConfig);

    expect(stats.uploadedGo).toBeCloseTo(100, 1);
    expect(stats.downloadedGo).toBeCloseTo(50, 1);
    expect(stats.ratio).toBe(2);
  });

  it('returns null ratio when downloaded is zero', async () => {
    const meData = {
      uploaded: 1_000_000_000,
      downloaded: 0,
      ratio: 0,
      email: 'user@example.com',
      username: 'testuser',
      id: '123',
      avatar: null,
      bio: null,
      bonusPoints: 0,
      countExpressed: '0',
      forceChangeUsername: false,
      newYearGiftClaimed: false,
      passkey: 'abc',
      permissions: [],
      role: 'user',
      seedingCount: 0,
      showSensitiveContent: false,
      uploadStats: { approved: 0, pending: 0 },
    };

    mockFetch
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'session=abc; Path=/' },
        })
      )
      .mockImplementationOnce(async () =>
        new Response(JSON.stringify(meData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const { scrapeLaCale } = await import('../services/trackers/httpLaCale');
    const stats = await scrapeLaCale(baseConfig);

    expect(stats.ratio).toBeNull();
  });
});
