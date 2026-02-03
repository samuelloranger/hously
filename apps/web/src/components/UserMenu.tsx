import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import type { User } from "../types";
import { useTheme } from "../hooks/useTheme";
import { usePWA } from "../hooks/usePWA";
import { formatDisplayName } from "../lib/utils";
import { api } from "../lib/api";
import { cn } from "../lib/utils";
import { MenuIcon } from "lucide-react";

interface UserMenuProps {
  user: User;
  onLogout: () => void;
}

interface NavItem {
  path: string;
  translationKey: string;
  icon: string;
}

export function UserMenu({ user, onLogout }: UserMenuProps) {
  const { t, i18n } = useTranslation("common");
  const router = useRouterState();
  const currentPath = router.location.pathname;
  const [isOpen, setIsOpen] = useState(false);
  const { isDark, toggleTheme } = useTheme();
  const { isStandalone } = usePWA();

  const languages = [
    { code: "en", name: "English" },
    { code: "fr", name: "Français" },
  ];
  const currentLanguage =
    languages.find((lang) => lang.code === i18n.language) || languages[0];

  const navItems: NavItem[] = [
    {
      path: "/",
      translationKey: "nav.dashboard",
      icon: "📊",
    },
    {
      path: "/shopping",
      translationKey: "nav.shopping",
      icon: "🛒",
    },
    { path: "/chores", translationKey: "nav.chores", icon: "✅" },
    { path: "/gifts", translationKey: "nav.gifts", icon: "🎁" },
  ];

  const toggleLanguage = () => {
    const nextLanguage =
      languages.find((lang) => lang.code !== i18n.language) || languages[0];
    i18n.changeLanguage(nextLanguage.code);

    // Update locale on server (non-blocking)
    if (user) {
      api.updateLocale(nextLanguage.code).catch((error) => {
        // Silently fail - non-blocking update
        console.debug("Failed to update locale on server:", error);
      });
    }
  };

  const handleLogout = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          className="flex items-center text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg p-2"
          aria-label={t("common.userMenu")}
        >
          <span className="hidden xl:block mr-2 text-lg">👤</span>
          <span className="hidden xl:block">{formatDisplayName(user)}</span>
          <span className="xl:ml-1 flex justify-center items-center text-xl">
            <MenuIcon />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={`min-w-[230px] w-56 bg-neutral-50 dark:bg-neutral-800 rounded-md shadow-lg ring-1 ring-neutral-300 ring-opacity-5 z-50 theme-transition border border-neutral-200 dark:border-neutral-700 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2`}
          align="end"
          sideOffset={8}
          collisionPadding={16}
        >
          <div
            className={cn(
              "px-2 py-2 border-b border-neutral-200 dark:border-neutral-700",
              isStandalone ? "hidden" : "block lg:hidden ",
            )}
          >
            {navItems.map((item) => {
              const isActive =
                currentPath === item.path ||
                (item.path !== "/" && currentPath.startsWith(`${item.path}/`));
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`block w-full text-left px-2 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md ${
                    isActive
                      ? "text-primary-600 dark:text-primary-400 bg-neutral-50 dark:bg-neutral-700"
                      : ""
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {t(item.translationKey)}
                </Link>
              );
            })}
          </div>
          <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t("common.language")}
              </span>
              <button
                onClick={toggleLanguage}
                className="p-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 focus:outline-none rounded transition-colors"
                aria-label="Toggle language"
              >
                {currentLanguage.name}
              </button>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-between w-full text-left px-0 py-1 text-sm text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-md"
              aria-label={t("common.toggleTheme")}
            >
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t("common.theme")}
              </span>
              <span>{isDark ? "☀️" : "🌙"}</span>
            </button>
          </div>
          <Link
            to="/settings"
            search={{ tab: "profile" }}
            onClick={() => setIsOpen(false)}
            className={`block w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md ${
              currentPath === "/settings"
                ? "text-primary-600 dark:text-primary-400 bg-neutral-50 dark:bg-neutral-700"
                : ""
            }`}
          >
            <span className="mr-2">⚙️</span>
            {t("settings.title")}
          </Link>
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md"
          >
            <span className="mr-2">🚪</span>
            {t("nav.logout")}
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
