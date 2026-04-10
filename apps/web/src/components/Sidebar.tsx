import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { clearUser } from "@/lib/auth";
import { useLogout } from "@/hooks/auth/useAuth";
import { useUpdateProfile } from "@/hooks/users/useUsers";
import { formatDisplayName } from "@hously/shared/utils";
import { NotificationsMenu } from "@/components/NotificationsBell";
import { UserMenu } from "@/components/UserMenu";
import { Loader, LogOut, Search, Settings } from "lucide-react";
import { usePrefetchRoute } from "@/lib/routing/usePrefetchRoute";
import { useAuth } from "@/lib/auth/useAuth";
import { useTheme } from "@/hooks/app/useTheme";
import { cn } from "@/lib/utils";
import { navSections } from "@/lib/routing/navigation";

interface SidebarProps {
  onOpenQuickActions?: () => void;
}

export function Sidebar({ onOpenQuickActions }: SidebarProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation("common");
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const navigate = useNavigate();
  const logoutMutation = useLogout();
  const prefetchRoute = usePrefetchRoute();
  const { isDark, toggleTheme } = useTheme();
  const updateProfile = useUpdateProfile();

  const languages = [
    { code: "en", name: "EN" },
    { code: "fr", name: "FR" },
  ];
  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

  const toggleLanguage = () => {
    const nextLanguage =
      languages.find((lang) => lang.code !== i18n.language) || languages[0];
    i18n.changeLanguage(nextLanguage.code);
    if (user) {
      updateProfile.mutate(
        { locale: nextLanguage.code },
        {
          onError: (error) =>
            console.debug("Failed to update locale on server:", error),
        },
      );
    }
  };

  const handleLogout = async () => {
    try {
      let subscriptionEndpoint: string | undefined;
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            subscriptionEndpoint = subscription.endpoint;
            try {
              await subscription.unsubscribe();
            } catch (error) {
              console.warn(
                "Failed to unsubscribe from service worker on logout:",
                error,
              );
            }
          }
        } catch (error) {
          console.warn(
            "Could not get subscription endpoint for logout:",
            error,
          );
        }
      }

      await logoutMutation.mutateAsync(subscriptionEndpoint);
      clearUser();
      navigate({ to: "/login" });
    } catch (error) {
      console.error("Logout error:", error);
      clearUser();
      navigate({ to: "/login" });
    }
  };

  const initials = user ? formatDisplayName(user).charAt(0).toUpperCase() : "";

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-60 z-50 flex-col bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-r border-neutral-950/[0.06] dark:border-white/[0.08] theme-transition">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
          <Link
            to="/"
            className="flex items-center gap-2.5 group"
            onMouseEnter={() => prefetchRoute("/")}
          >
            <img
              src="/icon-32.png"
              alt=""
              className="h-7 w-7 transition-transform duration-200 group-hover:scale-110"
            />
            <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              Hously
            </span>
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {navSections.map((section) => (
            <div key={section.labelKey}>
              <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                {t(section.labelKey)}
              </span>
              <div className="mt-1.5 space-y-0.5">
                {section.items.map((item) => {
                  const isActive =
                    item.path === "/"
                      ? currentPath === "/"
                      : currentPath === item.path ||
                        currentPath.startsWith(`${item.path}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onMouseEnter={() => prefetchRoute(item.path)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
                        isActive
                          ? "bg-neutral-100 dark:bg-white/[0.08] text-neutral-900 dark:text-white"
                          : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/[0.04] hover:text-neutral-800 dark:hover:text-neutral-200",
                      )}
                    >
                      <Icon
                        size={18}
                        className={cn(
                          isActive && "text-indigo-600 dark:text-indigo-400",
                        )}
                      />
                      {t(item.translationKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="shrink-0 border-t border-neutral-950/[0.06] dark:border-white/[0.08] px-3 py-3 space-y-1">
          {onOpenQuickActions && (
            <button
              type="button"
              onClick={onOpenQuickActions}
              className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-neutral-500 transition-all duration-150 hover:bg-neutral-50 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-white/[0.04] dark:hover:text-neutral-200"
            >
              <Search size={18} />
              <span className="flex-1 text-left">
                {t("common.quickActions")}
              </span>
              <span className="rounded-md border border-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400 dark:border-white/[0.08]">
                ⌘K
              </span>
            </button>
          )}

          {/* Notifications */}
          <div className="flex items-center">
            <NotificationsMenu />
            <span className="ml-2 text-[13px] font-medium text-neutral-500 dark:text-neutral-400">
              {t("notifications.title")}
            </span>
          </div>

          {/* Settings */}
          <Link
            to="/settings"
            search={{ tab: "profile" }}
            onMouseEnter={() => prefetchRoute("/settings", { tab: "profile" })}
            className={cn(
              "flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-150",
              currentPath.startsWith("/settings")
                ? "bg-neutral-100 dark:bg-white/[0.08] text-neutral-900 dark:text-white"
                : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/[0.04] hover:text-neutral-800 dark:hover:text-neutral-200",
            )}
          >
            <Settings size={18} />
            {t("settings.title")}
          </Link>

          {/* Divider */}
          <div className="h-px bg-neutral-950/[0.06] dark:bg-white/[0.08] my-1" />

          {/* User section */}
          {user && (
            <div className="flex items-center gap-2.5 px-2.5 py-1.5">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={formatDisplayName(user)}
                  className="h-8 w-8 rounded-lg object-cover ring-1 ring-neutral-200/80 dark:ring-white/10 shrink-0"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 text-xs font-semibold text-primary-700 dark:text-primary-300 shrink-0">
                  {initials}
                </div>
              )}
              <span className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300 truncate">
                {formatDisplayName(user)}
              </span>
            </div>
          )}

          {/* Quick actions row */}
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] transition-colors"
              aria-label={t("common.toggleTheme")}
              title={t("common.toggleTheme")}
            >
              <span className="text-sm">{isDark ? "☀️" : "🌙"}</span>
            </button>
            <button
              onClick={toggleLanguage}
              className="flex h-8 items-center justify-center rounded-lg px-2 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
              title={t("common.language")}
            >
              {currentLanguage.name}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleLogout}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/[0.06] hover:text-red-600 dark:hover:text-red-400 transition-colors"
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden">
        <div style={{ height: "calc(56px + env(safe-area-inset-top, 0px))" }} />
        <nav className="fixed heading-safe-area top-0 left-0 right-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-b border-neutral-950/[0.06] dark:border-white/[0.08] theme-transition">
          <div className="px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              {/* Left: Logo */}
              <Link
                to="/"
                className="flex items-center gap-2.5 group"
                onMouseEnter={() => prefetchRoute("/")}
              >
                <img
                  src="/icon-32.png"
                  alt=""
                  className="h-7 w-7 transition-transform duration-200 group-hover:scale-110"
                />
                <span className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
                  Hously
                </span>
              </Link>

              {/* Right: Notifications + User */}
              <div className="flex items-center gap-0.5">
                {onOpenQuickActions && (
                  <>
                    <button
                      type="button"
                      onClick={onOpenQuickActions}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-white/[0.06]"
                      aria-label={t("common.quickActions")}
                      title={t("common.quickActions")}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    <div className="mx-1.5 h-5 w-px bg-neutral-200 dark:bg-white/[0.08]" />
                  </>
                )}
                <NotificationsMenu />
                <div className="mx-1.5 h-5 w-px bg-neutral-200 dark:bg-white/[0.08]" />
                {!user ? (
                  <div className="flex h-9 w-9 items-center justify-center text-neutral-400">
                    <Loader className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <UserMenu user={user} onLogout={handleLogout} />
                )}
              </div>
            </div>
          </div>
        </nav>
      </div>
    </>
  );
}
