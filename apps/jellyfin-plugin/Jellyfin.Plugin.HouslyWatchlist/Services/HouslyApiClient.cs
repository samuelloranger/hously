using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.HouslyWatchlist.Services;

public record WatchlistItem(
    [property: JsonPropertyName("tmdb_id")] int TmdbId,
    [property: JsonPropertyName("media_type")] string MediaType,
    [property: JsonPropertyName("title")] string Title);

public record WatchlistResponse(
    [property: JsonPropertyName("items")] List<WatchlistItem> Items);

public class HouslyApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _httpClient;
    private readonly ILogger<HouslyApiClient> _logger;

    public HouslyApiClient(HttpClient httpClient, ILogger<HouslyApiClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<List<WatchlistItem>> GetWatchlistAsync(
        string jellyfinUserId,
        CancellationToken cancellationToken = default)
    {
        var config = Plugin.Instance?.Configuration;
        if (string.IsNullOrWhiteSpace(config?.HouslyBaseUrl))
        {
            return [];
        }

        var url = JoinUrl(config.HouslyBaseUrl, $"/api/sync/jellyfin/watchlist/{Uri.EscapeDataString(jellyfinUserId)}");
        using var request = BuildRequest(HttpMethod.Get, url);
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(10));

        using var response = await _httpClient.SendAsync(request, cts.Token).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            return [];
        }

        var result = await response.Content
            .ReadFromJsonAsync<WatchlistResponse>(JsonOptions, cts.Token)
            .ConfigureAwait(false);

        return result?.Items ?? [];
    }

    public async Task RemoveWatchlistItemAsync(
        string jellyfinUserId,
        int tmdbId,
        string mediaType,
        CancellationToken cancellationToken = default)
    {
        var config = Plugin.Instance?.Configuration;
        if (string.IsNullOrWhiteSpace(config?.HouslyBaseUrl))
        {
            return;
        }

        var path = $"/api/sync/jellyfin/watchlist/{Uri.EscapeDataString(jellyfinUserId)}/item/{tmdbId}?type={Uri.EscapeDataString(mediaType)}";
        using var request = BuildRequest(HttpMethod.Delete, JoinUrl(config.HouslyBaseUrl, path));
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(10));

        using var response = await _httpClient.SendAsync(request, cts.Token).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode && response.StatusCode != System.Net.HttpStatusCode.NotFound)
        {
            _logger.LogWarning(
                "[HouslyWatchlist] RemoveWatchlistItem returned {StatusCode} for tmdb:{TmdbId}",
                (int)response.StatusCode,
                tmdbId);
        }
    }

    private static HttpRequestMessage BuildRequest(HttpMethod method, string url)
    {
        var request = new HttpRequestMessage(method, url);
        var token = Plugin.Instance?.Configuration.AdminToken;
        if (!string.IsNullOrWhiteSpace(token))
        {
            request.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        return request;
    }

    private static string JoinUrl(string baseUrl, string path)
    {
        return $"{baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
    }
}
