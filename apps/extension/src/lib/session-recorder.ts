import {
  categorizeUrl,
  formatLocalDate,
  getBurnoutAssessment,
  getDailyFocusMetrics,
  normalizeTrackableUrl,
  type BurnoutAssessment,
  type FocusSession,
} from "@quantified-self/focus-core";

import type { FocusSettings } from "./focus-db.js";

const MIN_SESSION_DURATION_SECONDS = 15;
const LOOKBACK_DAYS = 14;

type ActiveSession = {
  tabId: number;
  windowId: number | null;
  origin: string;
  path: string;
  hostname: string;
  category: FocusSession["category"];
  intent: FocusSession["intent"];
  startedAt: string;
};

export type TrackableTab = {
  id?: number;
  windowId?: number | null;
  url?: string | null;
};

export type FocusRecorderStore = {
  getSettings: () => Promise<FocusSettings>;
  saveSettings: (settings: FocusSettings) => Promise<FocusSettings>;
  saveSession: (session: FocusSession) => Promise<void>;
  listRecentSessions: (sinceIso: string) => Promise<FocusSession[]>;
};

export type FocusNotifier = {
  notify: (assessment: BurnoutAssessment) => Promise<void> | void;
};

function getLookbackStart(now: Date) {
  const start = new Date(now);
  start.setDate(start.getDate() - LOOKBACK_DAYS);
  return start.toISOString();
}

function createSessionFromActive(active: ActiveSession, endedAt: Date): FocusSession | null {
  const durationSeconds = Math.round(
    (endedAt.getTime() - new Date(active.startedAt).getTime()) / 1000,
  );

  if (durationSeconds < MIN_SESSION_DURATION_SECONDS) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    origin: active.origin,
    path: active.path,
    hostname: active.hostname,
    category: active.category,
    intent: active.intent,
    startTime: active.startedAt,
    endTime: endedAt.toISOString(),
    durationSeconds,
  };
}

function toActiveSession(tab: TrackableTab, startedAt: Date): ActiveSession | null {
  if (typeof tab.id !== "number" || !tab.url) {
    return null;
  }

  const normalized = normalizeTrackableUrl(tab.url);

  if (!normalized) {
    return null;
  }

  const categorization = categorizeUrl(normalized);

  return {
    tabId: tab.id,
    windowId: tab.windowId ?? null,
    ...normalized,
    category: categorization.category,
    intent: categorization.intent,
    startedAt: startedAt.toISOString(),
  };
}

export class FocusSessionRecorder {
  private active: ActiveSession | null = null;

  constructor(
    private readonly store: FocusRecorderStore,
    private readonly notifier: FocusNotifier,
  ) {}

  getActiveSession() {
    return this.active;
  }

  async syncActiveTab(tab: TrackableTab | null, at = new Date()) {
    const nextActive = tab ? toActiveSession(tab, at) : null;

    if (!nextActive) {
      await this.clearActive(at);
      return;
    }

    if (
      this.active &&
      this.active.tabId === nextActive.tabId &&
      this.active.origin === nextActive.origin &&
      this.active.path === nextActive.path
    ) {
      return;
    }

    await this.clearActive(at);
    this.active = nextActive;
  }

  async handleTabRemoved(tabId: number, at = new Date()) {
    if (this.active?.tabId !== tabId) {
      return;
    }

    await this.clearActive(at);
  }

  async handleWindowBlur(at = new Date()) {
    await this.clearActive(at);
  }

  async heartbeat(resolveActiveTab: () => Promise<TrackableTab | null>, at = new Date()) {
    const tab = await resolveActiveTab();
    await this.syncActiveTab(tab, at);
  }

  private async clearActive(at: Date) {
    if (!this.active) {
      return;
    }

    const finalized = createSessionFromActive(this.active, at);
    this.active = null;

    if (!finalized) {
      return;
    }

    await this.store.saveSession(finalized);
    await this.evaluateBurnout(at);
  }

  private async evaluateBurnout(referenceTime: Date) {
    const recentSessions = await this.store.listRecentSessions(
      getLookbackStart(referenceTime),
    );
    const metrics = getDailyFocusMetrics(recentSessions);
    const assessment = getBurnoutAssessment(metrics);
    const settings = await this.store.getSettings();
    const today = formatLocalDate(referenceTime);
    let nextSettings: FocusSettings = {
      ...settings,
      lastBurnoutLevel: assessment.level,
    };

    if (
      settings.notificationsEnabled &&
      (assessment.level === "warning" || assessment.level === "critical") &&
      settings.lastBurnoutLevel !== assessment.level &&
      settings.lastNotificationDate !== today
    ) {
      await this.notifier.notify(assessment);
      nextSettings = {
        ...nextSettings,
        lastNotificationDate: today,
      };
    }

    await this.store.saveSettings(nextSettings);
  }
}

export { MIN_SESSION_DURATION_SECONDS };
