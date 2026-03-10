import type {
  CodingStreaksResponse,
  CodingActivitySeriesResponse,
  Goal,
  GoalsProgressResponse,
  GoalsResponse,
  HealthMetricSeriesResponse,
  HeatmapResponse,
  IntegrationConfig,
  IntegrationsResponse,
  ImportsResponse,
  ListeningHistorySeriesResponse,
  RecentResponse,
  SummaryResponse,
  SyncRunsResponse,
} from "@quantified-self/contracts";

function getBaseUrl() {
  return (
    process.env.INTERNAL_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3001"
  );
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`);
  }

  return (await response.json()) as T;
}

export function fetchSummary(range: string) {
  return getJson<SummaryResponse>(`/api/summary?range=${range}`);
}

export function fetchCodingActivity(range: string, bucket: string) {
  return getJson<CodingActivitySeriesResponse>(
    `/api/coding-activity?range=${range}&bucket=${bucket}`,
  );
}

export function fetchListeningHistory(range: string, bucket: string) {
  return getJson<ListeningHistorySeriesResponse>(
    `/api/listening-history?range=${range}&bucket=${bucket}`,
  );
}

export function fetchHealthMetrics(
  range: string,
  bucket: string,
  metricType: string,
) {
  return getJson<HealthMetricSeriesResponse>(
    `/api/health-metrics?range=${range}&bucket=${bucket}&metricType=${encodeURIComponent(metricType)}`,
  );
}

export function fetchRecent(dataset: string, limit = 10) {
  return getJson<RecentResponse>(`/api/recent?dataset=${dataset}&limit=${limit}`);
}

export function fetchImports(limit = 20) {
  return getJson<ImportsResponse>(`/api/imports?limit=${limit}`);
}

export function fetchIntegrations() {
  return getJson<IntegrationsResponse>("/api/integrations");
}

export function fetchSyncRuns(limit = 20) {
  return getJson<SyncRunsResponse>(`/api/sync-runs?limit=${limit}`);
}

export function fetchGoals() {
  return getJson<GoalsResponse>("/api/goals");
}

export function fetchGoalProgress(dataset?: Goal["dataset"]) {
  const query = dataset ? `?dataset=${dataset}` : "";
  return getJson<GoalsProgressResponse>(`/api/goals/progress${query}`);
}

export function fetchHeatmap() {
  return getJson<HeatmapResponse>("/api/visualizations/heatmap?range=365d");
}

export function fetchStreaks() {
  return getJson<CodingStreaksResponse>("/api/visualizations/streaks");
}

export function getClientApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
}
