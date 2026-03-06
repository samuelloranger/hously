const GITEA_TOKEN = process.env.GITEA_API_TOKEN || '';
const GITEA_BASE = process.env.GITEA_URL || 'https://git.example.com';
const GITEA_OWNER = process.env.GITEA_OWNER || 'samuelloranger';
const GITEA_REPO = process.env.GITEA_REPO || 'hously';

function apiUrl(path: string): string {
  return `${GITEA_BASE}/api/v1/repos/${GITEA_OWNER}/${GITEA_REPO}${path}`;
}

async function giteaFetch<T>(path: string): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: {
      Authorization: `token ${GITEA_TOKEN}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Gitea API ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function giteaFetchText(path: string): Promise<string> {
  const res = await fetch(apiUrl(path), {
    headers: {
      Authorization: `token ${GITEA_TOKEN}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Gitea API ${res.status}: ${res.statusText}`);
  }
  return res.text();
}

export interface GiteaRunSummary {
  id: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  event: string;
  created_at: string;
  updated_at: string;
  duration_seconds: number | null;
}

interface GiteaRunRaw {
  id: number;
  display_title: string;
  status: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  event: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  actor: { login: string; avatar_url: string };
}

interface GiteaJobRaw {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface GiteaStepSummary {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure';
}

export interface GiteaJobSummary {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  steps: GiteaStepSummary[];
}

export interface GiteaBuildStatus {
  enabled: boolean;
  connected: boolean;
  building: boolean;
  run: GiteaRunSummary | null;
  jobs: GiteaJobSummary[] | null;
  logs: string | null;
  error?: string;
}

// Workflow steps and their log markers (order matters)
const WORKFLOW_STEPS: { name: string; marker: string }[] = [
  { name: 'Signal build', marker: '⭐ Run Main Signal' },
  { name: 'Checkout', marker: 'Syncing repository' },
  { name: 'Build images', marker: 'load build definition from Dockerfile' },
  { name: 'Restart containers', marker: 'Container hously-web Starting' },
];

function parseStepsFromLogs(logText: string, jobCompleted: boolean): GiteaStepSummary[] {
  const steps: GiteaStepSummary[] = WORKFLOW_STEPS.map(s => ({
    name: s.name,
    status: 'pending' as const,
  }));

  if (jobCompleted) {
    return steps.map(s => ({ ...s, status: 'success' as const }));
  }

  let lastMatchedIndex = -1;
  for (let i = 0; i < WORKFLOW_STEPS.length; i++) {
    if (logText.includes(WORKFLOW_STEPS[i].marker)) {
      lastMatchedIndex = i;
    }
  }

  for (let i = 0; i < steps.length; i++) {
    if (i < lastMatchedIndex) {
      steps[i].status = 'success';
    } else if (i === lastMatchedIndex) {
      steps[i].status = 'running';
    }
  }

  return steps;
}

// --- Build signal state ---
// The workflow calls /api/dashboard/gitea/builds/signal to activate polling.
// Polling stays active until the build completes, then goes idle.

let buildActive = false;
let lastSignalAt = 0;
const SIGNAL_TTL_MS = 10 * 60 * 1000; // auto-expire after 10 min in case we miss completion

export function signalBuildStarted() {
  buildActive = true;
  lastSignalAt = Date.now();
}

export function isBuildActive(): boolean {
  if (!buildActive) return false;
  // Auto-expire stale signals
  if (Date.now() - lastSignalAt > SIGNAL_TTL_MS) {
    buildActive = false;
    return false;
  }
  return true;
}

function markBuildCompleted() {
  buildActive = false;
}


/** Gitea returns "1970-01-01T00:00:00Z" instead of null for unset timestamps */
function sanitizeTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  if (new Date(ts).getTime() <= 0) return null;
  return ts;
}

function computeDuration(started: string | null, completed: string | null): number | null {
  started = sanitizeTimestamp(started);
  completed = sanitizeTimestamp(completed);
  if (!started) return null;
  const start = new Date(started).getTime();
  const end = completed ? new Date(completed).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 1000));
}

export async function fetchGiteaBuildStatus(includeLogs = false): Promise<GiteaBuildStatus> {
  if (!GITEA_TOKEN) {
    return { enabled: false, connected: false, building: false, avg_duration_seconds: null, run: null, jobs: null, logs: null };
  }

  try {
    const runsData = await giteaFetch<{ workflow_runs: GiteaRunRaw[] }>('/actions/runs?limit=1');
    const latestRun = runsData.workflow_runs?.[0];
    if (!latestRun) {
      return { enabled: true, connected: true, building: false, avg_duration_seconds: null, run: null, jobs: null, logs: null };
    }

    const isRunning = ['running', 'in_progress', 'waiting', 'queued', 'pending'].includes(latestRun.status);

    const run: GiteaRunSummary = {
      id: latestRun.id,
      display_title: latestRun.display_title,
      status: latestRun.status,
      conclusion: latestRun.conclusion ?? null,
      head_branch: latestRun.head_branch,
      head_sha: latestRun.head_sha,
      event: latestRun.event,
      created_at: latestRun.created_at,
      updated_at: latestRun.updated_at,
      duration_seconds: computeDuration(sanitizeTimestamp(latestRun.started_at) ?? latestRun.created_at, latestRun.completed_at),
    };

    const jobsData = await giteaFetch<{ jobs: GiteaJobRaw[] }>(`/actions/runs/${latestRun.id}/jobs`);
    const jobCompleted = !isRunning;
    const jobs: GiteaJobSummary[] = (jobsData.jobs || []).map(j => ({
      id: j.id,
      name: j.name,
      status: j.status,
      conclusion: j.conclusion,
      started_at: sanitizeTimestamp(j.started_at),
      completed_at: sanitizeTimestamp(j.completed_at),
      duration_seconds: computeDuration(j.started_at, j.completed_at),
      steps: [],
    }));

    // Fetch logs when building (for step progress) or when explicitly requested
    let logs: string | null = null;
    if ((isRunning || includeLogs) && jobs.length > 0) {
      try {
        const rawLogs = await giteaFetchText(`/actions/jobs/${jobs[0].id}/logs`);
        jobs[0].steps = parseStepsFromLogs(rawLogs, jobCompleted);
        if (includeLogs) {
          const lines = rawLogs.split('\n');
          logs = lines.slice(-100).join('\n');
        }
      } catch {
        // Logs may not be available yet — use empty steps
      }
    } else if (jobCompleted && jobs.length > 0) {
      // Job completed but we didn't fetch logs — mark all steps done
      jobs[0].steps = WORKFLOW_STEPS.map(s => ({ name: s.name, status: 'success' as const }));
    }

    // If the build was active but just completed, mark it done
    if (buildActive && !isRunning) {
      markBuildCompleted();
    }

    return { enabled: true, connected: true, building: isRunning, run, jobs, logs };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      building: false,
           run: null,
      jobs: null,
      logs: null,
      error: error instanceof Error ? error.message : 'Failed to fetch Gitea build status',
    };
  }
}

