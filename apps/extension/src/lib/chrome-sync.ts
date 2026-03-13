import type {
  ChromeBulkIngestResponse,
  ChromeHealthResponse,
} from "@quantified-self/contracts";

import type { FocusSettings } from "./focus-db.js";

export type ChromeConnectionState = "reachable" | "unreachable" | "unhealthy";

export type ChromeHealthProbeResult = {
  state: ChromeConnectionState;
  baseUrl: string;
  health: ChromeHealthResponse | null;
  message: string;
};

export type ChromeSyncStore = {
  getSettings: () => Promise<FocusSettings>;
  saveSettings: (settings: FocusSettings) => Promise<FocusSettings>;
  listUnsyncedSessions: (limit?: number) => Promise<
    Array<{
      id: string;
      tabId?: number | null;
      windowId?: number | null;
      origin: string;
      path: string;
      hostname: string;
      documentTitle?: string | null;
      category: string;
      intent: "productive" | "neutral" | "distracting";
      eventReason?: "activated" | "updated" | "window_blur" | "removed" | "heartbeat";
      isPathMasked?: boolean;
      startTime: string;
      endTime: string;
      durationSeconds: number;
    }>
  >;
  markSessionsSynced: (ids: string[], syncedAt: string) => Promise<void>;
};

type ChromeSyncResult = {
  run?: ChromeBulkIngestResponse["run"];
  receivedCount: number;
  insertedCount: number;
  connection: ChromeHealthProbeResult;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function buildFallbackBaseUrls(value: string) {
  const normalized = normalizeBaseUrl(value);
  const candidates = [normalized];

  try {
    const parsed = new URL(normalized);

    if (parsed.hostname === "localhost") {
      parsed.hostname = "127.0.0.1";
      candidates.push(parsed.toString().replace(/\/+$/, ""));
    }
  } catch {
    return candidates;
  }

  return [...new Set(candidates)];
}

function getConnectionErrorMessage(baseUrl: string) {
  return `Cannot reach local API at ${baseUrl}. Start docker compose, check the API URL, then reload the extension.`;
}

export async function probeChromeApi(
  apiBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ChromeHealthProbeResult> {
  const candidates = buildFallbackBaseUrls(apiBaseUrl);
  let lastNetworkFailure: string | null = null;

  for (const candidate of candidates) {
    try {
      const response = await fetchImpl(`${candidate}/api/chrome/health`, {
        method: "GET",
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        return {
          state: "unhealthy",
          baseUrl: candidate,
          health: null,
          message: `API reachable, health probe returned status ${response.status}.`,
        };
      }

      const health = (await response.json()) as ChromeHealthResponse;

      if (health.status !== "ok" || health.database !== "ok") {
        return {
          state: "unhealthy",
          baseUrl: candidate,
          health,
          message: "API reachable, but the backend is not healthy yet.",
        };
      }

      return {
        state: "reachable",
        baseUrl: candidate,
        health,
        message: `Connected to ${candidate}.`,
      };
    } catch (error) {
      lastNetworkFailure =
        error instanceof Error ? error.message : "Network request failed";
    }
  }

  return {
    state: "unreachable",
    baseUrl: candidates[0] ?? normalizeBaseUrl(apiBaseUrl),
    health: null,
    message: lastNetworkFailure
      ? `${getConnectionErrorMessage(candidates[0] ?? apiBaseUrl)} ${lastNetworkFailure}`
      : getConnectionErrorMessage(candidates[0] ?? apiBaseUrl),
  };
}

export async function syncChromeSessions(
  store: ChromeSyncStore,
  fetchImpl: typeof fetch = fetch,
): Promise<ChromeSyncResult> {
  const settings = await store.getSettings();

  if (!settings.syncEnabled) {
    return {
      receivedCount: 0,
      insertedCount: 0,
      connection: {
        state: "unhealthy",
        baseUrl: normalizeBaseUrl(settings.apiBaseUrl),
        health: null,
        message: "Localhost Chrome sync is disabled.",
      },
    };
  }

  const connection = await probeChromeApi(settings.apiBaseUrl, fetchImpl);

  if (connection.state === "unreachable") {
    await store.saveSettings({
      ...settings,
      lastChromeSyncError: connection.message,
    });
    throw new Error(connection.message);
  }

  if (connection.state === "unhealthy") {
    await store.saveSettings({
      ...settings,
      lastChromeSyncError: connection.message,
    });
    throw new Error(connection.message);
  }

  if (connection.baseUrl !== normalizeBaseUrl(settings.apiBaseUrl)) {
    await store.saveSettings({
      ...settings,
      apiBaseUrl: connection.baseUrl,
      lastChromeSyncError: null,
    });
  }

  const sessions = await store.listUnsyncedSessions(200);

  if (sessions.length === 0) {
    await store.saveSettings({
      ...settings,
      apiBaseUrl: connection.baseUrl,
      lastChromeSyncError: null,
    });

    return {
      receivedCount: 0,
      insertedCount: 0,
      connection,
    };
  }

  try {
    const response = await fetchImpl(`${connection.baseUrl}/api/chrome/sessions/bulk`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sessions: sessions.map((session) => ({
          ...session,
          eventReason: session.eventReason ?? "heartbeat",
          isPathMasked: Boolean(session.isPathMasked),
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`API reachable, sync failed with status ${response.status}.`);
    }

    const result = (await response.json()) as ChromeBulkIngestResponse;
    const syncedAt = result.run.finishedAt ?? new Date().toISOString();

    await store.markSessionsSynced(
      sessions.map((session) => session.id),
      syncedAt,
    );
    await store.saveSettings({
      ...settings,
      apiBaseUrl: connection.baseUrl,
      lastChromeSyncAt: syncedAt,
      lastChromeSyncError: null,
    });

    return {
      ...result,
      connection,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Chrome sync failed";

    await store.saveSettings({
      ...settings,
      apiBaseUrl: connection.baseUrl,
      lastChromeSyncError: message,
    });

    throw new Error(message);
  }
}
