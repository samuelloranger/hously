import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Clock,
  Bell,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  Link,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useICalToken,
  useGenerateICalToken,
  useRevokeICalToken,
} from "@/pages/calendar/useCalendar";
import { SettingsPageHeader } from "@/pages/settings/_component/SettingsPageHeader";

export function CalendarTab() {
  const { t } = useTranslation("common");
  const { data: tokenData, isLoading } = useICalToken();
  const generateToken = useGenerateICalToken();
  const revokeToken = useRevokeICalToken();
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const handleCopy = async () => {
    if (!tokenData?.url) return;
    await navigator.clipboard.writeText(tokenData.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = () => {
    if (tokenData?.hasToken && !confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }
    setConfirmRegenerate(false);
    generateToken.mutate();
  };

  const handleRevoke = () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    setConfirmRevoke(false);
    revokeToken.mutate();
  };

  const upcomingFeatures = [
    { icon: Bell, label: t("settings.calendar.features.reminders") },
    { icon: Clock, label: t("settings.calendar.features.availability") },
  ];

  return (
    <div
      className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6"
      key="calendar-tab"
    >
      <SettingsPageHeader
        icon={CalendarDays}
        title={t("settings.calendar.title")}
      />

      {/* iCal Subscription Section */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-9 h-9 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Link className="w-4.5 h-4.5 text-primary-400" />
          </div>
          <h2 className="text-base font-semibold text-neutral-100">
            {t("settings.calendar.subscription.title")}
          </h2>
        </div>
        <p className="text-sm text-neutral-400 mb-5">
          {t("settings.calendar.subscription.description")}
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tokenData?.hasToken ? (
          <div className="space-y-4">
            {/* URL Display */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                {t("settings.calendar.subscription.urlLabel")}
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-neutral-700/50 border border-neutral-600 text-sm text-neutral-300 font-mono truncate">
                  {tokenData.url}
                </div>
                <Button
                  type="button"
                  onClick={handleCopy}
                  className="gap-1.5 shrink-0 bg-primary-500/10 text-primary-400 hover:bg-primary-500/20"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      {t("settings.calendar.subscription.copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      {t("settings.calendar.subscription.copy")}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <p className="text-xs text-neutral-400">
              {t("settings.calendar.subscription.instructions")}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              {tokenData.webcalUrl && (
                <a
                  href={tokenData.webcalUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t("settings.calendar.subscription.openInCalendar")}
                </a>
              )}

              {confirmRegenerate ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400">
                    {t("settings.calendar.subscription.regenerateConfirm")}
                  </span>
                  <Button
                    type="button"
                    onClick={handleGenerate}
                    disabled={generateToken.isPending}
                    className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                  >
                    {t("settings.calendar.subscription.regenerate")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmRegenerate(false)}
                  >
                    {t("settings.profile.cancel")}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGenerate}
                  disabled={generateToken.isPending}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t("settings.calendar.subscription.regenerate")}
                </Button>
              )}

              {confirmRevoke ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400">
                    {t("settings.calendar.subscription.revokeConfirm")}
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleRevoke}
                    disabled={revokeToken.isPending}
                  >
                    {t("settings.calendar.subscription.revoke")}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmRevoke(false)}
                  >
                    {t("settings.profile.cancel")}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleRevoke}
                  disabled={revokeToken.isPending}
                  className="gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  {t("settings.calendar.subscription.revoke")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-primary-400" />
            </div>
            <p className="text-sm text-neutral-400 max-w-sm mb-4">
              {t("settings.calendar.subscription.description")}
            </p>
            <Button
              type="button"
              onClick={() => generateToken.mutate()}
              disabled={generateToken.isPending}
              className="gap-2"
            >
              <Link className="w-4 h-4" />
              {t("settings.calendar.subscription.generate")}
            </Button>
          </div>
        )}
      </div>

      {/* Coming Soon Section */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="flex flex-col items-center py-4 text-center">
          <h3 className="text-base font-semibold text-neutral-100 mb-2">
            {t("settings.calendar.comingSoon")}
          </h3>
          <p className="text-sm text-neutral-400 max-w-sm mb-4">
            {t("settings.calendar.comingSoonDescription")}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {upcomingFeatures.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-neutral-700/50 text-sm text-neutral-400"
              >
                <Icon className="w-4 h-4 text-primary-500 flex-shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
