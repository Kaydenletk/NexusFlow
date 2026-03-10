import { eq, sql } from "drizzle-orm";
import type {
  IntegrationConfig,
  IntegrationProvider,
  IntegrationsResponse,
  ManualSyncResult,
  SyncRun,
  SyncRunsResponse,
} from "@quantified-self/contracts";
import {
  getDb,
  integrationConfigs,
  syncRuns,
} from "@quantified-self/db";

import { AppError } from "../lib/errors.js";
import { runWakaTimeSync } from "./wakatime-service.js";

function maskApiKey(apiKey?: string) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 6) {
    return "*".repeat(apiKey.length);
  }

  return `${apiKey.slice(0, 3)}${"*".repeat(Math.max(apiKey.length - 6, 2))}${apiKey.slice(-3)}`;
}

function toIntegrationConfig(
  row:
    | {
        provider: string;
        enabled: boolean;
        credentialsJson: Record<string, unknown>;
        syncCursor: Date | null;
        lastSyncedAt: Date | null;
        lastError: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined,
): IntegrationConfig {
  const apiKey =
    typeof row?.credentialsJson?.apiKey === "string"
      ? row.credentialsJson.apiKey
      : undefined;
  const fallbackDate = new Date().toISOString();

  return {
    provider: "wakatime",
    enabled: row?.enabled ?? false,
    credentials: {
      apiKeyPreview: maskApiKey(apiKey),
      hasApiKey: Boolean(apiKey),
    },
    syncCursor: row?.syncCursor?.toISOString() ?? null,
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    lastError: row?.lastError ?? null,
    createdAt: row?.createdAt?.toISOString() ?? fallbackDate,
    updatedAt: row?.updatedAt?.toISOString() ?? fallbackDate,
  };
}

export async function getIntegrationConfigs(): Promise<IntegrationsResponse> {
  const db = getDb();
  const rows = await db.select().from(integrationConfigs);
  const wakatime = rows.find((row) => row.provider === "wakatime");

  return {
    items: [toIntegrationConfig(wakatime)],
  };
}

export async function upsertIntegrationConfig(
  provider: IntegrationProvider,
  payload: { enabled: boolean; credentials: { apiKey?: string } },
): Promise<IntegrationConfig> {
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.provider, provider))
    .limit(1);
  const nextApiKey = payload.credentials.apiKey?.trim();
  const existingApiKey =
    typeof existing?.credentialsJson?.apiKey === "string"
      ? existing.credentialsJson.apiKey
      : "";

  if (!nextApiKey && !existingApiKey) {
    throw new AppError(
      400,
      "API_KEY_REQUIRED",
      "An API key is required before this integration can be saved",
    );
  }

  const [row] = await db
    .insert(integrationConfigs)
    .values({
      provider,
      enabled: payload.enabled,
      credentialsJson: {
        apiKey: nextApiKey || existingApiKey,
      },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: integrationConfigs.provider,
      set: {
        enabled: payload.enabled,
        credentialsJson: {
          apiKey: nextApiKey || existingApiKey,
        },
        updatedAt: now,
        lastError: null,
      },
    })
    .returning();

  return toIntegrationConfig(row);
}

export async function deleteIntegrationConfig(provider: IntegrationProvider) {
  const db = getDb();

  await db
    .delete(integrationConfigs)
    .where(eq(integrationConfigs.provider, provider));
}

export async function getSyncRuns(
  provider?: IntegrationProvider,
  limit = 20,
): Promise<SyncRunsResponse> {
  const db = getDb();
  const query = db
    .select()
    .from(syncRuns)
    .orderBy(sql`${syncRuns.createdAt} DESC`)
    .limit(limit);

  const rows = provider
    ? await query.where(eq(syncRuns.provider, provider))
    : await query;

  return {
    items: rows.map(toSyncRun),
  };
}

export async function triggerSync(
  provider: IntegrationProvider,
): Promise<ManualSyncResult> {
  const db = getDb();
  const [config] = await db
    .select()
    .from(integrationConfigs)
    .where(eq(integrationConfigs.provider, provider))
    .limit(1);

  if (!config) {
    throw new AppError(
      404,
      "INTEGRATION_NOT_CONFIGURED",
      `${provider} is not configured`,
    );
  }

  if (!config.enabled) {
    throw new AppError(
      409,
      "INTEGRATION_DISABLED",
      `${provider} is configured but disabled`,
    );
  }

  switch (provider) {
    case "wakatime":
      return runWakaTimeSync(config);
  }
}

export function toSyncRun(row: {
  id: string;
  provider: string;
  status: string;
  importBatchId: string | null;
  rowsFetched: number;
  rowsInserted: number;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
}): SyncRun {
  return {
    id: row.id,
    provider: row.provider as IntegrationProvider,
    status: row.status as SyncRun["status"],
    importBatchId: row.importBatchId,
    rowsFetched: row.rowsFetched,
    rowsInserted: row.rowsInserted,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
