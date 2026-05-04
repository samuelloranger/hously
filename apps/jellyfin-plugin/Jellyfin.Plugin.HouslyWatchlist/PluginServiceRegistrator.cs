using Jellyfin.Plugin.HouslyWatchlist.Services;
using MediaBrowser.Controller;
using MediaBrowser.Controller.Plugins;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;

namespace Jellyfin.Plugin.HouslyWatchlist;

public class PluginServiceRegistrator : IPluginServiceRegistrator
{
    public void RegisterServices(IServiceCollection serviceCollection, IServerApplicationHost applicationHost)
    {
        serviceCollection.AddHttpClient<HouslyApiClient>();
        serviceCollection.AddSingleton<WatchlistSyncService>();
        serviceCollection.AddHostedService(sp => sp.GetRequiredService<WatchlistSyncService>());
        serviceCollection.AddSingleton<IStartupFilter, HouslyStartupFilter>();
    }
}

public class HouslyStartupFilter : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next)
    {
        return app =>
        {
            app.UseMiddleware<HouslyWebhookMiddleware>();
            next(app);
        };
    }
}
