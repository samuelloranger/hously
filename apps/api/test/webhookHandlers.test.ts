import { describe, expect, it } from 'bun:test';
import { webhookHandlers } from '../src/services/webhookHandlers';

describe('webhookHandlers.jellyfin', () => {
  it('normalizes the official flat webhook payload shape', () => {
    const result = webhookHandlers.jellyfin({
      NotificationType: 'PlaybackStart',
      Title: 'Severance',
      NotificationUsername: 'sam',
      NotificationUserId: '42',
      ItemId: 'item-1',
      ItemType: 'Episode',
      ServerName: 'Media',
      ServerId: 'server-1',
      PlaybackPosition: '00:10:00',
      Provider_tmdb: '123',
      Provider_imdb: 'tt11280740',
    });

    expect(result.event_type).toBe('PlaybackStart');
    expect(result.template_variables.NotificationType).toBe('PlaybackStart');
    expect(result.template_variables.Title).toBe('Severance');
    expect(result.template_variables.NotificationUsername).toBe('sam');
    expect(result.template_variables.ItemType).toBe('Episode');
    expect(result.template_variables.ServerName).toBe('Media');
    expect(result.template_variables.Provider_tmdb).toBe('123');
    expect(result.template_variables.item_name).toBe('Severance');
    expect(result.template_variables.user_name).toBe('sam');
  });

  it('extracts official variables from the nested Jellyfin payload shape', () => {
    const result = webhookHandlers.jellyfin({
      NotificationType: 'ItemAdded',
      Item: {
        Id: 'item-2',
        Name: 'The Matrix',
        Type: 'Movie',
        Overview: 'Neo learns the truth.',
        ProductionYear: 1999,
        ProviderIds: {
          Tmdb: '603',
          Imdb: 'tt0133093',
        },
        Genres: ['Action', 'Sci-Fi'],
        RunTimeTicks: 81600000000,
      },
      User: {
        Id: '7',
        Name: 'admin',
      },
      Server: {
        Id: 'server-2',
        Name: 'Jellyfin',
      },
    });

    expect(result.event_type).toBe('ItemAdded');
    expect(result.template_variables.Title).toBe('The Matrix');
    expect(result.template_variables.ItemId).toBe('item-2');
    expect(result.template_variables.ItemType).toBe('Movie');
    expect(result.template_variables.NotificationUsername).toBe('admin');
    expect(result.template_variables.ServerName).toBe('Jellyfin');
    expect(result.template_variables.Provider_tmdb).toBe('603');
    expect(result.template_variables.Provider_imdb).toBe('tt0133093');
    expect(result.template_variables.Genres).toBe('Action, Sci-Fi');
    expect(result.template_variables.Runtime).toBe('2:16:00');
    expect(result.template_variables.year).toBe('1999');
  });

  it('maps legacy event aliases to the official Jellyfin notification types', () => {
    const result = webhookHandlers.jellyfin({
      NotificationType: 'UserAdded',
      NotificationUsername: 'new-user',
      ServerName: 'Jellyfin',
    });

    expect(result.event_type).toBe('UserCreated');
    expect(result.template_variables.NotificationType).toBe('UserCreated');
  });
});
