using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.HouslyWatchlist;

public class UserMapping
{
    public string JellyfinUserId { get; set; } = string.Empty;

    public int HouslyUserId { get; set; }
}

public class PluginConfiguration : BasePluginConfiguration
{
    public string HouslyBaseUrl { get; set; } = string.Empty;

    public string AdminToken { get; set; } = string.Empty;

    public int SyncIntervalMinutes { get; set; } = 15;

    public List<UserMapping> UserMappings { get; set; } = [];
}
