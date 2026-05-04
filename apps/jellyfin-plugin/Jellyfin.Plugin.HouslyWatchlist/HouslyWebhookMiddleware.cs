using System.Text.Json;
using System.Text.Json.Serialization;
using Jellyfin.Plugin.HouslyWatchlist.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace Jellyfin.Plugin.HouslyWatchlist;

public record WebhookPayload(
    [property: JsonPropertyName("jellyfin_user_id")] string? JellyfinUserId,
    [property: JsonPropertyName("tmdb_id")] int? TmdbId,
    [property: JsonPropertyName("media_type")] string? MediaType,
    [property: JsonPropertyName("action")] string? Action);

public class HouslyWebhookMiddleware
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly RequestDelegate _next;
    private readonly ILogger<HouslyWebhookMiddleware> _logger;

    public HouslyWebhookMiddleware(RequestDelegate next, ILogger<HouslyWebhookMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, WatchlistSyncService syncService)
    {
        if (context.Request.Method != HttpMethods.Post
            || !context.Request.Path.StartsWithSegments("/hously/webhook/sync"))
        {
            await _next(context).ConfigureAwait(false);
            return;
        }

        var expectedToken = Plugin.Instance?.Configuration.AdminToken;
        var authHeader = context.Request.Headers.Authorization.ToString();
        if (string.IsNullOrWhiteSpace(expectedToken)
            || !string.Equals(authHeader, $"Bearer {expectedToken}", StringComparison.Ordinal))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        WebhookPayload? payload;
        try
        {
            payload = await JsonSerializer.DeserializeAsync<WebhookPayload>(
                    context.Request.Body,
                    JsonOptions,
                    context.RequestAborted)
                .ConfigureAwait(false);
        }
        catch (JsonException)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        _ = Task.Run(async () =>
        {
            try
            {
                if (string.IsNullOrWhiteSpace(payload?.JellyfinUserId))
                {
                    // Full sync for all mapped users
                    await syncService.SyncAllUsersAsync(CancellationToken.None).ConfigureAwait(false);
                }
                else if (payload.TmdbId is not null
                    && !string.IsNullOrWhiteSpace(payload.MediaType)
                    && string.Equals(payload.Action, "removed", StringComparison.OrdinalIgnoreCase))
                {
                    // Fast path: remove a single item from this user's collection
                    await syncService.RemoveItemFromCollectionAsync(
                        payload.JellyfinUserId,
                        payload.TmdbId.Value,
                        payload.MediaType,
                        CancellationToken.None).ConfigureAwait(false);
                }
                else
                {
                    // Rebuild the full collection for this user (covers "added" and manual triggers)
                    await syncService.SyncUserAsync(payload.JellyfinUserId, CancellationToken.None)
                        .ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[HouslyWatchlist] Webhook sync failed");
            }
        });

        context.Response.StatusCode = StatusCodes.Status202Accepted;
    }
}
