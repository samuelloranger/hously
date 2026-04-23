import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Send, Plus, ChevronUp, Pencil } from "lucide-react";
import type {
  NotificationChannel,
  NotificationChannelType,
  NotificationChannelConfig,
  NtfyChannelConfig,
  TelegramChannelConfig,
} from "@hously/shared/types";
import {
  useNotificationChannels,
  useCreateNotificationChannel,
  useUpdateNotificationChannel,
  useDeleteNotificationChannel,
  useTestNotificationChannel,
} from "@/lib/notifications/useNotificationChannels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Channel type registry — add new entries here when adding a provider
// ---------------------------------------------------------------------------
const CHANNEL_TYPES: { value: NotificationChannelType; label: string }[] = [
  { value: "ntfy", label: "ntfy" },
  { value: "telegram", label: "Telegram" },
];

// Returns an empty config object for the given type.
// Add a new case when adding a provider — TS will error via the `never` guard.
function emptyConfig(type: NotificationChannelType): NotificationChannelConfig {
  switch (type) {
    case "ntfy":
      return { url: "", topic: "", token: "", priority: undefined };
    case "telegram":
      return { bot_token: "", chat_id: "" };
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown channel type: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Type-specific config form fields
// ---------------------------------------------------------------------------
interface ConfigFieldsProps {
  type: NotificationChannelType;
  config: NotificationChannelConfig;
  onChange: (config: NotificationChannelConfig) => void;
}

function ConfigFields({ type, config, onChange }: ConfigFieldsProps) {
  switch (type) {
    case "ntfy": {
      const cfg = config as NtfyChannelConfig;
      return (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Server URL
            </h3>
            <Input
              value={cfg.url}
              onChange={(e) => onChange({ ...cfg, url: e.target.value })}
              placeholder="https://ntfy.sh"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Topic
            </h3>
            <Input
              value={cfg.topic}
              onChange={(e) => onChange({ ...cfg, topic: e.target.value })}
              placeholder="my-topic"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Access token{" "}
              <span className="font-normal text-neutral-500">(optional)</span>
            </h3>
            <Input
              value={cfg.token ?? ""}
              onChange={(e) =>
                onChange({ ...cfg, token: e.target.value || undefined })
              }
              placeholder="tk_..."
            />
          </div>
        </div>
      );
    }
    case "telegram": {
      const cfg = config as TelegramChannelConfig;
      return (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Bot Token
            </h3>
            <Input
              value={cfg.bot_token}
              onChange={(e) => onChange({ ...cfg, bot_token: e.target.value })}
              placeholder="123456:ABC-DEF..."
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Chat ID
            </h3>
            <Input
              value={cfg.chat_id}
              onChange={(e) => onChange({ ...cfg, chat_id: e.target.value })}
              placeholder="-1001234567890"
            />
          </div>
        </div>
      );
    }
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown channel type: ${_exhaustive}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main section component
// ---------------------------------------------------------------------------
export function NotificationChannelsSection() {
  const { data, isLoading } = useNotificationChannels();
  const createMutation = useCreateNotificationChannel();
  const updateMutation = useUpdateNotificationChannel();
  const deleteMutation = useDeleteNotificationChannel();
  const testMutation = useTestNotificationChannel();

  const channels = data?.channels ?? [];

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<NotificationChannelType>("ntfy");
  const [formLabel, setFormLabel] = useState("");
  const [formConfig, setFormConfig] = useState<NotificationChannelConfig>(
    emptyConfig("ntfy"),
  );

  // Edit form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editConfig, setEditConfig] = useState<NotificationChannelConfig>(
    emptyConfig("ntfy"),
  );

  function handleTypeChange(value: NotificationChannelType) {
    setFormType(value);
    setFormConfig(emptyConfig(value));
  }

  function resetForm() {
    setFormType("ntfy");
    setFormLabel("");
    setFormConfig(emptyConfig("ntfy"));
    setShowForm(false);
  }

  function handleEdit(channel: NotificationChannel) {
    setEditingId(channel.id);
    setEditLabel(channel.label);
    setEditConfig(channel.config);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditLabel("");
    setEditConfig(emptyConfig("ntfy"));
  }

  async function handleAdd() {
    if (!formLabel.trim()) {
      toast.error("Please enter a label for the channel.");
      return;
    }
    const config =
      formType === "ntfy"
        ? {
            ...(formConfig as NtfyChannelConfig),
            token: (formConfig as NtfyChannelConfig).token?.trim() || undefined,
          }
        : formConfig;

    createMutation.mutate(
      { type: formType, label: formLabel.trim(), config },
      {
        onSuccess: () => {
          toast.success("Channel added.");
          resetForm();
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to add channel.",
          );
        },
      },
    );
  }

  async function handleSaveEdit() {
    if (editingId === null) return;
    if (!editLabel.trim()) {
      toast.error("Label cannot be empty.");
      return;
    }
    updateMutation.mutate(
      { id: editingId, label: editLabel.trim(), config: editConfig },
      {
        onSuccess: () => {
          toast.success("Channel updated.");
          cancelEdit();
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to update channel.",
          );
        },
      },
    );
  }

  async function handleToggle(id: number, enabled: boolean) {
    updateMutation.mutate(
      { id, enabled },
      {
        onSuccess: () =>
          toast.success(enabled ? "Channel enabled." : "Channel disabled."),
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to update channel.",
          );
        },
      },
    );
  }

  async function handleTest(id: number) {
    testMutation.mutate(id, {
      onSuccess: () => toast.success("Test notification sent."),
      onError: (err) => {
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to send test notification.",
        );
      },
    });
  }

  async function handleDelete(id: number) {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success("Channel deleted."),
      onError: (err) => {
        toast.error(
          err instanceof Error ? err.message : "Failed to delete channel.",
        );
      },
    });
  }

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Notification Channels
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Push notifications to external services (e.g. ntfy).
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
          aria-expanded={showForm}
        >
          {showForm ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Add Channel
            </>
          )}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-4 bg-neutral-50 dark:bg-neutral-700/30">
          <div>
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Type
            </h3>
            <Select
              value={formType}
              onValueChange={(v) =>
                handleTypeChange(v as NotificationChannelType)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Label
            </h3>
            <Input
              value={formLabel}
              onChange={(e) => setFormLabel(e.target.value)}
              placeholder="My ntfy channel"
            />
          </div>

          <ConfigFields
            type={formType}
            config={formConfig}
            onChange={setFormConfig}
          />

          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending ? "Adding…" : "Add Channel"}
            </Button>
            <Button
              variant="ghost"
              onClick={resetForm}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Channel list */}
      {isLoading ? (
        <div className="p-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
          Loading channels…
        </div>
      ) : channels.length === 0 ? (
        <div className="p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg text-neutral-500 dark:text-neutral-400 text-sm">
          No channels configured.
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((channel) =>
            editingId === channel.id ? (
              <div
                key={channel.id}
                className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-4 space-y-4 bg-neutral-50 dark:bg-neutral-700/30"
              >
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Label
                  </h3>
                  <Input
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    placeholder="My ntfy channel"
                  />
                </div>
                <ConfigFields
                  type={channel.type}
                  config={editConfig}
                  onChange={setEditConfig}
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updateMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={cancelEdit}
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={channel.id}
                className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Switch
                    checked={channel.enabled}
                    onCheckedChange={(checked) =>
                      handleToggle(channel.id, checked)
                    }
                    disabled={updateMutation.isPending}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {channel.label}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      {channel.type}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(channel)}
                    title="Edit channel"
                    className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleTest(channel.id)}
                    disabled={testMutation.isPending}
                    title="Send test notification"
                    className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(channel.id)}
                    disabled={deleteMutation.isPending}
                    title="Delete channel"
                    className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
