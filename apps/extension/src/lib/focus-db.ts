import Dexie, { type Table } from "dexie";
import {
  type BurnoutLevel,
  type FocusSession,
  type FocusSnapshotV1,
} from "@nexusflow/focus-core";

import { buildFocusSnapshot } from "./snapshot.js";

export type FocusSettings = {
  id: "app";
  notificationsEnabled: boolean;
  exportVersion: 1;
  timezone: string;
  syncEnabled: boolean;
  apiBaseUrl: string;
  lastChromeSyncAt: string | null;
  lastChromeSyncError: string | null;
  lastBurnoutLevel: BurnoutLevel | null;
  lastNotificationDate: string | null;
};

export type StoredFocusSession = FocusSession & {
  syncedAt?: string | null;
};

const defaultSettings: FocusSettings = {
  id: "app",
  notificationsEnabled: true,
  exportVersion: 1,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  syncEnabled: true,
  apiBaseUrl: "http://localhost:3001",
  lastChromeSyncAt: null,
  lastChromeSyncError: null,
  lastBurnoutLevel: null,
  lastNotificationDate: null,
};

export class FocusExtensionDatabase extends Dexie {
  tabSessions!: Table<StoredFocusSession, string>;
  settings!: Table<FocusSettings, string>;

  constructor() {
    super("nexusflow-focus-extension");

    this.version(1).stores({
      tabSessions: "id,startTime,endTime,hostname,category,intent",
      settings: "id",
    });
    this.version(2).stores({
      tabSessions: "id,startTime,endTime,hostname,category,intent,syncedAt",
      settings: "id",
    });
  }
}

export const extensionDb = new FocusExtensionDatabase();

export async function getSettings() {
  const existing = await extensionDb.settings.get("app");

  if (existing) {
    // Merge with defaults so older records missing new fields still work.
    return { ...defaultSettings, ...existing };
  }

  await extensionDb.settings.put(defaultSettings);

  return defaultSettings;
}

export async function saveSettings(settings: FocusSettings) {
  await extensionDb.settings.put(settings);

  return settings;
}

export async function saveSession(session: FocusSession) {
  await extensionDb.tabSessions.put({
    ...session,
    syncedAt: null,
  });
}

export async function listSessions() {
  return extensionDb.tabSessions.orderBy("startTime").toArray();
}

export async function listSessionsForDate(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  // Include sessions that started shortly before midnight but overlap today.
  const queryStart = new Date(start);
  queryStart.setDate(queryStart.getDate() - 1);

  const sessions = await extensionDb.tabSessions
    .where("startTime")
    .between(queryStart.toISOString(), end.toISOString(), true, false)
    .toArray();

  return sessions
    .filter((session) => new Date(session.endTime).getTime() > start.getTime())
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

export async function listRecentSessions(sinceIso: string) {
  return extensionDb.tabSessions
    .where("startTime")
    .aboveOrEqual(sinceIso)
    .sortBy("startTime");
}

export async function listUnsyncedSessions(limit = 200) {
  const rows = await extensionDb.tabSessions
    .filter((session) => !session.syncedAt)
    .limit(limit)
    .toArray();

  return rows.sort((left, right) => left.startTime.localeCompare(right.startTime));
}

export async function markSessionsSynced(ids: string[], syncedAt: string) {
  await extensionDb.transaction("rw", extensionDb.tabSessions, async () => {
    for (const id of ids) {
      const existing = await extensionDb.tabSessions.get(id);

      if (!existing) {
        continue;
      }

      await extensionDb.tabSessions.put({
        ...existing,
        syncedAt,
      });
    }
  });
}

export async function exportFocusSnapshot(): Promise<FocusSnapshotV1> {
  const [sessions, settings] = await Promise.all([listSessions(), getSettings()]);

  return buildFocusSnapshot(sessions, settings.timezone);
}
