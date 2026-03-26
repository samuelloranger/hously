import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Search, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatBytes, useQuickSearch } from '@hously/shared';
import { navSections } from './navigation';
import { Dialog } from './dialog';
import { Input } from './ui/input';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

interface QuickActionPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  section: 'actions' | 'torrents' | 'medias' | 'recipes' | 'chores' | 'shopping' | 'users';
  keywords?: string[];
  shortcut?: string;
  action: () => void;
}

export function QuickActionPalette({ isOpen, onClose, onOpen }: QuickActionPaletteProps) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const router = useRouterState();
  const { isDark, toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const isLoggedIn = router.location.pathname !== '/login';
  const shouldSearch = isOpen && normalizedQuery.length >= 2 && isLoggedIn;

  const actions = useMemo<QuickAction[]>(() => {
    const navActions = navSections.flatMap(section =>
      section.items.map(item => ({
        id: `nav-${item.path}`,
        title: t(item.translationKey),
        description: t('common.quickActionsOpenPage', { page: t(item.translationKey) }),
        icon: item.mobileIcon,
        section: 'actions' as const,
        keywords: [item.path, item.translationKey, section.labelKey],
        action: () => {
          navigate({ to: item.path });
          onClose();
        },
      }))
    );

    return [
      ...navActions,
      {
        id: 'notifications',
        title: t('notifications.title'),
        description: t('common.quickActionsOpenPage', { page: t('notifications.title') }),
        icon: '🔔',
        section: 'actions',
        keywords: ['notifications', 'alerts'],
        action: () => {
          navigate({ to: '/notifications' });
          onClose();
        },
      },
      {
        id: 'settings',
        title: t('settings.title'),
        description: t('common.quickActionsOpenPage', { page: t('settings.title') }),
        icon: '⚙️',
        section: 'actions',
        keywords: ['settings', 'profile', 'plugins'],
        action: () => {
          navigate({ to: '/settings', search: { tab: 'profile' as const } });
          onClose();
        },
      },
      {
        id: 'theme',
        title: isDark ? t('common.switchToLight') : t('common.switchToDark'),
        description: t('common.quickActionsToggleTheme'),
        icon: isDark ? '☀️' : '🌙',
        section: 'actions',
        keywords: ['theme', 'dark', 'light'],
        shortcut: 'T',
        action: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'refresh',
        title: t('common.refetch'),
        description: t('common.quickActionsRefreshCurrentPage'),
        icon: '↻',
        section: 'actions',
        shortcut: 'R',
        keywords: ['refresh', 'reload'],
        action: () => {
          window.location.reload();
        },
      },
    ];
  }, [isDark, navigate, onClose, t, toggleTheme]);

  const filteredActions = useMemo<QuickAction[]>(() => {
    if (!normalizedQuery) {
      return actions;
    }

    return actions.filter(action => {
      const searchable = [action.title, action.description, ...(action.keywords ?? [])].join(' ').toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [actions, normalizedQuery]);

  const searchQuery = useQuickSearch(normalizedQuery, { enabled: shouldSearch, staleTime: 30_000 });

  const collectionResults = useMemo<QuickAction[]>(() => {
    if (!shouldSearch || !searchQuery.data) return [];

    const { torrents, medias, recipes, chores, shopping, users } = searchQuery.data;

    const torrentActions: QuickAction[] = torrents.map(torrent => ({
      id: `torrent-${torrent.id}`,
      title: torrent.name,
      description: [formatBytes(torrent.size_bytes), torrent.category, `${Math.round(torrent.progress * 100)}%`]
        .filter(Boolean)
        .join(' • '),
      icon: '🧲',
      section: 'torrents' as const,
      action: () => {
        navigate({ to: '/torrents/$hash', params: { hash: torrent.id } });
        onClose();
      },
    }));

    const mediaActions: QuickAction[] = medias.map(item => ({
      id: `media-${item.id}`,
      title: item.title,
      description: [
        item.service.toUpperCase(),
        item.media_type === 'movie' ? t('medias.filterMovies') : t('medias.filterSeries'),
        item.year ?? '',
      ]
        .filter(Boolean)
        .join(' • '),
      icon: item.media_type === 'movie' ? '🎬' : '📺',
      section: 'medias' as const,
      action: () => {
        navigate({
          to: '/library',
          search: {
            current_media_id: `${item.service}:${item.source_id}`,
            current_media_tab: 'search',
          },
        });
        onClose();
      },
    }));

    const recipeActions: QuickAction[] = recipes.map(recipe => ({
      id: `recipe-${recipe.id}`,
      title: recipe.name,
      description: recipe.category
        ? t(`recipes.category.${recipe.category}`, recipe.category)
        : t('common.quickActionsOpenRecipe'),
      icon: recipe.is_favorite ? '⭐' : '🍳',
      section: 'recipes' as const,
      action: () => {
        navigate({ to: '/kitchen/$recipeId', params: { recipeId: String(recipe.id) } });
        onClose();
      },
    }));

    const choreActions: QuickAction[] = chores.map(chore => ({
      id: `chore-${chore.id}`,
      title: chore.chore_name,
      description: [chore.description, chore.assigned_to_username].filter(Boolean).join(' • ') || t('chores.title'),
      icon: chore.completed ? '✅' : '🧹',
      section: 'chores' as const,
      action: () => {
        navigate({ to: '/chores' });
        onClose();
      },
    }));

    const shoppingActions: QuickAction[] = shopping.map(item => ({
      id: `shopping-${item.id}`,
      title: item.item_name,
      description: item.notes ?? t('shopping.title'),
      icon: item.completed ? '✅' : '🛒',
      section: 'shopping' as const,
      action: () => {
        navigate({ to: '/shopping' });
        onClose();
      },
    }));

    const userActions: QuickAction[] = users.map(user => ({
      id: `user-${user.id}`,
      title: user.name,
      description: user.email,
      icon: '👤',
      section: 'users' as const,
      action: () => {
        navigate({ to: '/settings', search: { tab: 'profile' as const } });
        onClose();
      },
    }));

    return [...torrentActions, ...mediaActions, ...recipeActions, ...choreActions, ...shoppingActions, ...userActions];
  }, [navigate, normalizedQuery, onClose, searchQuery.data, shouldSearch, t]);

  const sectionLabels: Record<QuickAction['section'], string> = useMemo(
    () => ({
      torrents: t('common.quickActionsSectionTorrents'),
      medias: t('common.quickActionsSectionMedias'),
      recipes: t('common.quickActionsSectionRecipes'),
      chores: t('chores.title'),
      shopping: t('shopping.title'),
      users: 'Users',
      actions: t('common.quickActionsSectionActions'),
    }),
    [t]
  );

  const matchScore = (title: string, q: string): number => {
    const lower = title.toLowerCase();
    if (lower === q) return 3;
    if (lower.startsWith(q)) return 2;
    if (lower.includes(q)) return 1;
    return 0;
  };

  const results = useMemo<QuickAction[]>(() => {
    if (!normalizedQuery) {
      return filteredActions;
    }

    return [...collectionResults, ...filteredActions].sort(
      (a, b) => matchScore(b.title, normalizedQuery) - matchScore(a.title, normalizedQuery)
    );
  }, [filteredActions, normalizedQuery, collectionResults]);

  const isSearchingCollections = shouldSearch && searchQuery.isLoading;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCommandPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCommandPaletteShortcut) {
        event.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onOpen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setActiveIndex(0);
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeIndex > results.length - 1) {
      setActiveIndex(Math.max(results.length - 1, 0));
    }
  }, [activeIndex, results.length]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!results.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(currentIndex => (currentIndex + 1) % results.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(currentIndex => (currentIndex - 1 + results.length) % results.length);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      results[activeIndex]?.action();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('common.quickActions')}
      panelClassName="max-w-3xl overflow-hidden p-0"
    >
      <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
        <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-900">
          <Search className="h-4 w-4 text-neutral-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('common.quickActionsPlaceholder')}
            className="border-0 bg-transparent! px-0 focus:ring-0"
          />
          <span className="hidden items-center rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-semibold text-neutral-400 dark:border-neutral-700 sm:inline-flex">
            ⌘K
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
          <p>
            {normalizedQuery.length >= 2 ? t('common.quickActionsSearchCollections') : t('common.quickActionsHint')}
          </p>
          <p>{router.location.pathname}</p>
        </div>
      </div>

      <div className="max-h-[60dvh] overflow-y-auto p-3">
        {isSearchingCollections && (
          <div className="px-3 pb-3 text-xs text-neutral-500 dark:text-neutral-400">
            {t('common.quickActionsLoadingResults')}
          </div>
        )}

        {results.length > 0 ? (
          <div className="space-y-1">
            {results.map((action, index) => (
              <button
                key={action.id}
                type="button"
                onClick={action.action}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
                  activeIndex === index
                    ? 'bg-neutral-100 dark:bg-neutral-700/70'
                    : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-700/40'
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg dark:bg-neutral-800">
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-neutral-900 dark:text-white">{action.title}</p>
                  <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">{action.description}</p>
                </div>
                {action.shortcut ? (
                  <span className="shrink-0 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-semibold text-neutral-400 dark:border-neutral-700">
                    {action.shortcut}
                  </span>
                ) : normalizedQuery ? (
                  <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500">
                    {sectionLabels[action.section]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 px-6 py-14 text-center dark:border-neutral-700">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Sparkles className="h-5 w-5 text-neutral-500" />
            </div>
            <p className="font-medium text-neutral-900 dark:text-white">{t('common.quickActionsNoResults')}</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              {t('common.quickActionsNoResultsDescription')}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
