import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Monitor, Trash2, LogOut, Key, Wifi } from "lucide-react";
import {
  useAdminSessions,
  useRevokeSession,
  useRevokeUserSessions,
  useAdminWebPush,
  useDeleteWebPush,
} from "@/pages/settings/useAdmin";
import { useCurrentUser } from "@/lib/auth/useAuth";
import {
  useOidcProviders,
  oidcProviderIconUrl,
} from "@/lib/auth/useOidcProviders";
import { formatDateTime } from "@hously/shared/utils";
import { LoadingState } from "@/components/LoadingState";
import type { AdminSession } from "@hously/shared";

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function getSessionLifespan(created_at: string, expires_at: string) {
  const now = Date.now();
  const start = new Date(created_at).getTime();
  const end = new Date(expires_at).getTime();
  const total = end - start;
  const elapsed = now - start;
  const pct = Math.min(Math.max(elapsed / total, 0), 1);
  const daysLeft = Math.max(
    Math.ceil((end - now) / (1000 * 60 * 60 * 24)),
    0,
  );
  return { pct, daysLeft };
}

function LifespanBar({ pct }: { pct: number }) {
  const color =
    pct >= 0.9
      ? "bg-red-500"
      : pct >= 0.7
        ? "bg-amber-400"
        : "bg-primary-500";
  return (
    <div className="h-1 w-16 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

function SessionCard({
  session,
  providerIconMap,
  sessionsByUser,
  onRevoke,
  onRevokeAll,
  revoking,
  revokingAll,
  language,
}: {
  session: AdminSession;
  providerIconMap: Record<string, string>;
  sessionsByUser: Record<string, { email: string; count: number }>;
  onRevoke: (id: string) => void;
  onRevokeAll: (userId: string, email: string) => void;
  revoking: boolean;
  revokingAll: boolean;
  language: string;
}) {
  const { t } = useTranslation("common");
  const { pct, daysLeft } = getSessionLifespan(
    session.created_at,
    session.expires_at,
  );
  const initials = getInitials(session.user_name, session.user_email);
  const isCredential =
    !session.provider_id || session.provider_id === "credential";
  const hasMultiple = (sessionsByUser[session.user_id]?.count ?? 0) > 1;

  const expiryColor =
    daysLeft <= 1
      ? "text-red-500 dark:text-red-400"
      : daysLeft <= 3
        ? "text-amber-500 dark:text-amber-400"
        : "text-neutral-400 dark:text-neutral-500";

  return (
    <div className="group relative flex items-center gap-4 px-4 py-3.5 hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0">
      {/* Avatar + provider badge */}
      <div className="relative shrink-0">
        <div className="size-9 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center">
          <span className="text-xs font-semibold font-mono text-neutral-600 dark:text-neutral-300 tracking-tight">
            {initials}
          </span>
        </div>
        <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden">
          {isCredential ? (
            <Key className="size-2.5 text-neutral-400" />
          ) : (
            <img
              src={providerIconMap[session.provider_id!] ?? oidcProviderIconUrl(session.provider_id!, null)}
              alt=""
              className="size-3 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>
      </div>

      {/* Identity + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {session.user_name || session.user_email}
          </span>
          {session.user_name && (
            <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 truncate hidden sm:block">
              {session.user_email}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {session.device && (session.device.browser || session.device.os) && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <Monitor className="size-3 shrink-0" />
              <span className="font-mono">
                {[session.device.browser, session.device.os]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          )}
          {session.ip_address && (
            <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500">
              {session.ip_address}
            </span>
          )}
        </div>
      </div>

      {/* Lifespan + dates */}
      <div className="hidden md:flex flex-col items-end gap-1.5 shrink-0">
        <LifespanBar pct={pct} />
        <span className={`text-xs font-mono tabular-nums ${expiryColor}`}>
          {daysLeft === 0
            ? t("settings.sessions.expiresImminently")
            : t("settings.sessions.expiresInDays", { count: daysLeft })}
        </span>
      </div>

      {/* Created date */}
      <div className="hidden lg:block text-xs font-mono text-neutral-400 dark:text-neutral-500 shrink-0 text-right w-32">
        {formatDateTime(session.created_at, language)}
      </div>

      {/* Actions — always visible on mobile, hover on desktop */}
      <div className="flex items-center gap-1.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        {hasMultiple && (
          <button
            onClick={() =>
              onRevokeAll(session.user_id, session.user_email)
            }
            disabled={revokingAll}
            title={t("settings.sessions.revokeAll")}
            className="size-7 flex items-center justify-center rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-40 transition-colors"
          >
            <LogOut className="size-3.5" />
          </button>
        )}
        <button
          onClick={() => onRevoke(session.id)}
          disabled={revoking}
          title={t("settings.sessions.revoke")}
          className="size-7 flex items-center justify-center rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: number;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 tracking-wide uppercase">
          {title}
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          {description}
        </p>
      </div>
      {count !== undefined && (
        <span className="text-xs font-mono font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-10 text-sm text-neutral-400 dark:text-neutral-500">
      {message}
    </div>
  );
}

export function SessionsTab() {
  const { t, i18n } = useTranslation("common");
  const { data: currentUser } = useCurrentUser();

  const { data: sessionsData, isLoading: loadingSessions } = useAdminSessions();
  const { data: webPushData, isLoading: loadingWebPush } = useAdminWebPush();
  const { data: oidcData } = useOidcProviders();
  const providerIconMap = Object.fromEntries(
    (oidcData?.providers ?? []).map((p) => [
      p.slug,
      oidcProviderIconUrl(p.slug, p.icon_url),
    ]),
  );

  const revokeSession = useRevokeSession();
  const revokeUserSessions = useRevokeUserSessions();
  const deleteWebPush = useDeleteWebPush();

  if (!currentUser?.is_admin) return null;

  const handleRevokeSession = async (id: string) => {
    if (!confirm(t("settings.sessions.revokeConfirm"))) return;
    try {
      await revokeSession.mutateAsync(id);
      toast.success(t("settings.sessions.revokeSuccess"));
    } catch {
      toast.error(t("settings.sessions.revokeError"));
    }
  };

  const handleRevokeUserSessions = async (
    userId: string,
    userEmail: string,
  ) => {
    if (
      !confirm(t("settings.sessions.revokeAllConfirm", { email: userEmail }))
    )
      return;
    try {
      await revokeUserSessions.mutateAsync(userId);
      toast.success(t("settings.sessions.revokeAllSuccess"));
    } catch {
      toast.error(t("settings.sessions.revokeError"));
    }
  };

  const handleDeleteWebPush = async (id: number) => {
    if (!confirm(t("settings.sessions.deleteWebPushConfirm"))) return;
    try {
      await deleteWebPush.mutateAsync(id);
      toast.success(t("settings.sessions.deleteWebPushSuccess"));
    } catch {
      toast.error(t("settings.sessions.deleteWebPushError"));
    }
  };

  const sessionsByUser = (sessionsData?.sessions ?? []).reduce<
    Record<string, { email: string; count: number }>
  >((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = { email: s.user_email, count: 0 };
    acc[s.user_id].count++;
    return acc;
  }, {});

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6"
      key="sessions-tab"
    >
      {/* Active Sessions */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="px-4 pt-5 pb-1">
          <SectionHeader
            title={t("settings.sessions.sessionsTitle")}
            description={t("settings.sessions.sessionsDescription")}
            count={sessionsData?.sessions?.length}
          />
        </div>
        {loadingSessions ? (
          <div className="px-4 pb-5">
            <LoadingState />
          </div>
        ) : !sessionsData?.sessions?.length ? (
          <EmptyState message={t("settings.sessions.noSessions")} />
        ) : (
          <div>
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="size-9" />
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">
                {t("settings.sessions.user")}
              </span>
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-right w-20">
                {t("settings.sessions.expiresAt")}
              </span>
              <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide text-right w-32">
                {t("settings.sessions.createdAt")}
              </span>
              <div className="w-16" />
            </div>
            {sessionsData.sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                providerIconMap={providerIconMap}
                sessionsByUser={sessionsByUser}
                onRevoke={handleRevokeSession}
                onRevokeAll={handleRevokeUserSessions}
                revoking={revokeSession.isPending}
                revokingAll={revokeUserSessions.isPending}
                language={i18n.language}
              />
            ))}
          </div>
        )}
      </div>

      {/* Web Push Subscriptions */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="px-4 pt-5 pb-1">
          <SectionHeader
            title={t("settings.sessions.webPushTitle")}
            description={t("settings.sessions.webPushDescription")}
            count={webPushData?.subscriptions?.length}
          />
        </div>
        {loadingWebPush ? (
          <div className="px-4 pb-5">
            <LoadingState />
          </div>
        ) : !webPushData?.subscriptions?.length ? (
          <EmptyState message={t("settings.sessions.noWebPush")} />
        ) : (
          <div>
            {webPushData.subscriptions.map((sub) => {
              const deviceLabel =
                [sub.browser_name, sub.os_name].filter(Boolean).join(" · ") ||
                sub.device_name ||
                t("settings.sessions.unknownDevice");
              const initials = getInitials(sub.user_name ?? null, sub.user_email);
              return (
                <div
                  key={sub.id}
                  className="group flex items-center gap-4 px-4 py-3.5 hover:bg-neutral-50 dark:hover:bg-white/[0.03] transition-colors border-b border-neutral-100 dark:border-neutral-800 last:border-0"
                >
                  <div className="size-9 rounded-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold font-mono text-neutral-600 dark:text-neutral-300 tracking-tight">
                      {initials}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {sub.user_name || sub.user_email}
                      </span>
                      {sub.user_name && (
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500 truncate hidden sm:block">
                          {sub.user_email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                        <Wifi className="size-3 shrink-0" />
                        <span className="font-mono">{deviceLabel}</span>
                      </span>
                    </div>
                  </div>
                  <div className="hidden lg:block text-xs font-mono text-neutral-400 dark:text-neutral-500 shrink-0 text-right w-32">
                    {sub.created_at
                      ? formatDateTime(sub.created_at, i18n.language)
                      : "—"}
                  </div>
                  <div className="flex items-center shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDeleteWebPush(sub.id)}
                      disabled={deleteWebPush.isPending}
                      title={t("settings.sessions.delete")}
                      className="size-7 flex items-center justify-center rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
