using Jellyfin.Data.Enums;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Collections;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Entities;
using MediaBrowser.Model.Querying;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.HouslyWatchlist.Services;

public class WatchlistSyncService : IHostedService, IDisposable
{
    private const string CollectionName = "What's Next from Hously";

    private readonly ILibraryManager _libraryManager;
    private readonly ICollectionManager _collectionManager;
    private readonly IUserDataManager _userDataManager;
    private readonly IUserManager _userManager;
    private readonly IApplicationPaths _appPaths;
    private readonly HouslyApiClient _apiClient;
    private readonly ILogger<WatchlistSyncService> _logger;
    private Timer? _timer;

    public WatchlistSyncService(
        ILibraryManager libraryManager,
        ICollectionManager collectionManager,
        IUserDataManager userDataManager,
        IUserManager userManager,
        IApplicationPaths appPaths,
        HouslyApiClient apiClient,
        ILogger<WatchlistSyncService> logger)
    {
        _libraryManager = libraryManager;
        _collectionManager = collectionManager;
        _userDataManager = userDataManager;
        _userManager = userManager;
        _appPaths = appPaths;
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

        _logger.LogInformation(
            "[HouslyWatchlist] Started. Sync interval: {Interval} min. First sync in 1 min.",
            interval);

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _userDataManager.UserDataSaved -= OnUserDataSaved;
        _timer?.Change(Timeout.Infinite, 0);
        _logger.LogInformation("[HouslyWatchlist] Stopped.");
        return Task.CompletedTask;
    }

    public async Task SyncAllUsersAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("[HouslyWatchlist] Starting full sync for all users");
        var users = _userManager.Users.ToList();
        var synced = 0;

        foreach (var user in users)
        {
            await SyncUserAsync(user.Id.ToString("N"), cancellationToken).ConfigureAwait(false);
            synced++;
        }

        _logger.LogInformation("[HouslyWatchlist] Full sync complete ({Count} users processed)", synced);
    }

    public async Task SyncUserAsync(string jellyfinUserId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(jellyfinUserId))
        {
            return;
        }

        _logger.LogInformation("[HouslyWatchlist] Syncing user {UserId}", jellyfinUserId);

        try
        {
            var watchlistItems = await _apiClient.GetWatchlistAsync(jellyfinUserId, cancellationToken)
                .ConfigureAwait(false);

            if (watchlistItems.Count == 0)
            {
                _logger.LogInformation(
                    "[HouslyWatchlist] No watchlist items for user {UserId} (unmapped or empty watchlist)",
                    jellyfinUserId);
                return;
            }

            _logger.LogInformation(
                "[HouslyWatchlist] {Count} watchlist items fetched for user {UserId}",
                watchlistItems.Count,
                jellyfinUserId);

            var matchedItemIds = new List<Guid>();
            foreach (var watchlistItem in watchlistItems)
            {
                var matched = FindLibraryItem(watchlistItem);
                if (matched is not null)
                {
                    matchedItemIds.Add(matched.Id);
                }
            }

            _logger.LogInformation(
                "[HouslyWatchlist] {Matched}/{Total} watchlist items found in library for user {UserId}",
                matchedItemIds.Count,
                watchlistItems.Count,
                jellyfinUserId);

            await UpsertCollectionAsync(matchedItemIds, cancellationToken).ConfigureAwait(false);
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
            var collection = _libraryManager.GetItemList(new InternalItemsQuery
            {
                IncludeItemTypes = [BaseItemKind.BoxSet],
                Name = CollectionName,
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

            _logger.LogInformation(
                "[HouslyWatchlist] Removed item tmdb:{TmdbId} from collection (watched by user {UserId})",
                tmdbId,
                jellyfinUserId);
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
        IReadOnlyCollection<Guid> itemIds,
        CancellationToken cancellationToken)
    {
        var existing = _libraryManager.GetItemList(new InternalItemsQuery
        {
            IncludeItemTypes = [BaseItemKind.BoxSet],
            Name = CollectionName,
        }).OfType<BoxSet>().FirstOrDefault();

        if (existing is null)
        {
            if (itemIds.Count == 0)
            {
                return;
            }

            await _collectionManager.CreateCollectionAsync(new CollectionCreationOptions
            {
                Name = CollectionName,
                ItemIdList = itemIds.Select(id => id.ToString()).ToArray(),
                IsLocked = false,
            }).ConfigureAwait(false);

            WriteBannerImages();

            _logger.LogInformation(
                "[HouslyWatchlist] Created collection '{Name}' with {Count} items",
                CollectionName,
                itemIds.Count);
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

        _logger.LogInformation(
            "[HouslyWatchlist] Updated collection '{Name}': +{Added} added, -{Removed} removed, {Total} total",
            CollectionName,
            toAdd.Count,
            toRemove.Count,
            targetIds.Count);
    }

    private void WriteBannerImages()
    {
        try
        {
            var collectionDir = Path.Combine(
                _appPaths.DataPath,
                "collections",
                $"{CollectionName} [boxset]");

            if (!Directory.Exists(collectionDir))
            {
                return;
            }

            var assembly = GetType().Assembly;
            var ns = GetType().Namespace!;

            foreach (var (resource, file) in new[]
            {
                ($"{ns}.Resources.backdrop.png", "backdrop.png"),
                ($"{ns}.Resources.folder.png", "folder.png"),
            })
            {
                using var stream = assembly.GetManifestResourceStream(resource);
                if (stream is null)
                {
                    continue;
                }

                using var fs = File.Create(Path.Combine(collectionDir, file));
                stream.CopyTo(fs);
            }

            _logger.LogInformation("[HouslyWatchlist] Wrote banner images for collection '{Name}'", CollectionName);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[HouslyWatchlist] Failed to write banner images");
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

        var jellyfinUserId = e.UserId.ToString("N");
        var mediaType = e.Item is Movie ? "movie" : "tv";

        _logger.LogInformation(
            "[HouslyWatchlist] Item watched: tmdb:{TmdbId} ({MediaType}) by user {UserId} — removing from watchlist",
            tmdbId,
            mediaType,
            jellyfinUserId);

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
