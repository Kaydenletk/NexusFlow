import {
  applyPrivacyPolicy,
  categorizeUrl,
  formatLocalDate,
  getEarlyBurnoutWarning,
  normalizeTrackableUrl,
  type BurnoutAssessment,
  type FocusSession,
} from "@nexusflow/focus-core";

import type { FocusSettings } from "./focus-db.js";

const MIN_SESSION_DURATION_SECONDS = 15;
const LOOKBACK_DAYS = 14;

type ActiveSession = {
  tabId: number;
  windowId: number | null;
  origin: string;
  path: string;
  hostname: string;
  documentTitle: string | null;
  category: FocusSession["category"];
  intent: FocusSession["intent"];
  eventReason: FocusSession["eventReason"];
  isPathMasked: boolean;
  startedAt: string;
};

export type TrackableTab = {
  id?: number;
  windowId?: number | null;
  url?: string | null;
  title?: string | null;
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

export type FocusSyncer = {
  syncPending: () => Promise<void>;
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
    documentTitle: active.documentTitle,
    tabId: active.tabId,
    windowId: active.windowId,
    category: active.category,
    intent: active.intent,
    eventReason: active.eventReason,
    isPathMasked: active.isPathMasked,
    startTime: active.startedAt,
    endTime: endedAt.toISOString(),
    durationSeconds,
  };
}

function toActiveSession(
  tab: TrackableTab,
  startedAt: Date,
  reason: NonNullable<FocusSession["eventReason"]>,
): ActiveSession | null {
  if (typeof tab.id !== "number" || !tab.url) {
    return null;
  }

  const normalized = normalizeTrackableUrl(tab.url);

  if (!normalized) {
    return null;
  }

  const categorization = categorizeUrl(normalized);
  const privacy = applyPrivacyPolicy(normalized, categorization.category);

  return {
    tabId: tab.id,
    windowId: tab.windowId ?? null,
    ...privacy,
    documentTitle: privacy.isPathMasked ? null : tab.title ?? null,
    category: categorization.category,
    intent: categorization.intent,
    eventReason: reason,
    startedAt: startedAt.toISOString(),
  };
}

export class FocusSessionRecorder {
  private active: ActiveSession | null = null;

  constructor(
    private readonly store: FocusRecorderStore,
    private readonly notifier: FocusNotifier,
    private readonly syncer?: FocusSyncer,
  ) {}

  getActiveSession() {
    return this.active;
  }

  async syncActiveTab(
    tab: TrackableTab | null,
    at = new Date(),
    reason: NonNullable<FocusSession["eventReason"]> = "heartbeat",
  ) {
    const nextActive = tab ? toActiveSession(tab, at, reason) : null;

    if (!nextActive) {
      await this.clearActive(at, reason);
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

    await this.clearActive(at, reason);
    this.active = nextActive;
  }

  async handleTabRemoved(tabId: number, at = new Date()) {
    if (this.active?.tabId !== tabId) {
      return;
    }

    await this.clearActive(at, "removed");
  }

  async handleWindowBlur(at = new Date()) {
    await this.clearActive(at, "window_blur");
  }

  async heartbeat(resolveActiveTab: () => Promise<TrackableTab | null>, at = new Date()) {
    const tab = await resolveActiveTab();
    await this.syncActiveTab(tab, at, "heartbeat");
  }

  private async clearActive(
    at: Date,
    reason: NonNullable<FocusSession["eventReason"]> = "heartbeat",
  ) {
    if (!this.active) {
      return;
    }

    const finalized = createSessionFromActive(
      {
        ...this.active,
        eventReason: reason,
      },
      at,
    );
    this.active = null;

    if (!finalized) {
      return;
    }

    await this.store.saveSession(finalized);
    await this.evaluateBurnout(at);
    await this.syncer?.syncPending();
  }

  private async evaluateBurnout(referenceTime: Date) {
    const recentSessions = await this.store.listRecentSessions(
      getLookbackStart(referenceTime),
    );
    const assessment = getEarlyBurnoutWarning(recentSessions);
    const settings = await this.store.getSettings();
    const today = formatLocalDate(referenceTime);
    let nextSettings: FocusSettings = {
      ...settings,
      lastBurnoutLevel: assessment.level,
    };

    if (
      settings.notificationsEnabled &&
      (assessment.level === "Warning" || assessment.level === "Critical") &&
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
