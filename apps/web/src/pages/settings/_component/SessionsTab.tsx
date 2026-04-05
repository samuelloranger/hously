import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Smartphone, Monitor, Trash2, LogOut } from "lucide-react";
import {
  useAdminSessions,
  useRevokeSession,
  useRevokeUserSessions,
  useAdminPushTokens,
  useDeletePushToken,
  useAdminWebPush,
  useDeleteWebPush,
} from "@/hooks/useAdmin";
import { useCurrentUser } from "@/hooks/useAuth";
import { formatDateTime } from "@hously/shared/utils";
import { LoadingState } from "@/components/LoadingState";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6">
      <h2 className="text-lg font-semibold mb-1.5 text-neutral-900 dark:text-neutral-100">
        {title}
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">
        {description}
      </p>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8 text-neutral-500 dark:text-neutral-400 text-sm">
      {message}
    </div>
  );
}

export function SessionsTab() {
  const { t, i18n } = useTranslation("common");
  const { data: currentUser } = useCurrentUser();

  const { data: sessionsData, isLoading: loadingSessions } = useAdminSessions();
  const { data: pushTokensData, isLoading: loadingPushTokens } =
    useAdminPushTokens();
  const { data: webPushData, isLoading: loadingWebPush } = useAdminWebPush();

  const revokeSession = useRevokeSession();
  const revokeUserSessions = useRevokeUserSessions();
  const deletePushToken = useDeletePushToken();
  const deleteWebPush = useDeleteWebPush();

  if (!currentUser?.is_admin) return null;

  const handleRevokeSession = async (id: number) => {
    if (!confirm(t("settings.sessions.revokeConfirm"))) return;
    try {
      await revokeSession.mutateAsync(id);
      toast.success(t("settings.sessions.revokeSuccess"));
    } catch {
      toast.error(t("settings.sessions.revokeError"));
    }
  };

  const handleRevokeUserSessions = async (
    userId: number,
    userEmail: string,
  ) => {
    if (!confirm(t("settings.sessions.revokeAllConfirm", { email: userEmail })))
      return;
    try {
      await revokeUserSessions.mutateAsync(userId);
      toast.success(t("settings.sessions.revokeAllSuccess"));
    } catch {
      toast.error(t("settings.sessions.revokeError"));
    }
  };

  const handleDeletePushToken = async (id: number) => {
    if (!confirm(t("settings.sessions.deleteTokenConfirm"))) return;
    try {
      await deletePushToken.mutateAsync(id);
      toast.success(t("settings.sessions.deleteTokenSuccess"));
    } catch {
      toast.error(t("settings.sessions.deleteTokenError"));
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

  // Group sessions by user for the "revoke all" action
  const sessionsByUser = (sessionsData?.sessions ?? []).reduce<
    Record<number, { email: string; count: number }>
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
      <SectionCard
        title={t("settings.sessions.sessionsTitle")}
        description={t("settings.sessions.sessionsDescription")}
      >
        {loadingSessions ? (
          <LoadingState />
        ) : !sessionsData?.sessions?.length ? (
          <EmptyState message={t("settings.sessions.noSessions")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.user")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.createdAt")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.expiresAt")}
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessionsData.sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">
                        {session.user_name || session.user_email}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {session.user_email}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                      {formatDateTime(session.created_at, i18n.language)}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                      {formatDateTime(session.expires_at, i18n.language)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {sessionsByUser[session.user_id]?.count > 1 && (
                          <button
                            onClick={() =>
                              handleRevokeUserSessions(
                                session.user_id,
                                session.user_email,
                              )
                            }
                            disabled={revokeUserSessions.isPending}
                            title={t("settings.sessions.revokeAll")}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg hover:bg-orange-200 dark:hover:bg-orange-900/50 disabled:opacity-50 transition-colors"
                          >
                            <LogOut className="w-3 h-3" />
                            {t("settings.sessions.revokeAll")}
                          </button>
                        )}
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          disabled={revokeSession.isPending}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("settings.sessions.revoke")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* iOS / Mobile Push Tokens */}
      <SectionCard
        title={t("settings.sessions.pushTokensTitle")}
        description={t("settings.sessions.pushTokensDescription")}
      >
        {loadingPushTokens ? (
          <LoadingState />
        ) : !pushTokensData?.push_tokens?.length ? (
          <EmptyState message={t("settings.sessions.noPushTokens")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.user")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.platform")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.token")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.createdAt")}
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pushTokensData.push_tokens.map((token) => (
                  <tr
                    key={token.id}
                    className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100">
                        {token.user_name || token.user_email}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {token.user_email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        <Smartphone className="w-3 h-3" />
                        {token.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                      {token.token}
                    </td>
                    <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                      {formatDateTime(token.created_at, i18n.language)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeletePushToken(token.id)}
                        disabled={deletePushToken.isPending}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        {t("settings.sessions.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Web Push Subscriptions */}
      <SectionCard
        title={t("settings.sessions.webPushTitle")}
        description={t("settings.sessions.webPushDescription")}
      >
        {loadingWebPush ? (
          <LoadingState />
        ) : !webPushData?.subscriptions?.length ? (
          <EmptyState message={t("settings.sessions.noWebPush")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.user")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.device")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.endpoint")}
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.createdAt")}
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-700 dark:text-neutral-300">
                    {t("settings.sessions.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {webPushData.subscriptions.map((sub) => {
                  const deviceLabel =
                    [sub.browser_name, sub.os_name]
                      .filter(Boolean)
                      .join(" / ") ||
                    sub.device_name ||
                    t("settings.sessions.unknownDevice");
                  return (
                    <tr
                      key={sub.id}
                      className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100">
                          {sub.user_name || sub.user_email}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">
                          {sub.user_email}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          <Monitor className="w-3 h-3" />
                          {deviceLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate">
                        {sub.endpoint ?? "—"}
                      </td>
                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-400">
                        {sub.created_at
                          ? formatDateTime(sub.created_at, i18n.language)
                          : "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteWebPush(sub.id)}
                          disabled={deleteWebPush.isPending}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          {t("settings.sessions.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
