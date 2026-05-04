using Jellyfin.Data.Enums;
using MediaBrowser.Controller.Collections;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Jellyfin.Data.Entities;

namespace Jellyfin.Plugin.HouslyWatchlist.Services;

public class WatchlistSyncService : IHostedService, IDisposable
{
    private const string CollectionPrefix = "What's Next";

    private readonly ILibraryManager _libraryManager;
    private readonly ICollectionManager _collectionManager;
    private readonly IUserDataManager _userDataManager;
    private readonly IUserManager _userManager;
    private readonly HouslyApiClient _apiClient;
    private readonly ILogger<WatchlistSyncService> _logger;
    private Timer? _timer;

    public WatchlistSyncService(
        ILibraryManager libraryManager,
        ICollectionManager collectionManager,
        IUserDataManager userDataManager,
        IUserManager userManager,
        HouslyApiClient apiClient,
        ILogger<WatchlistSyncService> logger)
    {
        _libraryManager = libraryManager;
        _collectionManager = collectionManager;
        _userDataManager = userDataManager;
        _userManager = userManager;
        _apiClient = apiClient;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _userDataManager.UserDataSaved += OnUserDataSaved;

        var interval = Math.Max(5, Plugin.Instance?.Configuration.SyncIntervalMinutes ?? 15);
        _timer = new Timer(
            _ => Task.Run(async () =>
            {
                try
                {
                    await SyncAllUsersAsync(CancellationToken.None).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "[HouslyWatchlist] Timer-triggered sync failed");
                }
            }),
            null,
            TimeSpan.FromMinutes(1),
            TimeSpan.FromMinutes(interval));

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _userDataManager.UserDataSaved -= OnUserDataSaved;
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    public async Task SyncAllUsersAsync(CancellationToken cancellationToken)
    {
        foreach (var user in _userManager.Users)
        {
            await SyncUserAsync(user.Id.ToString("D"), cancellationToken).ConfigureAwait(false);
        }
    }

    public async Task SyncUserAsync(string jellyfinUserId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(jellyfinUserId))
        {
            return;
        }

        try
        {
            var watchlistItems = await _apiClient.GetWatchlistAsync(jellyfinUserId, cancellationToken)
                .ConfigureAwait(false);

            var matchedItemIds = new List<Guid>();
            foreach (var watchlistItem in watchlistItems)
            {
                var matched = FindLibraryItem(watchlistItem);
                if (matched is not null)
                {
                    matchedItemIds.Add(matched.Id);
                }
            }

            await UpsertCollectionAsync(jellyfinUserId, matchedItemIds, cancellationToken)
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[HouslyWatchlist] Sync failed for Jellyfin user {UserId}", jellyfinUserId);
        }
    }

    public async Task RemoveItemFromCollectionAsync(
        string jellyfinUserId,
        int tmdbId,
        string mediaType,
        CancellationToken cancellationToken)
    {
        try
        {
            var collectionName = $"{CollectionPrefix} - {jellyfinUserId}";
            var collection = _libraryManager.GetItemList(new InternalItemsQuery
            {
                IncludeItemTypes = [BaseItemKind.BoxSet],
                Name = collectionName,
            }).OfType<BoxSet>().FirstOrDefault();

            if (collection is null)
            {
                return;
            }

            var item = FindLibraryItem(new WatchlistItem(tmdbId, mediaType, string.Empty));
            if (item is null)
            {
                return;
            }

            await _collectionManager.RemoveFromCollectionAsync(collection.Id, [item.Id])
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "[HouslyWatchlist] Failed to remove item {TmdbId} from collection for user {UserId}",
                tmdbId,
                jellyfinUserId);
        }
    }

    private BaseItem? FindLibraryItem(WatchlistItem watchlistItem)
    {
        var itemKind = string.Equals(watchlistItem.MediaType, "movie", StringComparison.OrdinalIgnoreCase)
            ? BaseItemKind.Movie
            : BaseItemKind.Series;

        var results = _libraryManager.GetItemList(new InternalItemsQuery
        {
            IncludeItemTypes = [itemKind],
            IsVirtualItem = false,
            HasAnyProviderId = new Dictionary<string, string>
            {
                { MetadataProvider.Tmdb.ToString(), watchlistItem.TmdbId.ToString() },
            },
        });

        return results.FirstOrDefault();
    }

    private async Task UpsertCollectionAsync(
        string jellyfinUserId,
        IReadOnlyCollection<Guid> itemIds,
        CancellationToken cancellationToken)
    {
        var collectionName = $"{CollectionPrefix} - {jellyfinUserId}";
        var existing = _libraryManager.GetItemList(new InternalItemsQuery
        {
            IncludeItemTypes = [BaseItemKind.BoxSet],
            Name = collectionName,
        }).OfType<BoxSet>().FirstOrDefault();

        if (existing is null)
        {
            if (itemIds.Count == 0)
            {
                return;
            }

            await _collectionManager.CreateCollectionAsync(new CollectionCreationOptions
            {
                Name = collectionName,
                ItemIdList = itemIds.Select(id => id.ToString()).ToArray(),
                IsLocked = false,
            }).ConfigureAwait(false);
            return;
        }

        var currentIds = existing.GetLinkedChildren().Select(item => item.Id).ToHashSet();
        var targetIds = itemIds.ToHashSet();

        var toRemove = currentIds.Except(targetIds).ToList();
        var toAdd = targetIds.Except(currentIds).ToList();

        if (toRemove.Count > 0)
        {
            await _collectionManager.RemoveFromCollectionAsync(existing.Id, toRemove)
                .ConfigureAwait(false);
        }

        if (toAdd.Count > 0)
        {
            await _collectionManager.AddToCollectionAsync(existing.Id, toAdd)
                .ConfigureAwait(false);
        }
    }

    private async void OnUserDataSaved(object? sender, UserDataSaveEventArgs e)
    {
        if (!e.UserData.Played)
        {
            return;
        }

        if (e.Item is not (Movie or Series))
        {
            return;
        }

        if (!e.Item.ProviderIds.TryGetValue(MetadataProvider.Tmdb.ToString(), out var tmdbIdValue)
            || !int.TryParse(tmdbIdValue, out var tmdbId))
        {
            return;
        }

        var jellyfinUserId = e.UserId.ToString("D");
        var mediaType = e.Item is Movie ? "movie" : "tv";

        try
        {
            await _apiClient.RemoveWatchlistItemAsync(jellyfinUserId, tmdbId, mediaType)
                .ConfigureAwait(false);
            await SyncUserAsync(jellyfinUserId, CancellationToken.None).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[HouslyWatchlist] Failed to remove watched item {TmdbId}", tmdbId);
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        GC.SuppressFinalize(this);
    }
}
