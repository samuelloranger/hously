import { describe, expect, it } from 'bun:test';
import { mapTrackerUrlToTag } from '../services/webhookEnrichment';

describe('mapTrackerUrlToTag', () => {
  it('maps C411 tracker URLs to the c411 tag', () => {
    expect(mapTrackerUrlToTag('https://c411.org/announce/abcdef')?.tag).toBe('c411');
  });

  it('maps Torr9 tracker URLs to the torr9 tag', () => {
    expect(mapTrackerUrlToTag('https://api.torr9.xyz/announce/abcdef')?.tag).toBe('torr9');
  });

  it('maps La Cale tracker URLs to the existing spaced tag', () => {
    expect(mapTrackerUrlToTag('https://tracker.la-cale.example/announce/abcdef')?.tag).toBe('La Cale');
  });

  it('ignores qBittorrent pseudo-trackers like DHT', () => {
    expect(mapTrackerUrlToTag('** [DHT] **')).toBeNull();
  });

  it('returns null for unknown tracker hosts', () => {
    expect(mapTrackerUrlToTag('https://tracker.example.com/announce/abcdef')).toBeNull();
  });
});
