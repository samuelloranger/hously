import { useState } from "react";
import { PencilIcon, PlusIcon, SignalIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import type {
  MinecraftCreateServerRequest,
  MinecraftServerEntry,
} from "@hously/shared/types/integrations";
import { Dialog } from "@/components/dialog";
import { IntegrationSectionCard } from "@/pages/settings/_component/integrations/IntegrationSectionCard";
import {
  useCreateMinecraftServer,
  useDeleteMinecraftServer,
  useMinecraftIntegration,
  useMinecraftServers,
  usePingMinecraftServer,
  useUpdateMinecraftIntegration,
  useUpdateMinecraftServer,
} from "@/pages/settings/useIntegrations";

// ---------------------------------------------------------------------------
// Public entry point — loads data then delegates to Impl
// ---------------------------------------------------------------------------

export function MinecraftIntegrationSection() {
  const { data, isLoading } = useMinecraftIntegration();
  return <MinecraftIntegrationSectionImpl data={data} isLoading={isLoading} />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const POLL_OPTIONS: { value: 5 | 15 | 30 | 60; label: string }[] = [
  { value: 5, label: "5 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
];

const WIDGET_VIEW_OPTIONS: { value: "compact" | "cards"; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "cards", label: "Cards" },
];

const DEFAULT_FORM: MinecraftCreateServerRequest = {
  name: "",
  host: "",
  port: 25565,
  poll_interval_minutes: 15,
  enabled: true,
  widget_view: "compact",
};

// ---------------------------------------------------------------------------
// Server dialog form
// ---------------------------------------------------------------------------

interface ServerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initial?: MinecraftServerEntry;
  onSubmit: (values: MinecraftCreateServerRequest) => void;
  isPending: boolean;
}

function ServerDialog({
  isOpen,
  onClose,
  initial,
  onSubmit,
  isPending,
}: ServerDialogProps) {
  const [form, setForm] = useState<MinecraftCreateServerRequest>(
    initial
      ? {
          name: initial.name,
          host: initial.host,
          port: initial.port,
          poll_interval_minutes: initial.poll_interval_minutes,
          enabled: initial.enabled,
          widget_view: initial.widget_view,
        }
      : DEFAULT_FORM,
  );

  const isEdit = Boolean(initial);

  function set<K extends keyof MinecraftCreateServerRequest>(
    key: K,
    value: MinecraftCreateServerRequest[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Minecraft Server" : "Add Minecraft Server"}
      panelClassName="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Display Name */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Display Name
          </label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="My Minecraft Server"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm"
          />
        </div>

        {/* Host */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Host
          </label>
          <input
            type="text"
            required
            value={form.host}
            onChange={(e) => set("host", e.target.value)}
            placeholder="play.example.com"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm font-mono"
          />
        </div>

        {/* Port */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Port
          </label>
          <input
            type="number"
            required
            min={1}
            max={65535}
            value={form.port}
            onChange={(e) => set("port", Number(e.target.value))}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm font-mono"
          />
        </div>

        {/* Poll Interval */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Poll Interval
          </label>
          <select
            value={form.poll_interval_minutes}
            onChange={(e) =>
              set(
                "poll_interval_minutes",
                Number(e.target.value) as 5 | 15 | 30 | 60,
              )
            }
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm"
          >
            {POLL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Widget View */}
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Widget View
          </label>
          <select
            value={form.widget_view}
            onChange={(e) =>
              set("widget_view", e.target.value as "compact" | "cards")
            }
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white text-sm"
          >
            {WIDGET_VIEW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center gap-3">
          <input
            id="server-enabled"
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="rounded border-neutral-300 dark:border-neutral-600"
          />
          <label
            htmlFor="server-enabled"
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            Enabled
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Server"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Server row
// ---------------------------------------------------------------------------

interface ServerRowProps {
  server: MinecraftServerEntry;
  onEdit: (server: MinecraftServerEntry) => void;
  onDelete: (id: number) => void;
  onPing: (id: number) => void;
  pinging: boolean;
}

function ServerRow({
  server,
  onEdit,
  onDelete,
  onPing,
  pinging,
}: ServerRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-700">
      {/* Online indicator */}
      <span
        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
          server.is_online ? "bg-green-500" : "bg-red-400"
        }`}
        title={server.is_online ? "Online" : "Offline"}
      />

      {/* Name + address */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
          {server.name}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">
          {server.host}:{server.port}
        </p>
      </div>

      {/* Badges */}
      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
        {server.poll_interval_minutes}m
      </span>
      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
        {server.widget_view}
      </span>

      {/* Actions */}
      <button
        type="button"
        title="Ping server"
        disabled={pinging}
        onClick={() => onPing(server.id)}
        className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
      >
        <SignalIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        title="Edit server"
        onClick={() => onEdit(server)}
        className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      >
        <PencilIcon className="w-4 h-4" />
      </button>
      <button
        type="button"
        title="Delete server"
        onClick={() => onDelete(server.id)}
        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function MinecraftIntegrationSectionImpl({
  data,
  isLoading,
}: {
  data: ReturnType<typeof useMinecraftIntegration>["data"];
  isLoading: boolean;
}) {
  const updateIntegration = useUpdateMinecraftIntegration();
  const { data: serversData, isLoading: serversLoading } =
    useMinecraftServers();
  const createServer = useCreateMinecraftServer();
  const updateServer = useUpdateMinecraftServer();
  const deleteServer = useDeleteMinecraftServer();
  const pingServer = usePingMinecraftServer();

  const [enabled, setEnabled] = useState(Boolean(data?.integration?.enabled));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<
    MinecraftServerEntry | undefined
  >(undefined);

  // Sync enabled state when server data loads
  const [prevData, setPrevData] = useState(data?.integration);
  if (data?.integration !== prevData) {
    setPrevData(data?.integration);
    setEnabled(Boolean(data?.integration?.enabled));
  }

  const servers = serversData?.servers ?? [];
  const isDirty = enabled !== Boolean(data?.integration?.enabled);

  function handleCancel() {
    setEnabled(Boolean(data?.integration?.enabled));
  }

  function handleSave() {
    updateIntegration
      .mutateAsync({ enabled })
      .then(() => toast.success("Minecraft integration saved."))
      .catch(() => toast.error("Failed to save Minecraft integration."));
  }

  function handleOpenAdd() {
    setEditTarget(undefined);
    setDialogOpen(true);
  }

  function handleOpenEdit(server: MinecraftServerEntry) {
    setEditTarget(server);
    setDialogOpen(true);
  }

  function handleDialogClose() {
    setDialogOpen(false);
    setEditTarget(undefined);
  }

  function handleDialogSubmit(values: MinecraftCreateServerRequest) {
    if (editTarget) {
      updateServer
        .mutateAsync({ id: editTarget.id, body: values })
        .then(() => {
          toast.success("Server updated.");
          handleDialogClose();
        })
        .catch(() => toast.error("Failed to update server."));
    } else {
      createServer
        .mutateAsync(values)
        .then(() => {
          toast.success("Server added.");
          handleDialogClose();
        })
        .catch(() => toast.error("Failed to add server."));
    }
  }

  function handleDelete(id: number) {
    if (!confirm("Delete this Minecraft server?")) return;
    deleteServer
      .mutateAsync(id)
      .then(() => toast.success("Server deleted."))
      .catch(() => toast.error("Failed to delete server."));
  }

  function handlePing(id: number) {
    pingServer
      .mutateAsync(id)
      .then(({ server }) => {
        if (server.is_online) {
          toast.success(
            `Online — ${server.online_players ?? 0}/${server.max_players ?? "?"} players · ${server.version ?? "unknown"} · ${server.latency_ms ?? "?"}ms`,
          );
        } else {
          toast.error("Server is offline.");
        }
      })
      .catch(() => toast.error("Ping failed."));
  }

  const dialogPending = createServer.isPending || updateServer.isPending;

  return (
    <>
      <IntegrationSectionCard
        title="Minecraft Servers"
        description="Monitor your Java Edition Minecraft servers"
        logoUrl="https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/minecraft.png"
        enabled={enabled}
        onEnabledChange={setEnabled}
        onCancel={handleCancel}
        onSave={handleSave}
        loading={isLoading}
        saving={updateIntegration.isPending}
        isDirty={isDirty}
      >
        <div className="space-y-3">
          {/* Server list */}
          {serversLoading ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Loading servers…
            </p>
          ) : servers.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              No servers configured yet.
            </p>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => (
                <ServerRow
                  key={server.id}
                  server={server}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete}
                  onPing={handlePing}
                  pinging={pingServer.isPending}
                />
              ))}
            </div>
          )}

          {/* Add server button */}
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-600 text-sm text-neutral-600 dark:text-neutral-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors w-full"
          >
            <PlusIcon className="w-4 h-4" />
            Add Server
          </button>
        </div>
      </IntegrationSectionCard>

      <ServerDialog
        key={editTarget?.id ?? "new"}
        isOpen={dialogOpen}
        onClose={handleDialogClose}
        initial={editTarget}
        onSubmit={handleDialogSubmit}
        isPending={dialogPending}
      />
    </>
  );
}
