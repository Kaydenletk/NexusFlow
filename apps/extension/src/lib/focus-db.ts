import Dexie, { type Table } from "dexie";
import {
  createFocusSnapshot,
  type BurnoutLevel,
  type FocusSession,
} from "@quantified-self/focus-core";

export type FocusSettings = {
  id: "app";
  notificationsEnabled: boolean;
  exportVersion: 1;
  timezone: string;
  lastBurnoutLevel: BurnoutLevel | null;
  lastNotificationDate: string | null;
};

const defaultSettings: FocusSettings = {
  id: "app",
  notificationsEnabled: true,
  exportVersion: 1,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  lastBurnoutLevel: null,
  lastNotificationDate: null,
};

export class FocusExtensionDatabase extends Dexie {
  tabSessions!: Table<FocusSession, string>;
  settings!: Table<FocusSettings, string>;

  constructor() {
    super("nexusflow-focus-extension");

    this.version(1).stores({
      tabSessions: "id,startTime,endTime,hostname,category,intent",
      settings: "id",
    });
  }
}

export const extensionDb = new FocusExtensionDatabase();

export async function getSettings() {
  const existing = await extensionDb.settings.get("app");

  if (existing) {
    return existing;
  }

  await extensionDb.settings.put(defaultSettings);

  return defaultSettings;
}

export async function saveSettings(settings: FocusSettings) {
  await extensionDb.settings.put(settings);

  return settings;
}

export async function saveSession(session: FocusSession) {
  await extensionDb.tabSessions.put(session);
}

export async function listSessions() {
  return extensionDb.tabSessions.orderBy("startTime").toArray();
}

export async function listRecentSessions(sinceIso: string) {
  return extensionDb.tabSessions
    .where("startTime")
    .aboveOrEqual(sinceIso)
    .sortBy("startTime");
}

export async function exportFocusSnapshot() {
  const [sessions, settings] = await Promise.all([listSessions(), getSettings()]);

  return createFocusSnapshot(sessions, {
    timezone: settings.timezone,
  });
}
