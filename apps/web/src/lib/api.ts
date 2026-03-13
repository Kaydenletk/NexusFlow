import type {
  ChromeCanvasCourseReport,
  ChromeCategoriesResponse,
  ChromeContextSwitchingResponse,
  ChromeHealthResponse,
  ChromeHostsResponse,
  ChromeOverviewResponse,
  ChromeSessionsResponse,
  ChromeSyncStatusResponse,
  ChromeTimelineResponse,
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

export function fetchChromeHealth() {
  return getJson<ChromeHealthResponse>("/api/chrome/health");
}

export function fetchChromeOverview(range: "1d" | "7d" | "30d") {
  return getJson<ChromeOverviewResponse>(`/api/chrome/overview?range=${range}`);
}

export function fetchChromeSessions(range: "1d" | "7d" | "30d", limit = 100) {
  return getJson<ChromeSessionsResponse>(
    `/api/chrome/sessions?range=${range}&limit=${limit}`,
  );
}

export function fetchChromeTimeline(date: string) {
  return getJson<ChromeTimelineResponse>(
    `/api/chrome/timeline?date=${encodeURIComponent(date)}`,
  );
}

export function fetchChromeHosts(range: "1d" | "7d" | "30d") {
  return getJson<ChromeHostsResponse>(`/api/chrome/hosts?range=${range}`);
}

export function fetchChromeCategories(range: "1d" | "7d" | "30d") {
  return getJson<ChromeCategoriesResponse>(`/api/chrome/categories?range=${range}`);
}

export function fetchChromeContextSwitching(range: "1d" | "7d" | "30d") {
  return getJson<ChromeContextSwitchingResponse>(
    `/api/chrome/context-switching?range=${range}`,
  );
}

export function fetchChromeCanvasReport(range: "1d" | "7d" | "30d") {
  return getJson<ChromeCanvasCourseReport>(
    `/api/chrome/canvas-report?range=${range}`,
  );
}

export function fetchChromeSyncStatus() {
  return getJson<ChromeSyncStatusResponse>("/api/chrome/sync-runs");
}
