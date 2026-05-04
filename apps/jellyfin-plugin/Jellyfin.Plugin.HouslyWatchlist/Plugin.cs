using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.HouslyWatchlist;

public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public static Plugin? Instance { get; private set; }

    public Plugin(IApplicationPaths appPaths, IXmlSerializer xmlSerializer)
        : base(appPaths, xmlSerializer)
    {
        Instance = this;
    }

    public override string Name => "Hously Watchlist";

    public override Guid Id => Guid.Parse("a3f4e2c1-8d6b-4f9a-b2e7-1c5d9f3a7e2b");

    public override string Description => "Syncs your Hously watchlist with a Jellyfin What's Next collection.";

    public IEnumerable<PluginPageInfo> GetPages()
    {
        return
        [
            new PluginPageInfo
            {
                Name = Name,
                EmbeddedResourcePath = $"{GetType().Namespace}.Configuration.configPage.html",
            },
        ];
    }
}
