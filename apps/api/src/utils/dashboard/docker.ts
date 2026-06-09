import http from "node:http";
import { getIntegrationConfigRecord } from "@hously/api/services/integrationConfigCache";
import { normalizeDockerConfig } from "@hously/api/utils/integrations/normalizers";
import { toRecord, toStringOrNull } from "@hously/shared/utils";
import type {
  DashboardDockerContainer,
  DashboardDockerSummaryResponse,
  DockerContainerState,
} from "@hously/shared/types";
import { buildDisabledDashboardSummary } from "@hously/api/utils/dashboard/disabledSummary";

const DEFAULT_DOCKER_SOCKET_PATH = "/var/run/docker.sock";

interface DockerApiContainer {
  Id?: string;
  Names?: string[];
  Image?: string;
  State?: string;
  Status?: string;
  Created?: number;
  Labels?: Record<string, string>;
}

const buildDockerDisabledSummary = (
  error?: string,
): DashboardDockerSummaryResponse =>
  buildDisabledDashboardSummary(
    {
      socket_path: null,
      endpoint: null,
      compose_project: null,
      summary: {
        total: 0,
        running: 0,
        stopped: 0,
        paused: 0,
        restarting: 0,
        unhealthy: 0,
        other: 0,
      },
      containers: [],
    },
    error,
  );

const normalizeState = (state: unknown): DockerContainerState => {
  switch (state) {
    case "running":
    case "exited":
    case "paused":
    case "restarting":
    case "dead":
    case "created":
    case "removing":
      return state;
    default:
      return "unknown";
  }
};

const dockerSocketRequest = async (
  socketPath: string,
  path: string,
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: "GET",
        socketPath,
        path,
        headers: { Accept: "application/json" },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) {
            reject(
              new Error(
                `Docker request failed with status ${res.statusCode}: ${body}`,
              ),
            );
            return;
          }

          try {
            resolve(body ? JSON.parse(body) : null);
          } catch (error) {
            reject(error);
          }
        });
      },
    );

    req.on("error", reject);
    req.end();
  });

const dockerHttpRequest = async (
  endpoint: string,
  path: string,
): Promise<unknown> => {
  const response = await fetch(new URL(path, endpoint).toString(), {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Docker request failed with status ${response.status}`);
  }

  return response.json();
};

const dockerRequest = async (
  endpoint: string,
  path: string,
): Promise<unknown> => {
  if (/^https?:\/\//i.test(endpoint)) {
    return dockerHttpRequest(endpoint, path);
  }
  return dockerSocketRequest(endpoint, path);
};

const serializeEndpoint = (
  endpoint: string,
): { socket_path: string | null; endpoint: string | null } =>
  /^https?:\/\//i.test(endpoint)
    ? { socket_path: null, endpoint }
    : { socket_path: endpoint, endpoint: null };

const iconNameForContainer = (
  container: Pick<DashboardDockerContainer, "name" | "compose_service">,
  overrides: Record<string, string>,
): string => {
  const candidates = [
    container.compose_service,
    container.name,
    container.name.replace(/^\/+/, ""),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const override = overrides[candidate] ?? overrides[candidate.toLowerCase()];
    if (override) return override;
  }

  return container.compose_service || container.name;
};

const toContainer = (
  raw: DockerApiContainer,
  iconNameOverrides: Record<string, string>,
): DashboardDockerContainer | null => {
  const labels = raw.Labels ?? {};
  const id = typeof raw.Id === "string" ? raw.Id : "";
  const name = raw.Names?.[0]?.replace(/^\/+/, "") || id.slice(0, 12);
  const createdAt =
    typeof raw.Created === "number" && raw.Created > 0
      ? new Date(raw.Created * 1000).toISOString()
      : null;

  if (!id || !name) return null;

  const container = {
    id: id.slice(0, 12),
    name,
    icon_name: name,
    image: raw.Image || "unknown",
    state: normalizeState(raw.State),
    status: raw.Status || "",
    compose_project: labels["com.docker.compose.project"] || null,
    compose_service: labels["com.docker.compose.service"] || null,
    created_at: createdAt,
  };
  return {
    ...container,
    icon_name: iconNameForContainer(container, iconNameOverrides),
  };
};

const isUnhealthy = (status: string): boolean => /\bunhealthy\b/i.test(status);

export const fetchDockerSummary =
  async (): Promise<DashboardDockerSummaryResponse> => {
    const integration = await getIntegrationConfigRecord("docker");

    if (!integration?.enabled) {
      return buildDockerDisabledSummary();
    }

    const config = normalizeDockerConfig(integration.config) ?? {
      socket_path: DEFAULT_DOCKER_SOCKET_PATH,
      endpoint: "",
      compose_project: "",
      icon_name_overrides: {},
    };
    const endpoint = config.endpoint || config.socket_path;

    try {
      const payload = await dockerRequest(endpoint, "/containers/json?all=1");

      if (!Array.isArray(payload)) {
        return {
          ...buildDockerDisabledSummary("Invalid Docker containers payload"),
          enabled: true,
          ...serializeEndpoint(endpoint),
          compose_project: config.compose_project || null,
        };
      }

      const containers = payload
        .map((item) => {
          const record = toRecord(item);
          if (!record) return null;
          const labelsRecord = toRecord(record.Labels);
          const labels =
            labelsRecord == null
              ? {}
              : Object.fromEntries(
                  Object.entries(labelsRecord).map(([key, value]) => [
                    key,
                    toStringOrNull(value) ?? "",
                  ]),
                );

          return toContainer(
            {
              Id: toStringOrNull(record.Id) ?? undefined,
              Names: Array.isArray(record.Names)
                ? record.Names.filter(
                    (name): name is string => typeof name === "string",
                  )
                : [],
              Image: toStringOrNull(record.Image) ?? undefined,
              State: toStringOrNull(record.State) ?? undefined,
              Status: toStringOrNull(record.Status) ?? undefined,
              Created:
                typeof record.Created === "number" ? record.Created : undefined,
              Labels: labels,
            },
            config.icon_name_overrides,
          );
        })
        .filter((container): container is DashboardDockerContainer =>
          Boolean(container),
        )
        .filter(
          (container) =>
            !config.compose_project ||
            container.compose_project === config.compose_project,
        )
        .sort((a, b) => {
          if (a.state !== "running" && b.state === "running") return -1;
          if (a.state === "running" && b.state !== "running") return 1;
          return a.name.localeCompare(b.name);
        });

      const summary = containers.reduce(
        (acc, container) => {
          acc.total += 1;
          if (container.state === "running") acc.running += 1;
          else if (container.state === "exited" || container.state === "dead")
            acc.stopped += 1;
          else if (container.state === "paused") acc.paused += 1;
          else if (container.state === "restarting") acc.restarting += 1;
          else acc.other += 1;

          if (isUnhealthy(container.status)) acc.unhealthy += 1;
          return acc;
        },
        {
          total: 0,
          running: 0,
          stopped: 0,
          paused: 0,
          restarting: 0,
          unhealthy: 0,
          other: 0,
        },
      );

      return {
        enabled: true,
        connected: true,
        updated_at: new Date().toISOString(),
        ...serializeEndpoint(endpoint),
        compose_project: config.compose_project || null,
        summary,
        containers,
      };
    } catch (error) {
      console.error("Error fetching Docker summary:", error);
      return {
        ...buildDockerDisabledSummary("Failed to fetch Docker summary"),
        enabled: true,
        ...serializeEndpoint(endpoint),
        compose_project: config.compose_project || null,
      };
    }
  };
